namespace TraceNet.DTOs
{
    /// <summary>
    /// 케이블 생성 요청 DTO
    /// 케이블 ID, 설명, 연결할 두 포트 ID를 전달
    /// </summary>
    public class CreateCableDto
    {
        public string CableId { get; set; } = string.Empty;
        public string? Description { get; set; }

        public int FromPortId { get; set; }
        public int ToPortId { get; set; }
    }
}
