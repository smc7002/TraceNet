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

        public TraceService(TraceNetDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// 시작 장비(DeviceId)에서 Server까지 도달하는 경로를 추적합니다.
        /// 실패 시 예외를 발생시키며, 반환 결과는 TraceResultDto 형식입니다.
        /// </summary>
        public async Task<TraceResultDto> TracePathAsync(int startDeviceId, int maxDepth = 20)
        {
            // ✅ 1. 캐시와 방문 기록 초기화
            var deviceCache = new Dictionary<int, Device>();
            var visited = new HashSet<int>();
            var path = new List<TraceDto>();

            // ✅ 2. 시작 장비 로딩 (Connection, Cable, ToPort, ToDevice 포함)
            var startDevice = await LoadDeviceWithConnectionsAsync(startDeviceId);
            if (startDevice == null)
                throw new KeyNotFoundException($"시작 장비(DeviceId={startDeviceId})를 찾을 수 없습니다.");

            deviceCache[startDeviceId] = startDevice;

            // ✅ 3. DFS 경로 탐색
            bool found = await DFS(startDeviceId, deviceCache, visited, path, 0, maxDepth);

            if (!found)
                throw new InvalidOperationException("서버까지의 경로를 찾을 수 없습니다.");

            // ✅ 4. 탐색 결과 반환
            return new TraceResultDto
            {
                StartDeviceName = startDevice.Name,
                EndDeviceName = path.LastOrDefault()?.ToDevice,
                Success = true,
                Path = path
            };
        }

        /// <summary>
        /// DFS 알고리즘을 통해 재귀적으로 연결 경로를 탐색합니다.
        /// 장비는 탐색 중 on-demand로 불러오며, 순환 및 최대 깊이를 고려합니다.
        /// </summary>
        private async Task<bool> DFS(
            int currentDeviceId,
            Dictionary<int, Device> deviceCache,
            HashSet<int> visited,
            List<TraceDto> path,
            int depth,
            int maxDepth)
        {
            // ✅ 깊이 초과 또는 중복 방문 방지
            if (depth > maxDepth || visited.Contains(currentDeviceId))
                return false;

            visited.Add(currentDeviceId);

            // ✅ 현재 장비 가져오기 (캐시 → DB 순)
            if (!deviceCache.TryGetValue(currentDeviceId, out var device))
            {
                device = await LoadDeviceWithConnectionsAsync(currentDeviceId);
                if (device == null)
                    return false;

                deviceCache[currentDeviceId] = device;
            }

            // ✅ 도착 조건: Server 타입 장비 도달
            if (device.Type.Equals("Server", StringComparison.OrdinalIgnoreCase))
                return true;

            // ✅ 각 포트를 통해 연결된 다음 장비로 재귀 탐색
            foreach (var port in device.Ports)
            {
                var conn = port.Connection;
                var cable = conn?.Cable;
                var nextPort = conn?.ToPort;
                var nextDevice = nextPort?.Device;

                // ❌ 연결이 불완전한 경우 스킵
                if (conn == null || cable == null || nextPort == null || nextDevice == null)
                    continue;

                // 🔒 자기 자신으로의 루프 방지
                if (nextDevice.DeviceId == currentDeviceId)
                    continue;

                // 🔄 경로에 현재 hop 추가
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

                // ✅ 다음 장비로 재귀 호출
                if (await DFS(nextDevice.DeviceId, deviceCache, visited, path, depth + 1, maxDepth))
                    return true;

                // 🔙 백트래킹 (경로 및 방문 기록에서 제거)
                path.RemoveAt(path.Count - 1);
            }

            visited.Remove(currentDeviceId);
            return false;
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
