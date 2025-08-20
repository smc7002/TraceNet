/**
 * @fileoverview 네트워크 인프라 시각화 메인 컴포넌트
 * 
 * React Flow 기반 고성능 네트워크 시각화 시스템
 * 
 * 주요 기능:
 * - 실시간 줌/팬 제어 및 뷰포트 상태 추적
 * - 키보드 네비게이션 지원 (화살표, Ctrl+Home 등)
 * - 미니맵을 통한 전체 네트워크 구조 overview
 * - 서버 중심 자동 배치 및 사용자 경험 최적화
 * - 개발 환경 전용 성능 모니터링 도구
 * 
 * 성능 최적화:
 * - React.memo를 통한 불필요한 리렌더링 방지
 * - requestAnimationFrame을 활용한 부드러운 애니메이션
 * - 뷰포트 내 요소만 렌더링하는 가상화
 * - 메모리 누수 방지를 위한 완벽한 리소스 정리
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

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

// ==========================================
// 타입 정의
// ==========================================

/**
 * 뷰포트 정보 인터페이스
 * MainPage의 스마트 PC 공개 알고리즘에서 사용
 */
type ViewportInfo = {
  /** React Flow transform X 좌표 */
  x: number;
  /** React Flow transform Y 좌표 */
  y: number;
  /** 현재 줌 레벨 (0.3 ~ 2.0) */
  zoom: number;
  /** 컨테이너 픽셀 너비 */
  width: number;
  /** 컨테이너 픽셀 높이 */
  height: number;
  /** Flow 좌표계 기준 화면 중심 X */
  centerX: number;
  /** Flow 좌표계 기준 화면 중심 Y */
  centerY: number;
};

/**
 * NetworkDiagram 컴포넌트 Props
 */
interface NetworkDiagramProps {
  /** 렌더링할 노드 배열 */
  nodes: Node[];
  /** 렌더링할 엣지 배열 */
  edges: Edge[];
  /** 현재 선택된 장비 (하이라이트 표시용) */
  selectedDevice: Device | null;
  /** 노드 클릭 이벤트 핸들러 */
  onDeviceClick: (device: Device) => void;
  /** 캔버스 빈 공간 클릭 이벤트 핸들러 */
  onCanvasClick: () => void;
  /** 엣지(연결선) 클릭 이벤트 핸들러 */
  onEdgeClick: (event: unknown, edge: Edge) => void;
  /** 전체 장비 목록 (노드 ID 매핑용) */
  devices: Device[];
  /** 커스텀 노드 타입들 */
  nodeTypes?: NodeTypes;
  /** 커스텀 엣지 타입들 */
  edgeTypes?: EdgeTypes;
  /** 표시 모드 */
  viewMode?: "full" | "smart" | "minimal";
  /** 문제 장비만 표시 여부 */
  showOnlyProblems?: boolean;
  /** 현재 줌 레벨 */
  zoomLevel?: number;
  /** 키보드 네비게이션 활성화 여부 */
  keyboardNavigationEnabled?: boolean;
  /** Ping 실행 중 여부 (UI 비활성화용) */
  isPinging?: boolean;
  /** 줌 레벨 변경 콜백 */
  onZoomChange?: (zoomLevel: number) => void;
  /** 뷰포트 변경 콜백 (스마트 PC 공개용) */
  onViewportChange?: (info: ViewportInfo) => void;
}

// ==========================================
// 상수 및 설정
// ==========================================

/** 개발 환경 감지 - 디버깅 로그 활성화 여부 */
const isLocalDev =
  typeof window !== "undefined" &&
  import.meta.env?.DEV &&
  window.location.hostname === "localhost";

/** 초기 줌 레벨 - 서버가 적절히 보이도록 설정 */
const INITIAL_ZOOM = 0.6;

// ==========================================
// 메인 컴포넌트
// ==========================================

/**
 * 네트워크 다이어그램 시각화 컴포넌트
 * 
 * React Flow를 기반으로 한 고성능 네트워크 시각화 시스템.
 * 제조업 환경에서 200+ 네트워크 장비를 실시간으로 모니터링하고
 * 직관적인 사용자 인터페이스를 제공.
 * 
 * 핵심 기능:
 * - 서버 중심 자동 배치로 즉각적인 네트워크 개요 제공
 * - 실시간 성능 모니터링 (개발 환경)
 * - 키보드 단축키를 통한 빠른 네비게이션
 * - 메모리 효율적인 리소스 관리
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
  onViewportChange,
}: NetworkDiagramProps) {
  
  // ==========================================
  // Refs 및 상태 관리
  // ==========================================
  
  /** React Flow 컨테이너 DOM 참조 */
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  /** React Flow 인스턴스 참조 (줌, 이동 제어용) */
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  
  /** 초기 화면 배치 완료 플래그 (중복 실행 방지) */
  const didFitOnce = useRef(false);
  
  /** 화면 크기 변경 감지용 ResizeObserver */
  const resizeObserver = useRef<ResizeObserver | null>(null);
  
  /** 화면 배치용 애니메이션 프레임 ID */
  const animationFrame = useRef<number | null>(null);
  
  /** 줌 이벤트 throttling용 애니메이션 프레임 ID */
  const zoomRaf = useRef<number | null>(null);
  
  /** 마지막 줌 레벨 (중복 이벤트 방지용) */
  const lastZoom = useRef<number | null>(null);

  // ==========================================
  // 키보드 네비게이션 초기화
  // ==========================================
  
  /** 키보드 네비게이션 훅 설정 */
  const keyboardControls = useKeyboardNavigation({
    stepSize: 100,           // 화살표 키 이동 거리 (px)
    enabled: keyboardNavigationEnabled && !isPinging, // Ping 중에는 비활성화
    zoomStep: 1.2,           // 줌 단계 (20% 증감)
    animationDuration: 300,  // 애니메이션 지속시간 (ms)
  });

  // 개발 환경에서만 키보드 컨트롤 상태 로깅
  useEffect(() => {
    if (isLocalDev) console.log("키보드 컨트롤 사용 가능:", keyboardControls);
  }, [keyboardControls]);

  // ==========================================
  // 메모리 관리 및 정리
  // ==========================================

  /**
   * 컴포넌트 언마운트 시 리소스 정리
   * 메모리 누수 방지를 위한 완벽한 정리 작업
   */
  useEffect(() => {
    return () => {
      // ResizeObserver 정리
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
        resizeObserver.current = null;
      }

      // 진행 중인 애니메이션 프레임 취소
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

  // ==========================================
  // 서버 중심 배치 로직
  // ==========================================

  /**
   * 서버 노드 찾기 헬퍼 함수
   * 
   * 다양한 형태의 서버 노드 타입을 감지:
   * - node.data.type이 "server" 또는 "Server"
   * - devices 배열에서 타입이 "server"인 장비
   * 
   * @param nodeList 검색할 노드 배열
   * @returns 서버 노드 또는 null
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
   * 
   * 사용자 경험 최적화를 위해 서버 노드를 우선적으로 중앙에 배치.
   * 서버가 없는 경우 전체 네트워크의 무게중심으로 이동.
   * 
   * @param nodeList 배치할 노드 배열
   * @param zoom 적용할 줌 레벨 (기본: INITIAL_ZOOM)
   */
  const centerOnServer = useCallback(
    (nodeList: Node[], zoom: number = INITIAL_ZOOM) => {
      const instance = reactFlowInstance.current;
      if (!instance) return;

      const serverNode = findServerNode(nodeList);

      if (serverNode) {
        // 서버 노드 중심으로 부드러운 이동
        if (typeof instance.setCenter === "function") {
          instance.setCenter(serverNode.position.x, serverNode.position.y, {
            zoom,
            duration: 500, // 0.5초 애니메이션
          });
          if (isLocalDev) {
            console.log(
              `[CENTER] 서버 중심으로 이동: (${serverNode.position.x}, ${serverNode.position.y}), 줌: ${zoom}`
            );
          }
        }
      } else {
        // 서버가 없으면 네트워크 전체의 무게중심 계산
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

      // 부모 컴포넌트에 줌 레벨 변경 알림
      onZoomChange?.(zoom);
    },
    [findServerNode, onZoomChange, isLocalDev]
  );

  // ==========================================
  // 이벤트 핸들러들
  // ==========================================

  /**
   * 노드 클릭 이벤트 핸들러
   * 
   * 노드 ID를 통해 devices 배열에서 해당 장비 정보를 찾아
   * 부모 컴포넌트의 onDeviceClick 콜백으로 전달
   * 
   * @param _ 사용하지 않는 이벤트 객체
   * @param node 클릭된 노드 객체
   */
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) onDeviceClick(device);
    },
    [devices, onDeviceClick]
  );

  /**
   * 캔버스 빈 공간 클릭 이벤트 핸들러
   * 
   * 사용자가 빈 공간을 클릭하면 선택 상태를 해제하고
   * 부모 컴포넌트에 알림
   * 
   * @param event 마우스 클릭 이벤트
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
   * 
   * React Flow가 완전히 로드된 후 호출되며,
   * 인스턴스 참조를 저장하고 초기 화면 배치를 수행
   * 
   * @param instance React Flow 인스턴스
   */
  const onInit = useCallback(
    (instance: ReactFlowInstance) => {
      if (isLocalDev) console.log("React Flow 초기화 완료");
      
      // 인스턴스 참조 저장
      reactFlowInstance.current = instance;
      
      // 하위 호환성을 위한 전역 참조 (필요시)
      if (typeof window !== "undefined")
        (window as any).reactFlowInstance = instance;

      // DOM이 완전히 렌더링된 다음 프레임에 서버 중심 배치
      requestAnimationFrame(() => {
        centerOnServer(nodes, INITIAL_ZOOM);
      });
    },
    [centerOnServer, nodes]
  );

  /**
   * 미니맵 노드 색상 결정 함수
   * 
   * 장비 상태와 타입에 따라 미니맵에서 표시될 색상을 결정.
   * 상태 우선, 타입 보조의 색상 매핑 전략 적용.
   * 
   * @param node 색상을 결정할 노드
   * @returns CSS 색상 코드 (HEX)
   */
  const miniMapNodeColor = useCallback(
    (node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      
      if (device) {
        // 1순위: 장비 실제 상태 기반 색상 매핑
        switch (device.status) {
          case "Online":
            return "#00ff00"; // 밝은 초록색 (정상)
          case "Offline":
            return "#ff0000"; // 밝은 빨간색 (오프라인)
          case "Unstable":
            return "#ffff00"; // 밝은 노란색 (불안정)
          default:
            return "#cccccc"; // 회색 (알 수 없음)
        }
      }

      // 2순위: 노드 타입 기반 색상 매핑 (폴백)
      switch (node.data?.type) {
        case "server":
          return "#ffcc00"; // 황금색 (서버)
        case "switch":
          return "#00ccff"; // 하늘색 (스위치)
        case "pc":
          return "#66ff66"; // 연한 초록색 (PC)
        default:
          return "#cccccc"; // 기본 회색
      }
    },
    [devices]
  );

  /**
   * 뷰포트 이동/줌 이벤트 핸들러
   * 
   * 사용자의 줌, 팬 동작을 감지하여:
   * 1. 줌 레벨 변경을 부모 컴포넌트에 알림
   * 2. 화면 중심 좌표를 계산하여 스마트 PC 공개 알고리즘에 제공
   * 
   * requestAnimationFrame을 사용하여 과도한 이벤트 호출 방지
   * 
   * @param _evt 사용하지 않는 이벤트 객체
   * @param viewport 현재 뷰포트 상태
   */
  const handleMove = useCallback(
    (_evt: unknown, viewport: { x: number; y: number; zoom: number }) => {
      const inst = reactFlowInstance.current;
      const container = reactFlowWrapper.current;
      if (!inst || !container) return;

      // 현재 컨테이너 크기 측정
      const { width, height } = container.getBoundingClientRect();

      // 화면 중심점의 스크린 좌표를 Flow 좌표계로 변환
      // 이 좌표는 MainPage의 스마트 PC 공개 알고리즘에서 사용됨
      const centerInScreen = { x: width / 2, y: height / 2 };
      const centerInFlow = inst.project(centerInScreen);

      // 이벤트 throttling을 위한 requestAnimationFrame 사용
      if (typeof viewport?.zoom === "number") {
        if (zoomRaf.current) cancelAnimationFrame(zoomRaf.current);
        zoomRaf.current = requestAnimationFrame(() => {
          
          // 줌 레벨 변경 시에만 onZoomChange 호출 (중복 방지)
          if (lastZoom.current !== viewport.zoom) {
            lastZoom.current = viewport.zoom;
            onZoomChange?.(viewport.zoom);
          }
          
          // 뷰포트 정보를 부모 컴포넌트에 전달
          onViewportChange?.({
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
            width,
            height,
            centerX: centerInFlow.x,
            centerY: centerInFlow.y,
          });

          zoomRaf.current = null;
        });
      }
    },
    [onZoomChange, onViewportChange]
  );

  // ==========================================
  // React Flow 설정
  // ==========================================

  /**
   * React Flow 기본 속성 설정
   * 성능 최적화와 사용자 경험 개선을 위한 설정들
   */
  const reactFlowProps = useMemo(
    () => ({
      // 노드 인터랙션 설정
      nodesDraggable: false,        // 노드 드래그 비활성화 (레이아웃 보호)
      nodesConnectable: false,      // 노드 간 연결 생성 비활성화
      elementsSelectable: true,     // 노드/엣지 선택 허용
      selectNodesOnDrag: false,     // 드래그 시 선택 비활성화
      
      // 화면 제어 설정
      fitView: false,               // 자동 피팅 비활성화 (수동 제어)
      defaultZoom: INITIAL_ZOOM,    // 초기 줌 레벨
      defaultPosition: [0, 0] as [number, number], // 초기 위치
      
      // 줌 및 이동 범위 제한
      minZoom: 0.3,                 // 최소 줌 (전체 뷰)
      maxZoom: 2,                   // 최대 줌 (세부 뷰)
      translateExtent: [            // 이동 가능 범위
        [-3000, -3000],
        [3000, 3000],
      ] as [[number, number], [number, number]],
      
      // 성능 최적화
      onlyRenderVisibleElements: true, // 뷰포트 내 요소만 렌더링
    }),
    []
  );

  // ==========================================
  // 초기화 및 생명주기 Effects
  // ==========================================

  /**
   * 데이터 로딩 완료 후 초기 화면 배치
   * 
   * 조건:
   * 1. 아직 초기화되지 않음 (didFitOnce.current === false)
   * 2. React Flow 인스턴스 준비됨
   * 3. 노드 데이터 존재
   * 4. 엣지-노드 일관성 확인 (Race condition 방지)
   * 
   * Race condition 방지를 위해 엣지의 모든 source/target이
   * 노드 목록에 존재하는지 검증 후 배치 실행
   */
  useEffect(() => {
    // 이미 초기화 완료된 경우 스킵
    if (didFitOnce.current) return;
    if (!reactFlowInstance.current) return;
    if (nodes.length === 0) return;

    // 엣지-노드 일관성 검증 (Race condition 방지)
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edgesValid = edges.every(
      (e) => nodeIds.has(e.source as string) && nodeIds.has(e.target as string)
    );
    if (!edgesValid) return;

    // 기존 애니메이션 프레임 취소
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }

    // 다음 프레임에 서버 중심 배치 실행
    animationFrame.current = requestAnimationFrame(() => {
      centerOnServer(nodes, INITIAL_ZOOM);
      didFitOnce.current = true;
      animationFrame.current = null;
      
      if (isLocalDev) console.log("[INIT] 서버 중심 초기 배치 완료");
    });

    // 컴포넌트 언마운트 시 애니메이션 프레임 정리
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = null;
      }
    };
  }, [nodes, edges, centerOnServer]);

  /**
   * 컨테이너 크기 변경 감지 설정
   * 
   * ResizeObserver를 사용하여 컨테이너 크기 변경을 감지하지만,
   * 사용자 경험을 위해 자동으로 화면을 재조정하지는 않음.
   * 사용자가 수동으로 설정한 줌/위치를 유지.
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
      // 크기 변경 감지만 하고 자동 이동은 하지 않음
      // 사용자가 설정한 뷰포트 상태 유지
      if (isLocalDev) console.log("[RESIZE] 컨테이너 크기 변경 감지됨");
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
   * 키보드 단축키 이벤트 리스너 설정
   * 
   * Ctrl + Home: 서버 중심으로 화면 이동
   * 사용자가 네트워크에서 길을 잃었을 때 빠른 복귀 기능 제공
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

  // ==========================================
  // 렌더링
  // ==========================================

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
        {/* 미니맵 - 5개 이상 노드가 있을 때만 표시 */}
        <MiniMap
          nodeColor={miniMapNodeColor}
          style={{ display: nodes.length > 5 ? "block" : "none" }}
        />
      </ReactFlow>

      {/* 키보드 단축키 안내 (조건부 표시) */}
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

/**
 * 수정 가이드
 * 
 * 1. 성능 튜닝:
 *    - INITIAL_ZOOM 값 조정으로 초기 화면 크기 변경
 *    - reactFlowProps의 minZoom/maxZoom으로 줌 범위 제한
 *    - onlyRenderVisibleElements로 뷰포트 렌더링 최적화 활성화
 * 
 * 2. 키보드 단축키 추가:
 *    - handleKeydown 함수에 새 키 조합 추가
 *    - useKeyboardNavigation 훅에서 기본 동작 확장
 * 
 * 3. 미니맵 커스터마이징:
 *    - miniMapNodeColor 함수에서 색상 매핑 변경
 *    - 표시 조건 수정 (현재: 5개 이상 노드)
 * 
 * 4. 초기 배치 로직 수정:
 *    - findServerNode에서 서버 감지 조건 변경
 *    - centerOnServer에서 배치 알고리즘 수정
 * 
 * 5. 성능 모니터링:
 *    - 개발 환경 패널에서 추가 지표 표시
 *    - React DevTools Profiler로 리렌더링 최적화
 * 
 * 6. 알려진 제한사항:
 *    - 1000+ 노드에서 초기 렌더링 지연 가능
 *    - 매우 깊은 줌에서 텍스트 가독성 저하
 */