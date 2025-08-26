/**
 * @fileoverview Network Monitoring Control Bar Component
 * @description TraceNet 시스템의 상단 제어 패널 컴포넌트
 *
 * @overview
 * 네트워크 장비 검색, 필터링, 상태 모니터링 및 일괄 작업을 위한 통합 UI 컴포넌트입니다.
 * 실시간 장비 상태 통계와 Ping 기능, JSON 데이터 업로드 기능을 제공합니다.
 */

import { useRef, useState } from "react";
import { DeviceStatus } from "../types/status";

/**
 * ControlBar 컴포넌트의 Props 인터페이스
 *
 * @interface ControlBarProps
 * @description 상위 컴포넌트(MainPage)와의 데이터 연동을 위한 인터페이스 정의
 */
interface ControlBarProps {
  /** 전체 데이터 새로고침 트리거 함수 */
  onRefresh: () => void;

  /** 문제 장비만 보기 토글 함수 */
  onToggleProblemOnly: () => void;

  /** 현재 문제 장비만 보기 상태 */
  showProblemOnly: boolean;

  /** 현재 검색어 문자열 */
  searchQuery: string;

  /** 검색어 변경 시 호출되는 함수 */
  onSearchChange: (value: string) => void;

  /** 검색 실행 시 호출되는 함수 (Enter 키 또는 검색 버튼) */
  onSearchSubmit: () => void;

  /** 장비 상태별 실시간 개수 통계 */
  statusCounts: {
    Online: number;
    Offline: number;
    Unstable: number;
  };

  /** 전체 장비 Ping 실행 함수 */
  onPingAll: () => void;

  /** Ping 작업 진행 중 여부 */
  isPinging: boolean;

  /** 키보드 네비게이션 활성화 여부 (선택사항) */
  keyboardNavEnabled?: boolean;

  /** 키보드 네비게이션 토글 함수 (선택사항) */
  onToggleKeyboardNav?: () => void;

  /** 검색 오류 메시지 (검색 결과 없을 때) */
  searchError?: string;

  /** 전체 장비 상태 일괄 변경 함수 */
  onBulkSetStatus: (
    status: DeviceStatus,
    enablePing?: boolean
  ) => Promise<void> | void;

  /** 전체적인 작업 진행 상태 (isPinging보다 우선순위 높음) */
  isBusy?: boolean;

  /** 문제가 있는 장비 총 개수 */
  problemCount?: number;
}

/**
 * TraceNet 네트워크 모니터링 시스템의 상단 제어 패널 컴포넌트
 *
 * @description
 * 사용자가 네트워크 장비를 효과적으로 관리할 수 있도록 다음 기능들을 제공합니다:
 * - 실시간 장비 검색 및 필터링
 * - 장비 상태 통계 시각화
 * - 전체/선택적 Ping 실행
 * - 문제 장비 빠른 필터링
 * - JSON 데이터 일괄 업로드
 * - 장비 상태 일괄 변경
 *
 * @param {ControlBarProps} props - 컴포넌트 설정 및 이벤트 핸들러
 * @returns {JSX.Element} 렌더링된 제어 패널 UI
 *
 * @example
 * ```tsx
 * <ControlBar
 *   onRefresh={handleRefresh}
 *   onPingAll={handlePingAll}
 *   isPinging={isPinging}
 *   statusCounts={{ Online: 150, Offline: 5, Unstable: 2 }}
 *   searchQuery={searchTerm}
 *   onSearchChange={setSearchTerm}
 *   // ... 기타 props
 * />
 * ```
 */
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
  //keyboardNavEnabled,      // 향후 확장을 위해 주석 처리
  //onToggleKeyboardNav,     // 향후 확장을 위해 주석 처리
  searchError,
  onBulkSetStatus,
  isBusy,
  problemCount = 0,
}: ControlBarProps) {
  // 파일 업로드를 위한 숨겨진 input 요소 참조
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 일괄 상태 변경 드롭다운 메뉴 열림/닫힘 상태
  const [openBulk, setOpenBulk] = useState(false);

  // 전체 삭제 진행 상태
  const [deleting, setDeleting] = useState(false);

  // 전체 작업 진행 상태 (isBusy가 있으면 우선, 없으면 isPinging 사용)
  const busy = isBusy ?? isPinging;

  /**
   * JSON 파일 업로드 버튼 클릭 핸들러
   * 숨겨진 file input을 프로그래매틱하게 트리거합니다.
   */
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * JSON 파일 업로드 처리 함수
   *
   * @description
   * 사용자가 선택한 JSON 파일을 서버로 업로드하여 장비 데이터를 일괄 등록합니다.
   * 대용량 데이터 처리를 위해 FormData와 multipart/form-data를 사용합니다.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - 파일 선택 이벤트
   *
   * @async
   * @throws {Error} 네트워크 오류 또는 서버 오류 시 예외 발생
   *
   * @performance
   * - 권장 파일 크기: 10MB 이하
   * - 예상 처리 시간: 100개 장비당 1-2초
   *
   * @security
   * - JSON 형식 검증은 서버에서 수행
   * - 파일 크기 제한은 서버 설정에 따름
   */
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
      onRefresh(); // 업로드 후 장비/케이블 데이터 재로딩
    } catch (err) {
      alert("업로드 중 오류 발생");
      console.error(err);
    } finally {
      // 같은 파일을 다시 선택할 수 있도록 input value 초기화
      e.target.value = "";
    }
  };

  const handleDeleteAll = async () => {
    const ok = window.confirm(
      "⚠️ 모든 장비/포트/케이블 데이터를 삭제합니다. 되돌릴 수 없습니다. 진행할까요?"
    );
    if (!ok) return;

    try {
      setDeleting(true);
      const res = await fetch("/api/device/all", { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      // 가장 안전: 전체 새로고침
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("삭제에 실패했습니다. 콘솔을 확인하세요.");
    } finally {
      setDeleting(false);
    }
  };

  /**
   * 일괄 상태 변경 처리 함수
   *
   * @description
   * 선택된 상태로 모든 장비의 상태를 일괄 변경합니다.
   * Ping 기능의 활성화/비활성화도 함께 설정할 수 있습니다.
   *
   * @param {DeviceStatus} status - 변경할 장비 상태
   * @param {boolean} [enablePing] - Ping 기능 활성화 여부 (선택사항)
   */
  const handleBulk = (status: DeviceStatus, enablePing?: boolean) => {
    setOpenBulk(false);
    onBulkSetStatus(status, enablePing);
  };

  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-4">
      {/* 실시간 검색창 */}
      <input
        type="text"
        placeholder={
          searchError ? "장비 없음: 다시 입력하세요" : "장비 이름 or IP 검색..."
        }
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
        aria-label="장비 검색"
        aria-invalid={!!searchError}
      />

      {/* 🗑 전체 삭제 버튼 */}
      <button
        onClick={handleDeleteAll}
        disabled={busy || deleting}
        aria-label="모든 장비/포트/케이블 삭제"
        className="px-3 py-2 rounded-md text-sm border
             border-red-300 text-red-700 bg-red-50
             hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        title="모든 장비/포트/케이블 삭제"
      >
        {deleting ? "삭제 중..." : "전체 삭제"}
      </button>  

      {/* 실시간 상태 통계 표시 */}
      <div
        className="flex gap-2 text-xs font-medium"
        role="status"
        aria-live="polite"
      >
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

      {/* 문제 장비 필터 토글 */}
      <button
        onClick={onToggleProblemOnly}
        disabled={busy || problemCount === 0}
        aria-pressed={showProblemOnly}
        aria-label={`문제 장비만 보기 ${showProblemOnly ? "해제" : "활성화"}`}
        className={`px-3 py-2 rounded-md text-sm border ${
          showProblemOnly
            ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
            : "bg-white text-gray-800 border-slate-300 hover:bg-slate-100"
        } disabled:opacity-50 disabled:cursor-not-allowed transition`}
      >
        🔍 문제 장비만{problemCount ? ` (${problemCount})` : ""}
      </button>

      {/* 전체 상태 일괄 변경 드롭다운 */}
      <div className="relative">
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpenBulk((v) => !v)}
          aria-haspopup="true"
          aria-expanded={openBulk}
          aria-label="장비 상태 일괄 변경 메뉴"
          className="px-3 py-2 rounded-md text-sm border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          ⚙️ 상태 변경
        </button>

        {/* 드롭다운 메뉴 */}
        {openBulk && (
          <div
            className="absolute right-0 mt-2 w-56 rounded-md border border-slate-200 bg-white shadow-lg z-50"
            onMouseLeave={() => setOpenBulk(false)}
            role="menu"
            aria-label="상태 변경 옵션"
          >
            <MenuItem
              label="모두 Online"
              onClick={() => handleBulk(DeviceStatus.Online)}
            />
            <MenuItem
              label="모두 Offline"
              onClick={() => handleBulk(DeviceStatus.Offline)}
            />
            <MenuItem
              label="모두 Unstable"
              onClick={() => handleBulk(DeviceStatus.Unstable)}
            />
            <MenuItem
              label="모두 Unknown"
              onClick={() => handleBulk(DeviceStatus.Unknown)}
            />

            {/* 구분선 */}
            <div className="my-1 border-t border-slate-200" />

            {/* Ping 설정과 함께 상태 변경 */}
            <MenuItem
              label="모두 Online + Ping ON"
              onClick={() => handleBulk(DeviceStatus.Online, true)}
            />
            <MenuItem
              label="모두 Offline + Ping OFF"
              onClick={() => handleBulk(DeviceStatus.Offline, false)}
            />
          </div>
        )}
      </div>

      {/* 전체 Ping 실행 버튼 */}
      <button
        onClick={onPingAll}
        disabled={busy}
        aria-label={busy ? "Ping 실행 중" : "전체 장비 Ping 실행"}
        className={`px-3 py-2 rounded-md text-sm border ${
          busy
            ? "bg-green-400 text-white border-green-400 cursor-not-allowed"
            : "bg-green-600 text-white border-green-600 hover:bg-green-700"
        } disabled:opacity-75 transition flex items-center gap-1`}
      >
        {busy ? (
          <>
            {/* 로딩 스피너 */}
            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
            Ping 중...
          </>
        ) : (
          <>📡 전체 Ping</>
        )}
      </button>

      {/* 데이터 새로고침 버튼 */}
      <button
        onClick={onRefresh}
        disabled={busy}
        aria-label="장비 및 케이블 데이터 새로고침"
        className="px-3 py-2 rounded-md text-sm bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        🔄 새로고침
      </button>

      {/* JSON 데이터 업로드 버튼 */}
      <button
        onClick={handleImportClick}
        disabled={busy}
        aria-label="JSON 파일로 장비 데이터 일괄 업로드"
        className="px-3 py-2 rounded-md text-sm bg-slate-600 text-white border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        📂 JSON 업로드
      </button>

      {/* 숨겨진 파일 input (프로그래매틱 접근용) */}
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * 드롭다운 메뉴 아이템 컴포넌트
 *
 * @description
 * 일괄 상태 변경 드롭다운에서 사용되는 개별 메뉴 아이템입니다.
 * 접근성을 위해 키보드 네비게이션과 ARIA 속성을 지원합니다.
 *
 * @param {Object} props - 메뉴 아이템 속성
 * @param {string} props.label - 메뉴 아이템에 표시될 텍스트
 * @param {() => void} props.onClick - 클릭 시 실행될 함수
 *
 * @example
 * ```tsx
 * <MenuItem
 *   label="모두 Online"
 *   onClick={() => handleBulkChange(DeviceStatus.Online)}
 * />
 * ```
 */
function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
    >
      {label}
    </button>
  );
}

/**
 * @accessibility 접근성 고려사항
 *
 * 1. 키보드 네비게이션
 *    - Tab 키로 모든 버튼 접근 가능
 *    - Enter/Space로 버튼 활성화
 *    - 드롭다운 메뉴 화살표 키 지원 (향후 구현)
 *
 * 2. 스크린 리더 지원
 *    - aria-label로 버튼 목적 명시
 *    - aria-pressed로 토글 상태 표시
 *    - role 속성으로 UI 구조 명확화
 *
 * 3. 시각적 피드백
 *    - focus 상태 시각화
 *    - disabled 상태 명확한 구분
 *    - 상태 변화 시 적절한 색상 대비
 */

/**
 * @performance 성능 최적화 사항
 *
 * 1. React 최적화
 *    - useRef로 DOM 직접 접근 최소화
 *    - 조건부 렌더링으로 불필요한 DOM 생성 방지
 *    - 이벤트 핸들러 메모이제이션 (상위 컴포넌트에서 처리)
 *
 * 2. 사용자 경험 최적화
 *    - 로딩 상태 시각적 피드백
 *    - 버튼 비활성화로 중복 클릭 방지
 *    - 실시간 상태 업데이트
 *
 * 3. 메모리 관리
 *    - 파일 업로드 후 input value 초기화
 *    - 드롭다운 자동 닫힘으로 메모리 누수 방지
 */

/**
 * @integration 다른 컴포넌트와의 연동
 *
 * 1. MainPage.tsx
 *    - 모든 이벤트 핸들러와 상태 데이터 제공
 *    - 검색 결과와 필터링 로직 처리
 *
 * 2. NetworkDiagram.tsx
 *    - 상태 변경 시 노드 색상 업데이트
 *    - Ping 결과 시각적 반영
 *
 * 3. SidePanel.tsx
 *    - 선택된 장비 정보와 동기화
 *    - 상세 정보 업데이트 트리거
 */
