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
        /// </summary>
        // GetAllAsync() — ONLY change: Include(d => d.Rack)
        public async Task<List<DeviceDto>> GetAllAsync()
        {
            var devices = await _context.Devices
                .Include(d => d.Rack)
                .Include(d => d.Ports)
                    .ThenInclude(p => p.Connection)
                        .ThenInclude(c => c.ToPort)
                            .ThenInclude(p => p.Device)
                .AsSplitQuery()
                .AsNoTracking()
                .ToListAsync();

            foreach (var device in devices)
            {
                foreach (var port in device.Ports)
                {
                    if (port.Connection != null)
                    {
                        //Console.WriteLine($"[DEBUG] Port {port.PortId} → ToPort {port.Connection.ToPort?.PortId} / ToDevice {port.Connection.ToPort?.Device?.DeviceId}");
                    }
                }
            }

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
                    device.Ports.Add(new Port { Name = $"Port {i + 1}" });
                }
            }

            if (!string.Equals(device.Type, "Switch", StringComparison.OrdinalIgnoreCase))
            {
                device.RackId = null;
            }
            else
            {
                bool rackExists = await _context.Racks.AnyAsync(r => r.RackId == device.RackId);
                if (!rackExists)
                    return null;
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
                    .ThenInclude(p => p.Connection)
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

            if (device == null)
                return false;

            // 연결된 케이블 ID 수집
            var connectionsToDelete = device.Ports
                .Where(p => p.Connection != null)
                .Select(p => p.Connection!)
                .ToList();

            var cableIds = connectionsToDelete
                .Select(c => c.CableId)
                .Distinct()
                .ToList();

            // 1. CableConnection 삭제
            _context.CableConnections.RemoveRange(connectionsToDelete);

            // 2. Port 삭제
            _context.Ports.RemoveRange(device.Ports);

            // 3. Cable 삭제
            var cablesToDelete = await _context.Cables
                .Where(c => cableIds.Contains(c.CableId))
                .ToListAsync();
            _context.Cables.RemoveRange(cablesToDelete);

            // 4. Device 삭제
            _context.Devices.Remove(device);

            await _context.SaveChangesAsync();
            return true;
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
        /// </summary>
        public async Task<int> UpdateStatusBulkAsync(IEnumerable<(int deviceId, string status, bool? enablePing)> items)
        {
            var list = items.ToList();
            if (list.Count == 0) return 0;

            var ids = list.Select(i => i.deviceId).Distinct().ToList();
            var devices = await _context.Devices.Where(d => ids.Contains(d.DeviceId)).ToListAsync();
            var map = items
            .GroupBy(i => i.deviceId)
            .ToDictionary(g => g.Key, g => g.Last());

            foreach (var d in devices)
            {
                var req = map[d.DeviceId];
                var normalized = NormalizeStatus(req.status);
                if (!AllowedStatuses.Contains(normalized))
                    throw new ArgumentException($"허용되지 않는 상태: {req.status}");

                d.Status = normalized;
                if (req.enablePing.HasValue) d.EnablePing = req.enablePing.Value;
                d.LastCheckedAt = DateTime.UtcNow;
                d.LatencyMs = null;
            }

            await _context.SaveChangesAsync();
            return devices.Count;
        }
    }
}