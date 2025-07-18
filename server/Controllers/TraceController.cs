using Microsoft.AspNetCore.Mvc;
using TraceNet.DTOs;
using TraceNet.Services;

namespace TraceNet.Controllers
{
    /// <summary>
    /// 네트워크 경로 추적 API 컨트롤러
    /// 지정된 장비(DeviceId)에서 출발하여 루트(서버)까지의 연결 경로를 반환
    /// </summary>
    [ApiController]
    [Route("api/trace")]
    public class TraceController : ControllerBase
    {
        private readonly TraceService _traceService;

        public TraceController(TraceService traceService)
        {
            _traceService = traceService;
        }

        /// <summary>
        /// 📡 특정 장비에서 서버까지의 경로 추적
        /// </summary>
        /// <param name="deviceId">출발 장비의 ID</param>
        /// <returns>TraceResultDto (경로 + 케이블)</returns>
        [HttpGet("{deviceId}")]
        public async Task<ActionResult<TraceResultDto>> TraceFrom(int deviceId)
        {
            Console.WriteLine($"[🌐 TraceController] 호출됨 - deviceId: {deviceId}");

            try
            {
                var result = await _traceService.TracePathAsync(deviceId);

                // ❗ 명시적으로 탐색 실패 시
                if (!result.Success)
                    return NotFound(new { message = "서버까지의 경로를 찾을 수 없습니다." });

                // ✅ 케이블도 포함된 TraceResultDto 전체 반환
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                // 시작 장비가 존재하지 않을 경우
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                // 경로를 찾지 못한 경우
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                // 기타 예상치 못한 오류 → 전역 미들웨어로 위임 가능
                Console.WriteLine($"[❌ TraceController 오류] {ex.Message}");
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}
