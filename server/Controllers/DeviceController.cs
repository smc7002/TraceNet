using Microsoft.AspNetCore.Mvc;
using TraceNet.Models;
using TraceNet.Services;
using TraceNet.DTOs;
using AutoMapper;

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

        /// <summary>
        /// 📥 모든 장치 목록 조회
        /// GET: api/device
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DeviceDto>>> GetDevices()
        {
            try
            {
                var devices = await _deviceService.GetAllAsync();

                // ✅ 항상 배열로 반환
                return Ok(devices ?? new List<DeviceDto>());
            }
            catch (Exception ex)
            {
                throw new ApplicationException("장비 목록 조회 중 오류 발생", ex);
            }
        }


        /// <summary>
        /// 📥 새로운 장치 생성 및 포트 자동 생성
        /// POST: api/device
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<Device>> CreateDevice([FromBody] CreateDeviceDto dto)
        {
            var device = _mapper.Map<Device>(dto);
            var created = await _deviceService.CreateAsync(device);

            if (created == null)
                return BadRequest("Invalid device data.");

            var createdDto = _mapper.Map<DeviceDto>(created);
            return CreatedAtAction(nameof(GetDevices), new { id = createdDto.DeviceId }, createdDto);

        }

        /// <summary>
        /// ❌ 장치 삭제
        /// DELETE: api/device/{id}
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDevice(int id)
        {
            var success = await _deviceService.DeleteAsync(id);
            if (!success)
                return NotFound();

            return NoContent();
        }

        // DeviceController.cs에 추가할 엔드포인트들

        /// <summary>
        /// 🏓 단일 장비 Ping 실행
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
                throw new ApplicationException("장비 Ping 중 오류 발생", ex);
            }
        }

        /// <summary>
        /// 🏓 여러 장비 일괄 Ping 실행  
        /// POST: api/device/ping/multi
        /// </summary>
        [HttpPost("ping/multi")]
        public async Task<ActionResult<IEnumerable<PingResultDto>>> PingMultipleDevices([FromBody] MultiPingRequestDto dto)
        {
            try
            {
                var results = await _deviceService.PingMultipleDevicesAsync(dto.DeviceIds, dto.TimeoutMs);
                return Ok(results ?? new List<PingResultDto>());
            }
            catch (Exception ex)
            {
                throw new ApplicationException("일괄 Ping 중 오류 발생", ex);
            }
        }

        /// <summary>
        /// 📥 장비 상태 조회 (Ping 결과 포함)
        /// GET: api/device/{id}/status
        /// </summary>
        [HttpGet("{id}/status")]
        public async Task<ActionResult<DeviceDto>> GetDeviceStatus(int id)
        {
            try
            {
                var device = await _deviceService.GetWithStatusAsync(id);
                if (device == null)
                    return NotFound(new { message = $"장비 ID {id}를 찾을 수 없습니다." });

                return Ok(device);
            }
            catch (Exception ex)
            {
                throw new ApplicationException("장비 상태 조회 중 오류 발생", ex);
            }
        }

        /// <summary>
        /// 🏓 모든 장비 Ping 실행
        /// POST: api/device/ping/all
        /// </summary>
        [HttpPost("ping/all")]
        public async Task<ActionResult<IEnumerable<PingResultDto>>> PingAllDevices([FromQuery] int timeout = 2000)
        {
            try
            {
                // 모든 장비 ID 조회
                var allDevices = await _deviceService.GetAllAsync();
                var deviceIds = allDevices.Select(d => d.DeviceId).ToList();

                var results = await _deviceService.PingMultipleDevicesAsync(deviceIds, timeout);
                return Ok(results);
            }
            catch (Exception ex)
            {
                throw new ApplicationException("전체 장비 Ping 중 오류 발생", ex);
            }
        }
    }
}
