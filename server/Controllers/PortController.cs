using Microsoft.AspNetCore.Mvc;
using TraceNet.Models;
using TraceNet.Services;

namespace TraceNet.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PortController : ControllerBase
    {
        private readonly PortService _portService;

        public PortController(PortService portService)
        {
            _portService = portService;
        }

        /// <summary>
        /// Retrieve all ports connected to a specific device
        /// GET: /api/port?deviceId=3
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Port>>> GetPortsByDevice([FromQuery] int deviceId)
        {
            var ports = await _portService.GetByDeviceIdAsync(deviceId);

            if (ports.Count == 0)
                return NotFound($"No ports found for deviceId={deviceId}");

            return Ok(ports);
        }

        /// <summary>
        /// Retrieve all ports (including associated devices)
        /// GET: /api/ports
        /// </summary>
        [HttpGet("/api/ports")]
        public async Task<ActionResult<IEnumerable<Port>>> GetAllPorts()
        {
            var ports = await _portService.GetAllWithDeviceAsync(); // ✅ Includes devices
            return Ok(ports);
        }
    }
}
