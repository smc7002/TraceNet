namespace TraceNet.DTOs
{
    /// <summary>
    /// DTO representing the aggregated Ping results for all devices along a traced path.
    /// Includes overall success flag, error message, the traced path itself,
    /// detailed ping results per device, device counts by status, 
    /// and the timestamp of when the check was performed.
    /// </summary>

    public class TracePingResultDto
    {
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
        public TraceResultDto TracePath { get; set; } = new();
        public List<PingResultDto> PingResults { get; set; } = new();
        public int TotalDevices { get; set; }
        public int OnlineDevices { get; set; }
        public int OfflineDevices { get; set; }
        public int UnstableDevices { get; set; }
        public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
    }
}