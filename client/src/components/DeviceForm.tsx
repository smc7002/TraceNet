// 📁 components/DeviceForm.tsx
import { useState, useCallback } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios, { AxiosError } from "axios";

interface DeviceFormProps {
  onSuccess?: () => void; // 성공 시 콜백 (예: 목록 새로고침)
}

// 디바이스 타입 상수
const DEVICE_TYPES = ['PC', 'Switch', 'Server', 'NAS', 'AP', 'Printer', 'CCTV', 'Firewall', 'Router'] as const;
type DeviceType = typeof DEVICE_TYPES[number];

// 초기값 상수
const INITIAL_VALUES = {
  name: '',
  type: 'PC' as DeviceType,
  ipAddress: '',
  portCount: 1,
  rackId: null as number | null,
};

export default function DeviceForm({ onSuccess }: DeviceFormProps) {
  const [formData, setFormData] = useState<typeof INITIAL_VALUES>(INITIAL_VALUES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 폼 데이터 업데이트 핸들러
  const updateFormData = useCallback(
    <T extends keyof typeof formData>(field: T, value: typeof formData[T]) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  // 폼 리셋
  const resetForm = useCallback(() => {
    setFormData(INITIAL_VALUES);
    setError("");
  }, []);

  // IP 주소 유효성 검사
  const validateIpAddress = (ip: string): boolean => {
    if (!ip) return true;
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  // 폼 유효성 검사
  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "장비 이름을 입력해주세요.";
    if (formData.ipAddress && !validateIpAddress(formData.ipAddress)) {
      return "올바른 IP 주소 형식을 입력해주세요.";
    }
    if (formData.portCount < 1 || formData.portCount > 999) {
      return "포트 수는 1-999 사이여야 합니다.";
    }
    if (formData.type === "Switch" && !formData.rackId) {
      return "Switch 장비는 랙 ID가 필요합니다.";
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        rackId: formData.type === "Switch" ? formData.rackId : null,
      };

      await axios.post("/api/device", payload);
      resetForm();
      onSuccess?.();
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string; error?: string }>;
      const message =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        "장비 등록 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4 text-sm"
    >
      <div className="text-slate-700 font-semibold">➕ 장비 추가</div>

      <div className="space-y-3">
        <div>
          <label className="block text-slate-600 font-medium mb-1">
            장비 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateFormData("name", e.target.value)}
            required
            maxLength={50}
            placeholder="예: 서버실-PC-01"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">
            장비 유형 <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.type}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => updateFormData("type", e.target.value as DeviceType)}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {DEVICE_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">IP 주소</label>
          <input
            type="text"
            value={formData.ipAddress}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateFormData("ipAddress", e.target.value)}
            placeholder="192.168.0.10"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">
            포트 수 <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.portCount}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateFormData("portCount", Number(e.target.value))
            }
            min={1}
            max={999}
            required
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {formData.type === "Switch" && (
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              랙 ID <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.rackId ?? ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateFormData("rackId", e.target.value ? Number(e.target.value) : null)
              }
              required
              min={1}
              placeholder="1"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "등록 중..." : "장비 등록"}
        </button>

        <button
          type="button"
          onClick={resetForm}
          disabled={loading}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          초기화
        </button>
      </div>
    </form>
  );
}
