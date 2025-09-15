/**
 * SidePanel.tsx - Side panel component for network device and cable management
 *
 * Main features:
 * - Display and manage detailed information of selected devices
 * - View and manage cable connection information
 * - Provide forms for registering new devices/cables
 * - Monitor real-time port connection status (switch only)
 * - Display network path tracing (Trace) results
 *
 * Component structure:
 * - Provides 3 panel modes through conditional rendering
 * - Each panel consists of sub-components handling independent functionality
 * - Stable UX through error handling and loading state management
 *
 * Use cases:
 * - Network administrator device configuration and monitoring
 * - Cable connection relationship identification and problem diagnosis
 * - New device registration and existing device deletion
 */

import type { AxiosError } from 'axios';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import {
  deleteCable,
  deleteDevice,
  fetchPortsByDevice,
  updateDeviceStatus,
} from '../api/deviceApi';
import type { CableDto } from '../types/cable';
import type { Device } from '../types/device';
import type { Port } from '../types/port';
import { DeviceStatus } from '../types/status';
import type { TraceResponse } from '../types/trace';
import CableForm from './CableForm';
import DeviceForm from './DeviceForm';

/**
 * Props interface for SidePanel component
 * Defines all states and callback functions received from the main page
 */
interface SidePanelProps {
  selectedDevice: Device | null; // Currently selected device
  selectedCable: CableDto | null; // Currently selected cable
  traceResult: TraceResponse | null; // Path tracing result
  traceError: string | null; // Trace error message
  filteredCables: CableDto[]; // Search-filtered cable list
  setSelectedDevice: (device: Device | null) => void; // Change device selection state
  setSelectedCable: (cable: CableDto | null) => void; // Change cable selection state
  refetchDevices: () => Promise<void>; // Re-query device list
  refetchCables: () => Promise<void>; // Re-query cable list
  devices: Device[]; // Complete device list (for port connection info)
}

/**
 * Interface representing the connection status of switch ports
 * Integrated management of physical ports and logical cable connection information
 */
interface PortConnection {
  portNumber: number; // Port number (starting from 1)
  isActive: boolean; // Port activation status
  connectedDevice?: string; // Connected device name
  connectedDeviceType?: string; // Connected device type
  connectedDeviceStatus?: string; // Connected device status
  cableId?: string | number; // Cable ID (if connected)
}

/**
 * SidePanel main component
 *
 * Conditionally renders different panels based on selection state:
 * 1. Nothing selected → Registration panel (device/cable registration forms)
 * 2. Cable selected → Cable information panel
 * 3. Device selected → Device information panel (detailed info, port status, settings)
 */
export default function SidePanel(props: SidePanelProps) {
  const {
    selectedDevice,
    selectedCable,
    traceResult,
    traceError,
    filteredCables,
    setSelectedDevice,
    setSelectedCable,
    refetchDevices,
    refetchCables,
    devices,
  } = props;

  /**
   * Rendering branch logic
   *
   * Priority:
   * 1. Cable selection > Device selection (cable info is more specific)
   * 2. Device selection > Default state (device detailed info)
   * 3. Default state > Registration panel (new registration)
   */
  if (!selectedDevice) {
    return (
      <RegistrationPanel
        filteredCables={filteredCables}
        setSelectedCable={setSelectedCable}
        refetchDevices={refetchDevices}
        refetchCables={refetchCables}
      />
    );
  }

  if (selectedCable) {
    return (
      <CableInfoPanel
        selectedCable={selectedCable}
        setSelectedCable={setSelectedCable}
        refetchDevices={refetchDevices}
        refetchCables={refetchCables}
      />
    );
  }

  return (
    <DeviceInfoPanel
      selectedDevice={selectedDevice}
      setSelectedDevice={setSelectedDevice}
      refetchDevices={refetchDevices}
      refetchCables={refetchCables}
      traceResult={traceResult}
      traceError={traceError}
      filteredCables={filteredCables}
      devices={devices}
    />
  );
}

/* ───────────────────────── Registration Panel ───────────────────────── */

/**
 * Registration panel component
 *
 * Features:
 * - Provides new device registration form
 * - Provides new cable registration form
 * - Displays cable search results and selection functionality
 *
 * Display condition: Default state when no device is selected
 */
function RegistrationPanel({
  filteredCables,
  setSelectedCable,
  refetchDevices,
  refetchCables,
}: {
  filteredCables: CableDto[];
  setSelectedCable: (cable: CableDto | null) => void;
  refetchDevices: () => Promise<void>;
  refetchCables: () => Promise<void>;
}) {
  return (
    <aside className="w-80 shrink-0 space-y-6 overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-inner">
      <h2 className="text-lg font-semibold">🔧 Device and Cable Registration</h2>

      {/* Device registration form - automatically refreshes device list on success */}
      <DeviceForm onSuccess={refetchDevices} />

      {/* Cable registration form - automatically refreshes cable list on success */}
      <CableForm onSuccess={refetchCables} />

      {/* Cable search results section */}
      <section className="border-t border-slate-200 pt-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-600">🔌 Cable Search Results</h3>
        <CableSearchResults filteredCables={filteredCables} onSelectCable={setSelectedCable} />
      </section>
    </aside>
  );
}

/* ───────────────────────── Cable Panel ───────────────────────── */

/**
 * Cable information panel component
 *
 * Features:
 * - Displays detailed information of selected cable
 * - Cable deletion functionality (with confirmation dialog)
 * - Displays connected device information (From/To)
 *
 * Display condition: When a cable is selected
 */
function CableInfoPanel({
  selectedCable,
  setSelectedCable,
  refetchDevices,
  refetchCables,
}: {
  selectedCable: CableDto;
  setSelectedCable: (cable: CableDto | null) => void;
  refetchDevices: () => Promise<void>;
  refetchCables: () => Promise<void>;
}) {
  /**
   * Cable deletion handler
   *
   * Processing order:
   * 1. User confirmation dialog
   * 2. API call to delete cable
   * 3. Re-query device/cable lists (update connection relationships)
   * 4. Clear selection state
   * 5. Error handling and user notification
   */
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete cable ${selectedCable.cableId}?`)) return;

    try {
      await deleteCable(selectedCable.cableId);
      // Refresh both device and cable lists after cable deletion (synchronize connection state)
      await Promise.all([refetchDevices(), refetchCables()]);
      setSelectedCable(null);
      alert('Deletion completed');
    } catch (err) {
      alert('Deletion failed');
      console.error(err);
    }
  };

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">🔌 Cable Information</h2>

      {/* Display cable basic information */}
      <div className="space-y-3">
        <InfoItem label="Cable ID" value={String(selectedCable.cableId)} />
        <InfoItem label="Description" value={selectedCable.description ?? '-'} />
        <InfoItem
          label="From Device"
          value={`${selectedCable.fromDevice} (${selectedCable.fromPort})`}
        />
        <InfoItem label="To Device" value={`${selectedCable.toDevice} (${selectedCable.toPort})`} />
      </div>

      {/* Cable deletion button */}
      <button
        className="mt-6 w-full rounded bg-red-500 py-2 text-white transition hover:bg-red-600"
        onClick={handleDelete}
      >
        🗑️ Delete This Cable
      </button>
    </aside>
  );
}

/* ───────────────────────── Device Panel ───────────────────────── */

/**
 * Device information panel component
 *
 * Features:
 * - Display device basic information (name, IP, type, etc.)
 * - Monitor port connection status for switches
 * - Display network path tracing results
 * - Control device status and Ping settings
 * - Device deletion functionality (also deletes connected cables)
 *
 * Display condition: When device is selected but cable is not selected
 */
function DeviceInfoPanel({
  selectedDevice,
  setSelectedDevice,
  refetchDevices,
  refetchCables,
  traceResult,
  traceError,
  filteredCables,
  devices,
}: {
  selectedDevice: Device;
  setSelectedDevice: (device: Device | null) => void;
  refetchDevices: () => Promise<void>;
  refetchCables: () => Promise<void>;
  traceResult: TraceResponse | null;
  traceError: string | null;
  filteredCables: CableDto[];
  devices: Device[];
}) {
  const [deleting, setDeleting] = useState(false);

  /**
   * Device deletion handler
   *
   * Advanced error handling pattern:
   * 1. Optimistic update: immediately clear selection (fast UX)
   * 2. API call and data refresh
   * 3. Restore selection state on failure (rollback)
   * 4. Display detailed error message
   */
  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete device ${selectedDevice.name}?\nAll connected cables will also be deleted.`,
      )
    )
      return;

    try {
      setDeleting(true);

      // Optimistic update: immediately remove from UI (improve user experience)
      setSelectedDevice(null);

      // Perform actual deletion operation
      await deleteDevice(selectedDevice.deviceId);

      // Refresh both device and cable lists (reflect CASCADE deletion)
      await Promise.all([refetchDevices(), refetchCables()]);

      console.log('✅ Deletion completed and state updated');
    } catch (err) {
      // Restore selection state on failure (rollback)
      setSelectedDevice(selectedDevice);

      // Extract and display detailed error message
      const error = err as AxiosError<{ message: string }>;
      const message = error.response?.data?.message ?? error.message;
      alert(`Deletion failed: ${message}`);
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white shadow-md">
      {/* Device information header */}
      <DeviceHeader device={selectedDevice} />

      {/* Rack display: right below header, only for switches */}
      {selectedDevice.type?.toLowerCase() === 'switch' && (
        <div className="border-b border-slate-100 px-4 pb-1 pt-2">
          <span className="mr-1 text-xs text-slate-500">📦 Rack List: </span>
          <span className="text-xs font-medium text-slate-700">
            {selectedDevice.rackName ?? '-'}
          </span>
        </div>
      )}

      {/* Main content area (scrollable) */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4 text-sm">
        {/* Basic device information */}
        <DeviceBasicInfo device={selectedDevice} />

        {/* Display port connection status only for switches */}
        {selectedDevice.type?.toLowerCase() === 'switch' && (
          <PortConnectionStatus
            device={selectedDevice}
            filteredCables={filteredCables}
            devices={devices}
          />
        )}

        {/* Network path tracing results */}
        <TraceResultSection traceResult={traceResult} traceError={traceError} />

        {/* Device status and Ping setting controls */}
        <DeviceStatusControls
          device={selectedDevice}
          setSelectedDevice={setSelectedDevice}
          refetchDevices={refetchDevices}
        />
      </div>

      {/* Bottom fixed deletion button */}
      <div className="border-t border-slate-200 bg-white p-4">
        <button
          className="w-full rounded bg-red-500 py-2 text-white transition hover:bg-red-600 disabled:opacity-50"
          onClick={handleDelete}
          disabled={deleting}
        >
          🗑️ Delete This Device
        </button>
      </div>
    </aside>
  );
}

/* ───────────────────────── Sub Components ───────────────────────── */

/**
 * Cable search results display component
 *
 * Features:
 * - Display filtered cable list in button form
 * - Switch to detailed information panel on cable click
 * - Appropriate guidance message for empty results
 */
function CableSearchResults({
  filteredCables,
  onSelectCable,
}: {
  filteredCables: CableDto[];
  onSelectCable: (cable: CableDto | null) => void;
}) {
  return (
    <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
      {filteredCables.length === 0 ? (
        <div className="text-slate-400">No search results</div>
      ) : (
        filteredCables.map((cable) => (
          <button
            key={String(cable.cableId)}
            onClick={() => onSelectCable(cable)}
            className="block w-full rounded border px-2 py-1 text-left hover:bg-slate-100"
          >
            {/* Display cable description if available, otherwise just ID */}
            {cable.description ? `${cable.description} — ` : ''}({String(cable.cableId)})
          </button>
        ))
      )}
    </div>
  );
}

/**
 * Device header component
 * Fixed display of basic identification information of selected device at the top
 */
function DeviceHeader({ device }: { device: Device }) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 p-4">
      <div className="text-lg font-semibold">{device.name}</div>
      <div className="text-sm text-slate-500">
        {device.ipAddress ?? 'IP unspecified'} {' | '} {device.status} {' | '} just now
      </div>
    </div>
  );
}

/**
 * Device basic information component
 * Display basic device attributes such as IP address, device type, etc.
 */
function DeviceBasicInfo({ device }: { device: Device }) {
  return (
    <section>
      <div className="mb-3 font-semibold text-slate-700">📊 Device Information</div>
      <div className="space-y-2">
        <InfoItem label="IP Address" value={device.ipAddress ?? '-'} />
        <InfoItem label="Device Type" value={device.type ?? '-'} />

        {/* Display Rack only for switches */}
        {device.type?.toLowerCase() === 'switch' && (
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-500">Rack</span>
            <span className="font-medium text-slate-700">{device.rackName ?? '-'}</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────── Port Connection Status ───────── */

/**
 * Port connection status component (switch only)
 *
 * Features:
 * - Real-time query and display of all port status on switches
 * - Display connected device information for each port
 * - Visual display of port activation status (LED style)
 * - Integrated display of cable connection information and device information
 *
 * Data sources:
 * - Port information: fetchPortsByDevice API (physical port status)
 * - Connection information: filteredCables (logical cable connections)
 * - Device information: devices (status/type of connected devices)
 */
function PortConnectionStatus({
  device,
  filteredCables,
  devices,
}: {
  device: Device;
  filteredCables: CableDto[];
  devices: Device[];
}) {
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [portConnections, setPortConnections] = useState<PortConnection[]>([]);

  /**
   * Performance optimization: extract only necessary values instead of direct device object dependency
   * Prevents unnecessary re-execution when other properties of device object change
   */
  const deviceId = device.deviceId;
  const currentName = device.name;

  /**
   * Port information loading Effect
   *
   * Processing steps:
   * 1. Query physical port information from backend
   * 2. Match with cable information to construct logical connection relationships
   * 3. Add status information of connected devices
   * 4. Generate integrated port connection status
   *
   * Performance considerations:
   * - Prevent state updates when component unmounts using alive flag
   * - Initialize with empty array on error to ensure UI stability
   */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingPorts(true);

        // 1. Query physical port information
        const devicePorts = await fetchPortsByDevice(deviceId);

        // 2. Create Map for fast lookup based on device name
        const devicesByName = new Map<string, Device>(devices.map((d) => [d.name, d]));

        // 3. Integrate port-cable-device information
        const connections = createPortConnections(
          devicePorts,
          filteredCables,
          currentName,
          devicesByName,
        );

        // 4. Update state only if component is still mounted
        if (alive) setPortConnections(connections);
      } catch (error) {
        if (alive) setPortConnections([]);
        console.error('Failed to load port information:', error);
      } finally {
        if (alive) setLoadingPorts(false);
      }
    })();

    // Cleanup: prevent state updates when component unmounts
    return () => {
      alive = false;
    };
  }, [deviceId, currentName, filteredCables, devices]);

  return (
    <section>
      <div className="mb-3 font-semibold text-slate-700">🔌 Port Connection Status</div>
      {loadingPorts ? (
        <div className="text-sm text-slate-400">Loading port information...</div>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-md bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-2 text-xs">
            {portConnections.map((port) => (
              <PortConnectionItem key={port.portNumber} port={port} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Individual port connection status display component
 *
 * Visual elements:
 * - Port number: aligned display with fixed-width font
 * - Activation LED: green (active)/gray (inactive) circular indicator
 * - Connection status: connected device name and type or "Disconnected" display
 * - Background color: visual distinction based on connection status
 */
function PortConnectionItem({ port }: { port: PortConnection }) {
  return (
    <div
      className={`flex items-center justify-between rounded border p-2 ${
        port.connectedDevice
          ? 'border-green-200 bg-green-50' // Connected: green theme
          : 'border-slate-200 bg-slate-100' // Disconnected: gray theme
      }`}
    >
      {/* Left: Port number and activation status */}
      <div className="flex items-center space-x-2">
        <span className="font-mono font-semibold">
          P{port.portNumber.toString().padStart(2, '0')}
        </span>
        <div
          className={`h-2 w-2 rounded-full ${port.isActive ? 'bg-green-400' : 'bg-slate-300'}`}
        />
      </div>

      {/* Right: Connected device information */}
      <div className="text-right">
        {port.connectedDevice ? (
          <div>
            <div className="font-medium text-slate-700">{port.connectedDevice}</div>
            <div className="text-slate-500">{port.connectedDeviceType}</div>
          </div>
        ) : (
          <span className="text-slate-400">Disconnected</span>
        )}
      </div>
    </div>
  );
}

/* ───────── Trace Results ───────── */

/**
 * Network path tracing result display component
 *
 * Features:
 * - Display trace error messages
 * - Loading state guidance
 * - Display hop-by-hop path when path information is available
 * - Appropriate guidance message when path information is unavailable
 *
 * Display format: "Number. SourceDevice (SourcePort) → DestinationDevice (DestinationPort)"
 */
function TraceResultSection({
  traceResult,
  traceError,
}: {
  traceResult: TraceResponse | null;
  traceError: string | null;
}) {
  return (
    <section>
      <div className="mb-3 font-semibold text-slate-700">🛤️ Trace Results</div>
      {traceError ? (
        <div className="text-sm text-red-500">{traceError}</div>
      ) : !traceResult ? (
        <div className="text-sm text-slate-400">Loading trace information...</div>
      ) : traceResult.path?.length > 0 ? (
        <div className="space-y-1 rounded-md bg-slate-50 p-3 font-mono text-[12px] text-slate-700">
          {traceResult.path.map((trace, idx) => (
            <div key={idx}>
              {idx + 1}. {trace.fromDevice} ({trace.fromPort}) → {trace.toDevice} ({trace.toPort})
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-400">No path information available.</div>
      )}
    </section>
  );
}

/* ───────── Status/Ping Controls ───────── */

/**
 * Device status and Ping setting control component
 *
 * Features:
 * - Device status change (Online/Offline/Unstable/Unknown)
 * - Ping activation/deactivation toggle
 * - Real-time reflection of changes and error handling
 * - Display saving state and UI lock
 *
 * Status synchronization:
 * - Immediate local state update (optimistic update)
 * - Permanent save through backend API call
 * - Maintain consistency by refreshing global device list
 */
function DeviceStatusControls({
  device,
  setSelectedDevice,
  refetchDevices,
}: {
  device: Device;
  setSelectedDevice: (device: Device | null) => void;
  refetchDevices: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  /**
   * Device status change handler
   *
   * Processing order:
   * 1. Activate saving state (UI lock)
   * 2. Backend API call
   * 3. Update local selection state with response data
   * 4. Refresh global device list
   * 5. Error handling and user notification
   */
  const handleStatusChange = async (newStatus: DeviceStatus) => {
    try {
      setSaving(true);
      const updated = await updateDeviceStatus(device.deviceId, newStatus);

      // Immediately update local selection state
      setSelectedDevice({
        ...device,
        status: updated.status,
        lastCheckedAt: updated.lastCheckedAt,
        enablePing: updated.enablePing,
      });

      // Synchronize with global state
      await refetchDevices();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Ping activation/deactivation toggle handler
   *
   * Inverts current enablePing state for update
   * Only toggles Ping setting without changing device status
   */
  const handleTogglePing = async () => {
    try {
      setSaving(true);
      const updated = await updateDeviceStatus(
        device.deviceId,
        device.status as DeviceStatus,
        !device.enablePing, // Set to opposite of current state
      );

      // Update only Ping setting and last check time
      setSelectedDevice({
        ...device,
        enablePing: updated.enablePing,
        lastCheckedAt: updated.lastCheckedAt,
      });

      await refetchDevices();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="font-semibold text-slate-700">⚙️ Status / Ping</div>

      {/* Device status selection dropdown */}
      <div className="flex items-center gap-2">
        <label className="w-24 text-sm text-slate-600">Status</label>
        <select
          className="flex-1 rounded border px-2 py-1 text-sm"
          value={device.status}
          disabled={saving}
          onChange={(e) => handleStatusChange(e.target.value as DeviceStatus)}
        >
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
          <option value="Unstable">Unstable</option>
          <option value="Unknown">Unknown</option>
        </select>
      </div>

      {/* Ping activation toggle button */}
      <div className="flex items-center gap-2">
        <label className="w-24 text-sm text-slate-600">Enable Ping</label>
        <button
          type="button"
          disabled={saving}
          onClick={handleTogglePing}
          className={`rounded border px-3 py-1 text-sm transition ${
            device.enablePing
              ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          {device.enablePing ? 'ON' : 'OFF'}
        </button>
        {saving && <span className="ml-2 text-xs text-slate-500">Saving…</span>}
      </div>
    </section>
  );
}

/* ───────── Utility Functions ───────── */

/**
 * Port number extraction function from port strings
 *
 * Handles various port notation formats:
 * - "Gi1/0/10" → 10 (last number)
 * - "P05" → 5
 * - "FastEthernet0/1" → 1
 * - 24 → 24 (number as is)
 *
 * @param label Port label (string, number, or undefined)
 * @returns Extracted port number (NaN on failure)
 */
function parsePortNumber(label: string | number | undefined): number {
  if (typeof label === 'number') return label;
  if (!label) return NaN;

  // Regex: find last consecutive number group in string
  const m = String(label).match(/(\d+)(?!.*\d)/);
  return m ? Number(m[1]) : NaN;
}

/**
 * Port connection information generation function
 *
 * Features:
 * - Integrate physical port information with logical cable connections
 * - Map connected device information for each port
 * - Dynamic port range calculation (minimum 24 ports, expand to actual used ports)
 *
 * @param devicePorts Physical port status array
 * @param cables Cable connection information array
 * @param currentDeviceName Name of currently queried device
 * @param devicesByName Device name → device object mapping
 * @returns Integrated port connection information array
 */
function createPortConnections(
  devicePorts: Port[],
  cables: CableDto[],
  currentDeviceName: string,
  devicesByName: Map<string, Device>,
): PortConnection[] {
  /**
   * Step 1: Index cable connection information by port basis
   *
   * Structure: "DeviceName#PortNumber" → Cable object
   * Example: "Switch01#5" → { fromDevice: "Switch01", toDevice: "PC01", ... }
   */
  const byEnd = new Map<string, CableDto>();
  for (const cable of cables) {
    const fp = parsePortNumber(cable.fromPort as unknown as string | number | undefined);
    const tp = parsePortNumber(cable.toPort as unknown as string | number | undefined);

    // Add only valid port numbers to mapping
    if (!Number.isNaN(fp)) byEnd.set(`${cable.fromDevice}#${fp}`, cable);
    if (!Number.isNaN(tp)) byEnd.set(`${cable.toDevice}#${tp}`, cable);
  }

  /**
   * Step 2: Dynamic port range calculation
   *
   * Consideration factors:
   * - Maximum number among physically existing ports
   * - Maximum number among ports connected by cables
   * - Guarantee minimum 24 ports (typical switch default port count)
   */
  const maxObserved = Math.max(
    // Maximum number among physical ports
    devicePorts.reduce((m, p) => Math.max(m, p.portNumber || 0), 0),

    // Maximum number among cable-connected ports
    ...cables.map((c) =>
      Math.max(
        c.fromDevice === currentDeviceName
          ? parsePortNumber(c.fromPort as unknown as string | number | undefined)
          : 0,
        c.toDevice === currentDeviceName
          ? parsePortNumber(c.toPort as unknown as string | number | undefined)
          : 0,
      ),
    ),

    // Guarantee minimum 24 ports
    24,
  );

  /**
   * Step 3: Generate connection information for each port
   *
   * Processing steps:
   * 1. Query physical status by port number
   * 2. Match cable connection information
   * 3. Add status/type information of connected devices
   */
  const connections: PortConnection[] = [];
  for (let portNum = 1; portNum <= maxObserved; portNum++) {
    // Query physical port information
    const port = devicePorts.find((p) => p.portNumber === portNum);

    const connection: PortConnection = {
      portNumber: portNum,
      isActive: Boolean(port?.isActive), // Convert undefined/null to false
    };

    // Match cable connection information
    const hit = byEnd.get(`${currentDeviceName}#${portNum}`);
    if (hit) {
      // Determine if current device is From or To
      const isFrom = hit.fromDevice === currentDeviceName;
      connection.connectedDevice = isFrom ? hit.toDevice : hit.fromDevice;

      // Extract cable ID (ensure type safety)
      const id = (hit as { cableId?: string | number }).cableId;
      connection.cableId = typeof id === 'string' || typeof id === 'number' ? id : undefined;

      // Add status and type information of connected device
      const target = connection.connectedDevice
        ? devicesByName.get(connection.connectedDevice)
        : undefined;
      connection.connectedDeviceStatus = target?.status ?? 'Unknown';
      connection.connectedDeviceType = target?.type ?? 'Unknown';
    }

    connections.push(connection);
  }

  return connections;
}

/**
 * Information item display component
 *
 * Reusable component that displays label-value pairs in a consistent format
 * Used commonly in device information, cable information, etc.
 *
 * @param label Item label (e.g., "IP Address", "Device Type")
 * @param value Item value (string, number, JSX element, etc.)
 */
function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
