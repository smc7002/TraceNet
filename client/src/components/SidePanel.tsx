import { useState } from "react";
import axios, { AxiosError } from "axios";
import DeviceForm from "./DeviceForm";
import CableForm from "./CableForm";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";

interface SidePanelProps {
  selectedDevice: Device | null;
  traceResult: TraceResponse | null;
  traceError: string | null;
  setSelectedDevice: (device: Device | null) => void;
  refetchDevices: () => Promise<void>;
  refetchCables: () => Promise<void>;
}

export default function SidePanel({
  selectedDevice,
  traceResult,
  traceError,
  setSelectedDevice,
  refetchDevices,
  refetchCables,
}: SidePanelProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDeleteDevice = async () => {
    if (!selectedDevice) return;

    const confirmDelete = confirm(
      `정말 ${selectedDevice.name} 장비를 삭제하시겠습니까?\n연결된 케이블들도 모두 삭제됩니다.`
    );
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      setSelectedDevice(null); // 바로 패널 초기화
      await axios.delete(`/api/device/${selectedDevice.deviceId}`);
      await Promise.all([refetchDevices(), refetchCables()]);
      console.log("✅ 삭제 완료 및 상태 갱신됨");
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      const message = error.response?.data?.message ?? error.message;
      alert(`삭제 실패: ${message}`);
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  if (!selectedDevice) {
    return (
      <aside className="w-80 shrink-0 bg-white border-l border-slate-200 p-6 space-y-6 overflow-y-auto shadow-inner">
        <h2 className="text-lg font-semibold">🔧 장비 및 케이블 등록</h2>
        <DeviceForm onSuccess={refetchDevices} />
        <CableForm onSuccess={refetchCables} />
      </aside>
    );
  }

  return (
    <aside className="w-80 shrink-0 flex flex-col bg-white border-l border-slate-200 shadow-md">
      {/* 🔷 헤더 */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="text-lg font-semibold">{selectedDevice.name}</div>
        <div className="text-sm text-slate-500">
          {selectedDevice.ipAddress ?? "IP 미지정"} • {selectedDevice.status} • 방금 전
        </div>
      </div>

      {/* 📦 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
        <section>
          <div className="text-slate-700 font-semibold mb-3">📊 장비 정보</div>
          <InfoItem label="IP 주소" value={selectedDevice.ipAddress ?? "-"} />
          <InfoItem label="장비 유형" value={selectedDevice.type} />
        </section>

        <section>
          <div className="text-slate-700 font-semibold mb-3">🛤️ Trace 결과</div>
          {traceError ? (
            <div className="text-red-500 text-sm">{traceError}</div>
          ) : !traceResult ? (
            <div className="text-slate-400 text-sm">Trace 정보를 불러오는 중입니다...</div>
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
      </div>

      {/* 🧹 삭제 버튼 */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <button
          className="bg-red-500 text-white rounded w-full py-2 hover:bg-red-600 transition disabled:opacity-50"
          onClick={handleDeleteDevice}
          disabled={deleting}
        >
          🗑️ 이 장비 삭제하기
        </button>
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
