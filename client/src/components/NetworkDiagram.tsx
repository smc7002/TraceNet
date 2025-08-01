/* eslint-disable @typescript-eslint/no-explicit-any */
// 📁 client/src/components/NetworkDiagram.tsx

import { useCallback, useRef } from "react";
import ReactFlow from "react-flow-renderer";
import type { Node, Edge, NodeTypes, EdgeTypes } from "react-flow-renderer";
import type { Device } from "../types/device";
import { MiniMap } from "react-flow-renderer";

/**
 * NetworkDiagram Component
 *
 * 네트워크 토폴로지를 시각화하는 React Flow 기반 다이어그램 컴포넌트입니다.
 * 네트워크 장비들을 노드로, 연결 관계를 엣지로 표현하여 인터랙티브한
 * 네트워크 구성도를 제공합니다.
 *
 * 주요 기능:
 * - 네트워크 장비 시각화 (서버, 스위치, PC 등)
 * - 장비 간 연결 관계 표시
 * - 사용자 인터랙션 처리 (클릭, 선택 등)
 * - 커스텀 노드/엣지 타입 지원
 * - 마우스 클릭 좌표 로깅 (디버깅용)
 *
 */

/**
 * NetworkDiagram 컴포넌트의 Props 인터페이스
 */
interface NetworkDiagramProps {
  /** React Flow에서 렌더링할 노드 배열 */
  nodes: Node[];
  /** 노드 간 연결을 나타내는 엣지 배열 */
  edges: Edge[];
  /** 현재 선택된 장비 정보 (없으면 null) */
  selectedDevice: Device | null;
  /** 장비 클릭 시 호출되는 콜백 함수 */
  onDeviceClick: (device: Device) => void;
  /** 빈 캔버스 영역 클릭 시 호출되는 콜백 함수 (선택 해제용) */
  onCanvasClick: () => void;
  /** 엣지(연결선) 클릭 시 호출되는 콜백 함수 */
  onEdgeClick: (event: unknown, edge: Edge) => void;
  /** 전체 장비 목록 (노드-장비 매핑용) */
  devices: Device[];
  /** 커스텀 노드 타입 정의 (선택사항) */
  nodeTypes?: NodeTypes;
  /** 커스텀 엣지 타입 정의 (선택사항) */
  edgeTypes?: EdgeTypes;
}

export default function NetworkDiagram({
  nodes,
  edges,
  onDeviceClick,
  onCanvasClick,
  onEdgeClick,
  devices,
  nodeTypes,
  edgeTypes,
}: NetworkDiagramProps) {
  // React Flow 컨테이너 참조
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  /**
   * 노드 클릭 이벤트 핸들러
   */
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const device = devices.find((d) => d.deviceId.toString() === node.id);
      if (device) onDeviceClick(device);
    },
    [devices, onDeviceClick]
  );
  /**
   * 🎯 마우스 클릭 좌표 로깅 함수
   */
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      // 기존 좌표 출력 유지 (선택사항)
      console.log("🖱️ === 마우스 클릭 좌표 분석 ===");

      const screenX = event.clientX;
      const screenY = event.clientY;
      console.log(`📍 화면 좌표: (${screenX}, ${screenY})`);

      if (reactFlowWrapper.current) {
        const rect = reactFlowWrapper.current.getBoundingClientRect();
        const containerX = screenX - rect.left;
        const containerY = screenY - rect.top;
        console.log(`📍 컨테이너 좌표: (${containerX}, ${containerY})`);
      }

      // 🎯 실제 선택 해제 처리
      onCanvasClick(); // 외부 상태 초기화 (selectedDevice 등)

      const reactFlowInstance = (window as any).reactFlowInstance;
      if (
        reactFlowInstance &&
        typeof reactFlowInstance.setNodes === "function"
      ) {
        // 모든 노드의 selected 상태를 false로 변경
        reactFlowInstance.setNodes((nodes: Node[]) =>
          nodes.map((node) => ({ ...node, selected: false }))
        );
      }
    },
    [onCanvasClick]
  );

  /**
   * 🎯 React Flow 초기화 및 글로벌 디버깅 함수 등록
   */
  const onInit = useCallback((reactFlowInstance: unknown) => {
    console.log("🎯 React Flow 초기화 완료");

    // React Flow 인스턴스를 글로벌에 저장 (디버깅용)
    (window as any).reactFlowInstance = reactFlowInstance;

    console.log("💡 사용법:");
    console.log("   Ctrl+클릭: 해당 지점의 정확한 좌표 출력");
    console.log("   window.getFlowCoordinates(event): 수동 좌표 계산");

    // 글로벌 헬퍼 함수 등록
    (window as any).getFlowCoordinates = (event: MouseEvent) => {
      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (!rect) return null;

      const containerX = event.clientX - rect.left;
      const containerY = event.clientY - rect.top;

      // React Flow의 내부 변환을 통해 실제 Flow 좌표 계산
      const flowPosition = (reactFlowInstance as any).project({
        x: containerX,
        y: containerY,
      });

      console.log("🎯 === 정확한 Flow 좌표 ===");
      console.log(`📍 화면 좌표: (${event.clientX}, ${event.clientY})`);
      console.log(`📍 컨테이너 좌표: (${containerX}, ${containerY})`);
      console.log(`📍 Flow 좌표: (${flowPosition.x}, ${flowPosition.y})`);

      return flowPosition;
    };
  }, []);

  return (
    <div
      ref={reactFlowWrapper}
      style={{ width: "100%", height: "100%" }}
      // 🎯 Ctrl+클릭 시 상세 좌표 로깅
      onMouseDown={(e) => {
        if (e.ctrlKey) {
          console.log("🎯 === Ctrl+클릭 상세 분석 ===");
          const rect = reactFlowWrapper.current?.getBoundingClientRect();
          if (rect) {
            const containerX = e.clientX - rect.left;
            const containerY = e.clientY - rect.top;
            console.log(`📍 화면 좌표: (${e.clientX}, ${e.clientY})`);
            console.log(`📍 컨테이너 좌표: (${containerX}, ${containerY})`);

            // React Flow 인스턴스로 정확한 Flow 좌표 계산
            const reactFlowInstance = (window as any).reactFlowInstance;
            if (reactFlowInstance) {
              const flowPosition = (reactFlowInstance as any).project({
                x: containerX,
                y: containerY,
              });
              console.log(
                `📍 Flow 좌표: (${flowPosition.x}, ${flowPosition.y})`
              );
            }
          }
        }
      }}
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
        // 🎯 연결 기능 완전 비활성화
        nodesDraggable={false} // 노드 드래그 비활성화
        nodesConnectable={false} // 노드 연결 비활성화
        elementsSelectable={true} // 선택은 가능하게
        // 🎯 뷰포트 설정
        fitView={false}
        defaultZoom={1.0}
        defaultPosition={[0, 0]}
        translateExtent={[
          [-2000, -2000],
          [3000, 2000],
        ]}
        minZoom={0.3}
        maxZoom={2}
      >
        <MiniMap
          nodeColor={(node) => {
            switch (node.data?.type) {
              case "server":
                return "#ffcc00"; // 서버: 노란색
              case "switch":
                return "#00ccff"; // 스위치: 파란색
              case "pc":
                return "#66ff66"; // PC: 초록색
              default:
                return "#cccccc"; // 기본 회색
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}
