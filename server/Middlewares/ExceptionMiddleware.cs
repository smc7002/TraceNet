// 📁 Middlewares/ExceptionMiddleware.cs

using System.Net;
using System.Text.Json;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context); // 정상 파이프라인 진행
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred");

            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";

            var result = JsonSerializer.Serialize(new
            {
                status = context.Response.StatusCode,
                error = "서버 내부 오류가 발생했습니다.",
                details = ex.Message // 개발 중에는 노출, 운영 땐 제거 가능
            });

            await context.Response.WriteAsync(result);
        }
    }
}
