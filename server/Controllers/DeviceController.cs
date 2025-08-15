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

        // ===== 조회 =====

        /// <summary>
        /// 모든 장치 목록 조회
        /// GET: api/device
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DeviceDto>>> GetDevices()
        {
            var devices = await _deviceService.GetAllAsync();
            return Ok(devices ?? new List<DeviceDto>());
        }

        /// <summary>
        /// 단일 장치 조회
        /// GET: api/device/{id}
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<DeviceDto>> GetDevice(int id)
        {
            var device = await _deviceService.GetWithStatusAsync(id);
            if (device == null)
                return NotFound(new { message = $"장비 ID {id}를 찾을 수 없습니다." });
            return Ok(device);
        }

        /// <summary>
        /// 장비 상태 조회 (최신 Ping 결과 포함)
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

        // ===== 생성/삭제 =====

        /// <summary>
        /// 새로운 장치 생성 및 포트 자동 생성
        /// POST: api/device
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<DeviceDto>> CreateDevice([FromBody] CreateDeviceDto dto)
        {
            if (dto == null)
                return BadRequest(new { message = "장비 정보가 필요합니다." });

            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "장비 이름은 필수입니다." });

            var device = _mapper.Map<Device>(dto);
            var created = await _deviceService.CreateAsync(device);
            if (created == null)
                return BadRequest(new { message = "잘못된 장비 정보입니다." });

            var createdDto = _mapper.Map<DeviceDto>(created);

            // ✅ 단건 조회 엔드포인트로 Location 설정
            return CreatedAtAction(nameof(GetDevice), new { id = createdDto.DeviceId }, createdDto);
        }

        /// <summary>
        /// 장치 삭제
        /// DELETE: api/device/{id}
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDevice(int id)
        {
            try
            {
                var success = await _deviceService.DeleteAsync(id);
                if (!success)
                    return NotFound(new { message = $"장비 ID {id}를 찾을 수 없습니다." });

                return NoContent();
            }
            catch (Exception ex)
            {
                throw new ApplicationException("장비 삭제 중 오류 발생", ex);
            }
        }

        // ===== 상태 변경 =====

        public record UpdateStatusRequest(string Status, bool? EnablePing);
        public record BulkUpdateStatusRequest(List<int> DeviceIds, string Status, bool? EnablePing);

        /// <summary>
        /// 단일 장비 상태 변경 (선택적으로 EnablePing 변경)
        /// PUT: api/device/{id}/status
        /// </summary>
        [HttpPut("{id}/status")]
        public async Task<ActionResult<DeviceDto>> UpdateStatus(int id, [FromBody] UpdateStatusRequest req)
        {
            try
            {
                var dto = await _deviceService.UpdateStatusAsync(id, req.Status, req.EnablePing);
                if (dto == null)
                    return NotFound(new { message = $"장비 ID {id}를 찾을 수 없습니다." });
                return Ok(dto);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// 다수 장비 상태 일괄 변경
        /// PUT: api/device/status/bulk
        /// </summary>
        [HttpPut("status/bulk")]
        public async Task<ActionResult<object>> BulkUpdateStatus([FromBody] BulkUpdateStatusRequest req)
        {
            if (req?.DeviceIds == null || req.DeviceIds.Count == 0)
                return BadRequest(new { message = "대상 DeviceIds가 비어 있습니다." });

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
        /// 단일 장비 Ping 실행
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
        /// 여러 장비 일괄 Ping 실행
        /// POST: api/device/ping/multi
        /// </summary>
        [HttpPost("ping/multi")]
        public async Task<ActionResult<IEnumerable<PingResultDto>>> PingMultipleDevices([FromBody] MultiPingRequestDto dto)
        {
            if (dto?.DeviceIds == null || !dto.DeviceIds.Any())
                return BadRequest(new { message = "Ping할 장비 ID 목록이 필요합니다." });

            try
            {
                var timeout = dto.TimeoutMs > 0 ? dto.TimeoutMs : 2000;
                // DeviceService의 기본값(maxConcurrency=10) 사용 — DTO에 필드가 있으면 서비스 확장으로 전달 가능
                var results = await _deviceService.PingMultipleDevicesAsync(dto.DeviceIds, timeout);
                return Ok(results ?? new List<PingResultDto>());
            }
            catch (Exception ex)
            {
                throw new ApplicationException("일괄 Ping 중 오류 발생", ex);
            }
        }

        /// <summary>
        /// 모든 장비 Ping 실행
        /// POST: api/device/ping/all
        /// </summary>
        [HttpPost("ping/all")]
        public async Task<ActionResult<IEnumerable<PingResultDto>>> PingAllDevices([FromQuery] int timeout = 2000)
        {
            try
            {
                // NOTE: 서비스에 경량 메서드(GetAllDeviceIdsAsync)가 있다면 그걸로 대체 권장
                var allDevices = await _deviceService.GetAllAsync();
                var deviceIds = allDevices.Select(d => d.DeviceId).ToList();

                if (deviceIds.Count == 0)
                    return Ok(new List<PingResultDto>());

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
