/**
 * DeviceForm.tsx - 네트워크 장비 등록 폼 (랙 드롭다운 버전)
 */

import { useState, useCallback, useId, useEffect } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios, { AxiosError } from "axios";
import { fetchRacks, type Rack } from "../api/rackApi";

interface DeviceFormProps {
  onSuccess?: () => void;
}

const DEVICE_TYPES = [
  "PC",
  "Switch",
  "Server",
  //"NAS",
  //"AP",
  //"Printer",
  //"CCTV",
  //"Firewall",
  "Router",
] as const;
type DeviceType = (typeof DEVICE_TYPES)[number];

const INITIAL_VALUES = {
  name: "",
  type: "PC" as DeviceType,
  ipAddress: "",
  portCount: 1,
  rackId: null as number | null,
};

export default function DeviceForm({ onSuccess }: DeviceFormProps) {
  const [formData, setFormData] = useState({ ...INITIAL_VALUES });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Rack 목록 상태 ──────────────────────────────
  const [racks, setRacks] = useState<Rack[]>([]);
  const [loadingRacks, setLoadingRacks] = useState(false);

  // Switch 여부
  const isSwitch = formData.type === "Switch";

  // Switch 선택 시에만 랙 목록 로드(최초 1회)
  useEffect(() => {
    if (!isSwitch) return;
    if (racks.length > 0) return;

    (async () => {
      try {
        setLoadingRacks(true);
        const data = await fetchRacks(); // [{rackId, name, location}, ...]
        setRacks(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError("Rack 목록을 불러오지 못했습니다.");
      } finally {
        setLoadingRacks(false);
      }
    })();
  }, [isSwitch, racks.length]);

  // ── 접근성용 id ─────────────────────────────────
  const idName = useId();
  const idType = useId();
  const idIp = useId();
  const idPorts = useId();
  const idRack = useId();

  // ── 상태 업데이트 헬퍼 ───────────────────────────
  const updateFormData = useCallback(
    <T extends keyof typeof formData>(field: T, value: (typeof formData)[T]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const resetForm = useCallback(() => {
    setFormData({ ...INITIAL_VALUES });
    setError("");
  }, []);

  // ── 검증 ────────────────────────────────────────
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return "장비 이름을 입력해주세요.";

    const ip = formData.ipAddress.trim();
    if (ip && !ipRegex.test(ip)) return "올바른 IP 주소 형식을 입력해주세요.";

    if (
      !Number.isFinite(formData.portCount) ||
      formData.portCount < 1 ||
      formData.portCount > 999
    ) {
      return "포트 수는 1-999 사이여야 합니다.";
    }

    if (isSwitch && !formData.rackId) {
      return "스위치는 Rack 선택이 필수입니다.";
    }

    return null;
  };

  const extractAxiosMessage = (err: unknown) => {
    const e = err as AxiosError<{ message?: string; error?: string }>;
    return (
      e.response?.data?.message ||
      e.response?.data?.error ||
      e.message ||
      "장비 등록 중 오류가 발생했습니다."
    );
  };

  // ── 제출 ────────────────────────────────────────
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
        ipAddress: formData.ipAddress.trim() || null,
        rackId: isSwitch ? formData.rackId : null,
      };

      await axios.post("/api/device", payload);
      resetForm();
      onSuccess?.();
    } catch (err) {
      setError(extractAxiosMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── 렌더 ────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4 text-sm"
    >
      <div className="text-slate-700 font-semibold">➕ 장비 추가</div>

      <div className="space-y-3">
        {/* 이름 */}
        <div>
          <label htmlFor={idName} className="block text-slate-600 font-medium mb-1">
            장비 이름 <span className="text-red-500">*</span>
          </label>
          <input
            id={idName}
            type="text"
            value={formData.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateFormData("name", e.target.value)
            }
            required
            maxLength={50}
            placeholder="예: SW-01"
            autoComplete="off"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 유형 */}
        <div>
          <label htmlFor={idType} className="block text-slate-600 font-medium mb-1">
            장비 유형 <span className="text-red-500">*</span>
          </label>
          <select
            id={idType}
            value={formData.type}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              const next = e.target.value as DeviceType;
              updateFormData("type", next);
              // Switch 해제되면 rackId 초기화
              if (next !== "Switch" && formData.rackId !== null) {
                updateFormData("rackId", null);
              }
            }}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* IP (선택) */}
        <div>
          <label htmlFor={idIp} className="block text-slate-600 font-medium mb-1">
            IP 주소
          </label>
          <input
            id={idIp}
            type="text"
            value={formData.ipAddress}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateFormData("ipAddress", e.target.value)
            }
            placeholder="192.168.0.10"
            inputMode="numeric"
            pattern={ipRegex.source}
            autoComplete="off"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 포트 수 */}
        <div>
          <label htmlFor={idPorts} className="block text-slate-600 font-medium mb-1">
            포트 수 <span className="text-red-500">*</span>
          </label>
          <input
            id={idPorts}
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

        {/* 랙 선택 (Switch 전용) */}
        {isSwitch && (
          <div>
            <label htmlFor={idRack} className="block text-slate-600 font-medium mb-1">
              Rack <span className="text-red-500">*</span>
            </label>

            <select
              id={idRack}
              required
              disabled={loadingRacks}
              value={formData.rackId ?? ""}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                updateFormData(
                  "rackId",
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="" disabled>
                {loadingRacks ? "불러오는 중..." : "Rack 선택"}
              </option>
              {racks.map((r) => (
                <option key={r.rackId} value={r.rackId}>
                </option>
              ))}
            </select>

            {/* 로딩/힌트 */}
            {!loadingRacks && racks.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                등록된 Rack이 없습니다. 먼저 Rack을 추가하세요.
              </p>
            )}
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
