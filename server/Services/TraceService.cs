using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;
using TraceNet.DTOs;

namespace TraceNet.Services
{
    /// <summary>
    /// 장비 간 네트워크 연결 경로를 추적하는 서비스 클래스
    /// DFS 기반으로 서버까지의 물리적 연결을 추적하며,
    /// 불필요한 전체 로딩을 피하고 on-demand로 필요한 장비만 불러오는 방식으로 성능을 최적화함
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
            var deviceCache = new Dictionary<int, Device>();
            var visited = new HashSet<int>();
            var path = new List<TraceDto>();
            var cables = new List<CableEdgeDto>();

            var startDevice = await LoadDeviceWithConnectionsAsync(startDeviceId);
            if (startDevice == null)
                throw new KeyNotFoundException($"시작 장비(DeviceId={startDeviceId})를 찾을 수 없습니다.");

            deviceCache[startDeviceId] = startDevice;

            bool found = await DFS(startDeviceId, deviceCache, visited, path, cables, 0, maxDepth);

            if (!found)
                throw new InvalidOperationException("서버까지의 경로를 찾을 수 없습니다.");

            return new TraceResultDto
            {
                StartDeviceName = startDevice.Name,
                EndDeviceName = path.LastOrDefault()?.ToDevice,
                Success = true,
                Path = path,
                Cables = cables
            };
        }


        /// <summary>
        /// DFS 알고리즘을 통해 재귀적으로 연결 경로를 탐색합니다.
        /// 장비는 탐색 중 on-demand로 불러오며, 순환 및 최대 깊이를 고려합니다.
        /// </summary>
        private const string ServerDeviceType = "Server";
        private static readonly StringComparison IgnoreCase = StringComparison.OrdinalIgnoreCase;

        private async Task<bool> DFS(
   int currentDeviceId,
   Dictionary<int, Device> deviceCache,
   HashSet<int> visited,
   List<TraceDto> path,
   List<CableEdgeDto> cables,
   int depth,
   int maxDepth)
        {
            // 순환 참조 방지 및 탐색 깊이 제한으로 무한 루프 방지
            if (visited.Contains(currentDeviceId) || depth > maxDepth)
                return false;

            // 현재 노드를 방문 표시 (백트래킹을 위해 나중에 제거됨)
            visited.Add(currentDeviceId);

            // 디바이스 정보를 캐시에서 조회하거나 DB에서 로드
            if (!deviceCache.TryGetValue(currentDeviceId, out var device))
            {
                try
                {
                    // 비동기 DB 조회: 포트 및 연결 정보 포함
                    device = await LoadDeviceWithConnectionsAsync(currentDeviceId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[TraceService] Device 로딩 실패 (DeviceId={DeviceId})", currentDeviceId);
                    return false;
                }

                if (device == null)
                    return false;

                // 성능 향상을 위해 로드된 디바이스를 캐시에 저장
                deviceCache[currentDeviceId] = device;
            }

            // 목표 조건: 서버 타입 디바이스 발견 시 탐색 성공
            if (device.Type.Equals(ServerDeviceType, IgnoreCase))
                return true;

            // 현재 디바이스의 모든 포트를 탐색하여 연결된 다음 디바이스로 이동
            foreach (var port in device.Ports)
            {
                // 연결 유효성 검사: 케이블, 포트, 디바이스가 모두 존재하는지 확인
                if (!IsValidConnection(port, out var nextDevice, out var cable, out var nextPort))
                    continue;

                // 자기 자신으로의 연결 제외 (루프백 방지)
                if (nextDevice.DeviceId == currentDeviceId)
                    continue;

                // 경로 추적을 위한 연결 정보 기록 (UI 표시용)
                path.Add(new TraceDto
                {
                    CableId = cable.CableId,
                    FromDeviceId = device.DeviceId,
                    FromDevice = device.Name,
                    FromPort = port.Name,
                    ToDeviceId = nextDevice.DeviceId,
                    ToDevice = nextDevice.Name,
                    ToPort = nextPort.Name
                });

                // 네트워크 시각화를 위한 간선(Edge) 정보 기록
                cables.Add(new CableEdgeDto
                {
                    CableId = cable.CableId,
                    FromPortId = port.PortId,
                    FromDeviceId = device.DeviceId,
                    ToPortId = nextPort.PortId,
                    ToDeviceId = nextDevice.DeviceId
                });

                // 재귀 호출: 다음 디바이스에서 서버 탐색 계속
                if (await DFS(nextDevice.DeviceId, deviceCache, visited, path, cables, depth + 1, maxDepth))
                    return true;

                // 백트래킹: 현재 경로에서 서버를 찾지 못했으므로 기록 제거
                path.RemoveAt(path.Count - 1);
                cables.RemoveAt(cables.Count - 1);
            }

            // 백트래킹: 모든 경로 탐색 완료 후 방문 상태 해제
            visited.Remove(currentDeviceId);
            return false;
        }

        private static bool IsValidConnection(
            Port port,
            out Device nextDevice,
            out Cable cable,
            out Port nextPort)
        {
            nextDevice = null!;
            nextPort = null!;
            cable = null!;

            var conn = port.Connection;
            if (conn == null) return false;

            cable = conn.Cable!;
            nextPort = conn.ToPort!;
            nextDevice = nextPort?.Device!;

            return cable != null && nextPort != null && nextDevice != null;
        }

        /// <summary>
        /// 지정된 장비 ID를 기반으로 연결 정보까지 포함하여 장비를 로딩합니다.
        /// 포트 → 연결 → 케이블 및 연결된 포트/장비까지 포함됩니다.
        /// </summary>
        private async Task<Device?> LoadDeviceWithConnectionsAsync(int deviceId)
        {
            return await _context.Devices
                .Where(d => d.DeviceId == deviceId)
                .Include(d => d.Ports)
                    .ThenInclude(p => p.Connection)
                        .ThenInclude(conn => conn.Cable)
                .Include(d => d.Ports)
                    .ThenInclude(p => p.Connection)
                        .ThenInclude(conn => conn.ToPort)
                            .ThenInclude(p => p.Device)
                .FirstOrDefaultAsync();
        }
    }
}
