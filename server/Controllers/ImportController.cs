using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using TraceNet.Data;
using TraceNet.Models;

namespace TraceNet.Controllers;

/// <summary>
/// 네트워크 토폴로지 데이터 Import 컨트롤러
/// 
/// JSON 파일을 통해 랙, 장비, 케이블 정보를 일괄 업로드하는 기능을 제공합니다.
/// 데이터 Import 순서: Rack → Device → Cable 순으로 의존성을 고려하여 처리됩니다.
/// 
/// 주요 기능:
/// - JSON 형식의 네트워크 토폴로지 데이터 파싱
/// - 데이터베이스 트랜잭션을 통한 안전한 일괄 업로드
/// - 데이터 무결성 검증 및 에러 처리
/// - 장비 포트 자동 생성
/// </summary>
[ApiController]
[Route("api/import")]
public class ImportController : ControllerBase
{
    private readonly TraceNetDbContext _context;
    private readonly ILogger<ImportController> _logger;

    public ImportController(TraceNetDbContext context, ILogger<ImportController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// JSON 파일을 통한 네트워크 데이터 Import
    /// 
    /// 처리 순서:
    /// 1. 파일 유효성 검증
    /// 2. JSON 파싱 및 데이터 구조 검증
    /// 3. 트랜잭션 내에서 데이터베이스 Import 실행
    /// 4. 성공/실패 응답 반환
    /// </summary>
    /// <param name="file">업로드된 JSON 파일</param>
    /// <returns>Import 결과 메시지</returns>
    [HttpPost]
    public async Task<IActionResult> ImportJson(IFormFile file)
    {
        // ========================================================================
        // 1단계: 입력 파일 유효성 검증
        // ========================================================================
        var validationResult = ValidateUploadedFile(file);
        if (validationResult != null)
            return validationResult;

        try
        {
            // ====================================================================
            // 2단계: 파일 읽기 및 JSON 파싱
            // ====================================================================
            var importData = await ParseJsonFile(file);
            if (importData == null)
                return BadRequest(CreateErrorResponse("JSON 파싱 실패: 형식이 잘못되었습니다."));

            _logger.LogInformation("JSON 파싱 완료 - Racks: {RackCount}, Devices: {DeviceCount}, Cables: {CableCount}",
                importData.Racks.Count, importData.Devices.Count, importData.Cables.Count);

            // ====================================================================
            // 3단계: 데이터베이스 Import 실행 (트랜잭션)
            // ====================================================================
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await ImportToDatabase(importData);
                await transaction.CommitAsync();
                
                _logger.LogInformation("데이터 Import 성공");
                return Ok(CreateSuccessResponse("데이터가 성공적으로 업로드되었습니다."));
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "데이터 Import 중 오류 발생");
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Import 처리 중 오류 발생");
            return BadRequest(CreateErrorResponse($"오류 발생: {ex.Message}"));
        }
    }

    // ============================================================================
    // Private 헬퍼 메서드들
    // ============================================================================

    /// <summary>
    /// 업로드된 파일의 기본 유효성 검증
    /// </summary>
    private IActionResult? ValidateUploadedFile(IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(CreateErrorResponse("업로드된 파일이 비어 있습니다."));

        if (!file.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            return BadRequest(CreateErrorResponse("JSON 파일만 업로드 가능합니다."));

        // 파일 크기 제한 (10MB)
        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(CreateErrorResponse("파일 크기가 너무 큽니다. (최대 10MB)"));

        return null;
    }

    /// <summary>
    /// JSON 파일을 읽어서 ImportData 객체로 파싱
    /// </summary>
    private async Task<ImportData?> ParseJsonFile(IFormFile file)
    {
        using var reader = new StreamReader(file.OpenReadStream());
        var json = await reader.ReadToEndAsync();

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            AllowTrailingCommas = true,
            ReadCommentHandling = JsonCommentHandling.Skip
        };

        return JsonSerializer.Deserialize<ImportData>(json, options);
    }

    /// <summary>
    /// 파싱된 데이터를 데이터베이스에 Import
    /// 
    /// Import 순서 (의존성 고려):
    /// 1. Rack 생성 → RackId 매핑 테이블 생성
    /// 2. Device 생성 → Port 자동 생성 → DeviceId 매핑 테이블 생성  
    /// 3. Cable 및 CableConnection 생성
    /// </summary>
    private async Task ImportToDatabase(ImportData data)
    {
        // ========================================================================
        // 1단계: Rack Import 및 ID 매핑 생성
        // ========================================================================
        var rackIdMap = await ImportRacks(data.Racks);
        _logger.LogDebug("Rack Import 완료: {Count}개", rackIdMap.Count);

        // ========================================================================
        // 2단계: Device Import 및 Port 자동 생성
        // ========================================================================
        var deviceMap = await ImportDevices(data.Devices, rackIdMap);
        _logger.LogDebug("Device Import 완료: {Count}개", deviceMap.Count);

        // ========================================================================
        // 3단계: Cable 및 Connection Import
        // ========================================================================
        await ImportCables(data.Cables, deviceMap);
        _logger.LogDebug("Cable Import 완료: {Count}개", data.Cables.Count);
    }

    /// <summary>
    /// 랙 정보 Import 및 ID 매핑 테이블 생성
    /// </summary>
    private async Task<Dictionary<string, int>> ImportRacks(List<ImportRack> racks)
    {
        var rackIdMap = new Dictionary<string, int>();

        foreach (var rack in racks)
        {
            var entity = new Rack 
            { 
                Name = rack.Name.Trim(), 
                Location = rack.Location?.Trim() ?? ""
            };

            _context.Racks.Add(entity);
            await _context.SaveChangesAsync(); // ID 생성을 위해 즉시 저장

            rackIdMap[rack.Name] = entity.RackId;
            _logger.LogDebug("Rack 생성: {Name} (ID: {Id})", entity.Name, entity.RackId);
        }

        return rackIdMap;
    }

    /// <summary>
    /// 장비 정보 Import 및 포트 자동 생성
    /// </summary>
    private async Task<Dictionary<string, Device>> ImportDevices(
        List<ImportDevice> devices, 
        Dictionary<string, int> rackIdMap)
    {
        var deviceMap = new Dictionary<string, Device>();

        foreach (var deviceInfo in devices)
        {
            // 장비 엔티티 생성
            var device = new Device
            {
                Name = deviceInfo.Name.Trim(),
                Type = deviceInfo.Type.Trim(),
                IPAddress = deviceInfo.IpAddress.Trim(),
                RackId = GetRackId(deviceInfo.Rack, rackIdMap),
                PortCount = deviceInfo.PortCount,
                Ports = new List<Port>()
            };

            // 포트 자동 생성 (1번부터 PortCount까지)
            for (int portNumber = 1; portNumber <= deviceInfo.PortCount; portNumber++)
            {
                device.Ports.Add(new Port 
                { 
                    Name = portNumber.ToString(),
                    // Device는 EF가 자동으로 설정
                });
            }

            _context.Devices.Add(device);
            await _context.SaveChangesAsync(); // ID 생성 및 포트 ID 할당

            deviceMap[deviceInfo.Name] = device;
            _logger.LogDebug("Device 생성: {Name} (포트 {PortCount}개)", 
                device.Name, device.PortCount);
        }

        return deviceMap;
    }

    /// <summary>
    /// 케이블 정보 Import 및 연결 관계 생성
    /// </summary>
    private async Task ImportCables(List<ImportCable> cables, Dictionary<string, Device> deviceMap)
    {
        foreach (var cableInfo in cables)
        {
            // 케이블 엔티티 생성
            var cable = new Cable 
            { 
                CableId = cableInfo.CableId.Trim(),
                Description = cableInfo.Description?.Trim()
            };

            _context.Cables.Add(cable);
            await _context.SaveChangesAsync();

            // 연결할 장비 및 포트 검색
            var (fromDevice, toDevice) = GetDevicesForCable(cableInfo, deviceMap);
            var (fromPort, toPort) = GetPortsForCable(cableInfo, fromDevice, toDevice);

            // 케이블 연결 관계 생성
            var connection = new CableConnection
            {
                CableId = cable.CableId,
                FromPortId = fromPort.PortId,
                ToPortId = toPort.PortId
            };

            _context.CableConnections.Add(connection);
            _logger.LogDebug("Cable 연결: {CableId} ({FromDevice}:{FromPort} → {ToDevice}:{ToPort})",
                cable.CableId, fromDevice.Name, fromPort.Name, toDevice.Name, toPort.Name);
        }

        await _context.SaveChangesAsync();
    }

    // ============================================================================
    // 유틸리티 메서드들
    // ============================================================================

    /// <summary>
    /// 랙 이름으로 RackId 조회 (nullable 처리)
    /// </summary>
    private int? GetRackId(string? rackName, Dictionary<string, int> rackIdMap)
    {
        if (string.IsNullOrWhiteSpace(rackName))
            return null;

        return rackIdMap.TryGetValue(rackName, out var rackId) ? rackId : null;
    }

    /// <summary>
    /// 케이블 연결에 필요한 장비 쌍 조회
    /// </summary>
    private (Device FromDevice, Device ToDevice) GetDevicesForCable(
        ImportCable cableInfo, 
        Dictionary<string, Device> deviceMap)
    {
        if (!deviceMap.TryGetValue(cableInfo.FromDevice, out var fromDevice))
            throw new InvalidOperationException($"FromDevice '{cableInfo.FromDevice}'를 찾을 수 없습니다.");

        if (!deviceMap.TryGetValue(cableInfo.ToDevice, out var toDevice))
            throw new InvalidOperationException($"ToDevice '{cableInfo.ToDevice}'를 찾을 수 없습니다.");

        return (fromDevice, toDevice);
    }

    /// <summary>
    /// 케이블 연결에 필요한 포트 쌍 조회
    /// </summary>
    private (Port FromPort, Port ToPort) GetPortsForCable(
        ImportCable cableInfo,
        Device fromDevice,
        Device toDevice)
    {
        var fromPort = fromDevice.Ports.FirstOrDefault(p => p.Name == cableInfo.FromPort);
        if (fromPort == null)
            throw new InvalidOperationException(
                $"Device '{fromDevice.Name}'에서 포트 '{cableInfo.FromPort}'를 찾을 수 없습니다.");

        var toPort = toDevice.Ports.FirstOrDefault(p => p.Name == cableInfo.ToPort);
        if (toPort == null)
            throw new InvalidOperationException(
                $"Device '{toDevice.Name}'에서 포트 '{cableInfo.ToPort}'를 찾을 수 없습니다.");

        return (fromPort, toPort);
    }

    /// <summary>
    /// 성공 응답 객체 생성
    /// </summary>
    private object CreateSuccessResponse(string message) => new { success = true, message = $"✅ {message}" };

    /// <summary>
    /// 에러 응답 객체 생성
    /// </summary>
    private object CreateErrorResponse(string message) => new { success = false, message = $"❌ {message}" };

    // ============================================================================
    // Import 데이터 모델들 (JSON 파싱용)
    // ============================================================================

    #region Import Data Models

    /// <summary>
    /// JSON Import 데이터의 최상위 구조
    /// </summary>
    private class ImportData
    {
        public List<ImportRack> Racks { get; set; } = new();
        public List<ImportDevice> Devices { get; set; } = new();
        public List<ImportCable> Cables { get; set; } = new();
    }

    /// <summary>
    /// Import용 랙 정보 모델
    /// </summary>
    private class ImportRack
    {
        public string Name { get; set; } = "";
        public string? Location { get; set; }
    }

    /// <summary>
    /// Import용 장비 정보 모델
    /// </summary>
    private class ImportDevice
    {
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public string? Rack { get; set; }
        public string IpAddress { get; set; } = "";
        public int PortCount { get; set; }
    }

    /// <summary>
    /// Import용 케이블 정보 모델
    /// </summary>
    private class ImportCable
    {
        public string CableId { get; set; } = "";
        public string? Description { get; set; }
        public string FromDevice { get; set; } = "";
        public string FromPort { get; set; } = "";
        public string ToDevice { get; set; } = "";
        public string ToPort { get; set; } = "";
    }

    #endregion
}