// Program.cs

using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Services;
using AutoMapper;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TraceNet.DTOs; // ✅ DTOs 네임스페이스를 통해 프로필 인식

var builder = WebApplication.CreateBuilder(args);

// Add DbContext with production-ready settings
builder.Services.AddDbContext<TraceNetDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions =>
        {
            // Command Timeout: 200개 장비 처리를 위해 연장
            sqlOptions.CommandTimeout(180); // 3분 (기본 30초 → 180초)

            // 재시도 정책: 일시적 네트워크 오류 대응
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 3,                    // 최대 3회 재시도
                maxRetryDelay: TimeSpan.FromSeconds(10), // 최대 10초 지연
                errorNumbersToAdd: new[] { 2, 1205 }     // 타임아웃(2), 데드락(1205) 추가
            );

            // 연결 복원력 향상
            sqlOptions.MigrationsHistoryTable("__EFMigrationsHistory");
        })
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment()) // 개발 시에만 민감한 데이터 로깅
        .EnableDetailedErrors(builder.Environment.IsDevelopment())       // 개발 시에만 상세 에러
        .ConfigureWarnings(warnings =>
        {
            warnings.Ignore(CoreEventId.NavigationBaseIncludeIgnored);
        });
});

// 🔧 Add AutoMapper with all profiles in current assembly
builder.Services.AddAutoMapper(typeof(DeviceProfile));

// 🔧 Add Controllers with JSON 설정 (순환 참조 방지)
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

// 🧠 Add Services
builder.Services.AddScoped<CableService>();
builder.Services.AddScoped<DeviceService>();
builder.Services.AddScoped<PortService>();
builder.Services.AddScoped<TraceService>();
builder.Services.AddScoped<PingService>();

// 🌐 Add CORS policy to allow requests from frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins("http://localhost:5173")
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
});

// ⚙️ Swagger (선택)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// 🛠 Use CORS before controllers
app.UseCors("AllowFrontend");

// 🌐 Middleware pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

//app.UseHttpsRedirection();

app.UseMiddleware<ExceptionMiddleware>();

app.UseAuthorization();

app.MapControllers();

app.Run();
