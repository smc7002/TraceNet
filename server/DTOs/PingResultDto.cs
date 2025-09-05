namespace TraceNet.DTOs
{
    /// <summary>
    /// DTO representing the result of a Ping operation.
    /// Includes device ID, name, IP address, status, latency, 
    /// timestamp of the check, and optional error message.
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