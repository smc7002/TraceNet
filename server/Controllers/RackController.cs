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

        /// GET: /api/rack
        [HttpGet]
        public async Task<ActionResult<IEnumerable<RackDto>>> GetAll()
        {
            var racks = await _context.Racks
                .AsNoTracking()
                .Select(r => new RackDto { RackId = r.RackId, Name = r.Name })
                .OrderBy(r => r.Name)
                .ToListAsync();

            return Ok(racks);
        }
    }
}
