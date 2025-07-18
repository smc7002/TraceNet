public class ConnectionDto
{
    public int CableConnectionId { get; set; }
    public string CableId { get; set; }
    public int ToPortId { get; set; }
    public int? ToDeviceId { get; set; }
    public string DebugInfo => $"CableId={CableId}, ToPortId={ToPortId}, ToDeviceId={ToDeviceId}";

}
