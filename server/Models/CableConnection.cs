using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TraceNet.Models
{
    /// <summary>
    /// Represents the connection endpoints of a cable (fromPort ↔ toPort).
    /// </summary>
    public class CableConnection
    {
        [Key]
        public int CableConnectionId { get; set; }

        [Required]
        [ForeignKey("Cable")]
        public string CableId { get; set; } = null!;

        public Cable Cable { get; set; } = null!;

        [Required]
        [ForeignKey("FromPort")]
        public int FromPortId { get; set; }

        public Port FromPort { get; set; } = null!;

        [Required]
        [ForeignKey("ToPort")]
        public int ToPortId { get; set; }

        public Port ToPort { get; set; } = null!;
    }
}
