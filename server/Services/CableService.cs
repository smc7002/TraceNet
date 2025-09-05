using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;

namespace TraceNet.Services
{
    /// <summary>
    /// Service class for managing cables and their connections (CableConnection).
    /// </summary>
    public class CableService
    {
        private readonly TraceNetDbContext _context;

        public CableService(TraceNetDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Retrieve all cables including their connections and ports.
        /// Used for visualization diagram JSON.
        /// </summary>
        public async Task<List<CableConnection>> GetAllWithConnectionsAsync()
        {
            return await _context.CableConnections
                .Include(cc => cc.Cable)
                .Include(cc => cc.FromPort).ThenInclude(p => p.Device)
                .Include(cc => cc.ToPort).ThenInclude(p => p.Device)
                .ToListAsync();
        }

        /// <summary>
        /// Create a new cable along with its connection information.
        /// </summary>
        public async Task<Cable> CreateAsync(Cable cable)
        {
            // 1. Basic validation
            ValidateCableInput(cable);

            // 2. Uniqueness check (duplicate CableId)
            await EnsureCableIdIsUniqueAsync(cable.CableId);

            // 3. Validate connection (ports exist + no duplicate connections)
            await EnsureConnectionIsValidAsync(cable.Connection!);

            // 4. Save (can be extended with transactions if needed)
            _context.Cables.Add(cable);
            await _context.SaveChangesAsync();

            return cable;
        }

        private static void ValidateCableInput(Cable cable)
        {
            if (cable == null)
                throw new ArgumentNullException(nameof(cable));

            if (string.IsNullOrWhiteSpace(cable.CableId))
                throw new ArgumentException("CableId is required.");

            if (cable.Connection == null)
                throw new ArgumentException("Connection information is required.");

            if (cable.Connection.FromPortId == cable.Connection.ToPortId)
                throw new ArgumentException("FromPort and ToPort cannot be the same.");
        }

        private async Task EnsureCableIdIsUniqueAsync(string cableId)
        {
            bool exists = await _context.Cables.AnyAsync(c => c.CableId == cableId);
            if (exists)
                throw new InvalidOperationException($"CableId already exists: {cableId}");
        }

        private async Task EnsureConnectionIsValidAsync(CableConnection connection)
        {
            var portIds = new[] { connection.FromPortId, connection.ToPortId };

            // Check if ports exist and include device information
            var ports = await _context.Ports
                .Include(p => p.Device)
                .Where(p => portIds.Contains(p.PortId))
                .ToListAsync();

            if (ports.Count != 2)
            {
                var existingIds = ports.Select(p => p.PortId);
                var missing = portIds.Except(existingIds);
                throw new InvalidOperationException($"Non-existent port ID(s): {string.Join(", ", missing)}");
            }

            var fromPort = ports.First(p => p.PortId == connection.FromPortId);
            var toPort = ports.First(p => p.PortId == connection.ToPortId);

            // Check for duplicate connections
            bool anyConnected = await _context.CableConnections
                .AnyAsync(c => portIds.Contains(c.FromPortId) || portIds.Contains(c.ToPortId));

            if (anyConnected)
                throw new InvalidOperationException("One or more ports are already connected to another cable.");

            // ✅ Device type validation: PC must only connect to SWITCH
            string fromType = fromPort.Device.Type.ToUpper();
            string toType = toPort.Device.Type.ToUpper();

            bool isPCToInvalid =
                (fromType == "PC" && toType != "SWITCH") ||
                (toType == "PC" && fromType != "SWITCH");

            if (isPCToInvalid)
                throw new InvalidOperationException("A PC can only be connected to a SWITCH.");
        }

        /// <summary>
        /// Delete a cable and its associated connection.
        /// Removes them in order to respect foreign key constraints.
        /// </summary>
        public async Task DeleteAsync(string cableId)
        {
            var cable = await _context.Cables
                .Include(c => c.Connection)
                .FirstOrDefaultAsync(c => c.CableId == cableId);

            if (cable == null)
                throw new KeyNotFoundException($"CableId not found: {cableId}");

            if (cable.Connection != null)
                _context.CableConnections.Remove(cable.Connection);

            _context.Cables.Remove(cable);
            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Basic validation for a cable object.
        /// </summary>
        private bool IsInvalidCable(Cable cable)
        {
            return string.IsNullOrWhiteSpace(cable.CableId) || cable.Connection == null;
        }

        /// <summary>
        /// Validate whether ports exist and whether the connection is duplicated.
        /// </summary>
        private async Task<bool> IsValidConnectionAsync(CableConnection connection)
        {
            // 1. Prevent self-connections
            if (connection.FromPortId == connection.ToPortId)
                return false;

            // 2. Ensure both ports exist
            var fromExists = await _context.Ports.AnyAsync(p => p.PortId == connection.FromPortId);
            var toExists = await _context.Ports.AnyAsync(p => p.PortId == connection.ToPortId);
            if (!fromExists || !toExists)
                return false;

            // 3. Prevent duplicate connections (either From or To already used)
            var portUsed = await _context.CableConnections.AnyAsync(c =>
                c.FromPortId == connection.FromPortId ||
                c.ToPortId == connection.FromPortId ||
                c.FromPortId == connection.ToPortId ||
                c.ToPortId == connection.ToPortId
            );

            return !portUsed;
        }
    }
}
