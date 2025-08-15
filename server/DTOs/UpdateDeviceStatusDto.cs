namespace TraceNet.DTOs
{
    public class UpdateDeviceStatusDto
    {
        /// <summary>Online / Offline / Unstable / Unknown / Unreachable</summary>
        public string Status { get; set; } = "Unknown";

        /// <summary>선택: 수동 상태 운용 시 Ping을 끌지 여부</summary>
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
