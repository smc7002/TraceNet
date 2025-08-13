/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
// client/src/components/NetworkDiagram.tsx - 네트워크 시각화 메인 컴포넌트

import React, { useCallback, useRef, useMemo, useEffect } from "react";
import ReactFlow, {
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type ReactFlowInstance,
} from "react-flow-renderer";
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
  onZoomChange?: (zoomLevel: number) => void;
}

// 개발 환경 감지 - 디버깅 로그 활성화 여부 결정
const isLocalDev =
  typeof window !== "undefined" &&
  import.meta.env?.DEV &&
  window.location.hostname === "localhost";

/**
 * 네트워크 다이어그램 메인 컴포넌트
 *
 * React Flow 기반의 고성능 네트워크 시각화 시스템
 * 200+ 노드 환경에서 최적화된 렌더링과 사용자 인터랙션 제공
 *
 * 주요 기능:
 * - 실시간 줌/팬 제어 및 상태 추적
 * - 키보드 네비게이션 지원
 * - 미니맵을 통한 전체 구조 overview
 * - 개발 환경 전용 성능 모니터링
 * - 서버 중심 초기 화면 배치
 */
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
  zoomLevel = 1.0,
  keyboardNavigationEnabled = true,
  isPinging = false,
  onZoomChange,
}: NetworkDiagramProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const didFitOnce = useRef(false);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const animationFrame = useRef<number | null>(null);
  const zoomRaf = useRef<number | null>(null);
  const lastZoom = useRef<number | null>(null);
  const INITIAL_ZOOM = 0.6; // 조금 더 줌인해서 서버가 잘 보이도록

  // 키보드 네비게이션 훅 초기화
  const keyboardControls = useKeyboardNavigation({
    stepSize: 100,
    enabled: keyboardNavigationEnabled && !isPinging,
    zoomStep: 1.2,
    animationDuration: 300,
  });

  // 개발 환경에서만 키보드 컨트롤 상태 로깅
  useEffect(() => {
    if (isLocalDev) console.log("키보드 컨트롤 사용 가능:", keyboardControls);
  }, [keyboardControls]);

  /**
   * 컴포넌트 언마운트 시 정리 작업
   * 메모리 누수 방지를 위한 리소스 해제
   */
  useEffect(() => {
    return () => {
      // ResizeObserver 정리
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
        resizeObserver.current = null;
      }

      // 애니메이션 프레임 정리
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }

      if (zoomRaf.current) {
        cancelAnimationFrame(zoomRaf.current);
        zoomRaf.current = null;
      }

      // 전역 참조 정리 (하위 호환성 유지)
      if (typeof window !== "undefined" && (window as any).reactFlowInstance) {
        delete (window as any).reactFlowInstance;
      }

      if (isLocalDev) console.log("NetworkDiagram: 리소스 정리 완료");
    };
  }, []);

  /**
   * 서버 노드 찾기 헬퍼 함수
   */
  const findServerNode = useCallback(
    (nodeList: Node[]): Node | null => {
      return (
        nodeList.find(
          (node) =>
            node.data?.type === "server" ||
            node.data?.type === "Server" ||
            devices
              .find((d) => d.deviceId.toString() === node.id)
              ?.type.toLowerCase() === "server"
        ) || null
      );
    },
    [devices]
  );

  /**
   * 서버를 화면 중앙에 배치하는 함수
   */
  const centerOnServer = useCallback(
    (nodeList: Node[], zoom: number = INITIAL_ZOOM) => {
      const instance = reactFlowInstance.current;
      if (!instance) return;

      const serverNode = findServerNode(nodeList);

      if (serverNode) {
        // 서버 노드를 중심으로 화면 이동
        if (typeof instance.setCenter === "function") {
          instance.setCenter(serverNode.position.x, serverNode.position.y, {
            zoom,
            duration: 500,
          });
          if (isLocalDev) {
            console.log(
              `[CENTER] 서버 중심으로 이동: (${serverNode.position.x}, ${serverNode.position.y}), 줌: ${zoom}`
            );
          }
        }
      } else {
        // 서버가 없으면 전체 네트워크의 중심 계산
        if (nodeList.length > 0) {
          const centerX =
            nodeList.reduce((sum, node) => sum + node.position.x, 0) /
            nodeList.length;
          const centerY =
            nodeList.reduce((sum, node) => sum + node.position.y, 0) /
            nodeList.length;

          if (typeof instance.setCenter === "function") {
            instance.setCenter(centerX, centerY, { zoom, duration: 500 });
            if (isLocalDev) {
              console.log(
                `[CENTER] 네트워크 중심으로 이동: (${centerX}, ${centerY}), 줌: ${zoom}`
              );
            }
          }
        }
      }

      // 줌 레벨 업데이트
      onZoomChange?.(zoom);
    },
    [findServerNode, onZoomChange, isLocalDev]
  );

  /**
   * 노드 클릭 이벤트 핸들러
   * 노드 ID를 통해 해당 장비 정보를 찾아 부모 컴포넌트에 전달
   */
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) onDeviceClick(device);
    },
    [devices, onDeviceClick]
  );

  /**
   * 캔버스 클릭 이벤트 핸들러
   * 빈 공간 클릭 시 선택 상태 해제 및 부모 컴포넌트 알림
   */
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (isLocalDev) console.log("마우스 클릭:", event.clientX, event.clientY);
      onCanvasClick();
    },
    [onCanvasClick]
  );

  /**
   * React Flow 인스턴스 초기화 콜백
   * 로컬 ref에 저장하고 하위 호환성을 위해 전역에도 저장
   */
  const onInit = useCallback(
    (instance: ReactFlowInstance) => {
      if (isLocalDev) console.log("React Flow 초기화 완료");
      reactFlowInstance.current = instance;
      if (typeof window !== "undefined")
        (window as any).reactFlowInstance = instance;

      // DOM 그려진 다음 프레임에 서버 중심/줌 보정
      requestAnimationFrame(() => {
        centerOnServer(nodes, INITIAL_ZOOM);
      });
    },
    [centerOnServer, nodes]
  );

  /**
   * 미니맵 노드 색상 결정 함수
   * 장비 상태에 따른 색상 매핑으로 직관적인 상태 표시
   */
  const miniMapNodeColor = useCallback(
    (node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) {
        // 장비 상태 기반 색상 매핑
        switch (device.status) {
          case "Online":
            return "#00ff00"; // 초록색
          case "Offline":
            return "#ff0000"; // 빨간색
          case "Unstable":
            return "#ffff00"; // 노란색
          default:
            return "#cccccc"; // 회색
        }
      }

      // 장비 타입 기반 색상 매핑 (폴백)
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

  /**
   * 뷰포트 이동/줌 이벤트 핸들러
   * 줌 레벨 변경을 감지하여 부모 컴포넌트에 전달
   */
  const handleMove = useCallback(
    (_evt: unknown, viewport: { x: number; y: number; zoom: number }) => {
      if (typeof viewport?.zoom !== "number") return;
      if (isLocalDev) console.log(`[ZOOM] ${viewport.zoom.toFixed(3)}`);

      if (zoomRaf.current) cancelAnimationFrame(zoomRaf.current);
      zoomRaf.current = requestAnimationFrame(() => {
        if (lastZoom.current !== viewport.zoom) {
          lastZoom.current = viewport.zoom;
          onZoomChange?.(viewport.zoom);
        }
        zoomRaf.current = null;
      });
    },
    [onZoomChange]
  );

  /**
   * React Flow 기본 설정
   * 성능 최적화와 사용자 경험 개선을 위한 설정들
   */
  const reactFlowProps = useMemo(
    () => ({
      nodesDraggable: false, // 노드 드래그 비활성화
      nodesConnectable: false, // 노드 연결 비활성화
      elementsSelectable: true, // 요소 선택 활성화
      fitView: false, // 자동 피팅 비활성화 (우리가 제어)
      defaultZoom: INITIAL_ZOOM, // 기본 줌 레벨
      defaultPosition: [0, 0] as [number, number],
      translateExtent: [
        // 이동 가능 범위 제한
        [-3000, -3000],
        [3000, 3000],
      ] as [[number, number], [number, number]],
      minZoom: 0.3, // 최소 줌 레벨
      maxZoom: 2, // 최대 줌 레벨
      onlyRenderVisibleElements: true, // 뷰포트 내 요소만 렌더링
      selectNodesOnDrag: false, // 드래그 시 선택 비활성화
    }),
    []
  );

  /**
   * 첫 데이터 완성 시점에 서버 중심으로 화면 배치
   * Race condition 방지를 위한 안전한 초기화
   */
  useEffect(() => {
    if (didFitOnce.current) return;
    if (!reactFlowInstance.current) return;
    if (nodes.length === 0) return;

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edgesValid = edges.every(
      (e) => nodeIds.has(e.source as string) && nodeIds.has(e.target as string)
    );
    if (!edgesValid) return;

    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    animationFrame.current = requestAnimationFrame(() => {
      // 서버 중심으로 화면 배치
      centerOnServer(nodes, INITIAL_ZOOM);

      didFitOnce.current = true;
      animationFrame.current = null;
      if (isLocalDev) console.log("[INIT] 서버 중심 초기 배치 완료");
    });

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };
  }, [nodes, edges, centerOnServer]);

  /**
   * 컨테이너 리사이즈 감지 (자동 중심 이동 없음)
   * 단순히 ResizeObserver만 설정하되 자동 이동은 하지 않음
   */
  useEffect(() => {
    const container = reactFlowWrapper.current;
    if (!container || !reactFlowInstance.current) return;
    if (typeof ResizeObserver === "undefined") return;

    // 기존 observer 정리
    if (resizeObserver.current) {
      resizeObserver.current.disconnect();
    }

    resizeObserver.current = new ResizeObserver(() => {
      // 초기화 완료 후에는 자동으로 중심 이동하지 않음
      // 사용자가 수동으로 이동/줌을 조작할 수 있도록 함
      if (isLocalDev) console.log("[RESIZE] 감지됨 (자동 이동 안함)");
    });

    resizeObserver.current.observe(container);

    return () => {
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
        resizeObserver.current = null;
      }
    };
  }, []);

  /**
   * 키보드 단축키로 서버 중심 이동 (수동 트리거만)
   * Ctrl + Home으로 사용자가 원할 때만 서버 중심으로 이동
   */
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Home") {
        event.preventDefault();
        centerOnServer(nodes, INITIAL_ZOOM);
        if (isLocalDev) console.log("[MANUAL] 사용자가 서버 중심 이동 요청");
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [nodes, centerOnServer]);

  return (
    <div ref={reactFlowWrapper} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={handlePaneClick}
        onInit={onInit}
        onMove={handleMove}
        onMoveEnd={handleMove}
        {...reactFlowProps}
      >
        <MiniMap
          nodeColor={miniMapNodeColor}
          style={{ display: nodes.length > 5 ? "block" : "none" }}
        />
      </ReactFlow>

      {/* 키보드 단축키 안내 (활성화 시에만 표시) */}
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
          <div>화살표: 화면 이동</div>
          <div>Ctrl + +/-: 줌</div>
          <div>Ctrl + 0: 전체보기</div>
          <div>Ctrl + Home: 서버 중심</div>
        </div>
      )}

      {/* 개발 환경 전용 성능 모니터링 패널 */}
      {typeof window !== "undefined" &&
        window.location.hostname === "localhost" && (
          <div
            style={{
              position: "absolute",
              top: 120,
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
            <div>
              노드: {nodes.length} | 엣지: {edges.length}
            </div>
            <div>줌: {zoomLevel.toFixed(2)}x</div>
            <div>
              키보드: {keyboardNavigationEnabled && !isPinging ? "ON" : "OFF"}
            </div>
            <div>모드: {viewMode}</div>
            <div>초기화: {didFitOnce.current ? "완료" : "대기중"}</div>
            <div>서버 중심: {findServerNode(nodes) ? "감지됨" : "없음"}</div>
          </div>
        )}
    </div>
  );
});

NetworkDiagram.displayName = "NetworkDiagram";
export default NetworkDiagram;
