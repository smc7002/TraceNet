namespace TraceNet.DTOs
{
    /// <summary>
    /// Request DTO for device registration.
    /// Contains essential information such as name, type, number of ports, 
    /// IP address, and optional rack association.
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
