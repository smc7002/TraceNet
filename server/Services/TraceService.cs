using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;
using TraceNet.DTOs;

namespace TraceNet.Services
{
    /// <summary>
    /// 장비 간 네트워크 연결 경로를 추적하는 서비스 클래스
    /// 성능 최적화를 위해 데이터 사전 로딩과 동기 DFS를 활용
    /// </summary>
    public class TraceService
    {
        private readonly TraceNetDbContext _context;
        private readonly ILogger<TraceService> _logger;

        public TraceService(TraceNetDbContext context, ILogger<TraceService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// 시작 장비(DeviceId)에서 Server까지 도달하는 경로를 추적합니다.
        /// 실패 시 예외를 발생시키며, 반환 결과는 TraceResultDto 형식입니다.
        /// </summary>
        public async Task<TraceResultDto> TracePathAsync(int startDeviceId, int maxDepth = 20)
        {
            _logger.LogInformation("트레이스 시작: StartDeviceId={StartDeviceId}", startDeviceId);

            try
            {
                var deviceCache = await PreloadNetworkDataAsync(startDeviceId, maxDepth);

                _logger.LogInformation("Preload 완료. 캐시된 장비 수: {Count}", deviceCache.Count);

                if (!deviceCache.TryGetValue(startDeviceId, out var startDevice))
                {
                    _logger.LogError("❌ 시작 장비를 캐시에서 찾을 수 없음: {StartDeviceId}", startDeviceId);
                    throw new KeyNotFoundException($"시작 장비(DeviceId={startDeviceId})를 찾을 수 없습니다.");
                }

                _logger.LogInformation("장비 로드 성공: {DeviceName}", startDevice.Name);

                if (startDevice.Type.Equals("server", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("시작 장비가 이미 서버입니다. 즉시 반환.");
                    return new TraceResultDto
                    {
                        StartDeviceName = startDevice.Name,
                        EndDeviceName = startDevice.Name,
                        Success = true,
                        Path = new List<TraceDto>(),
                        Cables = new List<CableEdgeDto>()
                    };
                }

                _logger.LogInformation("DFS 탐색 진입 직전...");
                var result = PerformDFSSearch(startDeviceId, deviceCache, maxDepth);

                _logger.LogInformation("DFS 탐색 완료. 성공 여부: {Success}", result.Success);

                if (!result.Success)
                {
                    _logger.LogWarning("❌ DFS 탐색 실패. 경로 없음.");
                    throw new InvalidOperationException("서버까지의 경로를 찾을 수 없습니다.");
                }

                result.StartDeviceName = startDevice.Name;
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "트레이스 실패: StartDeviceId={StartDeviceId}", startDeviceId);
                throw;
            }
        }


        /// <summary>
        /// 연결된 장비들의 네트워크 데이터를 사전에 로딩합니다.
        /// BFS 방식으로 maxDepth 깊이까지의 연결된 장비들을 한 번에 로딩
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
        /// BFS를 사용하여 연결된 장비 ID들을 수집합니다. (EF Core LINQ 대신 메모리 기반)
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
        /// 동기 DFS를 사용하여 서버까지의 경로를 탐색합니다.
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
        /// 동기 DFS 알고리즘으로 서버까지의 경로를 탐색합니다.
        /// Stack을 사용하여 백트래킹을 효율적으로 처리합니다.
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
                _logger.LogWarning("캐시에서 장비를 찾을 수 없음: DeviceId={DeviceId}", currentDeviceId);
                return false;
            }

            _logger.LogInformation("DFS 탐색 중: {DeviceId} ({DeviceName}), 깊이={Depth}", device.DeviceId, device.Name, depth);

            visited.Add(currentDeviceId);

            if (device.Type.Equals("server", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("서버 발견: {DeviceName}", device.Name);
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
        /// 포트 연결의 유효성을 검사합니다. 양방향 연결을 모두 고려합니다.
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

    }
}
