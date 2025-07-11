// 📁 DTOs/CableDto.cs

namespace TraceNet.DTOs
{
    public class CableDto
    {
        public string CableId { get; set; } = null!;
        public string? Description { get; set; }

        public string FromDevice { get; set; } = null!;
        public string FromPort { get; set; } = null!;
        public string ToDevice { get; set; } = null!;
        public string ToPort { get; set; } = null!;
    }
}
