/**
 * @fileoverview Global Exception Handling Middleware
 * @description Catches all unhandled exceptions in the ASP.NET Core pipeline 
 * and provides a consistent error response.
 */

using System.Net;
using System.Text.Json;

/// <summary>
/// Application-wide exception handling middleware
/// 
/// Purpose:
/// - Centrally handle exceptions occurring in any controller
/// - Provide a consistent error response format to clients
/// - Filter internal error details for security
/// - Log all exceptions for debugging and diagnostics
/// 
/// Usage:
/// Register in Program.cs with app.UseMiddleware&lt;ExceptionMiddleware&gt;();
/// Note: Place this before other middleware to ensure all exceptions are caught.
/// </summary>
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    /// <summary>
    /// Middleware constructor
    /// </summary>
    /// <param name="next">Next middleware in the pipeline</param>
    /// <param name="logger">Logger injected via dependency injection</param>
    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    /// <summary>
    /// Handles HTTP requests and catches exceptions
    /// 
    /// Flow:
    /// 1. Normal case: passes request to the next middleware
    /// 2. Exception case: logs the error and returns a standardized error response
    /// </summary>
    /// <param name="context">HTTP context</param>
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            // Pass request to the next middleware in the chain
            await _next(context);
        }
        catch (Exception ex)
        {
            // Log all exceptions (including stack trace)
            _logger.LogError(ex, "Unhandled exception occurred: {RequestPath} {RequestMethod}", 
                context.Request.Path, context.Request.Method);

            // Configure HTTP response
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";

            // Create error response for the client
            var errorResponse = JsonSerializer.Serialize(new
            {
                status = context.Response.StatusCode,
                error = "An internal server error has occurred.",
                
                // Security note: remove in production to avoid exposing details
                details = ex.Message,
                
                // Debugging info (recommended only in development)
                timestamp = DateTime.UtcNow,
                path = context.Request.Path.Value
            });

            await context.Response.WriteAsync(errorResponse);
        }
    }
}

/**
 * Deployment considerations for production:
 * 
 * 1. Security hardening:
 *    - Remove ex.Message (avoid exposing internal details)
 *    - Hide stack trace
 *    - Return only a generic error message
 * 
 * 2. Enhanced logging:
 *    - Log client IP address
 *    - Log user info (if authenticated)
 *    - Log request headers (if necessary)
 * 
 * 3. Monitoring integration:
 *    - Integrate with Application Insights or Serilog
 *    - Set up error rate monitoring and alerts
 *    - Collect performance metrics
 * 
 * 4. Exception type-specific handling:
 *    - ValidationException → 400 Bad Request
 *    - UnauthorizedException → 401 Unauthorized
 *    - NotFoundException → 404 Not Found
 */

/**
 * Example registration in Program.cs:
 * 
 * var builder = WebApplication.CreateBuilder(args);
 * // ... service registrations
 * 
 * var app = builder.Build();
 * 
 * // Important: Register before other middleware
 * app.UseMiddleware<ExceptionMiddleware>();
 * 
 * app.UseAuthentication();
 * app.UseAuthorization();
 * app.MapControllers();
 * 
 * app.Run();
 */
