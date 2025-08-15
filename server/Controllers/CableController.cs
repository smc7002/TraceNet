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
        /// 모든 케이블 정보 조회 (연결 포함)
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CableDto>>> GetAllCables()
        {
            var connections = await _cableService.GetAllWithConnectionsAsync();
            var cableDtos = _mapper.Map<List<CableDto>>(connections);
            return Ok(cableDtos);
        }

        /// <summary>
        /// 새 케이블 + 연결 생성
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<CableDto>> CreateCable(CreateCableDto dto)
        {
            // 기본 검증
            if (dto == null)
                return BadRequest("케이블 정보가 필요합니다.");

            if (dto.FromPortId == dto.ToPortId)
                return BadRequest("동일한 포트끼리는 연결할 수 없습니다.");

            if (string.IsNullOrWhiteSpace(dto.CableId))
                return BadRequest("케이블 ID는 필수입니다.");

            var cable = new Cable
            {
                CableId = dto.CableId,
                Description = dto.Description,
                Connection = new CableConnection
                {
                    CableId = dto.CableId,
                    FromPortId = dto.FromPortId,
                    ToPortId = dto.ToPortId
                }
            };

            try
            {
                var created = await _cableService.CreateAsync(cable);
                var cableDto = _mapper.Map<CableDto>(created);
                
                return CreatedAtAction(nameof(GetAllCables), 
                    new { id = created.CableId }, cableDto);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                throw new ApplicationException("케이블 생성 중 알 수 없는 오류 발생", ex);
            }
        }

        /// <summary>
        /// 케이블 삭제 (연결 포함)
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCable(string id)
        {
            try
            {
                await _cableService.DeleteAsync(id);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                throw new ApplicationException("케이블 삭제 중 오류 발생", ex);
            }
        }
    }
}