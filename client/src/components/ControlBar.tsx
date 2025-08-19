// controlbar.tsx

import { useRef, useState } from "react";
import { DeviceStatus } from "../types/status";

interface ControlBarProps {
  onRefresh: () => void;
  onToggleProblemOnly: () => void;
  showProblemOnly: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  statusCounts: {
    Online: number;
    Offline: number;
    Unstable: number;
  };
  onPingAll: () => void;
  isPinging: boolean;
  keyboardNavEnabled?: boolean;
  onToggleKeyboardNav?: () => void;
  searchError?: string;

  /** 전체 상태 일괄 변경 */
  onBulkSetStatus: (status: DeviceStatus, enablePing?: boolean) => Promise<void> | void;
  /** 진행중 표시(선택) — 없으면 isPinging 사용 */
  isBusy?: boolean;
  problemCount?: number;
}

export default function ControlBar({
  onRefresh,
  onToggleProblemOnly,
  showProblemOnly,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  statusCounts,
  onPingAll,
  isPinging,
  //keyboardNavEnabled,
  //onToggleKeyboardNav,
  searchError,
  onBulkSetStatus,
  isBusy,
  problemCount = 0,
}: ControlBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openBulk, setOpenBulk] = useState(false);

  const busy = isBusy ?? isPinging;

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const { message } = await res.json();
        alert("❌ 업로드 실패: " + message);
        return;
      }

      alert("✅ JSON 파일 업로드 완료!");
      onRefresh(); // 업로드 후 장비/케이블 재로딩
    } catch (err) {
      alert("업로드 중 오류 발생");
      console.error(err);
    } finally {
      e.target.value = ""; // 같은 파일 다시 선택 가능하게
    }
  };

  const handleBulk = (status: DeviceStatus, enablePing?: boolean) => {
    setOpenBulk(false);
    onBulkSetStatus(status, enablePing);
  };

  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-4">
      {/* 🔍 검색창 */}
      <input
        type="text"
        placeholder={searchError ? "장비 없음: 다시 입력하세요" : "장비 이름 or IP 검색..."}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearchSubmit();
        }}
        className={`flex-1 px-4 py-2 text-sm border rounded-md outline-none transition
          ${
            searchError
              ? "border-red-400 focus:ring-2 focus:ring-red-400 focus:border-red-400"
              : "border-slate-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          }`}
        disabled={busy}
      />

      {/* ✅ 상태 통계 */}
      <div className="flex gap-2 text-xs font-medium">
        <div className="px-2 py-1 rounded bg-green-100 text-green-700 flex items-center gap-1">
          ● {statusCounts.Online}개 온라인
        </div>
        <div className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 flex items-center gap-1">
          ● {statusCounts.Unstable}개 경고
        </div>
        <div className="px-2 py-1 rounded bg-red-100 text-red-700 flex items-center gap-1">
          ● {statusCounts.Offline}개 오프라인
        </div>
      </div>

      {/* 문제만 토글 */}
      <button
        onClick={onToggleProblemOnly}
        disabled={busy || problemCount === 0}
        aria-pressed={showProblemOnly}
        className={`px-3 py-2 rounded-md text-sm border ${
          showProblemOnly
            ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
            : "bg-white text-gray-800 border-slate-300 hover:bg-slate-100"
        } disabled:opacity-50 disabled:cursor-not-allowed transition`}
      >
        🔍 문제 장비만{problemCount ? ` (${problemCount})` : ""}
      </button>

      {/* 전체 상태 드롭다운 */}
      <div className="relative">
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpenBulk((v) => !v)}
          className="px-3 py-2 rounded-md text-sm border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          ⚙️ 상태 변경
        </button>

        {openBulk && (
          <div
            className="absolute right-0 mt-2 w-56 rounded-md border border-slate-200 bg-white shadow-lg z-50"
            onMouseLeave={() => setOpenBulk(false)}
          >
            <MenuItem label="모두 Online" onClick={() => handleBulk(DeviceStatus.Online)} />
            <MenuItem label="모두 Offline" onClick={() => handleBulk(DeviceStatus.Offline)} />
            <MenuItem label="모두 Unstable" onClick={() => handleBulk(DeviceStatus.Unstable)} />
            <MenuItem label="모두 Unknown" onClick={() => handleBulk(DeviceStatus.Unknown)} />
            <div className="my-1 border-t border-slate-200" />
            <MenuItem label="모두 Online + Ping ON" onClick={() => handleBulk(DeviceStatus.Online, true)} />
            <MenuItem label="모두 Offline + Ping OFF" onClick={() => handleBulk(DeviceStatus.Offline, false)} />
          </div>
        )}
      </div>

      {/* 전체 Ping */}
      <button
        onClick={onPingAll}
        disabled={busy}
        className={`px-3 py-2 rounded-md text-sm border ${
          busy
            ? "bg-green-400 text-white border-green-400 cursor-not-allowed"
            : "bg-green-600 text-white border-green-600 hover:bg-green-700"
        } disabled:opacity-75 transition flex items-center gap-1`}
      >
        {busy ? (
          <>
            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
            Ping 중...
          </>
        ) : (
          <>📡 전체 Ping</>
        )}
      </button>

      {/* 새로고침 */}
      <button
        onClick={onRefresh}
        disabled={busy}
        className="px-3 py-2 rounded-md text-sm bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        🔄 새로고침
      </button>

      {/* JSON 업로드 */}
      <button
        onClick={handleImportClick}
        disabled={busy}
        className="px-3 py-2 rounded-md text-sm bg-slate-600 text-white border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        📂 JSON 업로드
      </button>
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
    >
      {label}
    </button>
  );
}
