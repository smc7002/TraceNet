using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;

namespace TraceNet.Services
{
    /// <summary>
    /// Service class responsible for querying port-related data.
    /// </summary>
    public class PortService
    {
        private readonly TraceNetDbContext _context;

        public PortService(TraceNetDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Retrieve all ports that belong to the specified DeviceId.
        /// </summary>
        public async Task<List<Port>> GetByDeviceIdAsync(int deviceId)
        {
            return await _context.Ports
                .Where(p => p.DeviceId == deviceId)
                .ToListAsync();
        }

        /// <summary>
        /// Check whether a port exists for the given port ID.
        /// </summary>
        public async Task<bool> ExistsAsync(int portId)
        {
            return await _context.Ports.AnyAsync(p => p.PortId == portId);
        }

        /// <summary>
        /// Retrieve all ports along with their associated device information.
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
