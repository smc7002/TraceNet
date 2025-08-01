// Device.cs

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TraceNet.Models
{
    /// <summary>
    /// Represents a network device (e.g., PC, Switch, Router).
    /// </summary>
    public class Device
    {
        public int DeviceId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string Type { get; set; } = string.Empty;

        [Range(1, 48)]
        public int PortCount { get; set; }

        public string? IPAddress { get; set; } 

        public int? RackId { get; set; }        

        public virtual Rack? Rack { get; set; }

        public virtual List<Port> Ports { get; set; } = new();
    }
}
