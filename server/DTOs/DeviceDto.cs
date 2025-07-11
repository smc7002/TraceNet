namespace TraceNet.DTOs
{
    /// <summary>
    /// 클라이언트 응답용 Device DTO
    /// </summary>
    public class DeviceDto
    {
        public int DeviceId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Status { get; set; } = "Unknown";
        public string IpAddress { get; set; } = string.Empty;
        public string RackName { get; set; } = string.Empty;
    }
}
