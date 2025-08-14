// DeviceDto.cs

namespace TraceNet.DTOs
{
    /// <summary>
    /// 클라이언트 응답용 Device DTO
    /// </summary>
    public class DeviceDto
    {
        public int DeviceId { get; set; }
        public string Name { get; set; }
        public string Type { get; set; }
        public int PortCount { get; set; }
        public string? IpAddress { get; set; }
        public string Status { get; set; } = "Unknown";
        public long? LatencyMs { get; set; }
        public DateTime? LastCheckedAt { get; set; }
        public bool EnablePing { get; set; }

        public string? RackName { get; set; }
        public List<PortDto> Ports { get; set; } = new();
    }
}
