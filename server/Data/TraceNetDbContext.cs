// TraceNetDbContext.cs
// TraceNet 프로젝트의 Entity Framework Core 데이터베이스 컨텍스트

using Microsoft.EntityFrameworkCore;
using TraceNet.Models;

namespace TraceNet.Data
{
    /// <summary>
    /// TraceNet 프로젝트의 Entity Framework Core 데이터베이스 컨텍스트
    /// 네트워크 장비와 케이블 연결을 추적하는 시스템의 데이터 액세스 계층
    /// </summary>
    public class TraceNetDbContext : DbContext
    {
        /// <summary>
        /// 생성자: 데이터베이스 연결 옵션을 받아 부모 클래스에 전달
        /// </summary>
        /// <param name="options">데이터베이스 연결 설정 옵션</param>
        public TraceNetDbContext(DbContextOptions<TraceNetDbContext> options)
            : base(options)
        {
        }

        /// <summary>
        /// 네트워크 장비(Device) 테이블에 대한 DbSet
        /// 라우터, 스위치, 서버 등의 네트워크 장비 정보를 저장
        /// </summary>
        public DbSet<Device> Devices => Set<Device>();

        /// <summary>
        /// 포트(Port) 테이블에 대한 DbSet
        /// 각 장비의 네트워크 포트 정보를 저장
        /// </summary>
        public DbSet<Port> Ports => Set<Port>();

        /// <summary>
        /// 케이블(Cable) 테이블에 대한 DbSet
        /// 물리적 케이블 정보를 저장
        /// </summary>
        public DbSet<Cable> Cables => Set<Cable>();

        /// <summary>
        /// 케이블 연결(CableConnection) 테이블에 대한 DbSet
        /// 케이블이 어떤 포트들을 연결하는지에 대한 정보를 저장
        /// </summary>
        public DbSet<CableConnection> CableConnections => Set<CableConnection>();

        public DbSet<Rack> Racks { get; set; }


        /// <summary>
        /// 모델 간의 관계를 정의하는 메서드
        /// 데이터베이스 테이블 간의 외래키 관계와 제약조건을 설정
        /// </summary>
        /// <param name="modelBuilder">모델 빌더 객체</param>
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // 🔥 Device와 Port 간의 1:N 관계 명시
            modelBuilder.Entity<Device>()
                .HasMany(d => d.Ports)
                .WithOne(p => p.Device)
                .HasForeignKey(p => p.DeviceId)
                .OnDelete(DeleteBehavior.Cascade); // 디바이스 삭제 시 포트도 삭제

            // Cable과 CableConnection 간의 1:1 관계 설정
            // 하나의 케이블은 정확히 하나의 연결 정보를 가짐
            modelBuilder.Entity<Cable>()
                .HasOne(c => c.Connection)              // Cable이 하나의 Connection을 가짐
                .WithOne(cc => cc.Cable)                // CableConnection이 하나의 Cable을 가짐
                .HasForeignKey<CableConnection>(cc => cc.CableId)  // CableConnection 테이블의 CableId가 외래키
                .OnDelete(DeleteBehavior.Cascade);      // Cable 삭제 시 연결된 CableConnection도 함께 삭제

            // CableConnection과 FromPort 간의 다대일 관계 설정
            // 여러 케이블 연결이 하나의 출발 포트를 참조할 수 있음
            modelBuilder.Entity<CableConnection>()
                .HasOne(cc => cc.FromPort)              // CableConnection이 하나의 FromPort를 가짐
                .WithMany()                            // Port는 여러 CableConnection을 가질 수 있음
                .HasForeignKey(cc => cc.FromPortId)     // FromPortId가 외래키
                .OnDelete(DeleteBehavior.Restrict);     // Port 삭제 시 연결된 CableConnection이 있으면 삭제 방지

            modelBuilder.Entity<CableConnection>()
.HasOne(cc => cc.ToPort)
.WithMany()
.HasForeignKey(cc => cc.ToPortId)
.OnDelete(DeleteBehavior.Restrict);

            // 🔗 Rack ↔ Device 관계 (단, Switch만 사용)
            modelBuilder.Entity<Rack>()
                .HasMany(r => r.Devices)
                .WithOne(d => d.Rack)
                .HasForeignKey(d => d.RackId)
                .OnDelete(DeleteBehavior.Cascade);

            // 정방향 1:1 (Port.Connection → CableConnection.FromPort)
            modelBuilder.Entity<Port>()
                .HasOne(p => p.Connection)
                .WithOne(c => c.FromPort)
                .HasForeignKey<CableConnection>(c => c.FromPortId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
