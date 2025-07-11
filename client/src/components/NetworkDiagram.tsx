import React, { useMemo, useCallback } from "react";
import ReactFlow, { Position, Controls, Background } from "react-flow-renderer";
import { MiniMap } from "react-flow-renderer";
import type { Node, Edge } from "react-flow-renderer";
import type { Device } from "../types/device";

interface TraceResult {
  path: Device[];
}

interface NetworkDiagramProps {
  devices: Device[];
  selectedDevice: Device | null;
  onDeviceClick: (device: Device) => void;
  traceResult: TraceResult | null;
}

export default function NetworkDiagram({
  devices,
  selectedDevice,
  onDeviceClick,
  traceResult,
}: NetworkDiagramProps) {
  // 🔵 디바이스 → 노드 변환
  const nodes: Node[] = useMemo(() => {
    return devices.map((device, index) => {
      const x = 200 + (index % 4) * 180;
      const y = 100 + Math.floor(index / 4) * 160;

      return {
        id: device.deviceId.toString(),
        position: { x, y },
        data: {
          label: `${getIcon(device.type)} ${device.name}`,
        },
        style: {
          padding: 10,
          border:
            selectedDevice?.deviceId === device.deviceId
              ? "2px solid #3b82f6"
              : "1px solid #ddd",
          backgroundColor: "#fff",
          borderRadius: 10,
          textAlign: "center",
          fontSize: 12,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });
  }, [devices, selectedDevice]);

  // 🟢 TraceResult → 엣지 생성
  const edges: Edge[] = useMemo(() => {
    if (!traceResult?.path || traceResult.path.length < 2) return [];

    return traceResult.path.slice(0, -1).map((from, index) => {
      const to = traceResult.path[index + 1];
      return {
        id: `e-${from.deviceId}-${to.deviceId}`,
        source: from.deviceId.toString(),
        target: to.deviceId.toString(),
        animated: true,
        style: { stroke: "lime", strokeWidth: 2 },
      };
    });
  }, [traceResult]);

  // ⚡ 노드 클릭 시 디바이스 정보 전달
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) onDeviceClick(device);
    },
    [devices, onDeviceClick]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap
          style={{ border: "1px solid #ccc", borderRadius: 4 }}
          nodeColor={(node) =>
            node.id === selectedDevice?.deviceId.toString() ? "#3b82f6" : "#999"
          }
          nodeStrokeWidth={2}
        />
      </ReactFlow>
    </div>
  );
}

// 📦 장비 아이콘
function getIcon(type: string): string {
  return (
    {
      PC: "💻",
      Switch: "🔀",
      Server: "🖥️",
      NAS: "💾",
      AP: "📡",
      Printer: "🖨️",
      CCTV: "📹",
      Firewall: "🔥",
      Router: "🌐",
    }[type] ?? "❓"
  );
}
