// 📁 client/src/components/CustomNode.tsx

import { memo, useMemo } from "react";
import {
  Monitor,
  Server,
  Router,
  Activity,
  AlertTriangle,
  Wifi,
} from "lucide-react";
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
  angleInDegrees?: number; // 추가: 노드의 각도 정보
}

interface CustomNodeProps extends NodeProps {
  data: CustomNodeData;
  sourcePosition?: Position; // 추가: layout에서 계산된 position
  targetPosition?: Position; // 추가: layout에서 계산된 position
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

// 노드 타입별 반지름 (Handle 위치 계산용)
const NODE_RADIUS = {
  server: 28, // 56px / 2
  switch: 24, // 48px / 2
  router: 24, // 48px / 2
  pc: 20, // 40px / 2
} as const;

const HANDLE_STYLE = {
  background: "#6b7280",
  border: "2px solid #ffffff",
  width: 8,
  height: 8,
  borderRadius: "50%",
};

// Radial 모드에서의 투명 Handle 스타일
const RADIAL_HANDLE_STYLE = {
  background: "transparent",
  border: "none",
  width: 8,
  height: 8,
  pointerEvents: "auto" as const,
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
  const shadow = selected ? "drop-shadow-[0_0_3px_white]" : "drop-shadow-[0_0_2px_gray]";
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

/**
 * Radial 모드에서 Handle의 정확한 위치를 계산합니다.
 * 노드의 원형 경계선에 Handle이 위치하도록 오프셋을 계산합니다.
 */
function getRadialHandleOffset(
  position: Position,
  nodeType: DeviceType
): {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
} {
  const radius = NODE_RADIUS[nodeType] || NODE_RADIUS.pc;

  switch (position) {
    case Position.Top:
      return {
        top: `-${radius}px`,
        left: "50%",
        transform: "translateX(-50%)",
      };
    case Position.Bottom:
      return {
        bottom: `-${radius}px`,
        left: "50%",
        transform: "translateX(-50%)",
      };
    case Position.Left:
      return {
        left: `-${radius}px`,
        top: "50%",
        transform: "translateY(-50%)",
      };
    case Position.Right:
      return {
        right: `-${radius}px`,
        top: "50%",
        transform: "translateY(-50%)",
      };
    default:
      return {};
  }
}

function CustomNode({
  data,
  selected = false,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
}: CustomNodeProps) {
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

  // Dagre 모드에서의 Handle 스타일
  const dagreHandleStyle =
    mode === "dagre" ? HANDLE_STYLE : RADIAL_HANDLE_STYLE;

  // Radial 모드에서의 Handle 위치 계산
  const sourceOffset =
    mode === "radial" ? getRadialHandleOffset(sourcePosition, type) : {};
  const targetOffset =
    mode === "radial" ? getRadialHandleOffset(targetPosition, type) : {};

  return (
    <div
      className="flex flex-col items-center relative z-10"
      role="button"
      tabIndex={0}
      aria-label={`${type} ${data.label} - ${status}`}
      aria-selected={selected}
    >
      {/* Target Handle - 입력 연결점 */}
      <Handle
        type="target"
        position={targetPosition}
        id="target"
        style={{
          ...dagreHandleStyle,
          ...(mode === "radial" && targetOffset),
        }}
      />

      {/* Source Handle - 출력 연결점 */}
      <Handle
        type="source" // 또는 "target"
        position={Position.Bottom} // 실제 방향은 중요치 않음, 중앙 고정이 핵심
        id="center-handle"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          ...RADIAL_HANDLE_STYLE,
        }}
      />

      {/* 서버 노드의 경우 모든 방향에 Handle 추가 (옵션) */}
      {mode === "radial" && type === "server" && (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const offset = 28; // px 기준 거리
            const isSource = angle < 180;
            return (
              <Handle
                key={`server-${angle}`}
                type={isSource ? "source" : "target"}
                position={Position.Bottom}
                id={`${isSource ? "source" : "target"}-${angle}`}
                style={{
                  position: "absolute",
                  left: `${50 + Math.cos(rad) * offset}px`,
                  top: `${50 + Math.sin(rad) * offset}px`,
                  transform: "translate(-50%, -50%)",
                  ...RADIAL_HANDLE_STYLE,
                }}
              />
            );
          })}
        </>
      )}

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
