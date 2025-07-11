namespace TraceNet.DTOs
{
    public class TraceResultDto
    {
        public string StartDeviceName { get; set; } = string.Empty;
        public string? EndDeviceName { get; set; }
        public bool Success { get; set; }
        public List<TraceDto> Path { get; set; } = new();
        public List<CableEdgeDto>? Cables { get; set; }
    }
}
