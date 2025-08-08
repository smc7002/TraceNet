/* eslint-disable @typescript-eslint/no-explicit-any */
// 📁 client/src/components/NetworkDiagram.tsx - Zoom Level 감지 및 성능 최적화 (수정됨)

import React, { useCallback, useRef, useMemo, useEffect } from "react";
import ReactFlow, { MiniMap, type Node, type Edge, type NodeTypes, type EdgeTypes } from "react-flow-renderer";
import type { Device } from "../types/device";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation";

interface NetworkDiagramProps {
  nodes: Node[];
  edges: Edge[];
  selectedDevice: Device | null;
  onDeviceClick: (device: Device) => void;
  onCanvasClick: () => void;
  onEdgeClick: (event: unknown, edge: Edge) => void;
  devices: Device[];
  nodeTypes?: NodeTypes;
  edgeTypes?: EdgeTypes;
  viewMode?: "full" | "smart" | "minimal";
  showOnlyProblems?: boolean;
  zoomLevel?: number;
  keyboardNavigationEnabled?: boolean;
  isPinging?: boolean;
  onZoomChange?: (zoomLevel: number) => void; // 🔥 줌 변경 콜백
}

const NetworkDiagram = React.memo(function NetworkDiagram({
  nodes,
  edges,
  onDeviceClick,
  onCanvasClick,
  onEdgeClick,
  devices,
  nodeTypes,
  edgeTypes,
  viewMode = "full",
  showOnlyProblems = false,
  zoomLevel = 1.0,
  keyboardNavigationEnabled = true,
  isPinging = false,
  onZoomChange,
}: NetworkDiagramProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const keyboardControls = useKeyboardNavigation({
    stepSize: 100,
    enabled: keyboardNavigationEnabled && !isPinging,
    zoomStep: 1.2,
    animationDuration: 300,
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      (window as any).keyboardControls = keyboardControls;
      console.log("🎮 키보드 컨트롤 사용 가능:", keyboardControls);
    }
  }, [keyboardControls]);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) onDeviceClick(device);
    },
    [devices, onDeviceClick]
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        console.log("🖱️ 마우스 클릭:", event.clientX, event.clientY);
      }
      onCanvasClick();
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.setNodes) {
        reactFlowInstance.setNodes((nodes: Node[]) =>
          nodes.map((node) => ({ ...node, selected: false }))
        );
      }
    },
    [onCanvasClick]
  );

  const onInit = useCallback((reactFlowInstance: any) => {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      console.log("🎯 React Flow 초기화 완료");
    }
    (window as any).reactFlowInstance = reactFlowInstance;
  }, []);

  const miniMapNodeColor = useCallback(
    (node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) {
        switch (device.status) {
          case "Online": return "#00ff00";
          case "Offline": return "#ff0000";
          case "Unstable": return "#ffff00";
          default: return "#cccccc";
        }
      }
      switch (node.data?.type) {
        case "server": return "#ffcc00";
        case "switch": return "#00ccff";
        case "pc": return "#66ff66";
        default: return "#cccccc";
      }
    },
    [devices]
  );

  // 🔥 안전한 줌 감지
  const handleMove = useCallback(
    (_evt: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (typeof viewport?.zoom === "number") {
        if (window.location.hostname === "localhost") {
          console.log(`[ZOOM] ${viewport.zoom.toFixed(3)}`);
        }
        onZoomChange?.(viewport.zoom);
      }
    },
    [onZoomChange]
  );

  const reactFlowProps = useMemo(
    () => ({
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: true,
      fitView: false,
      defaultZoom: 1.0,
      defaultPosition: [0, 0] as [number, number],
      translateExtent: [
        [-2000, -2000],
        [3000, 2000],
      ] as [[number, number], [number, number]],
      minZoom: 0.3,
      maxZoom: 2,
      onlyRenderVisibleElements: true,
      selectNodesOnDrag: false,
    }),
    []
  );

  return (
    <div
      ref={reactFlowWrapper}
      style={{ width: "100%", height: "100%" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={handlePaneClick}
        onInit={onInit}
        onMove={handleMove}       // ✅ 핵심: 직접 onMove 바인딩
        onMoveEnd={handleMove}    // ✅ 보조: onMoveEnd도 동일하게
        {...reactFlowProps}
      >
        <MiniMap
          nodeColor={miniMapNodeColor}
          style={{ display: nodes.length > 5 ? "block" : "none" }}
        />
      </ReactFlow>

      {keyboardNavigationEnabled && !isPinging && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 11,
            pointerEvents: "none",
            fontFamily: "monospace",
            lineHeight: 1.3,
            zIndex: 1000,
          }}
        >
          <div>⬆️⬇️⬅️➡️ 화면 이동</div>
          <div>Ctrl + +/- 줌</div>
          <div>Ctrl + 0 전체보기</div>
        </div>
      )}

      {typeof window !== "undefined" && window.location.hostname === "localhost" && (
        <div
          style={{
            position: "absolute",
            top: 80,
            left: 10,
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "8px 12px",
            borderRadius: 5,
            fontSize: 12,
            pointerEvents: "none",
            fontFamily: "monospace",
            lineHeight: 1.4,
          }}
        >
          <div>📊 노드: {nodes.length} | 엣지: {edges.length}</div>
          <div>🔍 줌: {zoomLevel.toFixed(2)}x</div>
          <div>🎮 키보드: {keyboardNavigationEnabled && !isPinging ? "ON" : "OFF"}</div>
          <div>🎯 모드: {viewMode}</div>
        </div>
      )}
    </div>
  );
});

NetworkDiagram.displayName = "NetworkDiagram";
export default NetworkDiagram;
