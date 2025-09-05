using Microsoft.AspNetCore.Mvc;
using TraceNet.Models;
using TraceNet.Services;
using TraceNet.DTOs;
using AutoMapper;
using System.Linq;

namespace TraceNet.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DeviceController : ControllerBase
    {
        private readonly DeviceService _deviceService;
        private readonly IMapper _mapper;

        public DeviceController(DeviceService deviceService, IMapper mapper)
        {
            _deviceService = deviceService;
            _mapper = mapper;
        }

        // ===== Retrieval =====

        /// <summary>
        /// Retrieve all devices
        /// GET: api/device
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DeviceDto>>> GetDevices()
        {
            var devices = await _deviceService.GetAllAsync();
            return Ok(devices ?? new List<DeviceDto>());
        }

        /// <summary>
        /// Retrieve a single device
        /// GET: api/device/{id}
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<DeviceDto>> GetDevice(int id)
        {
            var device = await _deviceService.GetWithStatusAsync(id);
            if (device == null)
                return NotFound(new { message = $"Device ID {id} not found." });
            return Ok(device);
        }

        /// <summary>
        /// Retrieve device status (includes latest Ping result)
        /// GET: api/device/{id}/status
        /// </summary>
        [HttpGet("{id}/status")]
        public async Task<ActionResult<DeviceDto>> GetDeviceStatus(int id)
        {
            try
            {
                var device = await _deviceService.GetWithStatusAsync(id);
                if (device == null)
                    return NotFound(new { message = $"Device ID {id} not found." });

                return Ok(device);
            }
            catch (Exception ex)
            {
                throw new ApplicationException("An error occurred while retrieving the device status.", ex);
            }
        }

        // ===== Create/Delete =====

        /// <summary>
        /// Create a new device and automatically create ports
        /// POST: api/device
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<DeviceDto>> CreateDevice([FromBody] CreateDeviceDto dto)
        {
            if (dto == null)
                return BadRequest(new { message = "Device information is required." });

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Device name is required." });

            var device = _mapper.Map<Device>(dto);
            var created = await _deviceService.CreateAsync(device);
            if (created == null)
                return BadRequest(new { message = "Invalid device information." });

            var createdDto = _mapper.Map<DeviceDto>(created);

            // Set Location header to the single device retrieval endpoint
            return CreatedAtAction(nameof(GetDevice), new { id = createdDto.DeviceId }, createdDto);
        }

        /// <summary>
        /// Delete a device
        /// DELETE: api/device/{id}
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDevice(int id)
        {
            try
            {
                var success = await _deviceService.DeleteAsync(id);
                if (!success)
                    return NotFound(new { message = $"Device ID {id} not found." });

                return NoContent();
            }
            catch (Exception ex)
            {
                throw new ApplicationException("An error occurred while deleting the device.", ex);
            }
        }

        /// <summary>
        /// Delete all devices, ports, connections, and cables
        /// </summary>
        [HttpDelete("all")]
        public async Task<IActionResult> DeleteAll()
        {
            var result = await _deviceService.DeleteAllAsync();
            return Ok(new
            {
                deletedDevices = result.deletedDevices,
                deletedPorts = result.deletedPorts,
                deletedConnections = result.deletedConnections,
                deletedCables = result.deletedCables
            });
        }

        // ===== Status Update =====

        public record UpdateStatusRequest(string Status, bool? EnablePing);
        public record BulkUpdateStatusRequest(List<int> DeviceIds, string Status, bool? EnablePing);

        /// <summary>
        /// Update the status of a single device (optionally update EnablePing)
        /// PUT: api/device/{id}/status
        /// </summary>
        [HttpPut("{id}/status")]
        public async Task<ActionResult<DeviceDto>> UpdateStatus(int id, [FromBody] UpdateStatusRequest req)
        {
            try
            {
                var dto = await _deviceService.UpdateStatusAsync(id, req.Status, req.EnablePing);
                if (dto == null)
                    return NotFound(new { message = $"Device ID {id} not found." });
                return Ok(dto);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// Bulk update the status of multiple devices
        /// PUT: api/device/status/bulk
        /// </summary>
        [HttpPut("status/bulk")]
        public async Task<ActionResult<object>> BulkUpdateStatus([FromBody] BulkUpdateStatusRequest req)
        {
            if (req?.DeviceIds == null || req.DeviceIds.Count == 0)
                return BadRequest(new { message = "Target DeviceIds cannot be empty." });

            try
            {
                var items = req.DeviceIds.Select(id => (deviceId: id, status: req.Status, enablePing: req.EnablePing));
                var updated = await _deviceService.UpdateStatusBulkAsync(items);
                return Ok(new { updated });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ===== Ping =====

        /// <summary>
        /// Execute Ping for a single device
        /// POST: api/device/{id}/ping
        /// </summary>
        [HttpPost("{id}/ping")]
        public async Task<ActionResult<PingResultDto>> PingDevice(int id, [FromQuery] int timeout = 2000)
        {
            try
            {
                var result = await _deviceService.PingDeviceAsync(id, timeout);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                throw new ApplicationException("An error occurred while pinging the device.", ex);
            }
        }

        /// <summary>
        /// Execute Ping for multiple devices
        /// POST: api/device/ping/multi
        /// </summary>
        [HttpPost("ping/multi")]
        public async Task<ActionResult<IEnumerable<PingResultDto>>> PingMultipleDevices([FromBody] MultiPingRequestDto dto)
        {
            if (dto?.DeviceIds == null || !dto.DeviceIds.Any())
                return BadRequest(new { message = "A list of device IDs to ping is required." });

            try
            {
                var timeout = dto.TimeoutMs > 0 ? dto.TimeoutMs : 2000;
                // DeviceService default (maxConcurrency=10) is used — if DTO includes such a field, it can be passed to the service
                var results = await _deviceService.PingMultipleDevicesAsync(dto.DeviceIds, timeout);
                return Ok(results ?? new List<PingResultDto>());
            }
            catch (Exception ex)
            {
                throw new ApplicationException("An error occurred while executing bulk Ping.", ex);
            }
        }

        /// <summary>
        /// Execute Ping for all devices
        /// POST: api/device/ping/all
        /// </summary>
        [HttpPost("ping/all")]
        public async Task<ActionResult<IEnumerable<PingResultDto>>> PingAllDevices([FromQuery] int timeout = 2000)
        {
            try
            {
                // NOTE: If the service has a lightweight method (GetAllDeviceIdsAsync), prefer using that
                var allDevices = await _deviceService.GetAllAsync();
                var deviceIds = allDevices.Select(d => d.DeviceId).ToList();

                if (deviceIds.Count == 0)
                    return Ok(new List<PingResultDto>());

                var results = await _deviceService.PingMultipleDevicesAsync(deviceIds, timeout);
                return Ok(results);
            }
            catch (Exception ex)
            {
                throw new ApplicationException("An error occurred while executing Ping for all devices.", ex);
            }
        }
    }
}
