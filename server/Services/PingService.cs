// PingService.cs

using System.Net.NetworkInformation;
using System.Net;
using TraceNet.DTOs;

namespace TraceNet.Services
{
    /// <summary>
    /// 네트워크 Ping 기능을 제공하는 서비스 클래스
    /// System.Net.NetworkInformation.Ping을 활용한 ICMP 패킷 전송
    /// </summary>
    public class PingService
    {
        private readonly ILogger<PingService> _logger;

        public PingService(ILogger<PingService> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// 단일 IP 주소에 대한 Ping 실행
        /// </summary>
        /// <param name="ipAddress">대상 IP 주소</param>
        /// <param name="timeoutMs">타임아웃 (밀리초)</param>
        /// <returns>PingResultDto</returns>
        public async Task<PingResultDto> PingAsync(string ipAddress, int timeoutMs = 2000)
        {
            _logger.LogInformation("Ping 시작: IP={IpAddress}, Timeout={Timeout}ms", ipAddress, timeoutMs);

            var result = new PingResultDto
            {
                IpAddress = ipAddress,
                CheckedAt = DateTime.UtcNow
            };

            try
            {
                // IP 주소 유효성 검사
                if (!IPAddress.TryParse(ipAddress, out var parsedIp))
                {
                    result.Status = "Unknown";
                    result.ErrorMessage = "유효하지 않은 IP 주소 형식";
                    _logger.LogWarning("잘못된 IP 주소: {IpAddress}", ipAddress);
                    return result;
                }

                using var ping = new Ping();
                var reply = await ping.SendPingAsync(parsedIp, timeoutMs);

                result.LatencyMs = reply.RoundtripTime;

                switch (reply.Status)
                {
                    case IPStatus.Success:
                        // 레이턴시 기준으로 상태 결정
                        result.Status = reply.RoundtripTime switch
                        {
                            < 100 => "Online",
                            < 500 => "Unstable", 
                            _ => "Unstable"
                        };
                        _logger.LogInformation("Ping 성공: {IpAddress} - {Latency}ms", ipAddress, reply.RoundtripTime);
                        break;

                    case IPStatus.TimedOut:
                        result.Status = "Offline";
                        result.ErrorMessage = "요청 시간 초과";
                        _logger.LogWarning("Ping 타임아웃: {IpAddress}", ipAddress);
                        break;

                    case IPStatus.DestinationHostUnreachable:
                    case IPStatus.DestinationNetworkUnreachable:
                        result.Status = "Unreachable";
                        result.ErrorMessage = $"호스트에 도달할 수 없음: {reply.Status}";
                        _logger.LogWarning("Ping 도달 불가: {IpAddress} - {Status}", ipAddress, reply.Status);
                        break;

                    default:
                        result.Status = "Offline";
                        result.ErrorMessage = $"Ping 실패: {reply.Status}";
                        _logger.LogWarning("Ping 실패: {IpAddress} - {Status}", ipAddress, reply.Status);
                        break;
                }
            }
            catch (PingException ex)
            {
                result.Status = "Unknown";
                result.ErrorMessage = $"Ping 오류: {ex.Message}";
                _logger.LogError(ex, "Ping 예외 발생: {IpAddress}", ipAddress);
            }
            catch (Exception ex)
            {
                result.Status = "Unknown";
                result.ErrorMessage = $"예상치 못한 오류: {ex.Message}";
                _logger.LogError(ex, "Ping 중 예상치 못한 오류: {IpAddress}", ipAddress);
            }

            return result;
        }

        /// <summary>
        /// 여러 IP 주소에 대한 병렬 Ping 실행
        /// </summary>
        /// <param name="ipAddresses">대상 IP 주소 목록</param>
        /// <param name="timeoutMs">타임아웃 (밀리초)</param>
        /// <param name="maxConcurrency">최대 동시 실행 수</param>
        /// <returns>PingResultDto 목록</returns>
        public async Task<List<PingResultDto>> PingMultipleAsync(
            IEnumerable<string> ipAddresses, 
            int timeoutMs = 2000, 
            int maxConcurrency = 10)
        {
            var ipList = ipAddresses.ToList();
            _logger.LogInformation("다중 Ping 시작: 대상 수={Count}, 동시실행={Concurrency}", 
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
            
            _logger.LogInformation("다중 Ping 완료: 총 {Total}개, 온라인 {Online}개", 
                results.Length, results.Count(r => r.Status == "Online"));

            return results.ToList();
        }

        /// <summary>
        /// 연속적인 Ping 실행 (지정된 횟수만큼 반복)
        /// </summary>
        /// <param name="ipAddress">대상 IP 주소</param>
        /// <param name="count">Ping 횟수</param>
        /// <param name="intervalMs">간격 (밀리초)</param>
        /// <param name="timeoutMs">타임아웃 (밀리초)</param>
        /// <returns>PingResultDto 목록</returns>
        public async Task<List<PingResultDto>> PingContinuousAsync(
            string ipAddress, 
            int count = 4, 
            int intervalMs = 1000, 
            int timeoutMs = 2000)
        {
            _logger.LogInformation("연속 Ping 시작: {IpAddress}, 횟수={Count}, 간격={Interval}ms", 
                ipAddress, count, intervalMs);

            var results = new List<PingResultDto>();

            for (int i = 0; i < count; i++)
            {
                if (i > 0)
                    await Task.Delay(intervalMs);

                var result = await PingAsync(ipAddress, timeoutMs);
                results.Add(result);

                _logger.LogDebug("연속 Ping {Current}/{Total}: {Status} - {Latency}ms", 
                    i + 1, count, result.Status, result.LatencyMs);
            }

            return results;
        }
    }
}