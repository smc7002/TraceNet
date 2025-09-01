// Program.cs

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TraceNet.Data;
using TraceNet.Services;
using AutoMapper;
using TraceNet.DTOs; // AutoMapper 프로필

var builder = WebApplication.CreateBuilder(args);

// ───────────────────────────────────────────────────────────────
// DB
builder.Services.AddDbContext<TraceNetDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions =>
        {
            sqlOptions.CommandTimeout(180); // 3분
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorNumbersToAdd: new[] { 2, 1205 } // 타임아웃/데드락
            );
            sqlOptions.MigrationsHistoryTable("__EFMigrationsHistory");
        })
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment())
        .EnableDetailedErrors(builder.Environment.IsDevelopment())
        .ConfigureWarnings(w => w.Ignore(CoreEventId.NavigationBaseIncludeIgnored));
});

// AutoMapper
builder.Services.AddAutoMapper(typeof(DeviceProfile));

// Controllers (순환참조 방지 + camelCase)
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        o.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// Services
builder.Services.AddScoped<CableService>();
builder.Services.AddScoped<DeviceService>();
builder.Services.AddScoped<PortService>();
builder.Services.AddScoped<TraceService>();
builder.Services.AddScoped<PingService>();

// CORS (개발 중 5173 허용)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy
            .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
    );
});

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ───────────────────────────────────────────────────────────────

var app = builder.Build();

// 앱 시작 시 마이그레이션 자동 적용
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TraceNetDbContext>();
    db.Database.Migrate();
}

// API 포트 고정
app.Urls.Add("http://localhost:5000");


// 잘못된 절대경로를 /api/... 로 강제 리라이트 (헤더/Accept와 무관하게 항상 적용)
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
        newPath = "/api" + path; // /trace/... → /api/trace/...

    if (newPath is not null)
    {
        var old = ctx.Request.Path.Value;
        ctx.Request.Path = newPath;
        app.Logger.LogWarning("Rewrote {old} -> {new}{qs}", old, newPath, ctx.Request.QueryString);
    }

    await next();
});

// //  /device 등으로 직접 GET되면 /api/... 로 로컬 리다이렉트
// app.MapGet("/device",      (HttpContext ctx) => Results.LocalRedirect("/api/device" + ctx.Request.QueryString));
// app.MapGet("/ports",       (HttpContext ctx) => Results.LocalRedirect("/api/ports"  + ctx.Request.QueryString));
// app.MapGet("/port",        (HttpContext ctx) => Results.LocalRedirect("/api/port"   + ctx.Request.QueryString));
// app.MapGet("/cable",       (HttpContext ctx) => Results.LocalRedirect("/api/cable"  + ctx.Request.QueryString));
// app.MapGet("/trace/{*rest}", (string rest, HttpContext ctx)
//     => Results.LocalRedirect("/api/trace/" + rest + ctx.Request.QueryString));

// (정적 파일 서빙) wwwroot/index.html 등을 기본 문서로
app.UseDefaultFiles();
app.UseStaticFiles();

// CORS는 정적/컨트롤러 앞
app.UseCors("AllowFrontend");

// Swagger는 개발에서만
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// HTTPS 리디렉션은 인증서 준비되면 해제
// app.UseHttpsRedirection();

// 글로벌 예외 미들웨어
app.UseMiddleware<ExceptionMiddleware>();

app.UseAuthorization();

// API 라우트
app.MapControllers();

// DB 헬스체크: 연결/마이그레이션/레코드 수 확인
app.MapGet("/health/db", async (TraceNetDbContext db) =>
{
    try
    {
        var connected = await db.Database.CanConnectAsync();
        var pending   = await db.Database.GetPendingMigrationsAsync();
        var deviceCnt = await db.Devices.CountAsync();
        var cableCnt  = await db.Cables.CountAsync();

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

// SPA 폴백: /api가 아닌 경로는 모두 index.html 반환
app.MapFallbackToFile("index.html");

app.Run();
