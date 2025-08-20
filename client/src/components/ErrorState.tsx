// ErrorState.tsx
// 네트워크/초기 로딩 등 전역 에러 상황에서 간단한 메시지와 재시도 버튼을 보여주는 컴포넌트

interface ErrorStateProps {
  /** 사용자에게 보여줄 에러 메시지 (기본: "문제가 발생했습니다.") */
  message?: string;
  /** '다시 시도' 버튼 클릭 시 실행할 콜백 (예: window.location.reload) */
  onRetry?: () => void;
}

export default function ErrorState({
  message = "문제가 발생했습니다.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center text-slate-600 py-12">
      <div className="text-3xl mb-2">⚠️</div>
      <div className="mb-4">{message}</div>

      {/* onRetry가 전달된 경우에만 '다시 시도' 버튼 노출 */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
