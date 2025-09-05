/**
 * DeviceForm.tsx - Network device registration form (rack dropdown version)
 */

import axios, { AxiosError } from 'axios';
import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';

import { fetchRacks, type Rack } from '../api/rackApi';

interface DeviceFormProps {
  onSuccess?: () => void;
}

const DEVICE_TYPES = [
  'PC',
  'Switch',
  'Server',
  //"NAS",
  //"AP",
  //"Printer",
  //"CCTV",
  //"Firewall",
  'Router',
] as const;
type DeviceType = (typeof DEVICE_TYPES)[number];

const INITIAL_VALUES = {
  name: '',
  type: 'PC' as DeviceType,
  ipAddress: '',
  portCount: 1,
  rackId: null as number | null,
};

export default function DeviceForm({ onSuccess }: DeviceFormProps) {
  const [formData, setFormData] = useState({ ...INITIAL_VALUES });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Rack list state ──────────────────────────────
  const [racks, setRacks] = useState<Rack[]>([]);
  const [loadingRacks, setLoadingRacks] = useState(false);

  // Whether it's a Switch
  const isSwitch = formData.type === 'Switch';

  // Load rack list only when Switch is selected (first time only)
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
        setError('Failed to load rack list.');
      } finally {
        setLoadingRacks(false);
      }
    })();
  }, [isSwitch, racks.length]);

  // ── Accessibility ids ─────────────────────────────────
  const idName = useId();
  const idType = useId();
  const idIp = useId();
  const idPorts = useId();
  const idRack = useId();

  // ── State update helper ───────────────────────────
  const updateFormData = useCallback(
    <T extends keyof typeof formData>(field: T, value: (typeof formData)[T]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const resetForm = useCallback(() => {
    setFormData({ ...INITIAL_VALUES });
    setError('');
  }, []);

  // ── Validation ────────────────────────────────────────
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Please enter device name.';

    const ip = formData.ipAddress.trim();
    if (ip && !ipRegex.test(ip)) return 'Please enter a valid IP address format.';

    if (
      !Number.isFinite(formData.portCount) ||
      formData.portCount < 1 ||
      formData.portCount > 999
    ) {
      return 'Port count must be between 1-999.';
    }

    if (isSwitch && !formData.rackId) {
      return 'Rack selection is required for switches.';
    }

    return null;
  };

  const extractAxiosMessage = (err: unknown) => {
    const e = err as AxiosError<{ message?: string; error?: string }>;
    return (
      e.response?.data?.message ||
      e.response?.data?.error ||
      e.message ||
      'An error occurred during device registration.'
    );
  };

  // ── Submit ────────────────────────────────────────
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        ipAddress: formData.ipAddress.trim() || null,
        rackId: isSwitch ? formData.rackId : null,
      };

      await axios.post('/api/device', payload);
      resetForm();
      onSuccess?.();
    } catch (err) {
      setError(extractAxiosMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
    >
      <div className="font-semibold text-slate-700">➕ Add Device</div>

      <div className="space-y-3">
        {/* Name */}
        <div>
          <label htmlFor={idName} className="mb-1 block font-medium text-slate-600">
            Device Name <span className="text-red-500">*</span>
          </label>
          <input
            id={idName}
            type="text"
            value={formData.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateFormData('name', e.target.value)}
            required
            maxLength={50}
            placeholder="e.g., SW-01"
            autoComplete="off"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type */}
        <div>
          <label htmlFor={idType} className="mb-1 block font-medium text-slate-600">
            Device Type <span className="text-red-500">*</span>
          </label>
          <select
            id={idType}
            value={formData.type}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              const next = e.target.value as DeviceType;
              updateFormData('type', next);
              // Reset rackId when Switch is deselected
              if (next !== 'Switch' && formData.rackId !== null) {
                updateFormData('rackId', null);
              }
            }}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* IP (optional) */}
        <div>
          <label htmlFor={idIp} className="mb-1 block font-medium text-slate-600">
            IP Address
          </label>
          <input
            id={idIp}
            type="text"
            value={formData.ipAddress}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateFormData('ipAddress', e.target.value)
            }
            placeholder="192.168.0.10"
            inputMode="numeric"
            pattern={ipRegex.source}
            autoComplete="off"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Port Count */}
        <div>
          <label htmlFor={idPorts} className="mb-1 block font-medium text-slate-600">
            Port Count <span className="text-red-500">*</span>
          </label>
          <input
            id={idPorts}
            type="number"
            value={formData.portCount}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateFormData('portCount', Number(e.target.value))
            }
            min={1}
            max={999}
            required
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Rack Selection (Switch only) */}
        {isSwitch && (
          <div>
            <label htmlFor={idRack} className="mb-1 block font-medium text-slate-600">
              Rack <span className="text-red-500">*</span>
            </label>

            <select
              id={idRack}
              required
              disabled={loadingRacks}
              value={formData.rackId ?? ''}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                updateFormData('rackId', e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="" disabled>
                {loadingRacks ? 'Loading...' : 'Select Rack'}
              </option>
              {racks.map((r) => (
                <option key={r.rackId} value={r.rackId}></option>
              ))}
            </select>

            {/* Loading/hint */}
            {!loadingRacks && racks.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">
                No registered racks found. Please add a rack first.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Registering...' : 'Register Device'}
        </button>
        <button
          type="button"
          onClick={resetForm}
          disabled={loading}
          className="rounded border border-slate-300 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
