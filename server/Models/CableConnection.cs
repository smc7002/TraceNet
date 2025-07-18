// CableConnection.cs

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TraceNet.Models
{
    /// <summary>
    /// Represents the connection endpoints of a cable (fromPort ↔ toPort).
    /// </summary>
    public class CableConnection
    {
        public int CableConnectionId { get; set; }

        public int FromPortId { get; set; }
        public virtual Port FromPort { get; set; } = null!;

        public int ToPortId { get; set; }
        public virtual Port ToPort { get; set; } = null!;

        public String CableId { get; set; } = null!;
        public virtual Cable Cable { get; set; } = null!;
    }

}
