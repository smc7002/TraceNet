namespace TraceNet.DTOs
{
    /// <summary>
    /// Ping 결과 응답 DTO
    /// </summary>
    public class PingResultDto
    {
        public int DeviceId { get; set; }
        public string DeviceName { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Status { get; set; } = "Unknown"; // Online, Offline, Unstable, Unknown
        public long? LatencyMs { get; set; }
        public DateTime CheckedAt { get; set; }
        public string? ErrorMessage { get; set; }
    }
}