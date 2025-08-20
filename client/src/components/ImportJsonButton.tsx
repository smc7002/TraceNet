// components/ImportJsonButton.tsx
// 로컬 JSON 파일을 선택해 서버로 업로드하는 버튼 컴포넌트
// 서버는 multipart/form-data로 업로드되는 "file" 필드를 받는다고 가정

import { useRef } from "react";
import axios from "axios";

export default function ImportJsonButton({ onSuccess }: { onSuccess: () => void }) {
  // 숨겨진 <input type="file">에 접근하기 위한 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 파일 선택 변경 핸들러
   * - 사용자가 파일을 고르면 FormData로 래핑해 업로드
   * - 성공 시 상위 콜백(onSuccess) 호출하여 목록/화면 갱신
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 백엔드가 multipart/form-data의 "file" 키로 받도록 일치시킴
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post("/api/import", formData);
      alert("✅ JSON 데이터가 성공적으로 업로드되었습니다.");
      onSuccess();

      // (선택) 같은 파일을 연속 업로드할 수 있도록 입력값 리셋이 필요하면 아래 주석 해제
      // e.currentTarget.value = "";
    } catch (err) {
      // 서버 메시지를 노출하려면 err 타입 가드를 추가할 수 있음
      alert("❌ 업로드 실패: " + (err as Error).message);
    }
  };

  return (
    <div className="mb-4">
      {/* 파일 선택 트리거 버튼 (숨겨진 input 클릭) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        📂 JSON 업로드
      </button>

      {/* 실제 파일 입력: 화면에서는 숨김, 버튼으로만 트리거 */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
