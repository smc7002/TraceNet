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
        /// 특정 Device에 연결된 모든 포트 조회
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
        /// 전체 포트 목록 조회 (장비 포함)
        /// GET: /api/ports
        /// </summary>
        [HttpGet("/api/ports")]
        public async Task<ActionResult<IEnumerable<Port>>> GetAllPorts()
        {
            var ports = await _portService.GetAllWithDeviceAsync(); // ✅ 장비 포함
            return Ok(ports);
        }
    }
}
