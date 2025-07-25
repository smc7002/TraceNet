import { useCallback } from "react";
import CustomEdge from "../utils/CustomEdge";
import ReactFlow from "react-flow-renderer";
import type { Node, Edge } from "react-flow-renderer";
import type { Device } from "../types/device";

const edgeTypes = { custom: CustomEdge };

interface NetworkDiagramProps {
  nodes: Node[];
  edges: Edge[];
  selectedDevice: Device | null;
  onDeviceClick: (device: Device) => void;
  onCanvasClick: () => void;
  onEdgeClick: (event: unknown, edge: Edge) => void;
  devices: Device[];
}

export default function NetworkDiagram({
  nodes,
  edges,
  //selectedDevice,
  onDeviceClick,
  onCanvasClick,
  onEdgeClick,
  devices,
}: NetworkDiagramProps) {
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) onDeviceClick(device);
    },
    [devices, onDeviceClick]
  );

  console.log(
    "🧪 [NetworkDiagram] nodes",
    nodes.map((n) => n.id)
  );
  console.log(
    "🧪 [NetworkDiagram] edges",
    edges.map((e) => e.id)
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onCanvasClick}
      fitView
    />
  );
}
