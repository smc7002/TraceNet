using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;
using TraceNet.DTOs;

namespace TraceNet.Services
{
    public class DeviceService
    {
        private readonly TraceNetDbContext _context;

        public DeviceService(TraceNetDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// 전체 디바이스 목록 + 포트 포함 조회
        /// </summary>
        public async Task<List<Device>> GetAllAsync()
        {
            var devices = await _context.Devices
                .Include(d => d.Ports)
                .ToListAsync();

            // 👉 콘솔 출력: 실제 포트 수 확인용
            foreach (var device in devices)
            {
                Console.WriteLine($"{device.Name} has {device.Ports.Count} ports.");
            }

            return devices;
        }

        /// <summary>
        /// 새로운 디바이스 등록 + 포트 자동 생성
        /// </summary>
        public async Task<Device?> CreateAsync(Device device)
        {
            // 유효성 검사
            if (string.IsNullOrWhiteSpace(device.Name) || device.PortCount <= 0)
                return null;

            // Switch 타입이 아닌 경우 RackId 제거
            if (!device.Type.Equals("Switch", StringComparison.OrdinalIgnoreCase))
            {
                device.RackId = null;
            }
            else
            {
                // Switch인데 RackId가 null이거나 유효하지 않으면 실패
                bool rackExists = await _context.Racks.AnyAsync(r => r.RackId == device.RackId);
                if (!rackExists)
                    return null;
            }

            // 장치 저장
            _context.Devices.Add(device);
            await _context.SaveChangesAsync();

            // 포트 자동 생성
            for (int i = 1; i <= device.PortCount; i++)
            {
                _context.Ports.Add(new Port
                {
                    Name = $"Port {i}",
                    DeviceId = device.DeviceId
                });
            }

            await _context.SaveChangesAsync();

            // 생성된 장치 반환 (포트 포함)
            return await _context.Devices
                .Include(d => d.Ports)
                .FirstOrDefaultAsync(d => d.DeviceId == device.DeviceId);
        }



        /// <summary>
        /// 디바이스 + 관련 포트 삭제
        /// </summary>
        public async Task<bool> DeleteAsync(int deviceId)
        {
            var device = await _context.Devices
                .Include(d => d.Ports)
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);

            if (device == null)
                return false;

            _context.Ports.RemoveRange(device.Ports);
            _context.Devices.Remove(device);
            await _context.SaveChangesAsync();

            return true;
        }
    }
}
