using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;
using TraceNet.DTOs;

namespace TraceNet.Services
{
    /// <summary>
    /// Traces a network path (Device→Port→Cable→Port→Device) from a start device to a server.
    /// Also supports pinging all devices along the traced path.
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
        /// Trace path from a device to a server. Throws if no path is found.
        /// </summary>
        /// <param name="startDeviceId">Starting device id.</param>
        /// <param name="maxDepth">Max hops to prevent infinite loops (default: 20).</param>
        public async Task<TraceResultDto> TracePathAsync(int startDeviceId, int maxDepth = 20)
        {
            _logger.LogInformation("Trace started: StartDeviceId={StartDeviceId}", startDeviceId);

            try
            {
                // Preload network subgraph to avoid N+1 during DFS.
                var deviceCache = await PreloadNetworkDataAsync(startDeviceId, maxDepth);
                _logger.LogInformation("Preload completed. Cached devices: {Count}", deviceCache.Count);

                if (!deviceCache.TryGetValue(startDeviceId, out var startDevice))
                    throw new KeyNotFoundException($"Starting device (DeviceId={startDeviceId}) not found.");

                // Trivial case: start is already a server.
                if (startDevice.Type.Equals("server", StringComparison.OrdinalIgnoreCase))
                {
                    return new TraceResultDto
                    {
                        StartDeviceName = startDevice.Name,
                        EndDeviceName = startDevice.Name,
                        Success = true,
                        Path = new List<TraceDto>(),
                        Cables = new List<CableEdgeDto>()
                    };
                }

                // In-memory DFS over the cache.
                var result = PerformDFSSearch(startDeviceId, deviceCache, maxDepth);
                if (!result.Success)
                    throw new InvalidOperationException("Could not find a path to the server.");

                result.StartDeviceName = startDevice.Name; // convenience for UI
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Trace failed: StartDeviceId={StartDeviceId}", startDeviceId);
                throw;
            }
        }

        /// <summary>
        /// Preload reachable devices (bounded by maxDepth) and required nav props.
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
                .AsSplitQuery() // multiple Include trees → avoid large cross-joins
                .ToDictionaryAsync(d => d.DeviceId);

            // Keep object identity consistent for DFS traversal.
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
        /// Memory BFS to collect reachable device ids up to maxDepth (predictable DB usage).
        /// </summary>
        private async Task<HashSet<int>> GetConnectedDeviceIdsBFS_MemoryBased(int startDeviceId, int maxDepth)
        {
            var visited = new HashSet<int>();
            var queue = new Queue<(int DeviceId, int Depth)>();

            // Load all devices once instead of lazy-loading during traversal
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
                if (depth >= maxDepth) continue; // Depth limit prevents infinite exploration

                if (!allDevices.TryGetValue(currentDeviceId, out var device)) continue;

                // Explore all outgoing connections from this device
                foreach (var port in device.Ports)
                {
                    var to = port.Connection?.ToPort?.Device;
                    if (to != null && visited.Add(to.DeviceId)) // visited.Add returns false if already exists
                        queue.Enqueue((to.DeviceId, depth + 1));
                }
            }

            return visited;
        }

        /// <summary>
        /// DFS over the preloaded cache; returns first found path.
        /// </summary>
        private TraceResultDto PerformDFSSearch(int startDeviceId, Dictionary<int, Device> deviceCache, int maxDepth)
        {
            var visited = new HashSet<int>();
            var pathStack = new Stack<TraceDto>();
            var cableStack = new Stack<CableEdgeDto>();

            if (DFS(startDeviceId, deviceCache, visited, pathStack, cableStack, 0, maxDepth))
            {
                var path = pathStack.Reverse().ToList();

                // Deduplicate cables for visualization.
                var uniqueCables = cableStack
                    .Reverse()
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
        /// Core DFS: stop at server, avoid loops, backtrack on dead ends.
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

            visited.Add(currentDeviceId);

            if (device.Type.Equals("server", StringComparison.OrdinalIgnoreCase))
                return true;

            foreach (var port in device.Ports)
            {
                var connections = GetValidConnections(port);

                foreach (var (nextDevice, cable, nextPort) in connections)
                {
                    if (visited.Contains(nextDevice.DeviceId)) continue;

                    // take edge
                    pathStack.Push(new TraceDto
                    {
                        CableId = cable.CableId,
                        FromDeviceId = device.DeviceId,
                        FromDevice = device.Name,
                        FromPort = port.Name,
                        ToDeviceId = nextDevice.DeviceId,
                        ToDevice = nextDevice.Name,
                        ToPort = nextPort.Name
                    });

                    cableStack.Push(new CableEdgeDto
                    {
                        CableId = cable.CableId,
                        FromPortId = port.PortId,
                        FromDeviceId = device.DeviceId,
                        ToPortId = nextPort.PortId,
                        ToDeviceId = nextDevice.DeviceId
                    });

                    // recurse
                    if (DFS(nextDevice.DeviceId, deviceCache, visited, pathStack, cableStack, depth + 1, maxDepth))
                        return true;

                    // backtrack
                    pathStack.Pop();
                    cableStack.Pop();
                }
            }

            // Allow alternate routes to revisit this node later.
            visited.Remove(currentDeviceId);
            return false;
        }

        /// <summary>
        /// Outgoing connection from a port (one-way in current model).
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
        /// Trace, then ping all devices on that path. Returns aggregate stats and per-device results.
        /// </summary>
        public async Task<TracePingResultDto> PingTracePathAsync(int startDeviceId)
        {
            _logger.LogInformation("TracePath ping started: StartDeviceId={StartDeviceId}", startDeviceId);

            try
            {
                var traceResult = await TracePathAsync(startDeviceId);
                if (!traceResult.Success)
                {
                    return new TracePingResultDto
                    {
                        Success = false,
                        ErrorMessage = "No path found."
                    };
                }

                // Unique device set 
                var deviceIds = new HashSet<int> { startDeviceId };
                foreach (var step in traceResult.Path)
                {
                    deviceIds.Add(step.FromDeviceId);
                    deviceIds.Add(step.ToDeviceId);
                }

                var pingResults = new List<PingResultDto>();
                var devices = await _context.Devices
                    .Where(d => deviceIds.Contains(d.DeviceId))
                    .ToListAsync();

                foreach (var device in devices)
                {
                    var pingResult = await PingDeviceInternalAsync(device);
                    pingResults.Add(pingResult);
                }

                return new TracePingResultDto
                {
                    Success = true,
                    TracePath = traceResult,
                    PingResults = pingResults,
                    TotalDevices = deviceIds.Count,
                    OnlineDevices = pingResults.Count(p => p.Status == "Online"),
                    OfflineDevices = pingResults.Count(p => p.Status == "Offline"),
                    UnstableDevices = pingResults.Count(p => p.Status == "Unstable"),
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
        /// Ping one device and persist its status snapshot.
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

            var pingResult = await _pingService.PingAsync(device.IPAddress);

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
