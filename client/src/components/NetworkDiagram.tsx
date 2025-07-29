// 📁 client/src/components/NetworkDiagram.tsx

import { useCallback } from "react";
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
 * - 자동 뷰포트 맞춤 기능
 *
 * @component
 * @version 1.0.0
 */

/**
 * NetworkDiagram 컴포넌트의 Props 인터페이스
 *
 * @interface NetworkDiagramProps
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

/**
 * NetworkDiagram 메인 컴포넌트
 *
 * React Flow를 래핑하여 네트워크 다이어그램 전용 기능을 제공합니다.
 * 노드 클릭 시 해당하는 Device 객체를 찾아 상위 컴포넌트로 전달하는
 * 중요한 매핑 역할을 수행합니다.
 *
 * @param props - NetworkDiagramProps 인터페이스를 따르는 속성 객체
 * @returns JSX.Element - 렌더링된 React Flow 다이어그램
 *
 * @example
 * ```tsx
 * <NetworkDiagram
 *   nodes={layoutedNodes}
 *   edges={connections}
 *   selectedDevice={currentDevice}
 *   onDeviceClick={(device) => setSelectedDevice(device)}
 *   onCanvasClick={() => setSelectedDevice(null)}
 *   onEdgeClick={(event, edge) => handleConnectionClick(edge)}
 *   devices={allDevices}
 *   nodeTypes={customNodeTypes}
 *   edgeTypes={customEdgeTypes}
 * />
 * ```
 */
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
  /**
   * 노드 클릭 이벤트 핸들러
   *
   * React Flow의 노드 클릭 이벤트를 처리하여 해당 노드에 연결된
   * Device 객체를 찾고 상위 컴포넌트의 onDeviceClick 콜백을 호출합니다.
   *
   * 처리 과정:
   * 1. 클릭된 노드의 ID 추출
   * 2. devices 배열에서 해당 ID와 일치하는 장비 검색
   * 3. 장비가 존재하면 onDeviceClick 콜백 실행
   *
   * @param _ - React Flow 노드 클릭 이벤트 객체 (사용하지 않음)
   * @param node - 클릭된 노드 객체
   *
   * @remarks
   * - useCallback을 사용하여 메모이제이션으로 불필요한 리렌더링 방지
   * - 의존성 배열에 devices와 onDeviceClick을 포함하여 최신 상태 보장
   * - Device ID를 문자열로 변환하여 비교 (타입 안전성 확보)
   */
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      // 노드 ID와 일치하는 장비 검색
      // deviceId는 숫자일 수 있으므로 문자열로 변환하여 비교
      const device = devices.find((d) => d.deviceId.toString() === node.id);

      // 해당 장비가 존재하는 경우에만 콜백 실행
      if (device) onDeviceClick(device);
    },
    [devices, onDeviceClick] // 의존성 배열: 변경 시에만 콜백 재생성
  );

  /**
   * React Flow 컴포넌트 렌더링
   *
   * 네트워크 다이어그램의 핵심 렌더링 로직입니다.
   * 모든 인터랙션과 시각화 기능을 React Flow에 위임하고,
   * 필요한 이벤트 핸들러와 설정을 전달합니다.
   */
  return (
    <ReactFlow
      // === 기본 데이터 ===
      nodes={nodes} // 시각화할 노드 배열
      edges={edges} // 노드 간 연결 정보
      // === 커스터마이징 ===
      nodeTypes={nodeTypes} // 커스텀 노드 컴포넌트 (예: 서버, 스위치, PC 아이콘)
      edgeTypes={edgeTypes} // 커스텀 엣지 스타일 (예: 연결 타입별 색상)
      // === 이벤트 핸들러 ===
      onNodeClick={handleNodeClick} // 노드 클릭 → 장비 선택
      onEdgeClick={onEdgeClick} // 엣지 클릭 → 연결 정보 표시
      onPaneClick={onCanvasClick} // 빈 영역 클릭 → 선택 해제
      // === 뷰포트 설정 ===
      fitView
      // 초기 로드 시 모든 노드가 보이도록 자동 줌/팬 조정
    >
      {/* 미니맵 컴포넌트: 전체 레이아웃을 축소해서 보여줌 */}
      <MiniMap
        nodeColor={(node) => {
          // 노드 타입에 따라 색상 지정
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
  );
}
