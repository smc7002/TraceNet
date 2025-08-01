namespace TraceNet.DTOs
{
    /// <summary>
    /// 여러 장비 일괄 Ping 요청 DTO
    /// </summary>
    public class MultiPingRequestDto
    {
        public List<int> DeviceIds { get; set; } = new();
        public int TimeoutMs { get; set; } = 2000;
        public int MaxConcurrency { get; set; } = 10;
        public bool UpdateDatabase { get; set; } = true;
    }
}