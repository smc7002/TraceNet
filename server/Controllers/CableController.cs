using Microsoft.AspNetCore.Mvc;
using TraceNet.Models;
using TraceNet.Services;
using TraceNet.DTOs;
using AutoMapper;

namespace TraceNet.Controllers
{
    /// <summary>
    /// Cable Management API Controller
    /// Provides REST APIs to create, retrieve, and delete relationships 
    /// between network cables and ports
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
        /// Retrieve all cable information (including connections)
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CableDto>>> GetAllCables()
        {
            var connections = await _cableService.GetAllWithConnectionsAsync();
            var cableDtos = _mapper.Map<List<CableDto>>(connections);
            return Ok(cableDtos);
        }

        /// <summary>
        /// Create a new cable and connection
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<CableDto>> CreateCable(CreateCableDto dto)
        {
            // Basic validation
            if (dto == null)
                return BadRequest("Cable information is required.");

            if (dto.FromPortId == dto.ToPortId)
                return BadRequest("Cannot connect a port to itself.");

            if (string.IsNullOrWhiteSpace(dto.CableId))
                return BadRequest("Cable ID is required.");

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
                throw new ApplicationException("An unknown error occurred while creating the cable.", ex);
            }
        }

        /// <summary>
        /// Delete a cable (including its connections)
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
                throw new ApplicationException("An error occurred while deleting the cable.", ex);
            }
        }
    }
}
