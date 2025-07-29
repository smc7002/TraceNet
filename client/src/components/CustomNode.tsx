// 📁 client/src/components/CustomNode.tsx

import { memo, useMemo } from "react";
import { Monitor, Server, Router, Activity, AlertTriangle, Wifi } from "lucide-react";
import { Handle, Position } from "react-flow-renderer";
import type { NodeProps } from "react-flow-renderer";

export type DeviceStatus = "online" | "offline" | "unstable";
export type DeviceType = "server" | "switch" | "pc" | "router";
export type LayoutMode = "radial" | "dagre" | "hierarchical";

export interface CustomNodeData {
  type: DeviceType;
  status: DeviceStatus;
  label: string;
  mode?: LayoutMode;
  showLabel?: boolean;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

interface CustomNodeProps extends NodeProps {
  data: CustomNodeData;
}

const DEVICE_COLORS = {
  online: "text-green-500",
  offline: "text-red-500",
  unstable: "text-yellow-500",
} as const;

const DEVICE_BG_COLORS = {
  online: "bg-green-50",
  offline: "bg-red-50",
  unstable: "bg-yellow-50",
} as const;

const ICON_SIZES = {
  server: 28,
  switch: 24,
  router: 24,
  pc: 20,
} as const;

const NODE_SIZES = {
  server: "w-14 h-14",
  switch: "w-12 h-12",
  router: "w-12 h-12",
  pc: "w-10 h-10",
} as const;

const HANDLE_STYLE = {
  background: "#6b7280",
  border: "2px solid #ffffff",
  width: 8,
  height: 8,
  borderRadius: "50%",
};

const getStatusColor = (status: DeviceStatus): string =>
  DEVICE_COLORS[status] || "text-gray-400";

const getStatusBgColor = (status: DeviceStatus): string =>
  DEVICE_BG_COLORS[status] || "bg-gray-50";

const getDeviceIcon = (type: DeviceType, status: DeviceStatus) => {
  const colorClass = getStatusColor(status);
  const size = ICON_SIZES[type] || ICON_SIZES.pc;

  const iconProps = {
    size,
    className: colorClass,
    "aria-hidden": true,
  };

  switch (type) {
    case "server":
      return <Server {...iconProps} />;
    case "switch":
      return <Router {...iconProps} />;
    case "router":
      return <Wifi {...iconProps} />;
    case "pc":
    default:
      return <Monitor {...iconProps} />;
  }
};

const getStatusIcon = (status: DeviceStatus) => {
  const props = { size: 12, className: getStatusColor(status) };

  switch (status) {
    case "online":
      return <Activity {...props} />;
    case "unstable":
      return <AlertTriangle {...props} />;
    case "offline":
      return <div className="w-3 h-3 rounded-full bg-red-500" />;
    default:
      return null;
  }
};

const getNodeStyles = (
  selected: boolean,
  status: DeviceStatus,
  type: DeviceType
) => {
  const baseRing = selected
    ? "ring-2 ring-amber-400 ring-offset-2"
    : "ring-1 ring-slate-200";

  const hoverEffect = "hover:ring-2 hover:ring-blue-300 hover:scale-105";
  const transition = "transition-all duration-200 ease-in-out";
  const shadow = selected ? "shadow-lg" : "shadow-sm hover:shadow-md";
  const bgColor = getStatusBgColor(status);
  const nodeSize = NODE_SIZES[type] || NODE_SIZES.pc;

  return {
    container: `${nodeSize} rounded-full ${bgColor} border-2 border-white ${baseRing} ${shadow} ${hoverEffect} ${transition} flex items-center justify-center cursor-pointer relative`,
    label:
      "mt-2 text-xs text-gray-700 font-medium text-center max-w-20 truncate",
    statusBadge:
      "absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm",
  };
};

function CustomNode({ data, selected = false }: CustomNodeProps) {
  const showLabel = data.showLabel ?? true;
  const mode = data.mode || "dagre";
  const type = data.type;
  const status = data.status;

  const styles = useMemo(
    () => getNodeStyles(selected, status, type),
    [selected, status, type]
  );

  const deviceIcon = useMemo(() => getDeviceIcon(type, status), [type, status]);
  const statusIcon = useMemo(() => getStatusIcon(status), [status]);

  const hiddenStyle = {
    ...HANDLE_STYLE,
    opacity: 0,
    pointerEvents: "none",
  };

  return (
    <div
      className="flex flex-col items-center relative"
      role="button"
      tabIndex={0}
      aria-label={`${type} ${data.label} - ${status}`}
      aria-selected={selected}
    >
      {/* ✅ 항상 렌더링, 단 radial일 때 숨김 */}
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        style={mode === "radial" ? hiddenStyle : HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        style={mode === "radial" ? hiddenStyle : HANDLE_STYLE}
      />

      <div className={styles.container}>
        {deviceIcon}
        <div className={styles.statusBadge}>{statusIcon}</div>
      </div>

      {showLabel && (
        <div className={styles.label} title={data.label}>
          {data.label}
        </div>
      )}

      {showLabel && data.ipAddress && (
        <div className="text-xs text-gray-500 font-mono mt-1">
          {data.ipAddress}
        </div>
      )}
    </div>
  );
}

export default memo(CustomNode);
