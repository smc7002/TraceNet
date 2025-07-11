import React from "react";

interface ErrorStateProps {
  message?: string;
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
