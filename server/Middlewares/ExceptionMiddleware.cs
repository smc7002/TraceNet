/**
 * @fileoverview 전역 예외 처리 미들웨어
 * @description ASP.NET Core 파이프라인에서 처리되지 않은 모든 예외를 캐치하여 일관된 에러 응답 제공
 */

using System.Net;
using System.Text.Json;

/// <summary>
/// 애플리케이션 전역 예외 처리 미들웨어
/// 
/// 목적:
/// - 모든 컨트롤러에서 발생하는 예외를 중앙 집중 처리
/// - 클라이언트에게 일관된 에러 응답 형식 제공
/// - 보안을 위해 내부 에러 정보 필터링
/// - 모든 예외를 로그에 기록하여 디버깅 지원
/// 
/// 사용법:
/// Program.cs에서 app.UseMiddleware&lt;ExceptionMiddleware&gt;(); 로 등록
/// 주의: 다른 미들웨어보다 앞쪽에 배치해야 모든 예외를 캐치할 수 있음
/// </summary>
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    /// <summary>
    /// 미들웨어 생성자
    /// </summary>
    /// <param name="next">다음 미들웨어 파이프라인</param>
    /// <param name="logger">로깅을 위한 의존성 주입</param>
    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    /// <summary>
    /// HTTP 요청 처리 및 예외 캐치
    /// 
    /// 처리 흐름:
    /// 1. 정상 케이스: 다음 미들웨어로 요청 전달
    /// 2. 예외 발생: 예외 로깅 후 표준화된 에러 응답 반환
    /// </summary>
    /// <param name="context">HTTP 컨텍스트</param>
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            // 다음 미들웨어 체인으로 요청 전달
            await _next(context);
        }
        catch (Exception ex)
        {
            // 모든 예외를 로그에 기록 (스택 트레이스 포함)
            _logger.LogError(ex, "처리되지 않은 예외 발생: {RequestPath} {RequestMethod}", 
                context.Request.Path, context.Request.Method);

            // HTTP 응답 설정
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";

            // 클라이언트용 에러 응답 생성
            var errorResponse = JsonSerializer.Serialize(new
            {
                status = context.Response.StatusCode,
                error = "서버 내부 오류가 발생했습니다.",
                
                // 보안 고려사항: 운영 환경에서는 제거 권장
                details = ex.Message,
                
                // 디버깅용 추가 정보 (개발 환경에서만 사용)
                timestamp = DateTime.UtcNow,
                path = context.Request.Path.Value
            });

            await context.Response.WriteAsync(errorResponse);
        }
    }
}

/**
 * 운영 환경 배포 시 고려사항:
 * 
 * 1. 보안 강화:
 *    - ex.Message 제거 (내부 정보 노출 방지)
 *    - 스택 트레이스 정보 숨김
 *    - 일반적인 에러 메시지만 반환
 * 
 * 2. 로깅 강화:
 *    - 요청 IP 주소 기록
 *    - 사용자 정보 (인증된 경우)
 *    - 요청 헤더 정보 (필요시)
 * 
 * 3. 모니터링 연동:
 *    - Application Insights 또는 Serilog 연동
 *    - 에러율 모니터링 및 알림 설정
 *    - 성능 메트릭 수집
 * 
 * 4. 특정 예외 타입별 처리:
 *    - ValidationException → 400 Bad Request
 *    - UnauthorizedException → 401 Unauthorized  
 *    - NotFoundException → 404 Not Found
 */

/**
 * Program.cs 등록 예시:
 * 
 * var builder = WebApplication.CreateBuilder(args);
 * // ... 서비스 등록
 * 
 * var app = builder.Build();
 * 
 * // 중요: 다른 미들웨어보다 먼저 등록
 * app.UseMiddleware<ExceptionMiddleware>();
 * 
 * app.UseAuthentication();
 * app.UseAuthorization();
 * app.MapControllers();
 * 
 * app.Run();
 */