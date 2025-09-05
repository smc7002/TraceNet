// 📁 client/src/components/CustomNode.tsx

import { Activity, AlertTriangle, Ban, Monitor, Router, Server, Wifi, WifiOff } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { NodeProps } from 'react-flow-renderer';
import { Handle, Position } from 'react-flow-renderer';

/**
 * Network Device Custom Node Component
 *
 * Key Features:
 * - Supports multiple network device types (Server, Switch, PC, Router)
 * - Visual feedback for real-time Ping status
 * - Multiple layout modes (Dagre, Radial)
 * - Optimized anchor placement via dynamic Handle positioning
 * - Accessibility and UX conscious
 *
 * Design Goals:
 * - Enable quick, intuitive understanding of network structure
 * - Make incident states immediately recognizable
 * - Real-time Ping monitoring
 * - Extensible component architecture
 * - High-performance rendering (React.memo)
 * - Consistent design language (Tailwind CSS)
 */

// ==========================================
// Type Definitions & Interfaces
// ==========================================

/**
 * Network device status enum (includes Ping states)
 *
 * Represents current status of each device in conjunction with the real-time Ping system.
 *
 * @enum {string}
 */
export type DeviceStatus = 'Online' | 'Offline' | 'Unstable' | 'Unknown' | 'Unreachable';

/**
 * Supported network device types
 *
 * Common categories used in manufacturing environments.
 *
 * @enum {string}
 */
export type DeviceType = 'server' | 'switch' | 'pc' | 'router';

/**
 * Layout mode type
 *
 * Defines how to visualize the network topology.
 *
 * @enum {string}
 */
export type LayoutMode = 'radial' | 'dagre' | 'hierarchical';

/**
 * Custom node data interface (includes Ping info)
 *
 * Defines all required/optional data passed to a React Flow node,
 * including real device properties and visualization settings.
 *
 * @interface CustomNodeData
 */
export interface CustomNodeData {
  /** Device type — determines icon and styling */
  type: DeviceType;

  /** Real-time device status — drives colors and badges (reflects Ping) */
  status: DeviceStatus;

  /** Device display name — for user identification */
  label: string;

  /** Currently applied layout mode — used for Handle position calculation */
  mode?: LayoutMode;

  /** Whether to show label — controls UI density */
  showLabel?: boolean;

  /** IP address — for identification and diagnostics */
  ipAddress?: string;

  /** Ping result — latency in milliseconds */
  latencyMs?: number | null;

  /** Last Ping check timestamp */
  lastCheckedAt?: string;

  /** Extensible metadata — reserved for future features */
  metadata?: Record<string, unknown>;

  /** Angle used in radial layout — optimizes Handle placement */
  angleInDegrees?: number;

  /** Highlight flag (e.g., search result) */
  highlighted?: boolean;
}

/**
 * Props interface for the custom node component
 *
 * Extends React Flow NodeProps to support custom behavior.
 *
 * @interface CustomNodeProps
 * @extends {NodeProps}
 */
interface CustomNodeProps extends NodeProps {
  /** Node data object */
  data: CustomNodeData;

  /** Output Handle position calculated by the layout engine */
  sourcePosition?: Position;

  /** Input Handle position calculated by the layout engine */
  targetPosition?: Position;
}

// ==========================================
//  Style & Visual Constants (with Ping states)
// ==========================================

/**
 * Text color mapping by device status (includes Ping states)
 *
 * Uses Tailwind CSS classes with sufficient contrast for accessibility.
 *
 * @constant
 */
const DEVICE_COLORS = {
  Online: 'text-green-500',       // Normal: green (success)
  Offline: 'text-red-500',        // Offline: red (danger)
  Unstable: 'text-yellow-500',    // Unstable: yellow (warning)
  Unknown: 'text-gray-400',       // Unknown: gray (neutral)
  Unreachable: 'text-red-600',    // Unreachable: deeper red (critical)
} as const;

/**
 * Background color mapping by device status
 *
 * Differentiates the node background by status
 * using subtle tones to avoid excessive visual noise.
 *
 * @constant
 */
const DEVICE_BG_COLORS = {
  Online: 'bg-green-50',
  Offline: 'bg-red-50',
  Unstable: 'bg-yellow-50',
  Unknown: 'bg-gray-50',
  Unreachable: 'bg-red-100',
} as const;

/**
 * Icon sizes by device type
 *
 * Establishes visual hierarchy by importance:
 * Server > Switch/Router > PC
 *
 * @constant
 */
const ICON_SIZES = {
  server: 28, // Largest — network core
  switch: 24, // Medium — intermediate device
  router: 24, // Medium — intermediate device
  pc: 20,     // Small — endpoint
} as const;

/**
 * Node container sizes by device type
 *
 * Tailwind classes aligned proportionally to icon sizes for visual consistency.
 *
 * @constant
 */
const NODE_SIZES = {
  server: 'w-14 h-14', // 56 × 56
  switch: 'w-12 h-12', // 48 × 48
  router: 'w-12 h-12', // 48 × 48
  pc: 'w-10 h-10',     // 40 × 40
} as const;

/**
 * Node radius for Handle position calculation
 *
 * Ensures Handles sit exactly on the circular boundary in radial layout.
 *
 * @constant
 */
const NODE_RADIUS = {
  server: 28, // Half of NODE_SIZES (w-14 = 56 / 2)
  switch: 24, // Half of NODE_SIZES (w-12 = 48 / 2)
  router: 24, // Half of NODE_SIZES (w-12 = 48 / 2)
  pc: 20,     // Half of NODE_SIZES (w-10 = 40 / 2)
} as const;

/**
 * Handle style for Dagre layout
 *
 * Provides clear anchor visuals for hierarchical layouts.
 *
 * @constant
 */
const HANDLE_STYLE = {
  background: '#6b7280',     // neutral-500
  border: '2px solid #ffffff',
  width: 8,
  height: 8,
  borderRadius: '50%',
};

/**
 * Transparent Handle style for radial layout
 *
 * Keeps anchors functional while visually minimal.
 *
 * @constant
 */
const RADIAL_HANDLE_STYLE = {
  background: 'transparent',
  border: 'none',
  width: 8,
  height: 8,
  pointerEvents: 'auto' as const,
};

// ==========================================
// Styling Utilities (Ping-aware)
// ==========================================

/**
 * Returns a text color class by device status
 *
 * @param status - device status (Ping-aware)
 * @returns Tailwind CSS text color class
 */
const getStatusColor = (status: DeviceStatus): string => DEVICE_COLORS[status] || 'text-gray-400';

/**
 * Returns a background color class by device status
 *
 * @param status - device status (Ping-aware)
 * @returns Tailwind CSS background color class
 */
const getStatusBgColor = (status: DeviceStatus): string => DEVICE_BG_COLORS[status] || 'bg-gray-50';

/**
 * Creates an icon component by device type
 *
 * Behavior:
 * - Selects a Lucide icon per device type
 * - Applies status color automatically
 * - Sets aria-hidden for decorative icons
 * - Uses size optimized for the type
 *
 * @param type - device type
 * @param status - device status (Ping-aware)
 * @returns Styled React icon component
 */
const getDeviceIcon = (type: DeviceType, status: DeviceStatus) => {
  const colorClass = getStatusColor(status);
  const size = ICON_SIZES[type] || ICON_SIZES.pc;

  // Common props for all icons
  const iconProps = {
    size,
    className: colorClass,
    'aria-hidden': true, // decorative
  };

  // Icon mapping by device type
  switch (type) {
    case 'server':
      return <Server {...iconProps} />;

    case 'switch':
      return <Router {...iconProps} />;

    case 'router':
      return <Wifi {...iconProps} />;

    case 'pc':
    default:
      return <Monitor {...iconProps} />;
  }
};

/**
 * Creates a small status badge icon (Ping-aware)
 *
 * Behavior:
 * - Conveys Ping state at a glance
 * - Compact footprint
 * - Consistent with design system
 *
 * @param status - device status (Ping result)
 * @returns Status React component
 */
const getStatusIcon = (status: DeviceStatus) => {
  const props = { size: 12, className: getStatusColor(status) };

  switch (status) {
    case 'Online':
      // Online: waveform icon
      return <Activity {...props} />;

    case 'Unstable':
      // Unstable: warning triangle
      return <AlertTriangle {...props} />;

    case 'Offline':
      // Offline: Wi-Fi off icon
      return <WifiOff {...props} />;

    case 'Unreachable':
      // Unreachable: ban icon
      return <Ban {...props} />;

    case 'Unknown':
    default:
      // Unknown: simple gray dot
      return <div className="h-3 w-3 rounded-full bg-gray-400" />;
  }
};

/**
 * Returns a color class by latency value
 *
 * @param latencyMs - latency in milliseconds
 * @returns Tailwind CSS text color class
 */
const getLatencyColor = (latencyMs: number | null): string => {
  if (latencyMs === null) return 'text-gray-500';
  if (latencyMs < 100) return 'text-green-600';  // fast
  if (latencyMs < 500) return 'text-yellow-600'; // moderate
  return 'text-red-600';                          // slow
};

/**
 * Returns display text for latency
 *
 * @param latencyMs - latency in milliseconds
 * @returns Display text
 */
const getLatencyText = (latencyMs: number | null): string => {
  if (latencyMs === null) return 'timeout';
  return `${latencyMs}ms`;
};

/**
 * Builds dynamic style classes for the node container
 *
 * Behavior:
 * - Visual feedback for selection
 * - Status-based background and border
 * - Hover effects and transitions
 * - Shadows and scale effects
 *
 * 🎨 Visual:
 * - Selected: amber ring + stronger glow
 * - Hovered: blue ring + slight scale-up
 * - Smooth transitions for natural UX
 *
 * @param selected - node selection state
 * @param status - device status
 * @param type - device type
 * @returns Style class map
 */

// Label style constants by node type
const LABEL_STYLES = {
  server:
    'mt-2 text-xs font-black text-white bg-blue-900/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-center max-w-24 truncate shadow-lg border border-white/20',
  switch:
    'mt-2 text-xs font-bold text-white bg-purple-900/90 backdrop-blur-sm px-2 py-1 rounded-md text-center max-w-20 truncate shadow-md border border-white/20',
  router:
    'mt-2 text-xs font-bold text-white bg-green-900/90 backdrop-blur-sm px-2 py-1 rounded-md text-center max-w-20 truncate shadow-md border border-white/20',
  pc: 'mt-2 text-xs text-gray-700 font-medium text-center max-w-20 truncate',
} as const;

const getNodeStyles = (
  selected: boolean,
  highlighted: boolean,
  status: DeviceStatus,
  type: DeviceType,
) => {
  // Ring priority: selected > highlighted > default
  const ring = selected
    ? 'ring-2 ring-amber-400 ring-offset-2'                // Selected node: amber ring
    : highlighted
      ? 'ring-8 ring-red-400 ring-offset-2 animate-pulse'  // Search result highlight
      : 'ring-1 ring-slate-200';                           // Default: thin gray ring

  // Pulse animation when highlighted
  const pulse = highlighted ? 'animate-pulse' : '';

  // Blue ring + slight scale on hover
  const hoverEffect = 'hover:ring-2 hover:ring-blue-300 hover:scale-105';

  // Smooth transitions (200ms)
  const transition = 'transition-all duration-200 ease-in-out';

  // Shadow colors by selection/highlight state
  const shadow = selected
    ? 'drop-shadow-[0_0_3px_white]'    // Selected: white glow
    : highlighted
      ? 'drop-shadow-[0_0_6px_pink]'   // Highlighted: pink glow
      : 'drop-shadow-[0_0_2px_gray]';  // Default: gray shadow

  // Background color by status (Online=green, Offline=red, etc.)
  const bgColor = getStatusBgColor(status);

  // Node size by type (server > switch > pc)
  const nodeSize = NODE_SIZES[type] || NODE_SIZES.pc;

  return {
    // Main node container: circle + status bg + ring + animation
    container: `${nodeSize} rounded-full ${bgColor} border-2 border-white ${ring} ${pulse} ${shadow} ${hoverEffect} ${transition} flex items-center justify-center cursor-pointer relative`,

    // Label style (varies by device type)
    label: LABEL_STYLES[type] || LABEL_STYLES.pc,

    // Status badge at top-right corner (renders status icon)
    statusBadge:
      'absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm',
  };
};

/**
 * Calculates precise Handle offsets for radial layout
 *
 * Math:
 * - Places the Handle exactly on the circular boundary
 * - Computes proper offsets for each side
 * - Uses CSS transform to center accurately
 *
 * @param position - Handle direction (Top, Bottom, Left, Right)
 * @param nodeType - node type (for size)
 * @returns CSS style object (position & transform)
 */
function getRadialHandleOffset(
  position: Position,
  nodeType: DeviceType,
): {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
} {
  // Look up radius by node type
  const radius = NODE_RADIUS[nodeType] || NODE_RADIUS.pc;

  switch (position) {
    case Position.Top:
      // 🔝 Top Handle: centered on top boundary
      return {
        top: `-${radius}px`,
        left: '50%',
        transform: 'translateX(-50%)',
      };

    case Position.Bottom:
      // Bottom Handle: centered on bottom boundary
      return {
        bottom: `-${radius}px`,
        left: '50%',
        transform: 'translateX(-50%)',
      };

    case Position.Left:
      // Left Handle: centered on left boundary
      return {
        left: `-${radius}px`,
        top: '50%',
        transform: 'translateY(-50%)',
      };

    case Position.Right:
      // Right Handle: centered on right boundary
      return {
        right: `-${radius}px`,
        top: '50%',
        transform: 'translateY(-50%)',
      };

    default:
      // No positioning by default
      return {};
  }
}

// ==========================================
// Main Component (with Ping info)
// ==========================================

/**
 * Custom network node component (includes Ping monitoring)
 *
 * Architecture:
 * - Rendering optimized via React.memo
 * - Caches computed styles/icons via useMemo
 * - Adheres to accessibility standards (ARIA)
 * - Responsive design
 *
 * Core Features:
 * - Multiple layout modes (Dagre/Radial)
 * - Dynamic Handle placement
 * - Real-time Ping status
 * - Latency display
 * - Keyboard navigation friendly
 *
 * Visuals:
 * - Status-based coloring
 * - Smooth animations
 * - Intuitive iconography
 * - Consistent design language
 */
function CustomNode({ data, selected = false, targetPosition = Position.Top }: CustomNodeProps) {
  // Extract component settings
  const showLabel = data.showLabel ?? true;
  const mode = data.mode || 'dagre';
  const type = data.type;
  const status = data.status;

  // Memoize style object (re-render optimization)
  const styles = useMemo(
    () => getNodeStyles(selected, data.highlighted === true, status, type),
    [selected, data.highlighted, status, type],
  );

  // Memoize icon components
  const deviceIcon = useMemo(() => getDeviceIcon(type, status), [type, status]);
  const statusIcon = useMemo(() => getStatusIcon(status), [status]);

  // Choose Handle style by layout mode
  const dagreHandleStyle = mode === 'dagre' ? HANDLE_STYLE : RADIAL_HANDLE_STYLE;

  // Compute Handle position for radial layout
  const targetOffset = mode === 'radial' ? getRadialHandleOffset(targetPosition, type) : {};

  return (
    <div
      className="relative z-10 flex flex-col items-center"
      role="button"
      tabIndex={0}
      aria-label={`${type} ${data.label} - ${status} ${
        data.latencyMs ? `(${data.latencyMs}ms)` : ''
      }`}
      aria-selected={selected}
    >
      {/* Target Handle — input anchor */}
      <Handle
        type="target"
        position={targetPosition}
        id="target"
        style={{
          ...dagreHandleStyle,
          ...(mode === 'radial' && targetOffset),
        }}
      />

      {/* Central Handle — radial-only center anchor */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="center-handle"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          ...RADIAL_HANDLE_STYLE,
        }}
      />

      {/* Server-specific satellite Handles (radial mode only) */}
      {mode === 'radial' && type === 'server' && (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const offset = 28;
            const isSource = angle < 180;

            return (
              <Handle
                key={`server-${angle}`}
                type={isSource ? 'source' : 'target'}
                position={Position.Bottom}
                id={`${isSource ? 'source' : 'target'}-${angle}`}
                style={{
                  position: 'absolute',
                  left: `${50 + Math.cos(rad) * offset}px`,
                  top: `${50 + Math.sin(rad) * offset}px`,
                  transform: 'translate(-50%, -50%)',
                  ...RADIAL_HANDLE_STYLE,
                }}
              />
            );
          })}
        </>
      )}

      {/* Node main container */}
      <div className={styles.container}>
        {/* Device type icon */}
        {deviceIcon}

        {/* Status badge (top-right) — reflects Ping state */}
        <div className={styles.statusBadge}>{statusIcon}</div>
      </div>

      {/* Node label */}
      {showLabel && (
        <div className={styles.label} title={data.label}>
          {data.label}
        </div>
      )}

      {/* Optional IP address */}
      {showLabel && data.ipAddress && (
        <div className="mt-1 font-mono text-xs text-gray-500">{data.ipAddress}</div>
      )}

      {/* Ping latency */}
      {showLabel && data.latencyMs !== undefined && (
        <div
          className={`mt-1 text-xs font-semibold ${getLatencyColor(data.latencyMs)}`}
          title={`Ping: ${getLatencyText(data.latencyMs)} ${
            data.lastCheckedAt ? `(${new Date(data.lastCheckedAt).toLocaleTimeString()})` : ''
          }`}
        >
          📡 {getLatencyText(data.latencyMs)}
        </div>
      )}
    </div>
  );
}

// Performance: prevent unnecessary re-renders
export default memo(CustomNode);
