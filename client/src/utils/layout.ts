//  client/src/utils/layout.ts

import { Position } from "react-flow-renderer";
import type { Node, Edge } from "react-flow-renderer";
import dagre from "dagre";

/**
 * Network Layout Manager
 *
 * 네트워크 토폴로지 시각화를 위한 레이아웃 관리 모듈
 * React Flow 기반의 네트워크 다이어그램에서 노드와 엣지의 배치를 자동화합니다.
 *
 * 지원하는 레이아웃:
 * - Dagre: 계층적 구조의 방향성 그래프 레이아웃
 * - Radial: 중심 서버를 기준으로 한 방사형 레이아웃
 *
 * @author Network Visualization Team
 * @version 1.0.0
 */

// --------------------------------------
// 레이아웃 모드 정의
// --------------------------------------

/**
 * 네트워크 다이어그램에서 사용 가능한 레이아웃 모드를 정의합니다.
 *
 * @enum {string}
 */
export enum LayoutMode {
  /** 계층적 방향성 그래프 레이아웃 (Left-to-Right) */
  Dagre = "dagre",
  /** 기본 방사형 레이아웃 */
  Radial = "radial",
  /** 개선된 방사형 레이아웃 (스위치 중심의 클러스터링) */
  NewRadial = "new-radial",
}

// --------------------------------------
// DAGRE 계층 레이아웃 구현
// --------------------------------------

/**
 * Dagre 알고리즘을 사용하여 계층적 네트워크 레이아웃을 생성합니다.
 *
 * 이 함수는 방향성 비순환 그래프(DAG) 구조에 최적화되어 있으며,
 * 네트워크 장비들을 논리적 계층에 따라 좌측에서 우측으로 배치합니다.
 *
 * @param nodes - 레이아웃을 적용할 노드 배열
 * @param edges - 노드 간의 연결 관계를 나타내는 엣지 배열
 * @returns 위치가 계산된 노드와 엣지 객체
 *
 * @example
 * ```typescript
 * const { nodes: layoutedNodes, edges } = getDagreLayoutedElements(nodes, edges);
 * ```
 */
export function getDagreLayoutedElements(nodes: Node[], edges: Edge[]) {
  // Dagre 그래프 인스턴스 생성 및 기본 설정
  const dagreGraph = new dagre.graphlib.Graph();

  // 엣지의 기본 라벨을 빈 객체로 설정
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 그래프 레이아웃 속성 설정
  dagreGraph.setGraph({
    rankdir: "LR", // Left-to-Right 방향
    nodesep: 80, // 같은 레벨 노드 간 최소 간격 (px)
    ranksep: 100, // 다른 레벨 간 최소 간격 (px)
  });

  // 모든 노드를 그래프에 추가 (고정 크기 적용)
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: 180, // 노드 너비
      height: 60, // 노드 높이
    });
  });

  // 모든 엣지를 그래프에 추가
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Dagre 레이아웃 알고리즘 실행
  dagre.layout(dagreGraph);

  // 계산된 위치 정보를 노드에 적용
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      // 노드 중심점을 기준으로 위치 조정 (좌상단 기준으로 변환)
      position: {
        x: nodeWithPosition.x - 90, // 너비의 절반만큼 좌측으로 이동
        y: nodeWithPosition.y - 30, // 높이의 절반만큼 위로 이동
      },
      // 연결점 위치 설정 (좌-우 방향 흐름)
      sourcePosition: Position.Right, // 출력 연결점: 우측
      targetPosition: Position.Left, // 입력 연결점: 좌측
      // 레이아웃 모드 메타데이터 추가
      data: { ...node.data, mode: "dagre" },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// --------------------------------------
// 개선된 방사형 레이아웃 구현
// --------------------------------------

/**
 * 네트워크 인프라에 특화된 방사형 레이아웃을 생성합니다.
 *
 * 이 레이아웃은 다음과 같은 계층 구조를 가정합니다:
 * 1. 중앙의 서버 (Core)
 * 2. 서버 주변의 스위치들 (Distribution Layer)
 * 3. 각 스위치에 연결된 PC들 (Access Layer)
 *
 * 특징:
 * - 서버는 화면 중앙에 고정 배치
 * - 스위치들은 서버를 중심으로 원형 배치
 * - PC들은 해당 스위치 주변에 클러스터링
 * - 연결된 PC 수에 따라 동적으로 반지름 조정
 *
 * @param nodes - 레이아웃을 적용할 노드 배열 (type 필드 필요: 'server', 'switch', 'pc')
 * @param edges - 노드 간의 연결 관계를 나타내는 엣지 배열
 * @returns 위치가 계산된 노드와 엣지 객체
 *
 * @example
 * ```typescript
 * // 노드에는 data.type 필드가 필요합니다
 * const nodes = [
 *   { id: '1', data: { type: 'server', label: 'Main Server' } },
 *   { id: '2', data: { type: 'switch', label: 'SW-01' } },
 *   { id: '3', data: { type: 'pc', label: 'PC-01' } }
 * ];
 * const { nodes: layoutedNodes, edges } = getNewRadialLayoutedElements(nodes, edges);
 * ```
 */
export function getNewRadialLayoutedElements(
  inputNodes: Node[],
  inputEdges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  const center = { x: 800, y: 500 };
  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 60;

  // 노드 타입별 분류
  const server = inputNodes.find((n) => n.data?.type === "server");
  const switches = inputNodes.filter((n) => n.data?.type === "switch");
  const pcs = inputNodes.filter((n) => n.data?.type === "pc");

  // 서버가 없으면 원본 반환
  if (!server) return { nodes: inputNodes, edges: inputEdges };

  // 위치가 계산된 노드들을 저장할 Map (중복 방지)
  const positionedNodesMap = new Map<string, Node>();

  // 1. 서버 위치 고정 (중앙)
  positionedNodesMap.set(server.id, {
    ...server,
    position: {
      x: center.x - NODE_WIDTH / 2,
      y: center.y - NODE_HEIGHT / 2,
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: { ...server.data, mode: "radial" },
  });

  // 2. 스위치 원형 배치
  const switchRadius = 400;
  const switchAngleStep = (2 * Math.PI) / Math.max(switches.length, 1);

  switches.forEach((sw, i) => {
    const angle = i * switchAngleStep;
    const x = center.x + Math.cos(angle) * switchRadius;
    const y = center.y + Math.sin(angle) * switchRadius;

    positionedNodesMap.set(sw.id, {
      ...sw,
      position: {
        x: x - NODE_WIDTH / 2,
        y: y - NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: { ...sw.data, mode: "radial" },
    });
  });

  // 3. PC를 각 스위치 주변에 배치
  const pcSet = new Set<string>(); // 이미 배치된 PC 추적

  switches.forEach((sw) => {
    // 현재 스위치에 연결된 PC 찾기
    const connectedPCs = inputEdges
      .filter((e) => {
        const isSourceSwitch = e.source === sw.id;
        const isTargetSwitch = e.target === sw.id;
        const connectedId = isSourceSwitch ? e.target : isTargetSwitch ? e.source : null;
        
        if (!connectedId) return false;
        
        const connectedPC = pcs.find((p) => p.id === connectedId);
        return connectedPC && !pcSet.has(connectedId);
      })
      .map((e) => {
        const pcId = e.source === sw.id ? e.target : e.source;
        return pcs.find((p) => p.id === pcId);
      })
      .filter((pc): pc is Node => pc !== undefined);

    // 스위치의 위치 가져오기
    const switchNode = positionedNodesMap.get(sw.id);
    if (!switchNode || !switchNode.position) return;

    const switchPos = switchNode.position;
    const pcRadius = 150 + connectedPCs.length * 5; // 동적 반지름
    const pcAngleStep = (2 * Math.PI) / Math.max(connectedPCs.length, 1);
    const startAngle = -Math.PI / 2; // 12시 방향부터 시작

    connectedPCs.forEach((pc, idx) => {
      const angle = startAngle + idx * pcAngleStep;
      const px = switchPos.x + NODE_WIDTH / 2 + Math.cos(angle) * pcRadius;
      const py = switchPos.y + NODE_HEIGHT / 2 + Math.sin(angle) * pcRadius;

      positionedNodesMap.set(pc.id, {
        ...pc,
        position: {
          x: px - NODE_WIDTH / 2,
          y: py - NODE_HEIGHT / 2,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: { ...pc.data, mode: "radial" },
      });
      
      pcSet.add(pc.id);
    });
  });

  // 4. 위치가 계산되지 않은 노드들 처리 (고아 노드)
  inputNodes.forEach((node) => {
    if (!positionedNodesMap.has(node.id)) {
      console.warn(`⚠️ 노드 ${node.id} (${node.data?.label})의 위치가 계산되지 않았습니다. 기본 위치 할당.`);
      
      // 타입별로 다른 기본 위치 할당
      let defaultX = 100;
      let defaultY = 100;
      
      if (node.data?.type === "pc") {
        defaultX = 100;
        defaultY = 100 + (positionedNodesMap.size % 5) * 80;
      } else if (node.data?.type === "switch") {
        defaultX = center.x + 600;
        defaultY = center.y;
      }

      positionedNodesMap.set(node.id, {
        ...node,
        position: { x: defaultX, y: defaultY },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: { ...node.data, mode: "radial" },
      });
    }
  });

  // 5. 최종 노드 배열 생성 및 검증
  const finalNodes = Array.from(positionedNodesMap.values()).filter((n) => {
    const valid = 
      n.position &&
      typeof n.position.x === "number" &&
      typeof n.position.y === "number" &&
      !Number.isNaN(n.position.x) &&
      !Number.isNaN(n.position.y) &&
      Number.isFinite(n.position.x) &&
      Number.isFinite(n.position.y);
    
    if (!valid) {
      console.error(`❌ 노드 ${n.id}의 위치가 유효하지 않습니다:`, n.position);
    }
    
    return valid;
  });

  // 6. 엣지 처리 - custom 타입 적용 및 메타데이터 추가
  const finalEdges = inputEdges.map((e) => ({
    ...e,
    type: "custom",
    data: {
      ...e.data,
      mode: "radial",
    },
  }));

  console.log(`📊 Radial 레이아웃 결과: ${finalNodes.length}개 노드, ${finalEdges.length}개 엣지`);

  return { nodes: finalNodes, edges: finalEdges };
}
