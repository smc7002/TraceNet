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

                if (devices == null || !devices.Any())
                    return NoContent(); // 데이터 없음

                return Ok(devices); // 정상 반환
            }
            catch (Exception ex)
            {
                // 예외는 전역 ExceptionMiddleware에서 처리되므로 재던짐
                throw new ApplicationException("장비 목록 조회 중 오류 발생", ex);
            }
        }

        /// <summary>
        /// 📥 새로운 장치 생성 및 포트 자동 생성
        /// POST: api/device
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<Device>> CreateDevice(CreateDeviceDto dto)
        {
            var device = _mapper.Map<Device>(dto);
            var created = await _deviceService.CreateAsync(device);

            if (created == null)
                return BadRequest("Invalid device data.");

            return CreatedAtAction(nameof(GetDevices), new { id = created.DeviceId }, created);
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
    }
}
