// PingService.cs

using System.Net.NetworkInformation;
using System.Net;
using TraceNet.DTOs;

namespace TraceNet.Services
{
    /// <summary>
    /// Service that provides network Ping functionality
    /// using System.Net.NetworkInformation.Ping to send ICMP packets.
    /// </summary>
    public class PingService
    {
        private readonly ILogger<PingService> _logger;

        public PingService(ILogger<PingService> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Execute a ping against a single IP address.
        /// </summary>
        /// <param name="ipAddress">Target IP address</param>
        /// <param name="timeoutMs">Timeout in milliseconds</param>
        /// <returns>PingResultDto</returns>
        public async Task<PingResultDto> PingAsync(string ipAddress, int timeoutMs = 2000)
        {
            _logger.LogInformation("Ping started: IP={IpAddress}, Timeout={Timeout}ms", ipAddress, timeoutMs);

            var result = new PingResultDto
            {
                IpAddress = ipAddress,
                CheckedAt = DateTime.UtcNow
            };

            try
            {
                // Validate IP address format
                if (!IPAddress.TryParse(ipAddress, out var parsedIp))
                {
                    result.Status = "Unknown";
                    result.ErrorMessage = "Invalid IP address format";
                    _logger.LogWarning("Invalid IP address: {IpAddress}", ipAddress);
                    return result;
                }

                using var ping = new Ping();
                var reply = await ping.SendPingAsync(parsedIp, timeoutMs);

                result.LatencyMs = reply.RoundtripTime;

                switch (reply.Status)
                {
                    case IPStatus.Success:
                        // Determine status based on latency
                        result.Status = reply.RoundtripTime switch
                        {
                            < 100 => "Online",
                            < 500 => "Unstable",
                            _ => "Unstable"
                        };
                        _logger.LogInformation("Ping succeeded: {IpAddress} - {Latency}ms", ipAddress, reply.RoundtripTime);
                        break;

                    case IPStatus.TimedOut:
                        result.Status = "Offline";
                        result.ErrorMessage = "Request timed out";
                        _logger.LogWarning("Ping timed out: {IpAddress}", ipAddress);
                        break;

                    case IPStatus.DestinationHostUnreachable:
                    case IPStatus.DestinationNetworkUnreachable:
                        result.Status = "Unreachable";
                        result.ErrorMessage = $"Host unreachable: {reply.Status}";
                        _logger.LogWarning("Ping unreachable: {IpAddress} - {Status}", ipAddress, reply.Status);
                        break;

                    default:
                        result.Status = "Offline";
                        result.ErrorMessage = $"Ping failed: {reply.Status}";
                        _logger.LogWarning("Ping failed: {IpAddress} - {Status}", ipAddress, reply.Status);
                        break;
                }
            }
            catch (PingException ex)
            {
                result.Status = "Unknown";
                result.ErrorMessage = $"Ping error: {ex.Message}";
                _logger.LogError(ex, "Ping exception: {IpAddress}", ipAddress);
            }
            catch (Exception ex)
            {
                result.Status = "Unknown";
                result.ErrorMessage = $"Unexpected error: {ex.Message}";
                _logger.LogError(ex, "Unexpected error during ping: {IpAddress}", ipAddress);
            }

            return result;
        }

        /// <summary>
        /// Execute ping in parallel for multiple IP addresses.
        /// </summary>
        /// <param name="ipAddresses">List of target IP addresses</param>
        /// <param name="timeoutMs">Timeout in milliseconds</param>
        /// <param name="maxConcurrency">Maximum degree of parallelism</param>
        /// <returns>List of PingResultDto</returns>
        public async Task<List<PingResultDto>> PingMultipleAsync(
            IEnumerable<string> ipAddresses,
            int timeoutMs = 2000,
            int maxConcurrency = 10)
        {
            var ipList = ipAddresses.ToList();
            _logger.LogInformation("Bulk ping started: targets={Count}, concurrency={Concurrency}",
                ipList.Count, maxConcurrency);

            var semaphore = new SemaphoreSlim(maxConcurrency, maxConcurrency);
            var tasks = ipList.Select(async ip =>
            {
                await semaphore.WaitAsync();
                try
                {
                    return await PingAsync(ip, timeoutMs);
                }
                finally
                {
                    semaphore.Release();
                }
            });

            var results = await Task.WhenAll(tasks);

            _logger.LogInformation("Bulk ping completed: total={Total}, online={Online}",
                results.Length, results.Count(r => r.Status == "Online"));

            return results.ToList();
        }

        /// <summary>
        /// Execute consecutive pings (repeat a specified number of times).
        /// </summary>
        /// <param name="ipAddress">Target IP address</param>
        /// <param name="count">Number of pings</param>
        /// <param name="intervalMs">Interval between pings in milliseconds</param>
        /// <param name="timeoutMs">Timeout in milliseconds</param>
        /// <returns>List of PingResultDto</returns>
        public async Task<List<PingResultDto>> PingContinuousAsync(
            string ipAddress,
            int count = 4,
            int intervalMs = 1000,
            int timeoutMs = 2000)
        {
            _logger.LogInformation("Continuous ping started: {IpAddress}, count={Count}, interval={Interval}ms",
                ipAddress, count, intervalMs);

            var results = new List<PingResultDto>();

            for (int i = 0; i < count; i++)
            {
                if (i > 0)
                    await Task.Delay(intervalMs);

                var result = await PingAsync(ipAddress, timeoutMs);
                results.Add(result);

                _logger.LogDebug("Continuous ping {Current}/{Total}: {Status} - {Latency}ms",
                    i + 1, count, result.Status, result.LatencyMs);
            }

            return results;
        }
    }
}
