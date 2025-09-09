using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;
using TraceNet.DTOs;
using AutoMapper;
using System.Globalization;

namespace TraceNet.Services
{
    public class DeviceService
    {
        private readonly TraceNetDbContext _context;
        private readonly IMapper _mapper;
        private readonly ILogger<DeviceService> _logger;
        private readonly PingService _pingService;

        public DeviceService(
            TraceNetDbContext context,
            IMapper mapper,
            ILogger<DeviceService> logger,
            PingService pingService)
        {
            _context = context;
            _mapper = mapper;
            _logger = logger;
            _pingService = pingService;
        }

        /// <summary>
        /// Retrieve all devices including ports.
        ///
        /// Performance optimizations:
        /// - AsSplitQuery(): split complex Include graphs to avoid N+1 issues.
        /// - AsNoTracking(): disable change tracking for read-only queries.
        ///
        /// Include graph: Device → Ports → Connection → ToPort → ToDevice
        /// </summary>
        public async Task<List<DeviceDto>> GetAllAsync()
        {
            // Composite Include query — fetch full network topology
            var devices = await _context.Devices
                .Include(d => d.Rack)
                .Include(d => d.Ports)                    // all ports of the device
                    .ThenInclude(p => p.Connection)       // connection of each port
                        .ThenInclude(c => c.ToPort)       // destination port
                            .ThenInclude(p => p.Device)   // destination device
                .AsSplitQuery()    // split complex relationships into multiple queries
                .AsNoTracking()    // read-only
                .ToListAsync();

            // Connection sanity check loop for debugging (kept as comment)
            foreach (var device in devices)
            {
                foreach (var port in device.Ports)
                {
                    if (port.Connection != null)
                    {
                        // Debug log:
                        // Console.WriteLine($"[DEBUG] Port {port.PortId} → ToPort {port.Connection.ToPort?.PortId} / ToDevice {port.Connection.ToPort?.Device?.DeviceId}");
                    }
                }
            }

            // Entity → DTO conversion (AutoMapper)
            return _mapper.Map<List<DeviceDto>>(devices);
        }

        /// <summary>
        /// Create a new device and auto-generate ports.
        /// </summary>
        public async Task<Device?> CreateAsync(Device device)
        {
            if (string.IsNullOrWhiteSpace(device.Name) || device.PortCount <= 0)
                return null;

            // Initialize Ports list
            if (device.Ports == null || device.Ports.Count == 0)
            {
                device.Ports = new List<Port>(); // create if null

                for (int i = 0; i < device.PortCount; i++)
                {
                    device.Ports.Add(new Port { Name = (i + 1).ToString() });
                }
            }

            // Switch-specific rack handling
            if (!string.Equals(device.Type, "Switch", StringComparison.OrdinalIgnoreCase))
            {
                device.RackId = null; // must be null for non-switch devices
            }
            else
            {
                // Rack is optional for switches; if provided, verify existence
                if (device.RackId.HasValue)
                {
                    var exists = await _context.Racks.AnyAsync(r => r.RackId == device.RackId.Value);
                    if (!exists) device.RackId = null; // ignore invalid value
                }
            }

            _context.Devices.Add(device);
            await _context.SaveChangesAsync();

            return await _context.Devices
                .Include(d => d.Ports)
                .FirstOrDefaultAsync(d => d.DeviceId == device.DeviceId);
        }

        /// <summary>
        /// Delete a device and its related ports, connections, and cables.
        /// </summary>
        public async Task<bool> DeleteAsync(int deviceId)
        {
            var device = await _context.Devices
                .Include(d => d.Ports)
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

            if (device == null) return false;

            // All port IDs on this device
            var portIds = device.Ports.Select(p => p.PortId).ToList();

            // Collect all cable connections where this device's ports appear as FromPort or ToPort
            var connectionsToDelete = await _context.CableConnections
                .Where(cc => portIds.Contains(cc.FromPortId) || portIds.Contains(cc.ToPortId))
                .ToListAsync();

            var cableIds = connectionsToDelete
                .Select(c => c.CableId)
                .Distinct()
                .ToList();

            // 1) remove connections
            _context.CableConnections.RemoveRange(connectionsToDelete);

            // 2) remove cables (after removing connections)
            var cablesToDelete = await _context.Cables
                .Where(c => cableIds.Contains(c.CableId))
                .ToListAsync();
            _context.Cables.RemoveRange(cablesToDelete);

            // 3) remove ports
            _context.Ports.RemoveRange(device.Ports);

            // 4) remove device
            _context.Devices.Remove(device);

            await _context.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// Delete all devices sequentially by reusing DeleteAsync(deviceId).
        /// Safe because it reuses the already-validated single-delete path.
        /// </summary>
        public async Task<(int deletedDevices, int deletedPorts, int deletedConnections, int deletedCables)> DeleteAllAsync()
        {
            // Capture counts before deletion
            var totalPorts = await _context.Ports.CountAsync();
            var totalConnections = await _context.CableConnections.CountAsync();
            var totalCables = await _context.Cables.CountAsync();

            // Fetch device IDs only (lightweight)
            var ids = await _context.Devices.Select(d => d.DeviceId).ToListAsync();
            int ok = 0;

            // Reuse the validated deletion routine
            foreach (var id in ids)
            {
                var success = await DeleteAsync(id);
                if (success) ok++;
            }

            return (ok, totalPorts, totalConnections, totalCables);
        }

        /// <summary>
        /// Execute Ping for a single device.
        /// </summary>
        public async Task<PingResultDto> PingDeviceAsync(int deviceId, int timeoutMs = 2000)
        {
            var device = await _context.Devices.FirstOrDefaultAsync(d => d.DeviceId == deviceId);
            if (device == null)
                throw new KeyNotFoundException($"Device ID {deviceId} not found.");

            // Manual mode: skip ping (update only the last-checked timestamp)
            if (!device.EnablePing)
            {
                device.LastCheckedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return new PingResultDto
                {
                    DeviceId = device.DeviceId,
                    DeviceName = device.Name,
                    IpAddress = device.IPAddress ?? "",
                    Status = device.Status ?? "Unknown",
                    CheckedAt = DateTime.UtcNow,
                    ErrorMessage = "Ping disabled (EnablePing=false)"
                };
            }

            if (string.IsNullOrEmpty(device.IPAddress))
            {
                device.LastCheckedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return new PingResultDto
                {
                    DeviceId = deviceId,
                    DeviceName = device.Name,
                    IpAddress = "",
                    Status = "Unknown",
                    CheckedAt = DateTime.UtcNow,
                    ErrorMessage = "IP address is not configured"
                };
            }

            var pingResult = await _pingService.PingAsync(device.IPAddress, timeoutMs);

            device.Status = pingResult.Status;
            device.LatencyMs = pingResult.LatencyMs;
            device.LastCheckedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new PingResultDto
            {
                DeviceId = deviceId,
                DeviceName = device.Name,
                IpAddress = device.IPAddress,
                Status = pingResult.Status,
                LatencyMs = pingResult.LatencyMs,
                CheckedAt = DateTime.UtcNow,
                ErrorMessage = pingResult.ErrorMessage
            };
        }

        /// <summary>
        /// Execute Ping for multiple devices (safe mapping approach).
        /// </summary>
        public async Task<List<PingResultDto>> PingMultipleDevicesAsync(
            List<int> deviceIds, int timeoutMs = 2000, int maxConcurrency = 10)
        {
            _logger.LogInformation("Bulk ping started: count={Count}, concurrency={MaxConcurrency}",
                deviceIds.Count, maxConcurrency);

            var devices = await _context.Devices
                .Where(d => deviceIds.Contains(d.DeviceId))
                .ToListAsync();

            var results = new List<PingResultDto>();
            if (!devices.Any()) return results;

            // 1) EnablePing = false
            var disabled = devices.Where(d => !d.EnablePing).ToList();
            foreach (var d in disabled)
            {
                d.LastCheckedAt = DateTime.UtcNow;
                results.Add(new PingResultDto
                {
                    DeviceId = d.DeviceId,
                    DeviceName = d.Name,
                    IpAddress = d.IPAddress ?? "",
                    Status = d.Status ?? "Unknown",
                    CheckedAt = DateTime.UtcNow,
                    ErrorMessage = "Ping disabled (EnablePing=false)"
                });
            }

            // 2) Missing IP (EnablePing = true)
            var noIp = devices.Where(d => string.IsNullOrEmpty(d.IPAddress) && d.EnablePing).ToList();
            foreach (var d in noIp)
            {
                d.LastCheckedAt = DateTime.UtcNow;
                results.Add(new PingResultDto
                {
                    DeviceId = d.DeviceId,
                    DeviceName = d.Name,
                    IpAddress = "",
                    Status = "Unknown",
                    CheckedAt = DateTime.UtcNow,
                    ErrorMessage = "IP address is not configured"
                });
            }

            // 3) Actual ping targets (has IP and EnablePing = true)
            var targets = devices.Where(d => !string.IsNullOrEmpty(d.IPAddress) && d.EnablePing).ToList();
            if (targets.Any())
            {
                using var sem = new SemaphoreSlim(maxConcurrency, maxConcurrency);

                // Do not mutate EF entities from parallel tasks — return only results
                var pingTasks = targets.Select(async d =>
                {
                    await sem.WaitAsync();
                    try
                    {
                        var pr = await _pingService.PingAsync(d.IPAddress!, timeoutMs);
                        return new
                        {
                            d.DeviceId,
                            d.Name,
                            d.IPAddress,
                            Ping = pr
                        };
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Ping failed for device {DeviceId} ({IP})", d.DeviceId, d.IPAddress);
                        return new
                        {
                            d.DeviceId,
                            d.Name,
                            d.IPAddress,
                            Ping = new PingResultDto
                            {
                                IpAddress = d.IPAddress!,
                                Status = "Unreachable",
                                CheckedAt = DateTime.UtcNow,
                                ErrorMessage = ex.Message
                            }
                        };
                    }
                    finally { sem.Release(); }
                });

                var pinged = await Task.WhenAll(pingTasks);

                // Update EF entities on a single thread
                var byId = devices.ToDictionary(x => x.DeviceId);
                foreach (var x in pinged)
                {
                    var dev = byId[x.DeviceId];
                    dev.Status = x.Ping.Status;
                    dev.LatencyMs = x.Ping.LatencyMs;
                    dev.LastCheckedAt = DateTime.UtcNow;

                    results.Add(new PingResultDto
                    {
                        DeviceId = dev.DeviceId,
                        DeviceName = dev.Name,
                        IpAddress = dev.IPAddress!,
                        Status = x.Ping.Status,
                        LatencyMs = x.Ping.LatencyMs,
                        CheckedAt = DateTime.UtcNow,
                        ErrorMessage = x.Ping.ErrorMessage
                    });
                }
            }

            await _context.SaveChangesAsync();
            return results;
        }

        /// <summary>
        /// Retrieve device details including latest ping result.
        /// </summary>
        public async Task<DeviceDto?> GetWithStatusAsync(int deviceId)
        {
            var device = await _context.Devices
                .Include(d => d.Rack)
                .Include(d => d.Ports)
                    .ThenInclude(p => p.Connection)
                        .ThenInclude(c => c.ToPort)
                            .ThenInclude(p => p.Device)
                .AsSplitQuery()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

            if (device == null)
                return null;

            return _mapper.Map<DeviceDto>(device);
        }

        private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
        { "Online", "Offline", "Unstable", "Unknown", "Unreachable" };

        private static string NormalizeStatus(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return "Unknown";
            var lower = s.Trim().ToLowerInvariant();
            // Capitalize the first character
            return char.ToUpper(lower[0], CultureInfo.InvariantCulture) + lower[1..];
        }

        /// <summary>
        /// Manually update device status (optionally update EnablePing).
        /// </summary>
        public async Task<DeviceDto?> UpdateStatusAsync(int deviceId, string status, bool? enablePing = null)
        {
            var device = await _context.Devices.FirstOrDefaultAsync(d => d.DeviceId == deviceId);
            if (device == null) return null;

            var normalized = NormalizeStatus(status);
            if (!AllowedStatuses.Contains(normalized))
                throw new ArgumentException($"Unsupported status: {status}");

            device.Status = normalized;
            if (enablePing.HasValue) device.EnablePing = enablePing.Value;
            device.LastCheckedAt = DateTime.UtcNow;
            // Latency may not be meaningful when status is manually set
            device.LatencyMs = null;

            await _context.SaveChangesAsync();
            return _mapper.Map<DeviceDto>(device);
        }

        /// <summary>
        /// Bulk update statuses for multiple devices.
        ///
        /// Processing steps:
        /// 1. Deduplicate deviceIds (last request wins).
        /// 2. Filter to existing devices only.
        /// 3. Normalize and validate status values.
        /// 4. Apply updates and call SaveChanges once.
        ///
        /// Reduces DB roundtrips by using a single transaction-like save.
        /// Used by ControlBar “Change Status” dropdown for all devices.
        /// </summary>
        public async Task<int> UpdateStatusBulkAsync(IEnumerable<(int deviceId, string status, bool? enablePing)> items)
        {
            var list = items.ToList();
            if (list.Count == 0) return 0;

            // Collect target device IDs (distinct)
            var ids = list.Select(i => i.deviceId).Distinct().ToList();

            // Fetch only existing devices (ignore unknown IDs)
            var devices = await _context.Devices.Where(d => ids.Contains(d.DeviceId)).ToListAsync();

            // Handle duplicate deviceIds: last request wins
            var map = items
                .GroupBy(i => i.deviceId)
                .ToDictionary(g => g.Key, g => g.Last());

            // Apply updates per device
            foreach (var d in devices)
            {
                var req = map[d.DeviceId];

                // Normalize status (unify casing, e.g., "online" → "Online")
                var normalized = NormalizeStatus(req.status);
                if (!AllowedStatuses.Contains(normalized))
                    throw new ArgumentException($"Unsupported status: {req.status}");

                // Update device
                d.Status = normalized;
                if (req.enablePing.HasValue) d.EnablePing = req.enablePing.Value;
                d.LastCheckedAt = DateTime.UtcNow;
                d.LatencyMs = null;  // reset latency for manual status changes
            }

            // Persist all changes in one go (efficient like a transaction)
            await _context.SaveChangesAsync();
            return devices.Count;  // number of devices actually updated
        }
    }
}