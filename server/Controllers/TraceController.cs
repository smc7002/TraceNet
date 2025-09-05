using Microsoft.AspNetCore.Mvc;
using TraceNet.DTOs;
using TraceNet.Services;

namespace TraceNet.Controllers
{
    /// <summary>
    /// Network Trace API Controller
    /// Returns the connection path from a given device (DeviceId) to the root (server).
    /// </summary>
    [ApiController]
    [Route("api/trace")]
    public class TraceController : ControllerBase
    {
        private readonly TraceService _traceService;
        private readonly DeviceService _deviceService;

        public TraceController(TraceService traceService, DeviceService deviceService)
        {
            _traceService = traceService;
            _deviceService = deviceService;
        }

        /// <summary>
        /// Trace the path from a specific device to the server
        /// </summary>
        /// <param name="deviceId">ID of the starting device</param>
        /// <returns>TraceResultDto (path + cables)</returns>
        [HttpGet("{deviceId}")]
        public async Task<ActionResult<TraceResultDto>> TraceFrom(int deviceId)
        {
            Console.WriteLine($"[🌐 TraceController] Invoked - deviceId: {deviceId}");

            try
            {
                var result = await _traceService.TracePathAsync(deviceId);

                // ❗ Explicit failure to find a path
                if (!result.Success)
                    return NotFound(new { message = "Could not find a path to the server." });

                // Return full TraceResultDto including cables
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                // Starting device does not exist
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                // Path not found
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                // Other unexpected errors → can be delegated to global middleware
                Console.WriteLine($"[❌ TraceController Error] {ex.Message}");
                return StatusCode(500, new { message = ex.Message });
            }
        }

        /// <summary>
        /// Execute Ping for all devices along the TracePath
        /// GET: api/trace/{deviceId}/ping
        /// </summary>
        [HttpGet("{deviceId}/ping")]
        public async Task<ActionResult<TracePingResultDto>> PingTracePath(int deviceId)
        {
            Console.WriteLine($"[🏓 TraceController] TracePath Ping invoked - deviceId: {deviceId}");

            try
            {
                // Call PingTracePathAsync from TraceService (reuses existing logic)
                var result = await _traceService.PingTracePathAsync(deviceId);
                
                if (!result.Success)
                {
                    return NotFound(new { message = result.ErrorMessage ?? "Failed to execute TracePath Ping." });
                }
                
                Console.WriteLine($"[🏓 TraceController] Ping completed - Total {result.TotalDevices}, Online {result.OnlineDevices}");
                
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[❌ TracePath Ping Error] {ex.Message}");
                return StatusCode(500, new { message = "An error occurred while executing TracePath Ping." });
            }
        }
    }
}
