import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";

interface SidePanelProps {
  selectedDevice: Device | null;
  traceResult: TraceResponse | null;
  traceError: string | null;
}

export default function SidePanel({
  selectedDevice,
  traceResult,
  traceError,
}: SidePanelProps) {
  if (!selectedDevice) {
    return (
      <aside className="w-80 shrink-0 bg-white border-l border-slate-200 p-6 shadow-inner">
        <h2 className="text-lg font-semibold mb-4">장비 정보</h2>
        <p className="text-slate-400 text-sm">장비를 클릭해주세요.</p>
      </aside>
    );
  }

  return (
    <aside className="w-80 shrink-0 flex flex-col bg-white border-l border-slate-200 shadow-md">
      {/* 🔷 헤더 */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="text-lg font-semibold">{selectedDevice.name}</div>
        <div className="text-sm text-slate-500">
          {selectedDevice.ipAddress ?? "IP 미지정"} • {selectedDevice.status} •
          방금 전
        </div>
      </div>

      {/* 📦 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
        {/* 📊 장비 정보 */}
        <section>
          <div className="text-slate-700 font-semibold mb-3">📊 장비 정보</div>
          <InfoItem label="IP 주소" value={selectedDevice.ipAddress ?? "-"} />
          <InfoItem label="장비 유형" value={selectedDevice.type} />
        </section>

        {/* 🛤️ Trace 결과 */}
        <section>
          <div className="text-slate-700 font-semibold mb-3">🛤️ Trace 결과</div>
          {traceError ? (
            <div className="text-red-500 text-sm">{traceError}</div>
          ) : !traceResult ? (
            <div className="text-slate-400 text-sm">
              Trace 정보를 불러오는 중입니다...
            </div>
          ) : traceResult.path?.length > 0 ? (
            <div className="bg-slate-50 rounded-md p-3 text-[12px] font-mono space-y-1 text-slate-700">
              {traceResult.path.map((trace, idx) => (
                <div key={idx}>
                  {idx + 1}. {trace.fromDevice} ({trace.fromPort}) →{" "}
                  {trace.toDevice} ({trace.toPort})
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">경로 정보가 없습니다.</div>
          )}
        </section>

        {/* 📡 Ping 통계
        <section>
          <div className="text-slate-700 font-semibold mb-3">
            📡 Ping 통계 (임시 UI)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="평균 지연" value="2ms" />
            <StatBox label="가용성" value="99.9%" />
            <StatBox label="최소 지연" value="1ms" />
            <StatBox label="최대 지연" value="5ms" />
          </div>
        </section> */}

        {/* 📈 연결 히스토리 */}
        {/* <section>
          <div className="text-slate-700 font-semibold mb-3">
            📈 연결 히스토리
          </div>
          <InfoItem label="마지막 재시작" value="3일 전" />
          <InfoItem label="총 업타임" value="99.2%" />
          <InfoItem label="첫 감지" value="2024-01-15" />
        </section> */}
      </div>
    </aside>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

// function StatBox({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="text-center bg-slate-100 rounded-md p-2">
//       <div className="text-lg font-semibold text-slate-800">{value}</div>
//       <div className="text-[11px] text-slate-500">{label}</div>
//     </div>
//   );
// }
