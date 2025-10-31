using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TraceNet.Data;
using TraceNet.Services;
using AutoMapper;
using TraceNet.DTOs;

var builder = WebApplication.CreateBuilder(args);

// Database - PostgreSQL
builder.Services.AddDbContext<TraceNetDbContext>(options =>
{
    var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
    string connectionString;

    if (!string.IsNullOrEmpty(databaseUrl))
    {
        // Railway DATABASE_URL -> Npgsql
        var uri = new Uri(databaseUrl);
        connectionString = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={uri.UserInfo.Split(':')[0]};Password={uri.UserInfo.Split(':')[1]};SSL Mode=Require;Trust Server Certificate=true";
    }
    else
    {
        connectionString = builder.Configuration.GetConnectionString("DefaultConnection")!;
    }

    options.UseNpgsql(connectionString, npgsqlOptions =>
        {
            npgsqlOptions.CommandTimeout(180);
            npgsqlOptions.EnableRetryOnFailure(
    maxRetryCount: 3,
    maxRetryDelay: TimeSpan.FromSeconds(10),
    errorCodesToAdd: null
);
            npgsqlOptions.MigrationsHistoryTable("__EFMigrationsHistory");
        })
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment())
        .EnableDetailedErrors(builder.Environment.IsDevelopment())
        .ConfigureWarnings(w => w.Ignore(CoreEventId.NavigationBaseIncludeIgnored));
});

// AutoMapper
builder.Services.AddAutoMapper(typeof(DeviceProfile));

// Controllers with JSON options
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        o.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// Service registration
builder.Services.AddScoped<CableService>();
builder.Services.AddScoped<DeviceService>();
builder.Services.AddScoped<PortService>();
builder.Services.AddScoped<TraceService>();
builder.Services.AddScoped<PingService>();

// CORS - Allow local dev + Railway production
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://tracenet-production.up.railway.app"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
    );
});

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Run migrations on startup (with error handling)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TraceNetDbContext>();
    try
    {
        // Apply migrations
        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();
        app.Logger.LogInformation("Database recreated with tables successfully");
    }
    catch (Exception ex)
    {
        app.Logger.LogError("DB creation failed: {message}", ex.Message);
    }
}

// Listen on Railway PORT or default 5000
var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Urls.Add($"http://0.0.0.0:{port}");

// Path rewrite middleware: /device -> /api/device
app.Use(async (ctx, next) =>
{
    var path = ctx.Request.Path.Value ?? string.Empty;
    string? newPath = null;

    if (path.Equals("/device", StringComparison.OrdinalIgnoreCase))
        newPath = "/api/device";
    else if (path.Equals("/ports", StringComparison.OrdinalIgnoreCase))
        newPath = "/api/ports";
    else if (path.Equals("/port", StringComparison.OrdinalIgnoreCase))
        newPath = "/api/port";
    else if (path.Equals("/cable", StringComparison.OrdinalIgnoreCase))
        newPath = "/api/cable";
    else if (path.StartsWith("/trace/", StringComparison.OrdinalIgnoreCase))
        newPath = "/api" + path;

    if (newPath is not null)
    {
        ctx.Request.Path = newPath;
        app.Logger.LogWarning("Rewrote {old} -> {new}", path, newPath);
    }

    await next();
});

// Static files
app.UseDefaultFiles();
app.UseStaticFiles();

// CORS
app.UseCors("AllowFrontend");

// Swagger (dev only)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Exception handling
app.UseMiddleware<ExceptionMiddleware>();

app.UseAuthorization();

// API routes
app.MapControllers();

// Health check endpoint
app.MapGet("/health/db", async (TraceNetDbContext db) =>
{
    try
    {
        var connected = await db.Database.CanConnectAsync();
        var pending = await db.Database.GetPendingMigrationsAsync();
        var deviceCnt = await db.Devices.CountAsync();
        var cableCnt = await db.Cables.CountAsync();

        return Results.Ok(new
        {
            connected,
            pendingMigrations = pending,
            counts = new { devices = deviceCnt, cables = cableCnt }
        });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

// SPA fallback
app.MapFallbackToFile("index.html");

app.Run();