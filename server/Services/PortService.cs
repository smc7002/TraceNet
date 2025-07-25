using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;

namespace TraceNet.Services
{
    /// <summary>
    /// 포트(Port) 관련 데이터 조회를 담당하는 서비스 클래스
    /// </summary>
    public class PortService
    {
        private readonly TraceNetDbContext _context;

        public PortService(TraceNetDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// 지정된 DeviceId에 속한 모든 포트 조회
        /// </summary>
        public async Task<List<Port>> GetByDeviceIdAsync(int deviceId)
        {
            return await _context.Ports
                .Where(p => p.DeviceId == deviceId)
                .ToListAsync();
        }

        /// <summary>
        /// 특정 포트 ID가 존재하는지 확인
        /// </summary>
        public async Task<bool> ExistsAsync(int portId)
        {
            return await _context.Ports.AnyAsync(p => p.PortId == portId);
        }

        /// <summary>
        /// 모든 포트를 장비 정보와 함께 조회
        /// </summary>
        public async Task<List<Port>> GetAllWithDeviceAsync()
        {
            return await _context.Ports
                .Include(p => p.Device)
                .OrderBy(p => p.PortId)
                .ToListAsync();
        }
    }
}
