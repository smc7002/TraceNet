interface ControlBarProps {
  onRefresh: () => void;
  onToggleProblemOnly: () => void;
  showProblemOnly: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;

  statusCounts: {
    Online: number;
    Offline: number;
    Unstable: number;
  };
}

export default function ControlBar({
  onRefresh,
  onToggleProblemOnly,
  showProblemOnly,
  searchQuery,
  onSearchChange,
  statusCounts,
}: ControlBarProps) {
  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-4">
      {/* 🔍 검색창 */}
      <input
        type="text"
        placeholder="장비 이름 or IP 검색..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition"
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

      {/* 🔘 버튼들 */}
      <button
        onClick={onToggleProblemOnly}
        className={`px-3 py-2 rounded-md text-sm border ${
          showProblemOnly
            ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
            : "bg-white text-gray-800 border-slate-300 hover:bg-slate-100"
        } transition`}
      >
        🔍 문제 장비만
      </button>

      <button
        onClick={onRefresh}
        className="px-3 py-2 rounded-md text-sm bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 transition"
      >
        🔄 새로고침
      </button>
    </div>
  );
}
