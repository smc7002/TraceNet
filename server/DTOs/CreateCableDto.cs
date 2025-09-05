namespace TraceNet.DTOs
{
    /// <summary>
    /// DTO for cable creation requests.
    /// Provides cable ID, description, and IDs of the two ports to connect.
    /// </summary>
    public class CreateCableDto
    {
        public string CableId { get; set; } = string.Empty;
        public string? Description { get; set; }

        public int FromPortId { get; set; }
        public int ToPortId { get; set; }
    }
}
