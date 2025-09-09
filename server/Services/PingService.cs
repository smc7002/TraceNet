// server/Services/PingService.cs
using System.Net;
using System.Net.NetworkInformation;
using System.Collections.Concurrent;
using System.Threading;
using TraceNet.DTOs;

namespace TraceNet.Services
{
    /// <summary>
    /// Bounded-concurrency ICMP ping service for bulk sweeps.
    /// Default tuning targets a typical factory LAN; make values configurable per site.
    /// </summary>
    public class PingService
    {
        private readonly ILogger<PingService> _logger;
        public PingService(ILogger<PingService> logger) => _logger = logger;

        /// <summary>
        /// Ping a single IP once.
        /// Contract:
        /// - Success < threshold(100ms) => "Online", else => "Unstable".
        /// - Timeouts => "Offline", unreachable => "Unreachable", others => "Offline".
        /// - Cancellation maps to "Unknown" with a reason.
        /// </summary>
        public async Task<PingResultDto> PingAsync(string ipAddress, int timeoutMs = 600, CancellationToken ct = default)
        {
            var result = new PingResultDto { IpAddress = ipAddress, CheckedAt = DateTime.UtcNow };

            try
            {
                // Fail fast on invalid input.
                if (!IPAddress.TryParse(ipAddress, out var parsedIp))
                {
                    result.Status = "Unknown";
                    result.ErrorMessage = "Invalid IP address format";
                    return result;
                }

                // Minimal payload keeps aggregate ICMP volume low during sweeps.
                byte[] buffer = new byte[1];
                using var ping = new Ping();
                var reply = await ping.SendPingAsync(parsedIp, timeoutMs, buffer).WaitAsync(ct);

                result.LatencyMs = reply.RoundtripTime;

                result.Status = reply.Status switch
                {
                    IPStatus.Success => reply.RoundtripTime < 100 ? "Online" : "Unstable",
                    IPStatus.TimedOut => "Offline",
                    IPStatus.DestinationHostUnreachable or IPStatus.DestinationNetworkUnreachable => "Unreachable",
                    _ => "Offline"
                };
                if (reply.Status != IPStatus.Success) result.ErrorMessage = reply.Status.ToString();
            }
            catch (OperationCanceledException)
            {
                // Global time limit or caller cancellation.
                result.Status = "Unknown";
                result.ErrorMessage = "Ping cancelled";
            }
            catch (PingException ex)
            {
                result.Status = "Unknown";
                result.ErrorMessage = $"Ping error: {ex.Message}";
                _logger.LogWarning(ex, "Ping exception: {Ip}", ipAddress);
            }
            catch (Exception ex)
            {
                result.Status = "Unknown";
                result.ErrorMessage = $"Unexpected error: {ex.Message}";
                _logger.LogError(ex, "Unexpected ping error: {Ip}", ipAddress);
            }
            return result;
        }

        /// <summary>
        /// Bulk ping with throttling and optional single retry.
        /// Contract:
        /// - Concurrency caps fan-out (default 64).
        /// - Global time limit cancels the whole sweep.
        /// - Retry (opt-in): only after non-success; 1.5× timeout; success-on-retry => "Unstable".
        /// - Logs a single summary line with distribution.
        /// </summary>
        public async Task<List<PingResultDto>> PingMultipleAsync(
            IEnumerable<string> ipAddresses,
            int timeoutMs = 600,           // default LAN baseline
            int maxConcurrency = 64,       // safe starting point; tune per deployment
            int globalTimeLimitMs = 20000, // bounds worst-case UX
            bool enableRetry = false,      // off by default to minimize load
            CancellationToken ct = default)
        {
            var ips = ipAddresses.Where(ip => !string.IsNullOrWhiteSpace(ip)).Distinct().ToList();
            _logger.LogInformation("Bulk ping started: targets={Targets}, concurrency={Concurrency}, timeout={Timeout}ms, globalLimit={Global}ms",
                ips.Count, maxConcurrency, timeoutMs, globalTimeLimitMs);

            if (ips.Count == 0) return new List<PingResultDto>();

            using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct);
            linked.CancelAfter(globalTimeLimitMs);

            var gate = new SemaphoreSlim(maxConcurrency, maxConcurrency);
            var bag = new ConcurrentBag<PingResultDto>();
            var sw = System.Diagnostics.Stopwatch.StartNew();

            var tasks = ips.Select(async ip =>
            {
                await gate.WaitAsync(linked.Token);
                try
                {
                    var first = await PingAsync(ip, timeoutMs, linked.Token);

                    if (enableRetry && first.Status is "Offline" or "Unreachable" or "Unknown")
                    {
                        try
                        {
                            var second = await PingAsync(ip, (int)(timeoutMs * 1.5), linked.Token);
                            if (second.Status == "Online") second.Status = "Unstable"; // flaky success
                            bag.Add(second);
                            return;
                        }
                        catch (OperationCanceledException)
                        {
                            first.Status = "Unknown";
                            first.ErrorMessage = "Global timeout/cancel";
                        }
                    }
                    bag.Add(first);
                }
                finally
                {
                    gate.Release();
                }
            });

            await Task.WhenAll(tasks);
            sw.Stop();

            var results = bag.ToList();

            _logger.LogInformation(
                "Bulk ping done: targets={T}, done={D}, totalMs={Ms}, dist(Online={On},Unstable={Un},Offline={Off},Unknown+Unreach={Uk})",
                ips.Count, results.Count, sw.ElapsedMilliseconds,
                results.Count(r => r.Status == "Online"),
                results.Count(r => r.Status == "Unstable"),
                results.Count(r => r.Status == "Offline"),
                results.Count(r => r.Status == "Unknown" || r.Status == "Unreachable")
            );

            return results;
        }

        /// <summary>
        /// Repeat ping for a single IP at a fixed interval.
        /// Useful to verify intermittency without flooding.
        /// </summary>
        public async Task<List<PingResultDto>> PingContinuousAsync(
            string ipAddress,
            int count = 4,
            int intervalMs = 1000,
            int timeoutMs = 600,
            CancellationToken ct = default)
        {
            var list = new List<PingResultDto>();
            for (int i = 0; i < count; i++)
            {
                if (i > 0) await Task.Delay(intervalMs, ct);
                list.Add(await PingAsync(ipAddress, timeoutMs, ct));
            }
            return list;
        }
    }
}
