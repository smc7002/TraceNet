// Device.cs

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TraceNet.Models
{
    public enum DeviceStatus
    {
        Unknown,
        Online,
        Offline,
        Unstable,
        Unreachable
    }
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

        [MaxLength(64)]
        public string? IPAddress { get; set; }
        public int? RackId { get; set; }
        public virtual Rack? Rack { get; set; }
        public virtual List<Port> Ports { get; set; } = new();

        [Required, MaxLength(16)]
        public string Status { get; set; } = "Unknown";
        public long? LatencyMs { get; set; }
        public DateTime? LastCheckedAt { get; set; }
        public bool EnablePing { get; set; } = true; // Ping 활성화 여부
    }
}
