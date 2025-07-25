// components/ImportJsonButton.tsx

import { useRef } from "react";
import axios from "axios";

export default function ImportJsonButton({ onSuccess }: { onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post("/api/import", formData);
      alert("✅ JSON 데이터가 성공적으로 업로드되었습니다.");
      onSuccess();
    } catch (err) {
      alert("❌ 업로드 실패: " + (err as Error).message);
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={() => fileInputRef.current?.click()}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        📂 JSON 업로드
      </button>
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
