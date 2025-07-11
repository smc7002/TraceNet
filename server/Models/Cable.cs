using System.ComponentModel.DataAnnotations;

namespace TraceNet.Models
{
    /// <summary>
    /// Represents a physical cable.
    /// </summary>
    public class Cable
    {
        [Key]
        public string CableId { get; set; } = null!;  // e.g., "CBL-001"

        public string? Description { get; set; }

        public CableConnection? Connection { get; set; }
    }
}
