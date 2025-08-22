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
        /// 전체 디바이스 목록 + 포트 포함 조회
        /// 
        /// 성능 최적화:
        /// - AsSplitQuery(): 복잡한 Include 관계를 여러 쿼리로 분할하여 N+1 문제 방지
        /// - AsNoTracking(): 읽기 전용으로 변경 추적 비활성화하여 메모리 절약
        /// 
        /// Include 구조: Device → Ports → Connection → ToPort → ToDevice
        /// </summary>
        public async Task<List<DeviceDto>> GetAllAsync()
        {
            // 복합 Include 쿼리 - 전체 네트워크 토폴로지 조회
            var devices = await _context.Devices
            .Include(d => d.Rack)
                .Include(d => d.Ports)                    // 장비의 모든 포트
                    .ThenInclude(p => p.Connection)       // 각 포트의 연결 정보
                        .ThenInclude(c => c.ToPort)       // 연결 대상 포트
                            .ThenInclude(p => p.Device)   // 연결 대상 장비
                .AsSplitQuery()    // 복잡한 관계를 여러 쿼리로 분할
                .AsNoTracking()    // 변경 추적 비활성화 (읽기 전용)
                .ToListAsync();

            // 디버깅용 연결 관계 검증 루프
            foreach (var device in devices)
            {
                foreach (var port in device.Ports)
                {
                    if (port.Connection != null)
                    {
                        // 디버깅 로그
                        //Console.WriteLine($"[DEBUG] Port {port.PortId} → ToPort {port.Connection.ToPort?.PortId} / ToDevice {port.Connection.ToPort?.Device?.DeviceId}");
                    }
                }
            }

            // Entity → DTO 변환 (AutoMapper 사용)
            return _mapper.Map<List<DeviceDto>>(devices);
        }

        /// <summary>
        /// 새로운 디바이스 등록 + 포트 자동 생성
        /// </summary>
        public async Task<Device?> CreateAsync(Device device)
        {
            if (string.IsNullOrWhiteSpace(device.Name) || device.PortCount <= 0)
                return null;

            // Ports 리스트 초기화
            if (device.Ports == null || device.Ports.Count == 0)
            {
                device.Ports = new List<Port>(); // null이면 새 리스트 생성

                for (int i = 0; i < device.PortCount; i++)
                {
                    device.Ports.Add(new Port { Name = (i + 1).ToString() });
                }
            }

            // 기존:
            // if (!string.Equals(device.Type, "Switch", StringComparison.OrdinalIgnoreCase))
            // {
            //     device.RackId = null;
            // }
            // else
            // {
            //     bool rackExists = await _context.Racks.AnyAsync(r => r.RackId == device.RackId);
            //     if (!rackExists)
            //         return null;
            // }

            if (!string.Equals(device.Type, "Switch", StringComparison.OrdinalIgnoreCase))
            {
                device.RackId = null; // 스위치 외에는 무조건 null
            }
            else
            {
                // 스위치여도 RackId 없으면 통과(선택사항)
                if (device.RackId.HasValue)
                {
                    var exists = await _context.Racks.AnyAsync(r => r.RackId == device.RackId.Value);
                    if (!exists) device.RackId = null; // 이상한 값 오면 무시
                }
            }


            _context.Devices.Add(device);
            await _context.SaveChangesAsync();

            return await _context.Devices
                .Include(d => d.Ports)
                .FirstOrDefaultAsync(d => d.DeviceId == device.DeviceId);
        }

        /// <summary>
        /// 디바이스 + 연결된 포트, 연결, 케이블 삭제
        /// </summary>
        public async Task<bool> DeleteAsync(int deviceId)
        {
            var device = await _context.Devices
                .Include(d => d.Ports)
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

            if (device == null) return false;

            // 이 장비의 모든 포트 ID
            var portIds = device.Ports.Select(p => p.PortId).ToList();

            // FromPort 또는 ToPort 로 물린 모든 케이블 연결 수집
            var connectionsToDelete = await _context.CableConnections
                .Where(cc => portIds.Contains(cc.FromPortId) || portIds.Contains(cc.ToPortId))
                .ToListAsync();

            var cableIds = connectionsToDelete
                .Select(c => c.CableId)
                .Distinct()
                .ToList();

            // 1) 연결 삭제
            _context.CableConnections.RemoveRange(connectionsToDelete);

            // 2) 케이블 삭제 (연결 지운 뒤)
            var cablesToDelete = await _context.Cables
                .Where(c => cableIds.Contains(c.CableId))
                .ToListAsync();
            _context.Cables.RemoveRange(cablesToDelete);

            // 3) 포트 삭제
            _context.Ports.RemoveRange(device.Ports);

            // 4) 장비 삭제
            _context.Devices.Remove(device);

            await _context.SaveChangesAsync();
            return true;
        }

        /// <summary>
        /// 모든 장비를 기존 DeleteAsync(deviceId) 로직을 재사용해 순차 삭제.
        /// 이미 검증된 단일 삭제 경로를 그대로 이용하므로 안전함.
        /// </summary>
        public async Task<(int deletedDevices, int deletedPorts, int deletedConnections, int deletedCables)> DeleteAllAsync()
        {
            // 삭제 전 개수 취합 
            var totalPorts = await _context.Ports.CountAsync();
            var totalConnections = await _context.CableConnections.CountAsync();
            var totalCables = await _context.Cables.CountAsync();

            // 장비 ID만 가볍게 조회
            var ids = await _context.Devices.Select(d => d.DeviceId).ToListAsync();
            int ok = 0;

            // 기존 검증된 삭제 루틴 재사용
            foreach (var id in ids)
            {
                var success = await DeleteAsync(id);
                if (success) ok++;
            }

            return (ok, totalPorts, totalConnections, totalCables);
        }


        /// <summary>
        /// 단일 장비 Ping 실행
        /// </summary>
        public async Task<PingResultDto> PingDeviceAsync(int deviceId, int timeoutMs = 2000)
        {
            var device = await _context.Devices.FirstOrDefaultAsync(d => d.DeviceId == deviceId);
            if (device == null)
                throw new KeyNotFoundException($"장비 ID {deviceId}를 찾을 수 없습니다.");

            // 수동모드: Ping 건너뜀 (마지막 점검시간만 업데이트)
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
                    ErrorMessage = "Ping 비활성화됨 (EnablePing=false)"
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
                    ErrorMessage = "IP 주소가 설정되지 않음"
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
        /// 여러 장비 일괄 Ping 실행 (안전한 매핑 방식)
        /// </summary>
        public async Task<List<PingResultDto>> PingMultipleDevicesAsync(
     List<int> deviceIds, int timeoutMs = 2000, int maxConcurrency = 10)
        {
            _logger.LogInformation("다중 Ping 시작: 장비 수={Count}, 동시성={MaxConcurrency}",
                deviceIds.Count, maxConcurrency);

            var devices = await _context.Devices
                .Where(d => deviceIds.Contains(d.DeviceId))
                .ToListAsync();

            var results = new List<PingResultDto>();
            if (!devices.Any()) return results;

            // 1) EnablePing=false
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
                    ErrorMessage = "Ping 비활성화됨 (EnablePing=false)"
                });
            }

            // 2) IP 없음 (EnablePing=true)
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
                    ErrorMessage = "IP 주소가 설정되지 않음"
                });
            }

            // 3) 실제 Ping 대상 (IP 있고 EnablePing=true)
            var targets = devices.Where(d => !string.IsNullOrEmpty(d.IPAddress) && d.EnablePing).ToList();
            if (targets.Any())
            {
                using var sem = new SemaphoreSlim(maxConcurrency, maxConcurrency);

                // 병렬 태스크에서는 EF 엔티티 수정 금지! 결과만 반환
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
                        _logger.LogError(ex, "장비 {DeviceId}({IP}) Ping 실패", d.DeviceId, d.IPAddress);
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

                // ← 단일 스레드에서 EF 엔티티 업데이트
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
        /// 장비 상태 조회 (최신 Ping 결과 포함)
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
            // 첫 글자 대문자화
            return char.ToUpper(lower[0], CultureInfo.InvariantCulture) + lower[1..];
        }

        /// <summary>
        /// 수동 상태 업데이트 (선택적으로 EnablePing도 변경)
        /// </summary>
        public async Task<DeviceDto?> UpdateStatusAsync(int deviceId, string status, bool? enablePing = null)
        {
            var device = await _context.Devices.FirstOrDefaultAsync(d => d.DeviceId == deviceId);
            if (device == null) return null;

            var normalized = NormalizeStatus(status);
            if (!AllowedStatuses.Contains(normalized))
                throw new ArgumentException($"허용되지 않는 상태: {status}");

            device.Status = normalized;
            if (enablePing.HasValue) device.EnablePing = enablePing.Value;
            device.LastCheckedAt = DateTime.UtcNow;
            // 수동 지정이면 레이턴시는 무의미할 수 있음
            device.LatencyMs = null;

            await _context.SaveChangesAsync();
            return _mapper.Map<DeviceDto>(device);
        }

        /// <summary>
        /// 다수 장비 상태 일괄 업데이트
        /// 
        /// 처리 로직:
        /// 1. 중복 deviceId 제거 (마지막 요청이 우선)
        /// 2. 존재하는 장비만 필터링
        /// 3. 상태값 정규화 및 검증
        /// 4. 일괄 업데이트 후 단일 SaveChanges 호출
        /// 
        /// 단일 트랜잭션으로 DB roundtrip 최소화
        /// ControlBar "상태 변경" 드롭다운에서 전체 장비 일괄 처리
        /// </summary>
        public async Task<int> UpdateStatusBulkAsync(IEnumerable<(int deviceId, string status, bool? enablePing)> items)
        {
            var list = items.ToList();
            if (list.Count == 0) return 0;

            // 대상 장비 ID 수집 (중복 제거)
            var ids = list.Select(i => i.deviceId).Distinct().ToList();

            // 존재하는 장비만 조회 (존재하지 않는 ID는 무시)
            var devices = await _context.Devices.Where(d => ids.Contains(d.DeviceId)).ToListAsync();

            // 중복 deviceId 처리: 마지막 요청이 우선 적용
            var map = items
                .GroupBy(i => i.deviceId)
                .ToDictionary(g => g.Key, g => g.Last());

            // 각 장비에 대해 상태 업데이트 적용
            foreach (var d in devices)
            {
                var req = map[d.DeviceId];

                // 상태값 정규화 (대소문자 통일: "online" → "Online")
                var normalized = NormalizeStatus(req.status);
                if (!AllowedStatuses.Contains(normalized))
                    throw new ArgumentException($"허용되지 않는 상태: {req.status}");

                // 장비 상태 업데이트
                d.Status = normalized;
                if (req.enablePing.HasValue) d.EnablePing = req.enablePing.Value;
                d.LastCheckedAt = DateTime.UtcNow;
                d.LatencyMs = null;  // 수동 상태 변경이므로 레이턴시 초기화
            }

            // 모든 변경사항을 한 번에 저장 (transaction 효율성)
            await _context.SaveChangesAsync();
            return devices.Count;  // 실제 업데이트된 장비 수 반환
        }
    }
}