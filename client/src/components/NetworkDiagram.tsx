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
  onCanvasClick: () => void; // ✅ 추가됨
  devices: Device[];
}

const getNodeColor = (node: Node, selectedId: string | null): string =>
  node.id === selectedId ? "#3b82f6" : "#999";

export default function NetworkDiagram({
  nodes,
  edges,
  selectedDevice,
  onDeviceClick,
  onCanvasClick, // ✅ props로 받음
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
        onPaneClick={onCanvasClick} // ✅ 여기 추가됨
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
          nodeColor={(n) => getNodeColor(n, selectedId)}
          nodeStrokeWidth={2}
        />
      </ReactFlow>
    </div>
  );
}
