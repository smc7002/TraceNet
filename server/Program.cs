// Program.cs

using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Services;
using AutoMapper;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TraceNet.DTOs; // ✅ DTOs 네임스페이스를 통해 프로필 인식

var builder = WebApplication.CreateBuilder(args);

// 🔌 Add DbContext
builder.Services.AddDbContext<TraceNetDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))
           .ConfigureWarnings(warnings =>
           {
               warnings.Ignore(CoreEventId.NavigationBaseIncludeIgnored);
           });
});

// 🔧 Add AutoMapper with all profiles in current assembly
builder.Services.AddAutoMapper(typeof(DeviceProfile));
builder.Services.AddScoped<DeviceService>();

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
