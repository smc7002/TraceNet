using Microsoft.EntityFrameworkCore;
using TraceNet.Data;
using TraceNet.Models;

namespace TraceNet.Services
{
    /// <summary>
    /// 케이블과 연결(CableConnection)을 관리하는 서비스 클래스
    /// </summary>
    public class CableService
    {
        private readonly TraceNetDbContext _context;

        public CableService(TraceNetDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// 전체 케이블 + 연결 + 포트 정보 조회
        /// 시각화 다이어그램 JSON 용도로 사용됨
        /// </summary>
        public async Task<List<Cable>> GetAllWithConnectionsAsync()
        {
            return await _context.Cables
                .Include(c => c.Connection)
                    .ThenInclude(conn => conn.FromPort)
                        .ThenInclude(p => p.Device)
                .Include(c => c.Connection)
                    .ThenInclude(conn => conn.ToPort)
                        .ThenInclude(p => p.Device)
                .ToListAsync();
        }

        /// <summary>
        /// 새 케이블과 연결 정보를 함께 생성
        /// </summary>
        public async Task<Cable> CreateAsync(Cable cable)
        {
            if (IsInvalidCable(cable))
                throw new ArgumentException("케이블 정보가 유효하지 않습니다.");

            // ✅ 1. CableId 중복 체크 (가장 먼저 검사하여 비용 절약)
            if (await _context.Cables.AnyAsync(c => c.CableId == cable.CableId))
                throw new InvalidOperationException($"이미 존재하는 CableId입니다: {cable.CableId}");

            var connection = cable.Connection!;

            // ✅ 2. 포트 존재 여부 및 중복 연결 여부 검사
            if (!await IsValidConnectionAsync(connection))
                throw new InvalidOperationException("포트가 존재하지 않거나 이미 다른 케이블과 연결되어 있습니다.");

            _context.Cables.Add(cable);
            await _context.SaveChangesAsync();

            return cable;
        }

        /// <summary>
        /// 케이블과 연결(CableConnection) 삭제
        /// 외래키 제약을 고려해 순서대로 제거
        /// </summary>
        public async Task DeleteAsync(string cableId)
        {
            var cable = await _context.Cables
                .Include(c => c.Connection)
                .FirstOrDefaultAsync(c => c.CableId == cableId);

            if (cable == null)
                throw new KeyNotFoundException($"해당 CableId를 찾을 수 없습니다: {cableId}");

            if (cable.Connection != null)
                _context.CableConnections.Remove(cable.Connection);

            _context.Cables.Remove(cable);
            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// 케이블 객체의 기본 유효성 검사
        /// </summary>
        private bool IsInvalidCable(Cable cable)
        {
            return string.IsNullOrWhiteSpace(cable.CableId) || cable.Connection == null;
        }

        /// <summary>
        /// 포트 존재 여부 및 중복 연결 여부 검사
        /// </summary>
        private async Task<bool> IsValidConnectionAsync(CableConnection connection)
        {
            // ✅ 1. 동일 포트 연결 금지
            if (connection.FromPortId == connection.ToPortId)
                return false;

            // ✅ 2. 포트 존재 여부 확인
            var fromExists = await _context.Ports.AnyAsync(p => p.PortId == connection.FromPortId);
            var toExists = await _context.Ports.AnyAsync(p => p.PortId == connection.ToPortId);
            if (!fromExists || !toExists)
                return false;

            // ✅ 3. 포트 중복 연결 방지 (From 또는 To에 이미 연결된 케이블 존재 시)
            var portUsed = await _context.CableConnections.AnyAsync(c =>
                c.FromPortId == connection.FromPortId ||
                c.ToPortId == connection.FromPortId ||
                c.FromPortId == connection.ToPortId ||
                c.ToPortId == connection.ToPortId
            );

            return !portUsed;
        }
    }
}
