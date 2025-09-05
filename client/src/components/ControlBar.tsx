/**
 * @fileoverview Network Monitoring Control Bar Component
 * @description Top control panel component for the TraceNet system
 *
 * @overview
 * Integrated UI component for network device search, filtering, status monitoring, and batch operations.
 * Provides real-time device status statistics, Ping functionality, and JSON data upload features.
 */

import { useState } from 'react';

import { DeviceStatus } from '../types/status';
import ImportJsonButton from './ImportJsonButton';

/**
 * Props interface for the ControlBar component
 *
 * @interface ControlBarProps
 * @description Interface definition for data integration with parent component (MainPage)
 */
interface ControlBarProps {
  /** Function to trigger complete data refresh */
  onRefresh: () => void;

  /** Function to toggle problem devices only view */
  onToggleProblemOnly: () => void;

  /** Current state of problem devices only view */
  showProblemOnly: boolean;

  /** Current search query string */
  searchQuery: string;

  /** Function called when search query changes */
  onSearchChange: (value: string) => void;

  /** Function called when search is executed (Enter key or search button) */
  onSearchSubmit: () => void;

  /** Real-time count statistics by device status */
  statusCounts: {
    Online: number;
    Offline: number;
    Unstable: number;
  };

  /** Function to execute Ping on all devices */
  onPingAll: () => void;

  /** Whether Ping operation is in progress */
  isPinging: boolean;

  /** Whether keyboard navigation is enabled (optional) */
  keyboardNavEnabled?: boolean;

  /** Function to toggle keyboard navigation (optional) */
  onToggleKeyboardNav?: () => void;

  /** Search error message (when no search results found) */
  searchError?: string;

  /** Function to bulk change device status */
  onBulkSetStatus: (status: DeviceStatus, enablePing?: boolean) => Promise<void> | void;

  /** Overall operation in progress state (higher priority than isPinging) */
  isBusy?: boolean;

  /** Total count of devices with problems */
  problemCount?: number;
}

/**
 * Top control panel component for the TraceNet network monitoring system
 *
 * @description
 * Provides the following functionality for effective network device management:
 * - Real-time device search and filtering
 * - Device status statistics visualization
 * - Full/selective Ping execution
 * - Quick filtering of problem devices
 * - Bulk JSON data upload
 * - Bulk device status changes
 *
 * @param {ControlBarProps} props - Component configuration and event handlers
 * @returns {JSX.Element} Rendered control panel UI
 *
 * @example
 * ```tsx
 * <ControlBar
 *   onRefresh={handleRefresh}
 *   onPingAll={handlePingAll}
 *   isPinging={isPinging}
 *   statusCounts={{ Online: 150, Offline: 5, Unstable: 2 }}
 *   searchQuery={searchTerm}
 *   onSearchChange={setSearchTerm}
 *   // ... other props
 * />
 * ```
 */
export default function ControlBar({
  onRefresh,
  onToggleProblemOnly,
  showProblemOnly,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  statusCounts,
  onPingAll,
  isPinging,
  //keyboardNavEnabled,      // Commented out for future extension
  //onToggleKeyboardNav,     // Commented out for future extension
  searchError,
  onBulkSetStatus,
  isBusy,
  problemCount = 0,
}: ControlBarProps) {
  // Open/close state for bulk status change dropdown menu
  const [openBulk, setOpenBulk] = useState(false);

  // Delete all operation in progress state
  const [deleting, setDeleting] = useState(false);

  // Overall operation in progress state (isBusy takes priority, fallback to isPinging)
  const busy = isBusy ?? isPinging;

  const handleDeleteAll = async () => {
    const ok = window.confirm(
      '⚠️ This will delete all device/port/cable data. This cannot be undone. Continue?',
    );
    if (!ok) return;

    try {
      setDeleting(true);
      const res = await fetch('/api/device/all', { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      // Safest approach: full page refresh
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Deletion failed. Please check the console.');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Bulk status change processing function
   *
   * @description
   * Bulk changes all devices to the selected status.
   * Can also enable/disable Ping functionality together.
   *
   * @param {DeviceStatus} status - Device status to change to
   * @param {boolean} [enablePing] - Whether to enable Ping functionality (optional)
   */
  const handleBulk = (status: DeviceStatus, enablePing?: boolean) => {
    setOpenBulk(false);
    onBulkSetStatus(status, enablePing);
  };

  return (
    <div className="flex w-full items-center gap-4 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
      {/* Real-time search input */}
      <input
        type="text"
        placeholder={
          searchError ? 'No device found: please try again' : 'Search device name or IP...'
        }
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearchSubmit();
        }}
        className={`flex-1 rounded-md border px-4 py-2 text-sm outline-none transition ${
          searchError
            ? 'border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400'
            : 'border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-400'
        }`}
        disabled={busy}
        aria-label="Device search"
        aria-invalid={!!searchError}
      />

      {/* 🗑 Delete all button */}
      <button
        onClick={handleDeleteAll}
        disabled={busy || deleting}
        aria-label="Delete all devices/ports/cables"
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        title="Delete all devices/ports/cables"
      >
        {deleting ? 'Deleting...' : 'Delete All'}
      </button>

      {/* Real-time status statistics display */}
      <div className="flex gap-2 text-xs font-medium" role="status" aria-live="polite">
        <div className="flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-green-700">
          ● {statusCounts.Online} Online
        </div>
        <div className="flex items-center gap-1 rounded bg-yellow-100 px-2 py-1 text-yellow-800">
          ● {statusCounts.Unstable} Warning
        </div>
        <div className="flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-red-700">
          ● {statusCounts.Offline} Offline
        </div>
      </div>

      {/* Problem devices filter toggle */}
      <button
        onClick={onToggleProblemOnly}
        disabled={busy || problemCount === 0}
        aria-pressed={showProblemOnly}
        aria-label={`Problem Devices Only ${showProblemOnly ? 'Disable' : 'Enable'}`}
        className={`rounded-md border px-3 py-2 text-sm ${
          showProblemOnly
            ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
            : 'border-slate-300 bg-white text-gray-800 hover:bg-slate-100'
        } transition disabled:cursor-not-allowed disabled:opacity-50`}
      >
        🔍 Problem Devices Only{problemCount ? ` (${problemCount})` : ''}
      </button>

      {/* Bulk status change dropdown */}
      <div className="relative">
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpenBulk((v) => !v)}
          aria-haspopup="true"
          aria-expanded={openBulk}
          aria-label="Bulk device status change menu"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ⚙️ Change Status
        </button>

        {/* Dropdown menu */}
        {openBulk && (
          <div
            className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-slate-200 bg-white shadow-lg"
            onMouseLeave={() => setOpenBulk(false)}
            role="menu"
            aria-label="Status change options"
          >
            <MenuItem label="All Online" onClick={() => handleBulk(DeviceStatus.Online)} />
            <MenuItem label="All Offline" onClick={() => handleBulk(DeviceStatus.Offline)} />
            <MenuItem label="All Unstable" onClick={() => handleBulk(DeviceStatus.Unstable)} />
            <MenuItem label="All Unknown" onClick={() => handleBulk(DeviceStatus.Unknown)} />

            {/* Divider */}
            <div className="my-1 border-t border-slate-200" />

            {/* Status change with Ping settings */}
            <MenuItem
              label="All Online + Ping ON"
              onClick={() => handleBulk(DeviceStatus.Online, true)}
            />
            <MenuItem
              label="All Offline + Ping OFF"
              onClick={() => handleBulk(DeviceStatus.Offline, false)}
            />
          </div>
        )}
      </div>

      {/* Ping all devices button */}
      <button
        onClick={onPingAll}
        disabled={busy}
        aria-label={busy ? 'Ping operation in progress' : 'Execute Ping on all devices'}
        className={`rounded-md border px-3 py-2 text-sm ${
          busy
            ? 'cursor-not-allowed border-green-400 bg-green-400 text-white'
            : 'border-green-600 bg-green-600 text-white hover:bg-green-700'
        } flex items-center gap-1 transition disabled:opacity-75`}
      >
        {busy ? (
          <>
            {/* Loading spinner */}
            <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent"></div>
            Pinging...
          </>
        ) : (
          <>📡 Ping All</>
        )}
      </button>

      {/* Data refresh button */}
      <button
        onClick={onRefresh}
        disabled={busy}
        aria-label="Refresh device and cable data"
        className="rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        🔄 Refresh
      </button>

      {/* JSON data upload button (reused component) */}
      <ImportJsonButton onSuccess={onRefresh} />
    </div>
  );
}

/**
 * Dropdown menu item component
 *
 * @description
 * Individual menu item used in the bulk status change dropdown.
 * Supports keyboard navigation and ARIA attributes for accessibility.
 *
 * @param {Object} props - Menu item properties
 * @param {string} props.label - Text to display in the menu item
 * @param {() => void} props.onClick - Function to execute on click
 *
 * @example
 * ```tsx
 * <MenuItem
 *   label="All Online"
 *   onClick={() => handleBulkChange(DeviceStatus.Online)}
 * />
 * ```
 */
function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
    >
      {label}
    </button>
  );
}

/**
 * @accessibility Accessibility Considerations
 *
 * 1. Keyboard Navigation
 *    - All buttons accessible via Tab key
 *    - Button activation via Enter/Space
 *    - Dropdown menu arrow key support (future implementation)
 *
 * 2. Screen Reader Support
 *    - aria-label specifies button purpose
 *    - aria-pressed shows toggle state
 *    - role attributes clarify UI structure
 *
 * 3. Visual Feedback
 *    - Focus state visualization
 *    - Clear distinction of disabled state
 *    - Appropriate color contrast for state changes
 */

/**
 * @performance Performance Optimization
 *
 * 1. React Optimization
 *    - Encapsulated file upload in ImportJsonButton to minimize direct DOM access
 *    - Conditional rendering prevents unnecessary DOM creation
 *    - Event handler memoization (handled in parent component)
 *
 * 2. User Experience Optimization
 *    - Visual feedback for loading states
 *    - Button disabling prevents duplicate clicks
 *    - Real-time status updates
 *
 * 3. Memory Management
 *    - Automatic dropdown closing prevents memory leaks
 */

/**
 * @integration Integration with Other Components
 *
 * 1. MainPage.tsx
 *    - Provides all event handlers and state data
 *    - Handles search results and filtering logic
 *
 * 2. NetworkDiagram.tsx
 *    - Updates node colors on status changes
 *    - Visual reflection of Ping results
 *
 * 3. SidePanel.tsx
 *    - Synchronizes with selected device information
 *    - Triggers detailed information updates
 */
  