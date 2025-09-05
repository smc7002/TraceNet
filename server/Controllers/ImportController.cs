using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using TraceNet.Data;
using TraceNet.Models;

namespace TraceNet.Controllers;

/// <summary>
/// Network Topology Data Import Controller
/// 
/// Provides a bulk upload feature for racks, devices, and cables via a JSON file.
/// Import order considers dependencies in the following sequence: Rack → Device → Cable.
/// 
/// Key Features:
/// - Parse network topology data in JSON format
/// - Safe bulk upload using a database transaction
/// - Data integrity validation and error handling
/// - Automatic port creation for devices
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
    /// Import network data from an uploaded JSON file
    /// 
    /// Processing steps:
    /// 1. Validate the uploaded file
    /// 2. Parse JSON and validate the data structure
    /// 3. Execute DB import within a transaction
    /// 4. Return success/failure response
    /// </summary>
    /// <param name="file">Uploaded JSON file</param>
    /// <returns>Import result message</returns>
    [HttpPost]
    public async Task<IActionResult> ImportJson(IFormFile file)
    {
        // ========================================================================
        // Step 1: Validate uploaded file
        // ========================================================================
        var validationResult = ValidateUploadedFile(file);
        if (validationResult != null)
            return validationResult;

        try
        {
            // ====================================================================
            // Step 2: Read file and parse JSON
            // ====================================================================
            var importData = await ParseJsonFile(file);
            if (importData == null)
                return BadRequest(CreateErrorResponse("JSON parsing failed: invalid format."));

            _logger.LogInformation("JSON parsed - Racks: {RackCount}, Devices: {DeviceCount}, Cables: {CableCount}",
                importData.Racks.Count, importData.Devices.Count, importData.Cables.Count);

            // ====================================================================
            // Step 3: Execute database import (transaction)
            // ====================================================================
            var strategy = _context.Database.CreateExecutionStrategy();
            IActionResult? actionResult = null;

            await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _context.Database.BeginTransactionAsync();
                try
                {
                    await ImportToDatabase(importData);
                    await tx.CommitAsync();

                    _logger.LogInformation("Data import succeeded");
                    actionResult = Ok(CreateSuccessResponse("Data has been uploaded successfully."));
                }
                catch (Exception ex)
                {
                    await tx.RollbackAsync();
                    _logger.LogError(ex, "Error occurred during data import");
                    // Rethrow so the execution strategy can observe the failure for retries if applicable
                    throw;
                }
            });

            return actionResult!;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while processing the import");
            return BadRequest(CreateErrorResponse($"An error occurred: {ex.Message}"));
        }
    }

    // ============================================================================
    // Private helper methods
    // ============================================================================

    /// <summary>
    /// Basic validation for the uploaded file
    /// </summary>
    private IActionResult? ValidateUploadedFile(IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(CreateErrorResponse("The uploaded file is empty."));

        if (!file.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            return BadRequest(CreateErrorResponse("Only JSON files are allowed."));

        // File size limit (10MB)
        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(CreateErrorResponse("File is too large. (Max 10MB)"));

        return null;
    }

    /// <summary>
    /// Read the JSON file and deserialize into an ImportData object
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
    /// Import parsed data into the database
    /// 
    /// Import order (considering dependencies):
    /// 1. Create Racks → build RackId mapping table
    /// 2. Create Devices → auto-create Ports → build DeviceId mapping table
    /// 3. Create Cables and CableConnections
    /// </summary>
    private async Task ImportToDatabase(ImportData data)
    {
        // ========================================================================
        // Step 1: Import Racks and build ID mapping
        // ========================================================================
        var rackIdMap = await ImportRacks(data.Racks);
        _logger.LogDebug("Rack import completed: {Count}", rackIdMap.Count);

        // ========================================================================
        // Step 2: Import Devices and auto-create Ports
        // ========================================================================
        var deviceMap = await ImportDevices(data.Devices, rackIdMap);
        _logger.LogDebug("Device import completed: {Count}", deviceMap.Count);

        // ========================================================================
        // Step 3: Import Cables and Connections
        // ========================================================================
        await ImportCables(data.Cables, deviceMap);
        _logger.LogDebug("Cable import completed: {Count}", data.Cables.Count);
    }

    /// <summary>
    /// Import rack info and build an ID mapping table
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
            await _context.SaveChangesAsync(); // Save immediately to get the generated ID

            rackIdMap[rack.Name] = entity.RackId;
            _logger.LogDebug("Rack created: {Name} (ID: {Id})", entity.Name, entity.RackId);
        }

        return rackIdMap;
    }

    /// <summary>
    /// Import device info and auto-create ports
    /// </summary>
    private async Task<Dictionary<string, Device>> ImportDevices(
        List<ImportDevice> devices,
        Dictionary<string, int> rackIdMap)
    {
        var deviceMap = new Dictionary<string, Device>();

        foreach (var deviceInfo in devices)
        {
            // Create device entity
            var device = new Device
            {
                Name = deviceInfo.Name.Trim(),
                Type = deviceInfo.Type.Trim(),
                IPAddress = deviceInfo.IpAddress.Trim(),
                RackId = GetRackId(deviceInfo.Rack, rackIdMap),
                PortCount = deviceInfo.PortCount,
                Ports = new List<Port>()
            };

            // Auto-create ports (from 1 to PortCount)
            for (int portNumber = 1; portNumber <= deviceInfo.PortCount; portNumber++)
            {
                device.Ports.Add(new Port
                {
                    Name = portNumber.ToString(),
                    // Device is set automatically by EF
                });
            }

            _context.Devices.Add(device);
            await _context.SaveChangesAsync(); // Generate IDs and assign port IDs

            deviceMap[deviceInfo.Name] = device;
            _logger.LogDebug("Device created: {Name} ({PortCount} ports)",
                device.Name, device.PortCount);
        }

        return deviceMap;
    }

    /// <summary>
    /// Import cable info and create connection relationships
    /// </summary>
    private async Task ImportCables(List<ImportCable> cables, Dictionary<string, Device> deviceMap)
    {
        foreach (var cableInfo in cables)
        {
            // Create cable entity
            var cable = new Cable
            {
                CableId = cableInfo.CableId.Trim(),
                Description = cableInfo.Description?.Trim()
            };

            _context.Cables.Add(cable);
            await _context.SaveChangesAsync();

            // Resolve devices and ports to connect
            var (fromDevice, toDevice) = GetDevicesForCable(cableInfo, deviceMap);
            var (fromPort, toPort) = GetPortsForCable(cableInfo, fromDevice, toDevice);

            // Create cable connection
            var connection = new CableConnection
            {
                CableId = cable.CableId,
                FromPortId = fromPort.PortId,
                ToPortId = toPort.PortId
            };

            _context.CableConnections.Add(connection);
            _logger.LogDebug("Cable connected: {CableId} ({FromDevice}:{FromPort} → {ToDevice}:{ToPort})",
                cable.CableId, fromDevice.Name, fromPort.Name, toDevice.Name, toPort.Name);
        }

        await _context.SaveChangesAsync();
    }

    // ============================================================================
    // Utility methods
    // ============================================================================

    /// <summary>
    /// Get RackId by rack name (nullable-friendly)
    /// </summary>
    private int? GetRackId(string? rackName, Dictionary<string, int> rackIdMap)
    {
        if (string.IsNullOrWhiteSpace(rackName))
            return null;

        return rackIdMap.TryGetValue(rackName, out var rackId) ? rackId : null;
    }

    /// <summary>
    /// Resolve the pair of devices needed for a cable connection
    /// </summary>
    private (Device FromDevice, Device ToDevice) GetDevicesForCable(
        ImportCable cableInfo,
        Dictionary<string, Device> deviceMap)
    {
        if (!deviceMap.TryGetValue(cableInfo.FromDevice, out var fromDevice))
            throw new InvalidOperationException($"FromDevice '{cableInfo.FromDevice}' not found.");

        if (!deviceMap.TryGetValue(cableInfo.ToDevice, out var toDevice))
            throw new InvalidOperationException($"ToDevice '{cableInfo.ToDevice}' not found.");

        return (fromDevice, toDevice);
    }

    /// <summary>
    /// Resolve the pair of ports needed for a cable connection
    /// </summary>
    private (Port FromPort, Port ToPort) GetPortsForCable(
        ImportCable cableInfo,
        Device fromDevice,
        Device toDevice)
    {
        var fromPort = fromDevice.Ports.FirstOrDefault(p => p.Name == cableInfo.FromPort);
        if (fromPort == null)
            throw new InvalidOperationException(
                $"Port '{cableInfo.FromPort}' not found on device '{fromDevice.Name}'.");

        var toPort = toDevice.Ports.FirstOrDefault(p => p.Name == cableInfo.ToPort);
        if (toPort == null)
            throw new InvalidOperationException(
                $"Port '{cableInfo.ToPort}' not found on device '{toDevice.Name}'.");

        return (fromPort, toPort);
    }

    /// <summary>
    /// Create a success response object
    /// </summary>
    private object CreateSuccessResponse(string message) => new { success = true, message = $"✅ {message}" };

    /// <summary>
    /// Create an error response object
    /// </summary>
    private object CreateErrorResponse(string message) => new { success = false, message = $"❌ {message}" };

    // ============================================================================
    // Import data models (for JSON parsing)
    // ============================================================================

    #region Import Data Models

    /// <summary>
    /// Root structure of JSON import data
    /// </summary>
    private class ImportData
    {
        public List<ImportRack> Racks { get; set; } = new();
        public List<ImportDevice> Devices { get; set; } = new();
        public List<ImportCable> Cables { get; set; } = new();
    }

    /// <summary>
    /// Rack model for import
    /// </summary>
    private class ImportRack
    {
        public string Name { get; set; } = "";
        public string? Location { get; set; }
    }

    /// <summary>
    /// Device model for import
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
    /// Cable model for import
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
