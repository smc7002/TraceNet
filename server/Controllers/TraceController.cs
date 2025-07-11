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
        /// <returns>TraceDto 경로 리스트</returns>
        [HttpGet("{deviceId}")]
        public async Task<ActionResult<TraceResultDto>> TraceFrom(int deviceId)
        {
            try
            {
                var result = await _traceService.TracePathAsync(deviceId);

                // Path는 존재하지만 비어 있는 경우 (이론상 없음 - 방어적으로 처리 가능)
                if (result.Path.Count == 0)
                    return NotFound(new { message = "경로를 찾을 수 없습니다." });

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
                throw new ApplicationException("경로 추적 중 오류가 발생했습니다.", ex);
            }
        }

    }
}
