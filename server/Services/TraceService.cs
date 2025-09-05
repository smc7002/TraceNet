using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;
using TraceNet.DTOs;
using TraceNet.Services;

namespace TraceNet.Services
{
    /// <summary>
    /// Service class that traces network connection paths between devices.
    /// Uses data preloading and a synchronous DFS for performance.
    /// </summary>
    public class TraceService
    {
        private readonly TraceNetDbContext _context;
        private readonly ILogger<TraceService> _logger;
        private readonly PingService _pingService;

        public TraceService(TraceNetDbContext context, ILogger<TraceService> logger, PingService pingService)
        {
            _context = context;
            _logger = logger;
            _pingService = pingService;
        }

        /// <summary>
        /// Trace a path from the starting device (DeviceId) to the server.
        /// Throws on failure. Returns a <see cref="TraceResultDto"/>.
        /// </summary>
        public async Task<TraceResultDto> TracePathAsync(int startDeviceId, int maxDepth = 20)
        {
            _logger.LogInformation("Trace started: StartDeviceId={StartDeviceId}", startDeviceId);

            try
            {
                var deviceCache = await PreloadNetworkDataAsync(startDeviceId, maxDepth);

                _logger.LogInformation("Preload completed. Cached devices: {Count}", deviceCache.Count);

                if (!deviceCache.TryGetValue(startDeviceId, out var startDevice))
                {
                    _logger.LogError("❌ Starting device not found in cache: {StartDeviceId}", startDeviceId);
                    throw new KeyNotFoundException($"Starting device (DeviceId={startDeviceId}) not found.");
                }

                _logger.LogInformation("Device loaded: {DeviceName}", startDevice.Name);

                if (startDevice.Type.Equals("server", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("Starting device is already the server. Returning immediately.");
                    return new TraceResultDto
                    {
                        StartDeviceName = startDevice.Name,
                        EndDeviceName = startDevice.Name,
                        Success = true,
                        Path = new List<TraceDto>(),
                        Cables = new List<CableEdgeDto>()
                    };
                }

                _logger.LogInformation("About to enter DFS search...");
                var result = PerformDFSSearch(startDeviceId, deviceCache, maxDepth);

                _logger.LogInformation("DFS search completed. Success={Success}", result.Success);

                if (!result.Success)
                {
                    _logger.LogWarning("❌ DFS search failed. No path found.");
                    throw new InvalidOperationException("Could not find a path to the server.");
                }

                result.StartDeviceName = startDevice.Name;
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Trace failed: StartDeviceId={StartDeviceId}", startDeviceId);
                throw;
            }
        }

        /// <summary>
        /// Preload network data for connected devices.
        /// Loads all connected devices up to <paramref name="maxDepth"/> using BFS.
        /// </summary>
        private async Task<Dictionary<int, Device>> PreloadNetworkDataAsync(int startDeviceId, int maxDepth)
        {
            var deviceIds = await GetConnectedDeviceIdsBFS_MemoryBased(startDeviceId, maxDepth);

            var devices = await _context.Devices
                .Where(d => deviceIds.Contains(d.DeviceId))
                .Include(d => d.Ports)
                    .ThenInclude(p => p.Connection)
                        .ThenInclude(c => c.ToPort)
                            .ThenInclude(p => p.Device)
                .Include(d => d.Ports)
                    .ThenInclude(p => p.Connection)
                        .ThenInclude(c => c.Cable)
                .AsSplitQuery()
                .ToDictionaryAsync(d => d.DeviceId);

            // Ensure ToPort.Device is populated from the cache when available
            foreach (var device in devices.Values)
            {
                foreach (var port in device.Ports)
                {
                    var toPort = port.Connection?.ToPort;
                    if (toPort != null && toPort.Device == null && devices.TryGetValue(toPort.DeviceId, out var toDevice))
                    {
                        toPort.Device = toDevice;
                    }
                }
            }

            return devices;
        }

        /// <summary>
        /// Collect connected device IDs using BFS (memory-based instead of EF LINQ).
        /// </summary>
        private async Task<HashSet<int>> GetConnectedDeviceIdsBFS_MemoryBased(int startDeviceId, int maxDepth)
        {
            var visited = new HashSet<int>();
            var queue = new Queue<(int DeviceId, int Depth)>();

            var allDevices = await _context.Devices
                .Include(d => d.Ports)
                    .ThenInclude(p => p.Connection)
                        .ThenInclude(c => c.ToPort)
                            .ThenInclude(p => p.Device)
                .AsSplitQuery()
                .ToDictionaryAsync(d => d.DeviceId);

            queue.Enqueue((startDeviceId, 0));
            visited.Add(startDeviceId);

            while (queue.Count > 0)
            {
                var (currentDeviceId, depth) = queue.Dequeue();
                if (depth >= maxDepth) continue;

                if (!allDevices.TryGetValue(currentDeviceId, out var device)) continue;

                foreach (var port in device.Ports)
                {
                    var to = port.Connection?.ToPort?.Device;
                    if (to != null && visited.Add(to.DeviceId))
                        queue.Enqueue((to.DeviceId, depth + 1));
                }
            }

            return visited;
        }

        /// <summary>
        /// Use a synchronous DFS to find a path to the server.
        /// </summary>
        private TraceResultDto PerformDFSSearch(int startDeviceId, Dictionary<int, Device> deviceCache, int maxDepth)
        {
            var visited = new HashSet<int>();
            var pathStack = new Stack<TraceDto>();
            var cableStack = new Stack<CableEdgeDto>();

            if (DFS(startDeviceId, deviceCache, visited, pathStack, cableStack, 0, maxDepth))
            {
                var path = pathStack.Reverse().ToList();
                var cables = cableStack.Reverse().ToList();
                var uniqueCables = cables
                    .GroupBy(c => c.CableId)
                    .Select(g => g.First())
                    .ToList();

                return new TraceResultDto
                {
                    EndDeviceName = path.LastOrDefault()?.ToDevice,
                    Success = true,
                    Path = path,
                    Cables = uniqueCables
                };
            }

            return new TraceResultDto { Success = false };
        }

        /// <summary>
        /// DFS algorithm to search for a path to the server.
        /// Uses stacks to efficiently handle backtracking.
        /// </summary>
        private bool DFS(
            int currentDeviceId,
            Dictionary<int, Device> deviceCache,
            HashSet<int> visited,
            Stack<TraceDto> pathStack,
            Stack<CableEdgeDto> cableStack,
            int depth,
            int maxDepth)
        {
            if (visited.Contains(currentDeviceId) || depth > maxDepth)
                return false;

            if (!deviceCache.TryGetValue(currentDeviceId, out var device))
            {
                _logger.LogWarning("Device not found in cache: DeviceId={DeviceId}", currentDeviceId);
                return false;
            }

            _logger.LogInformation("DFS visiting: {DeviceId} ({DeviceName}), depth={Depth}", device.DeviceId, device.Name, depth);

            visited.Add(currentDeviceId);

            if (device.Type.Equals("server", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Server found: {DeviceName}", device.Name);
                return true;
            }

            foreach (var port in device.Ports)
            {
                var connections = GetValidConnections(port);

                foreach (var (nextDevice, cable, nextPort) in connections)
                {
                    if (visited.Contains(nextDevice.DeviceId)) continue;

                    var trace = new TraceDto
                    {
                        CableId = cable.CableId,
                        FromDeviceId = device.DeviceId,
                        FromDevice = device.Name,
                        FromPort = port.Name,
                        ToDeviceId = nextDevice.DeviceId,
                        ToDevice = nextDevice.Name,
                        ToPort = nextPort.Name
                    };

                    var cableEdge = new CableEdgeDto
                    {
                        CableId = cable.CableId,
                        FromPortId = port.PortId,
                        FromDeviceId = device.DeviceId,
                        ToPortId = nextPort.PortId,
                        ToDeviceId = nextDevice.DeviceId
                    };

                    pathStack.Push(trace);
                    cableStack.Push(cableEdge);

                    if (DFS(nextDevice.DeviceId, deviceCache, visited, pathStack, cableStack, depth + 1, maxDepth))
                        return true;

                    pathStack.Pop();
                    cableStack.Pop();
                }
            }

            visited.Remove(currentDeviceId);
            return false;
        }

        /// <summary>
        /// Get valid outgoing connections from a port.
        /// </summary>
        private static List<(Device nextDevice, Cable cable, Port nextPort)> GetValidConnections(Port port)
        {
            var result = new List<(Device, Cable, Port)>();

            var conn = port.Connection;
            if (conn?.Cable != null && conn.ToPort?.Device != null)
            {
                result.Add((conn.ToPort.Device, conn.Cable, conn.ToPort));
            }

            return result;
        }

        /// <summary>
        /// Execute Ping for all devices along the traced path.
        /// </summary>
        public async Task<TracePingResultDto> PingTracePathAsync(int startDeviceId)
        {
            _logger.LogInformation("TracePath ping started: StartDeviceId={StartDeviceId}", startDeviceId);

            try
            {
                // 1) Trace the path first
                var traceResult = await TracePathAsync(startDeviceId);

                if (!traceResult.Success)
                {
                    return new TracePingResultDto
                    {
                        Success = false,
                        ErrorMessage = "No path found."
                    };
                }

                // 2) Collect all device IDs along the path
                var deviceIds = new HashSet<int> { startDeviceId };
                foreach (var step in traceResult.Path)
                {
                    deviceIds.Add(step.FromDeviceId);
                    deviceIds.Add(step.ToDeviceId);
                }

                // 3) Ping each device
                var pingResults = new List<PingResultDto>();
                var devices = await _context.Devices
                    .Where(d => deviceIds.Contains(d.DeviceId))
                    .ToListAsync();

                foreach (var device in devices)
                {
                    var pingResult = await PingDeviceInternalAsync(device);
                    pingResults.Add(pingResult);
                }

                var onlineCount = pingResults.Count(p => p.Status == "Online");
                var offlineCount = pingResults.Count(p => p.Status == "Offline");
                var unstableCount = pingResults.Count(p => p.Status == "Unstable");

                return new TracePingResultDto
                {
                    Success = true,
                    TracePath = traceResult,
                    PingResults = pingResults,
                    TotalDevices = deviceIds.Count,
                    OnlineDevices = onlineCount,
                    OfflineDevices = offlineCount,
                    UnstableDevices = unstableCount,
                    CheckedAt = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TracePath ping failed: StartDeviceId={StartDeviceId}", startDeviceId);
                throw;
            }
        }

        /// <summary>
        /// Execute ping for a single device (internal use).
        /// </summary>
        private async Task<PingResultDto> PingDeviceInternalAsync(Device device)
        {
            if (string.IsNullOrEmpty(device.IPAddress))
            {
                return new PingResultDto
                {
                    DeviceId = device.DeviceId,
                    DeviceName = device.Name,
                    IpAddress = "",
                    Status = "Unknown",
                    CheckedAt = DateTime.UtcNow,
                    ErrorMessage = "IP address is not configured"
                };
            }

            // Call PingService
            var pingResult = await _pingService.PingAsync(device.IPAddress);

            // Update device state
            device.Status = pingResult.Status;
            device.LatencyMs = pingResult.LatencyMs;
            device.LastCheckedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return new PingResultDto
            {
                DeviceId = device.DeviceId,
                DeviceName = device.Name,
                IpAddress = device.IPAddress,
                Status = pingResult.Status,
                LatencyMs = pingResult.LatencyMs,
                CheckedAt = DateTime.UtcNow,
                ErrorMessage = pingResult.ErrorMessage
            };
        }
    }
}
