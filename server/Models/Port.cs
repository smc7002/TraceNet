using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TraceNet.Models
{
    /// <summary>
    /// Represents a physical port on a device.
    /// </summary>
    public class Port
    {
        [Key]
        public int PortId { get; set; }

        [Required]
        public string Name { get; set; } = null!; // e.g., "Port 1", "Eth0"

        [ForeignKey("Device")]
        public int DeviceId { get; set; }

        public Device Device { get; set; } = null!;

        public int? ConnectionCableConnectionId { get; set; }

        public CableConnection? Connection { get; set; }

    }
}
