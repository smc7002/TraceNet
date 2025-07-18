// DTOs/PortDto.cs
public class PortDto
{
    public int PortId { get; set; }
    public string Name { get; set; }
    public int DeviceId { get; set; }
    public ConnectionDto? Connection { get; set; }
    public List<ConnectionDto> ToConnections { get; set; } = new List<ConnectionDto>();
}