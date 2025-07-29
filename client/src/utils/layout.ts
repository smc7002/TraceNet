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

  const server = inputNodes.find((n) => n.data?.type === "server");
  const switches = inputNodes.filter((n) => n.data?.type === "switch");
  const pcs = inputNodes.filter((n) => n.data?.type === "pc");

  if (!server) return { nodes: inputNodes, edges: inputEdges };

  // 서버 위치 고정
  const positionedNodes: Node[] = [
    {
      ...server,
      position: {
        x: center.x - NODE_WIDTH / 2,
        y: center.y - NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      data: { ...server.data, mode: "radial" },
    },
  ];

  // 스위치 원형 배치
  const radius = 400;
  const angleStep = (2 * Math.PI) / Math.max(switches.length, 1);

  switches.forEach((sw, i) => {
    const angle = i * angleStep;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;

    positionedNodes.push({
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

  // 스위치에 연결된 PC 배치
  switches.forEach((sw) => {
    const relatedPCs = inputEdges
      .filter(
        (e) =>
          (e.source === sw.id && pcs.find((p) => p.id === e.target)) ||
          (e.target === sw.id && pcs.find((p) => p.id === e.source))
      )
      .map((e) => (e.source === sw.id ? e.target : e.source))
      .map((id) => pcs.find((p) => p.id === id)!)
      .filter(Boolean);

    const base = positionedNodes.find((n) => n.id === sw.id)?.position;
    if (!base) return;

    const pcRadius = 100 + relatedPCs.length * 4;
    const rawStep = (2 * Math.PI) / Math.max(relatedPCs.length, 1);
    const angleStep = Math.max(rawStep, Math.PI / 18);
    const startAngle = -Math.PI / 2;

    relatedPCs.forEach((pc, idx) => {
      const angle = startAngle + idx * angleStep;
      const px = base.x + NODE_WIDTH / 2 + Math.cos(angle) * pcRadius;
      const py = base.y + NODE_HEIGHT / 2 + Math.sin(angle) * pcRadius;

      positionedNodes.push({
        ...pc,
        position: {
          x: px - NODE_WIDTH / 2,
          y: py - NODE_HEIGHT / 2,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: { ...pc.data, mode: "radial" },
      });
    });
  });

  const finalNodes = positionedNodes.filter(
    (n) =>
      typeof n.position?.x === "number" &&
      typeof n.position?.y === "number" &&
      !Number.isNaN(n.position.x) &&
      !Number.isNaN(n.position.y)
  );

  const finalEdges = inputEdges.map((e) => ({
    ...e,
    type: "custom",
  }));

  return { nodes: finalNodes, edges: finalEdges };
}
