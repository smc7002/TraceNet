// Port.cs

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TraceNet.Models
{
    /// <summary>
    /// Represents a physical port on a device.
    /// </summary>
    public class Port
{
    public int PortId { get; set; }

    public string Name { get; set; } = null!;

    public int DeviceId { get; set; }
    public virtual Device Device { get; set; } = null!;
    public int? ConnectionCableConnectionId { get; set; }
    public virtual CableConnection? Connection { get; set; }
}

}
