/**
 * CableForm.tsx - Network cable connection registration form component
 *
 * Main features:
 * - Register physical cable connections between two network devices
 * - Dynamic loading and selection of port information by device
 * - Network topology business rule validation
 * - Real-time validation and user feedback
 *
 * Design characteristics:
 * - Type safety: Separation of backend API and UI types
 * - Performance optimization: Result caching through useMemo
 * - Memory safety: AbortController and alive flag utilization
 * - User experience: Automatic port selection, loading state management
 *
 * Business rules:
 * - PCs can only connect to SWITCH
 * - Connection between same devices prohibited
 * - Duplicate connections on same port prevented
 *
 * Extensibility:
 * - Business rules can be extended when adding new device types
 * - Port sorting algorithm can be customized
 * - Validation rules can be separated into external configuration
 */

import axios, { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';

import type { Device } from '../types/device';

/**
 * Backend API response port type (management API only)
 *
 * Original port data structure returned from server
 * Provided along with nested device object
 */
type ApiPort = {
  portId: number; // Port unique ID
  name: string; // Port name (e.g., "GigabitEthernet0/1", "P01")
  device: { deviceId: number }; // Parent device information
};

/**
 * Port type used in UI
 *
 * Simplified structure extracting only necessary information from backend type
 * Optimized structure for rendering performance and memory efficiency
 */
type UiPort = {
  id: number; // Port ID (mapped to ApiPort.portId)
  name: string; // Display port name
};

/**
 * CableForm component Props interface
 */
interface CableFormProps {
  onSuccess: () => void; // Callback called when cable registration succeeds
}

/**
 * Network cable connection registration form component
 *
 * Core component containing complex state management and business logic
 * 300+ lines of code organized by logical sections for readability
 *
 * @param props Component props
 * @param props.onSuccess Callback function to execute on successful registration
 * @returns JSX.Element Rendered cable registration form
 */
export default function CableForm({ onSuccess }: CableFormProps) {
  // ───────────────── Form Input State Management ─────────────────

  /**
   * User input field states
   * Each input value is managed independently for granular control
   */
  const [cableId, setCableId] = useState(''); // Cable identifier
  const [description, setDescription] = useState(''); // Cable description (optional)

  // ───────────────── Server Data State Management ─────────────────

  /**
   * Reference data fetched from backend
   * Set once during initial loading and referenced throughout the form
   */
  const [devices, setDevices] = useState<Device[]>([]); // Complete device list
  const [portsByDeviceId, setPortsByDeviceId] = useState<Record<number, UiPort[]>>({}); // Port mapping by device

  // ───────────────── User Selection State Management ─────────────────

  /**
   * Selection states for both ends of cable connection
   *
   * Type design considerations:
   * - number | "": Distinguish between empty select value ("") and actual numeric ID
   * - Ensure type safety while maintaining compatibility with HTML select elements
   */
  const [fromDeviceId, setFromDeviceId] = useState<number | ''>(''); // Source device ID
  const [toDeviceId, setToDeviceId] = useState<number | ''>(''); // Destination device ID
  const [fromPortId, setFromPortId] = useState<number | ''>(''); // Source port ID
  const [toPortId, setToPortId] = useState<number | ''>(''); // Destination port ID

  // ───────────────── UI/Request State Management ─────────────────

  /**
   * User interface control states
   * Track asynchronous operation states like loading, submission
   */
  const [loading, setLoading] = useState(false); // Initial data loading state
  const [submitting, setSubmitting] = useState(false); // Form submission progress state

  // ───────────────── Performance Optimized Computation Logic ─────────────────

  /**
   * Map generation for fast lookup based on device ID
   *
   * Performance considerations:
   * - O(1) lookup performance for device information access
   * - Recalculated only when devices array changes
   * - Used for device type verification during validation
   */
  const deviceById = useMemo(
    () => new Map<number, Device>(devices.map((d) => [d.deviceId, d])),
    [devices],
  );

  /**
   * Port list calculation for selected devices
   *
   * Recalculated only when device selection changes, preventing unnecessary rendering
   * Safe array access guaranteed through type guards
   */
  const fromPorts = useMemo(
    () => (typeof fromDeviceId === 'number' ? (portsByDeviceId[fromDeviceId] ?? []) : []),
    [fromDeviceId, portsByDeviceId],
  );

  const toPorts = useMemo(
    () => (typeof toDeviceId === 'number' ? (portsByDeviceId[toDeviceId] ?? []) : []),
    [toDeviceId, portsByDeviceId],
  );

  // ───────────────── Initial Data Loading (Memory Safe) ─────────────────

  /**
   * Load device and port information when component mounts
   *
   * Advanced error handling pattern:
   * 1. AbortController: Cancel requests on component unmount
   * 2. alive flag: Track component lifecycle
   * 3. Promise.all: Optimize loading time with parallel requests
   * 4. Granular error handling: Distinguish cancellation/failure
   */
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        // Fetch device list and port list in parallel to reduce loading time
        const [deviceRes, portRes] = await Promise.all([
          axios.get<Device[]>('/api/device', { signal: controller.signal }),
          axios.get<ApiPort[]>('/api/ports', { signal: controller.signal }),
        ]);

        // Stop state updates if component has been unmounted
        if (!alive) return;

        setDevices(deviceRes.data);

        /**
         * Group port data by device
         *
         * Algorithm:
         * 1. Group ports by device ID
         * 2. Convert ApiPort → UiPort type
         * 3. Apply natural number priority sorting
         */
        const map: Record<number, UiPort[]> = {};
        for (const p of portRes.data) {
          const devId = p.device?.deviceId;
          if (typeof devId !== 'number') continue; // Skip invalid device IDs

          if (!map[devId]) map[devId] = [];
          map[devId].push({ id: p.portId, name: p.name });
        }

        /**
         * Natural number priority sorting for port names
         *
         * Sorting algorithm:
         * 1. Extract numbers from port names (e.g., "GigabitEthernet0/5" → 5)
         * 2. Primary sort by number
         * 3. Secondary sort by string (when numbers are same or absent)
         *
         * Result: ["P1", "P2", "P10", "P20"] (string sort: ["P1", "P10", "P2", "P20"])
         */
        for (const k of Object.keys(map)) {
          map[Number(k)].sort((a, b) => {
            const na = parseInt(a.name.replace(/\D+/g, '') || '0', 10);
            const nb = parseInt(b.name.replace(/\D+/g, '') || '0', 10);
            return na - nb || a.name.localeCompare(b.name);
          });
        }

        setPortsByDeviceId(map);
      } catch (error) {
        // Request cancellation is normal termination, not an error
        if (axios.isCancel(error)) return;

        console.error('Failed to load device/port:', error);
        alert('Failed to load device/port information.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // Cleanup: Prevent memory leaks
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  // ───────────────── Automatic Port Selection Logic ─────────────────

  /**
   * Auto-select first port when From device changes
   *
   * UX improvements:
   * - Users don't need to manually select ports every time
   * - Prevent errors from previous port selection persisting after device change
   * - Safely set empty value when port list is empty
   */
  useEffect(() => {
    if (typeof fromDeviceId === 'number') {
      const first = portsByDeviceId[fromDeviceId]?.[0]?.id;
      setFromPortId(first ?? '');
    } else {
      setFromPortId('');
    }
  }, [fromDeviceId, portsByDeviceId]);

  /**
   * Auto-select first port when To device changes
   * Same logic as From port
   */
  useEffect(() => {
    if (typeof toDeviceId === 'number') {
      const first = portsByDeviceId[toDeviceId]?.[0]?.id;
      setToPortId(first ?? '');
    } else {
      setToPortId('');
    }
  }, [toDeviceId, portsByDeviceId]);

  // ───────────────── Business Logic Validation ─────────────────

  /**
   * Form data validation function
   *
   * Validation steps:
   * 1. Required input existence check
   * 2. Network topology business rules
   * 3. Data consistency check
   *
   * @returns Error message string or null (if valid)
   */
  const validate = (): string | null => {
    // Step 1: Required input validation
    if (!cableId.trim()) return 'Please enter cable ID.';
    if (typeof fromDeviceId !== 'number' || typeof toDeviceId !== 'number')
      return 'Please select From/To devices.';
    if (typeof fromPortId !== 'number' || typeof toPortId !== 'number')
      return 'Please select From/To ports.';

    // Step 2: Logical consistency validation
    if (fromDeviceId === toDeviceId) return 'Connection between same devices is not allowed.';

    // Prevent connection between same ports (logically impossible)
    if (fromDeviceId === toDeviceId && fromPortId === toPortId)
      return 'Cannot connect same port to itself.';

    // Step 3: Device information existence check
    const from = deviceById.get(fromDeviceId);
    const to = deviceById.get(toDeviceId);
    if (!from || !to) return 'Device information not found.';

    // Step 4: Apply network topology business rules
    const fType = (from.type ?? '').toLowerCase();
    const tType = (to.type ?? '').toLowerCase();

    /**
     * Business rule: PC-SWITCH connection restriction
     *
     * Network architecture design principles:
     * - PCs connect directly only to SWITCH
     * - PC-PC direct connection prohibited (prevent network loops)
     * - PC-SERVER direct connection prohibited (security and management efficiency)
     *
     * Future expansion considerations:
     * - These rules can be separated into external configuration
     * - Rules need expansion when adding new device types
     */
    const invalidPc =
      (fType === 'pc' && tType !== 'switch') || (tType === 'pc' && fType !== 'switch');
    if (invalidPc) return 'PCs can only connect to SWITCH.';

    return null; // All validations passed
  };

  // ───────────────── Form Submission Handling ─────────────────

  /**
   * Cable registration submission handler
   *
   * Processing flow:
   * 1. Prevent default browser behavior
   * 2. Execute validation
   * 3. API call and state management
   * 4. Success/failure handling and user feedback
   * 5. Form reset and callback execution
   *
   * @param e React form event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Execute validation
    const err = validate();
    if (err) {
      alert(`❌ ${err}`);
      return;
    }

    try {
      setSubmitting(true);

      // Cable registration API call
      await axios.post('/api/cable', {
        cableId: cableId.trim(),
        description: description.trim() || undefined, // Convert empty string to undefined
        fromPortId,
        toPortId,
      });

      alert('Cable connected successfully.');

      /**
       * Form reset after success
       * Reset to clean state for users to register cables consecutively
       */
      setCableId('');
      setDescription('');
      setFromDeviceId('');
      setToDeviceId('');
      setFromPortId('');
      setToPortId('');

      // Notify parent component of success (typically for data refresh)
      onSuccess();
    } catch (err) {
      /**
       * Granular error handling
       *
       * Provide appropriate messages by error type:
       * - 409 Conflict: Duplicate connection attempt
       * - Other HTTP errors: Use server response message
       * - Network errors: Generic error message
       */
      const error = err as AxiosError<{ message?: string }>;
      const msg =
        error.response?.data?.message ??
        (error.response?.status === 409 ? 'Duplicate cable connection.' : error.message);
      alert(`Registration failed: ${msg}`);
      console.error('Cable registration error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // ───────────────── Component Rendering ─────────────────

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={submitting || loading}>
        <h3 className="mb-2 font-semibold text-slate-700">📍 Add Cable</h3>

        {/* Cable ID input field */}
        <div>
          <label className="mb-1 block text-sm" htmlFor="cable-id">
            Cable ID
          </label>
          <input
            id="cable-id"
            type="text"
            className="input"
            placeholder="e.g., CABLE-001"
            value={cableId}
            onChange={(e) => setCableId(e.target.value)}
            required
            disabled={loading || submitting}
          />
        </div>

        {/* Cable description input field (optional) */}
        <div>
          <label className="mb-1 block text-sm" htmlFor="cable-desc">
            Description
          </label>
          <input
            id="cable-desc"
            type="text"
            className="input"
            placeholder="e.g., PC-01 to SW-01"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading || submitting}
          />
        </div>

        {/* From device selection dropdown */}
        <div>
          <label className="mb-1 block text-sm" htmlFor="from-device">
            From Device
          </label>
          <select
            id="from-device"
            className="input"
            value={fromDeviceId}
            onChange={(e) => setFromDeviceId(e.target.value ? Number(e.target.value) : '')}
            required
            disabled={loading || submitting}
          >
            <option value="">-- Select --</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.name} ({d.type})
              </option>
            ))}
          </select>
        </div>

        {/* To device selection dropdown */}
        <div>
          <label className="mb-1 block text-sm" htmlFor="to-device">
            To Device
          </label>
          <select
            id="to-device"
            className="input"
            value={toDeviceId}
            onChange={(e) => setToDeviceId(e.target.value ? Number(e.target.value) : '')}
            required
            disabled={loading || submitting}
          >
            <option value="">-- Select --</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.name} ({d.type})
              </option>
            ))}
          </select>
        </div>

        {/* Port selection section */}
        <div className="space-y-4">
          {/* From port selection */}
          <div>
            <label className="mb-1 block text-sm" htmlFor="from-port">
              From Port
            </label>
            <select
              id="from-port"
              className="input"
              value={fromPortId}
              onChange={(e) => setFromPortId(e.target.value ? Number(e.target.value) : '')}
              disabled={loading || submitting || typeof fromDeviceId !== 'number'}
            >
              <option value="">-- Select --</option>
              {fromPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* To port selection */}
          <div>
            <label className="mb-1 block text-sm" htmlFor="to-port">
              To Port
            </label>
            <select
              id="to-port"
              className="input"
              value={toPortId}
              onChange={(e) => setToPortId(e.target.value ? Number(e.target.value) : '')}
              disabled={loading || submitting || typeof toDeviceId !== 'number'}
            >
              <option value="">-- Select --</option>
              {toPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className="rounded bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
          disabled={
            loading ||
            submitting ||
            !cableId ||
            typeof fromPortId !== 'number' ||
            typeof toPortId !== 'number'
          }
        >
          {submitting ? 'Registering…' : 'Connect Cable'}
        </button>
      </form>
    </div>
  );
}
