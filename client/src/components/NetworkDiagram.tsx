/* eslint-disable @typescript-eslint/no-explicit-any */
// 📁 client/src/components/NetworkDiagram.tsx

import React, { useCallback, useRef, useMemo, useEffect } from "react";
import ReactFlow from "react-flow-renderer";
import type { Node, Edge, NodeTypes, EdgeTypes } from "react-flow-renderer";
import type { Device } from "../types/device";
import { MiniMap } from "react-flow-renderer";
import { useKeyboardNavigation } from "../hooks/useKeyboardNavigation"; // 🆕 키보드 네비게이션 훅

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
  // 🚀 새로운 최적화 props
  viewMode?: "full" | "smart" | "minimal"; // 뷰 모드
  showOnlyProblems?: boolean; // 문제 장비만 표시
  zoomLevel?: number; // 현재 줌 레벨
  // 🆕 키보드 네비게이션 props
  keyboardNavigationEnabled?: boolean; // 키보드 네비게이션 활성화 여부
  isPinging?: boolean; // Ping 중일 때 키보드 비활성화
}

// 🚀 1. React.memo로 컴포넌트 메모이제이션
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
  keyboardNavigationEnabled = true, // 🆕 기본값 true
  isPinging = false, // 🆕 Ping 상태
}: NetworkDiagramProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // 🆕 키보드 네비게이션 훅 추가
  const keyboardControls = useKeyboardNavigation({
    stepSize: 100,
    enabled: keyboardNavigationEnabled && !isPinging,
    zoomStep: 1.2,
    animationDuration: 300,
  });

  // 🎮 개발 환경에서 키보드 컨트롤을 window에 노출
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.hostname === "localhost"
    ) {
      (window as any).keyboardControls = keyboardControls;
      console.log("🎮 키보드 컨트롤 사용 가능:", keyboardControls);
    }
  }, [keyboardControls]);

  // 🚀 2. 스마트 필터링된 노드들 (메모이제이션)
  const filteredNodes = useMemo(() => {
    if (viewMode === "minimal") {
      // 서버와 스위치만 표시
      return nodes.filter(
        (node) => node.data?.type === "server" || node.data?.type === "switch"
      );
    }

    if (showOnlyProblems) {
      // 문제 장비 + 서버/스위치만 표시
      return nodes.filter((node) => {
        const device = devices.find((d) => d.deviceId.toString() === node.id);
        return (
          node.data?.type === "server" ||
          node.data?.type === "switch" ||
          (device && device.status !== "Online")
        );
      });
    }

    return nodes;
  }, [nodes, devices, viewMode, showOnlyProblems]);

  // 🚀 3. 스마트 필터링된 엣지들 (메모이제이션)
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((node) => node.id));

    // LOD: 줌 아웃 시 엣지 숨기기
    if (zoomLevel < 0.5) {
      return []; // 너무 작으면 연결선 숨김
    }

    if (zoomLevel < 0.8) {
      // 중간 줌: 주요 연결선만 표시
      return edges.filter((edge) => {
        const sourceExists = nodeIds.has(edge.source);
        const targetExists = nodeIds.has(edge.target);
        const sourceNode = filteredNodes.find((n) => n.id === edge.source);
        const targetNode = filteredNodes.find((n) => n.id === edge.target);

        // 서버-스위치 또는 스위치-문제PC 연결만 표시
        return (
          sourceExists &&
          targetExists &&
          (sourceNode?.data?.type === "server" ||
            targetNode?.data?.type === "server" ||
            sourceNode?.data?.type === "switch" ||
            targetNode?.data?.type === "switch")
        );
      });
    }

    // 정상 줌: 필터된 노드 간 연결만 표시
    return edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
  }, [edges, filteredNodes, zoomLevel]);

  // 🚀 4. 노드 클릭 핸들러 (메모이제이션)
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) onDeviceClick(device);
    },
    [devices, onDeviceClick]
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      // 디버깅 로그는 개발 환경에서만
      if (
        typeof window !== "undefined" &&
        window.location.hostname === "localhost"
      ) {
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

  // 🚀 6. React Flow 초기화 (최적화)
  const onInit = useCallback((reactFlowInstance: unknown) => {
    if (
      typeof window !== "undefined" &&
      window.location.hostname === "localhost"
    ) {
      console.log(
        "🎯 React Flow 최적화 버전 초기화 - 키보드 네비게이션 활성화"
      );
      (window as any).reactFlowInstance = reactFlowInstance;
    }
  }, []);

  // 🚀 7. MiniMap 노드 색상 (메모이제이션)
  const miniMapNodeColor = useCallback(
    (node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);

      // 상태별 색상 우선
      if (device) {
        switch (device.status) {
          case "Online":
            return "#00ff00";
          case "Offline":
            return "#ff0000";
          case "Unstable":
            return "#ffff00";
          default:
            return "#cccccc";
        }
      }

      // 타입별 색상
      switch (node.data?.type) {
        case "server":
          return "#ffcc00";
        case "switch":
          return "#00ccff";
        case "pc":
          return "#66ff66";
        default:
          return "#cccccc";
      }
    },
    [devices]
  );

  // 🚀 8. React Flow 설정 (성능 최적화)
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
      // 🚀 성능 최적화 옵션
      onlyRenderVisibleElements: true, // 보이는 요소만 렌더링
      selectNodesOnDrag: false, // 드래그 시 선택 비활성화
      // 🎯 줌 변경 감지
      onViewportChange: (viewport: { x: number; y: number; zoom: number }) => {
        // 줌 레벨 기반 PC 노드 숨기기
        const shouldHidePCs = viewport.zoom < 0.01;

        if (shouldHidePCs) {
          // PC 노드들을 DOM에서 숨김 (CSS로)
          const pcNodes = document.querySelectorAll('[data-node-type="pc"]');
          pcNodes.forEach((node) => {
            (node as HTMLElement).style.opacity = "0.1";
            (node as HTMLElement).style.pointerEvents = "none";
          });
        } else {
          // PC 노드들 다시 표시
          const pcNodes = document.querySelectorAll('[data-node-type="pc"]');
          pcNodes.forEach((node) => {
            (node as HTMLElement).style.opacity = "1";
            (node as HTMLElement).style.pointerEvents = "auto";
          });
        }
      },
    }),
    []
  );

  return (
    <div
      ref={reactFlowWrapper}
      style={{ width: "100%", height: "100%" }}
      onMouseDown={(e) => {
        if (
          e.ctrlKey &&
          typeof window !== "undefined" &&
          window.location.hostname === "localhost"
        ) {
          // 개발 환경에서만 디버깅 로그
          console.log("🎯 Ctrl+클릭:", e.clientX, e.clientY);
        }
      }}
    >
      <ReactFlow
        nodes={filteredNodes.map((node) => ({
          ...node,
          // 🎯 PC 노드에 data-attribute 추가 (CSS 선택자용)
          data: {
            ...node.data,
            "data-node-type": node.data?.type,
          },
        }))}
        edges={filteredEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={handlePaneClick}
        onInit={onInit}
        {...reactFlowProps}
      >
        <MiniMap
          nodeColor={miniMapNodeColor}
          style={{
            // 🚀 MiniMap도 조건부 표시
            display: filteredNodes.length > 20 ? "block" : "none",
          }}
        />
      </ReactFlow>

      {/* 🆕 키보드 단축키 안내 */}
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

      {/* 🚀 9. 성능 정보 표시 (개발 환경) */}
      {typeof window !== "undefined" &&
        window.location.hostname === "localhost" && (
          <div
            style={{
              position: "absolute",
              top: 80,
              left: 10,
              background: "rgba(0,0,0,0.7)",
              color: "white",
              padding: "5px 10px",
              borderRadius: 5,
              fontSize: 12,
              pointerEvents: "none",
            }}
          >
            📊 노드: {filteredNodes.length}/{nodes.length} | 엣지:{" "}
            {filteredEdges.length}/{edges.length} | 모드: {viewMode} | 🎮
            키보드: {keyboardNavigationEnabled && !isPinging ? "ON" : "OFF"}
          </div>
        )}
    </div>
  );
});

// 🚀 10. 컴포넌트 이름 설정
NetworkDiagram.displayName = "NetworkDiagram";

export default NetworkDiagram;
