namespace TraceNet.DTOs
{
    /// <summary>
    /// React Flow용 장비 간 케이블 연결 정보를 나타내는 DTO
    /// </summary>
    public class CableEdgeDto
    {
        public string CableId { get; set; } = null!;

        public int FromPortId { get; set; }
        public int FromDeviceId { get; set; }

        public int ToPortId { get; set; }
        public int ToDeviceId { get; set; }
    }
}
