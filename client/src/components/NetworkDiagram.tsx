// 📁 src/components/NetworkDiagram.tsx

import React, { useMemo, useCallback } from "react";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  Position,
} from "react-flow-renderer";
import type { Node, Edge } from "react-flow-renderer";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
import { getDeviceStyle } from "../utils/getDeviceStyle";
import { mapCablesToEdges, mapTraceCablesToEdges } from "../utils/edgeMapper";
import { getDagreLayoutedElements } from "../utils/layout";

interface NetworkDiagramProps {
  devices: Device[];
  selectedDevice: Device | null;
  onDeviceClick: (device: Device) => void;
  traceResult: TraceResponse | null;
  allCables: CableDto[];
}

// 디바이스 타입별 아이콘 매핑 (상수로 분리)
const DEVICE_ICONS = {
  PC: "💻",
  Switch: "🔀",
  Server: "🖥️",
  NAS: "📎",
  AP: "📡",
  Printer: "🖨️",
  CCTV: "📹",
  Firewall: "🔥",
  Router: "🌐",
} as const;

const getIcon = (type: string): string => {
  return DEVICE_ICONS[type as keyof typeof DEVICE_ICONS] ?? "❓";
};

export default function NetworkDiagram({
  devices,
  selectedDevice,
  onDeviceClick,
  traceResult,
  allCables,
}: NetworkDiagramProps) {
  // 선택된 디바이스 ID 메모화
  const selectedDeviceId = useMemo(
    () => selectedDevice?.deviceId?.toString(),
    [selectedDevice]
  );

  // 디바이스 → 노드 변환
  const nodes: Node[] = useMemo(() => {
    return devices.map((device) => ({
      id: device.deviceId.toString(),
      data: {
        label: `${getIcon(device.type)} ${device.name}`,
      },
      style: getDeviceStyle(
        device.type,
        selectedDeviceId === device.deviceId.toString()
      ),
      draggable: true,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: { x: 0, y: 0 }, // dagre가 덮어씌움
    }));
  }, [devices, selectedDeviceId]);

  // 케이블 → 엣지 변환 (메모화 최적화)
  const baseEdges: Edge[] = useMemo(() => {
    const edges = mapCablesToEdges(allCables);
    console.log("✅ edges 확인:", edges);
    return edges;
  }, [allCables]);

  const traceEdges: Edge[] = useMemo(() => {
    if (!traceResult?.cables) return [];
    return mapTraceCablesToEdges(traceResult.cables);
  }, [traceResult?.cables]);

  // 최종 엣지 결합 (초기에는 baseEdges만, trace 있을 때는 traceEdges 우선)
  const finalEdges = useMemo(() => {
    if (traceEdges.length > 0) {
      // trace가 있을 때는 trace 결과를 우선 표시
      return [...baseEdges, ...traceEdges];
    } else {
      // 초기 로딩 시에는 모든 케이블 연결을 기본 스타일로 표시
      return baseEdges.map((edge) => ({
        ...edge,
        style: {
          stroke: "#999",
          strokeWidth: 2,
          ...edge.style,
        },
      }));
    }
  }, [baseEdges, traceEdges]);

  // 모든 노드/엣지를 함께 dagre로 정렬
  const layoutedElements = useMemo(() => {
    return getDagreLayoutedElements(nodes, finalEdges);
  }, [nodes, finalEdges]);

  // 노드 클릭 핸들러 (타입 안전성 개선)
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const deviceId = parseInt(node.id, 10);
      const device = devices.find((d) => d.deviceId === deviceId);
      if (device) {
        onDeviceClick(device);
      }
    },
    [devices, onDeviceClick]
  );

  // MiniMap 노드 색상 함수
  const getNodeColor = useCallback(
    (node: Node) => {
      return node.id === selectedDeviceId ? "#3b82f6" : "#999";
    },
    [selectedDeviceId]
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={layoutedElements.nodes}
        edges={layoutedElements.edges}
        onNodeClick={handleNodeClick}
        fitView
        nodesDraggable={true}
        nodesConnectable={false}
        zoomOnScroll={true}
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap
          style={{
            border: "1px solid #ccc",
            borderRadius: 4,
            backgroundColor: "rgba(255, 255, 255, 0.8)",
          }}
          nodeColor={getNodeColor}
          nodeStrokeWidth={2}
        />
      </ReactFlow>
    </div>
  );
}
