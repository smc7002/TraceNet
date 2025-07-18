namespace TraceNet.DTOs
{
    /// <summary>
    /// 디바이스 등록용 요청 DTO
    /// </summary>
    public class CreateDeviceDto
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public int PortCount { get; set; }
        public string IpAddress { get; set; } = string.Empty;
        public int? RackId { get; set; }
    }
}
