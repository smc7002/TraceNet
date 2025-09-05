namespace TraceNet.DTOs
{
    public class UpdateDeviceStatusDto
    {
        /// <summary>
        /// Current status of the device. 
        /// Possible values: Online, Offline, Unstable, Unknown, Unreachable.
        /// </summary>
        public string Status { get; set; } = "Unknown";

        /// <summary>
        /// Optional: Whether to disable automatic Ping when managing device status manually.
        /// </summary>
        public bool? EnablePing { get; set; }
    }

    public class UpdateDeviceStatusItemDto
    {
        public int DeviceId { get; set; }
        public string Status { get; set; } = "Unknown";
        public bool? EnablePing { get; set; }
    }

    public class BulkUpdateDeviceStatusDto
    {
        public List<UpdateDeviceStatusItemDto> Items { get; set; } = new();
    }
}
