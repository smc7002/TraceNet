//import React from "react";
// LoadingSpinner.tsx
// 전역 로딩 상태에서 화면 중앙에 회전 스피너를 보여주는 컴포넌트
// 페이지/패널 로딩 중임을 알리는 용도로 사용

export default function LoadingSpinner() {
  return (
    <div className="w-full h-full flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
