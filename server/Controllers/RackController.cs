using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.DTOs;

namespace TraceNet.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RackController : ControllerBase
    {
        private readonly TraceNetDbContext _context;
        public RackController(TraceNetDbContext context) => _context = context;

        /// <summary>
        /// GET: /api/rack
        /// Returns all racks with basic information.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<RackDto>>> GetAll()
        {
            // Query racks from the database without EF change tracking
            var racks = await _context.Racks
                .AsNoTracking()
                .Select(r => new RackDto { RackId = r.RackId, Name = r.Name })
                .OrderBy(r => r.Name) // Ensure consistent ordering
                .ToListAsync();

            // Return 200 OK with the list of racks
            return Ok(racks);
        }
    }
}
