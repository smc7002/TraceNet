namespace TraceNet.Models
{
    public class Rack
    {
        public int RackId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;

        public List<Device> Devices { get; set; } = new();
    }
}
