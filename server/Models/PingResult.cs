// PingResult.cs
using TraceNet.Models;

public class PingResult
{
    public int PingResultId { get; set; }
    public int DeviceId { get; set; }
    public virtual Device Device { get; set; } = null!;
    public string Status { get; set; } = "Unknown";
    public long? LatencyMs { get; set; }
    public DateTime CheckedAt { get; set; }
    public string? ErrorMessage { get; set; }
}