namespace TraceNet.DTOs
{
    /// <summary>
    /// DTO for bulk Ping requests across multiple devices.
    /// Includes target device IDs, timeout per request, 
    /// maximum concurrency level, and whether to update results in the database.
    /// </summary>
    public class MultiPingRequestDto
    {
        public List<int> DeviceIds { get; set; } = new();
        public int TimeoutMs { get; set; } = 2000;
        public int MaxConcurrency { get; set; } = 10;
        public bool UpdateDatabase { get; set; } = true;
    }
}