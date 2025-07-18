// 📁 src/components/NetworkDiagram.tsx

import React, { useCallback } from "react";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  type Node,
  type Edge,
} from "react-flow-renderer";
import type { Device } from "../types/device";
import { getDeviceStyle } from "../utils/getDeviceStyle";

interface NetworkDiagramProps {
  nodes: Node[];
  edges: Edge[];
  selectedDevice: Device | null;
  onDeviceClick: (device: Device) => void;
  devices: Device[];
}

const getNodeColor = (node: Node, selectedId: string | null): string =>
  node.id === selectedId ? "#3b82f6" : "#999";

export default function NetworkDiagram({
  nodes,
  edges,
  selectedDevice,
  onDeviceClick,
  devices,
}: NetworkDiagramProps) {
  const selectedId = selectedDevice?.deviceId.toString() ?? null;

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const deviceId = parseInt(node.id, 10);
      const matched = devices.find((d) => d.deviceId === deviceId);
      if (matched) {
        onDeviceClick(matched);
      }
    },
    [devices, onDeviceClick]
  );

  const getNodeStyle = (node: Node) => {
    return getDeviceStyle(
      node.data?.type ?? "Unknown",
      node.id === selectedId
    );
  };

  // 🔧 모든 엣지에 기본 스타일 주입 (안 보일 위험 방지)
  const styledEdges: Edge[] = edges.map((edge) => ({
    ...edge,
    style: {
      stroke: edge.style?.stroke ?? "#888",
      strokeWidth: edge.style?.strokeWidth ?? 2,
      ...edge.style,
    },
  }));

  return (
    <div className="w-full h-full">
      <ReactFlow
        key={nodes.map((n) => n.id).join("-") + styledEdges.length}
        nodes={nodes.map((n) => ({
          ...n,
          style: getNodeStyle(n),
        }))}
        edges={styledEdges}
        onNodeClick={handleNodeClick}
        fitView
        //defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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
          nodeColor={(n) => getNodeColor(n, selectedId)}
          nodeStrokeWidth={2}
        />
      </ReactFlow>
    </div>
  );
}
