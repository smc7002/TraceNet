namespace TraceNet.Infrastructure
{
    public static class DeviceStatusNames
    {
        public const string Online = "Online";
        public const string Unstable = "Unstable";
        public const string Offline = "Offline";
        public const string Unknown = "Unknown";
        public const string Unreachable = "Unreachable";

        public static string Normalize(string? s) =>
            s?.ToLowerInvariant() switch
            {
                "online" => Online,
                "unstable" => Unstable,
                "offline" => Offline,
                "unreachable" => Unreachable,
                _ => Unknown
            };
    }
}
