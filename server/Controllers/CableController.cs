using Microsoft.AspNetCore.Mvc;
using TraceNet.Models;
using TraceNet.Services;
using TraceNet.DTOs;
using AutoMapper;

namespace TraceNet.Controllers
{
    /// <summary>
    /// 케이블 관리 API 컨트롤러
    /// 네트워크 케이블과 포트 간의 연결 관계를 생성, 조회, 삭제하는 REST API 제공
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class CableController : ControllerBase
    {
        private readonly CableService _cableService;
        private readonly IMapper _mapper;

        public CableController(CableService cableService, IMapper mapper)
        {
            _cableService = cableService;
            _mapper = mapper;
        }

        /// <summary>
        /// 📥 모든 케이블 정보 조회 (연결 포함)
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CableDto>>> GetAllCables()
        {
            try
            {
                var connections = await _cableService.GetAllWithConnectionsAsync();

                if (connections == null || !connections.Any())
                    return Ok(new List<CableDto>()); // 항상 [] 반환 (204 말고!)

                // ✅ 수동 매핑: 관계 따라 값 추출
                var cableDtos = connections.Select(conn => new CableDto
                {
                    CableId = conn.Cable.CableId,
                    Description = conn.Cable.Description,
                    FromDevice = conn.FromPort.Device.Name,
                    FromPort = conn.FromPort.Name,
                    ToDevice = conn.ToPort.Device.Name,
                    ToPort = conn.ToPort.Name,
                    FromDeviceId = conn.FromPort.DeviceId,
                    ToDeviceId = conn.ToPort.DeviceId
                }).ToList();

                return Ok(cableDtos); // 200 OK
            }
            catch (Exception ex)
            {
                throw new ApplicationException("케이블 목록 조회 중 오류 발생", ex);
            }
        }


        /// <summary>
        /// 📥 새 케이블 + 연결 생성
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<Cable>> CreateCable(CreateCableDto dto)
        {
            var cable = new Cable
            {
                CableId = dto.CableId,
                Description = dto.Description,
                Connection = new CableConnection
                {
                    CableId = dto.CableId, // FK 필드 명시
                    FromPortId = dto.FromPortId,
                    ToPortId = dto.ToPortId
                }
            };

            try
            {
                var created = await _cableService.CreateAsync(cable);

                return CreatedAtAction(nameof(GetAllCables), new { id = created.CableId }, created);
            }
            catch (ArgumentException ex)
            {
                // 요청 자체가 잘못된 경우 (예: 포트 동일, 연결 null 등)
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                // 유효하지만 처리 불가한 경우 (예: 중복 CableId, 포트 사용 중)
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                // 그 외 예외 → 전역 미들웨어로 전달해도 되지만 여기서 로그도 가능
                throw new ApplicationException("케이블 생성 중 알 수 없는 오류 발생", ex);
            }
        }

        /// <summary>
        /// ❌ 케이블 삭제 (연결 포함)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCable(string id)
        {
            try
            {
                await _cableService.DeleteAsync(id);
                return NoContent(); // 204 성공 삭제
            }
            catch (KeyNotFoundException ex)
            {
                // 존재하지 않는 케이블 ID
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                // 그 외 예외는 전역 미들웨어로 전달하거나 로깅 가능
                throw new ApplicationException("케이블 삭제 중 오류 발생", ex);
            }
        }

    }
}
