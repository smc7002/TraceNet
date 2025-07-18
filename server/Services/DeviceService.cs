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

        public DeviceService(TraceNetDbContext context, IMapper mapper)
        {
            _context = context;
            _mapper = mapper;
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
    }
}
