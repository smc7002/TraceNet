namespace TraceNet.DTOs
{

    public class CableEdgeDto
    {
        public string CableId { get; set; } = null!;

        public int FromPortId { get; set; }
        public int FromDeviceId { get; set; }

        public int ToPortId { get; set; }
        public int ToDeviceId { get; set; }
    }
}
