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
        private readonly DeviceService _deviceService;

        public TraceController(TraceService traceService, DeviceService deviceService)
        {
            _traceService = traceService;
            _deviceService = deviceService;
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

        /// <summary>
        /// 🏓 TracePath 상의 모든 장비 Ping 실행
        /// GET: api/trace/{deviceId}/ping
        /// </summary>
        [HttpGet("{deviceId}/ping")]
        public async Task<ActionResult<TracePingResultDto>> PingTracePath(int deviceId)
        {
            Console.WriteLine($"[🏓 TraceController] TracePath Ping 호출 - deviceId: {deviceId}");

            try
            {
                // TraceService의 PingTracePathAsync 호출 (기존 로직 재사용)
                var result = await _traceService.PingTracePathAsync(deviceId);
                
                if (!result.Success)
                {
                    return NotFound(new { message = result.ErrorMessage ?? "TracePath Ping 실행 실패" });
                }
                
                Console.WriteLine($"[🏓 TraceController] Ping 완료 - 총 {result.TotalDevices}개, 온라인 {result.OnlineDevices}개");
                
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[❌ TracePath Ping 오류] {ex.Message}");
                return StatusCode(500, new { message = "TracePath Ping 중 오류 발생" });
            }
        }
    }
}