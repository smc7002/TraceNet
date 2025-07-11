namespace TraceNet.DTOs
{
    public class TraceDto
    {
        public string CableId { get; set; } = null!;
        public int FromDeviceId { get; set; }
        public string FromDevice { get; set; } = null!;
        public string FromPort { get; set; } = null!;
        public int ToDeviceId { get; set; }
        public string ToDevice { get; set; } = null!;
        public string ToPort { get; set; } = null!;
    }
}
