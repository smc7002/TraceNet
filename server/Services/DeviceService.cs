using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;
using TraceNet.DTOs;
using AutoMapper;

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
        public async Task<List<DeviceDto>> GetAllAsync()
        {
            var devices = await _context.Devices
                .Include(d => d.Ports)
                    .ThenInclude(p => p.Connection)
                        .ThenInclude(c => c.ToPort)
                            .ThenInclude(p => p.Device)
                .AsSplitQuery()
                .ToListAsync();

            foreach (var device in devices)
            {
                foreach (var port in device.Ports)
                {
                    if (port.Connection != null)
                    {
                        Console.WriteLine($"[DEBUG] Port {port.PortId} → ToPort {port.Connection.ToPort?.PortId} / ToDevice {port.Connection.ToPort?.Device?.DeviceId}");
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

            if (device.Ports == null || device.Ports.Count == 0)
            {
                for (int i = 0; i < device.PortCount; i++)
                {
                    device.Ports.Add(new Port { Name = $"Port {i + 1}" });
                }
            }

            if (!device.Type.Equals("Switch", StringComparison.OrdinalIgnoreCase))
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
            var device = await _context.Devices
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

            if (device == null)
                throw new KeyNotFoundException($"장비 ID {deviceId}를 찾을 수 없습니다.");

            if (string.IsNullOrEmpty(device.IPAddress))
            {
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

            // PingService 호출
            var pingResult = await _pingService.PingAsync(device.IPAddress, timeoutMs);

            // Device 상태 업데이트
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
        /// 여러 장비 일괄 Ping 실행
        /// </summary>
        public async Task<List<PingResultDto>> PingMultipleDevicesAsync(List<int> deviceIds, int timeoutMs = 2000)
        {
            var devices = await _context.Devices
                .Where(d => deviceIds.Contains(d.DeviceId))
                .ToListAsync();

            if (!devices.Any())
                return new List<PingResultDto>();

            var results = new List<PingResultDto>();

            // IP가 있는 장비들만 Ping
            var devicesWithIp = devices.Where(d => !string.IsNullOrEmpty(d.IPAddress)).ToList();

            if (devicesWithIp.Any())
            {
                var ipAddresses = devicesWithIp.Select(d => d.IPAddress!).ToList();
                var pingResults = await _pingService.PingMultipleAsync(ipAddresses, timeoutMs);

                // 결과를 Device 정보와 매핑
                for (int i = 0; i < devicesWithIp.Count; i++)
                {
                    var device = devicesWithIp[i];
                    var pingResult = pingResults[i];

                    // Device 상태 업데이트
                    device.Status = pingResult.Status;
                    device.LatencyMs = pingResult.LatencyMs;
                    device.LastCheckedAt = DateTime.UtcNow;

                    results.Add(new PingResultDto
                    {
                        DeviceId = device.DeviceId,
                        DeviceName = device.Name,
                        IpAddress = device.IPAddress!,
                        Status = pingResult.Status,
                        LatencyMs = pingResult.LatencyMs,
                        CheckedAt = DateTime.UtcNow,
                        ErrorMessage = pingResult.ErrorMessage
                    });
                }
            }

            // IP가 없는 장비들 처리
            var devicesWithoutIp = devices.Where(d => string.IsNullOrEmpty(d.IPAddress));
            foreach (var device in devicesWithoutIp)
            {
                results.Add(new PingResultDto
                {
                    DeviceId = device.DeviceId,
                    DeviceName = device.Name,
                    IpAddress = "",
                    Status = "Unknown",
                    CheckedAt = DateTime.UtcNow,
                    ErrorMessage = "IP 주소가 설정되지 않음"
                });
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
                .Include(d => d.Ports)
                    .ThenInclude(p => p.Connection)
                        .ThenInclude(c => c.ToPort)
                            .ThenInclude(p => p.Device)
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

            if (device == null)
                return null;

            return _mapper.Map<DeviceDto>(device);
        }
    }
}
