namespace TraceNet.DTOs
{
    /// <summary>
    /// TracePath 상의 모든 장비 Ping 결과 DTO
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