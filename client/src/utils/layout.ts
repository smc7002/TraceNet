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
 * @version 1.1.0
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
// 유틸리티 함수
// --------------------------------------

/**
 * 각도에 따른 Handle 위치를 계산합니다.
 *
 * 노드가 중심점으로부터 어떤 각도에 위치하는지에 따라
 * 가장 자연스러운 연결점 위치를 결정합니다.
 *
 * @param angleInDegrees - 노드의 각도 (도 단위, 0-360)
 * @returns source와 target Handle의 위치
 */
function getHandlePositionsByAngle(angleInDegrees: number): {
  source: Position;
  target: Position;
} {
  // 각도를 0-360 범위로 정규화
  const normalizedAngle = ((angleInDegrees % 360) + 360) % 360;

  // 8방향으로 구분하여 최적의 Handle 위치 결정
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) {
    // 오른쪽 (0도) - 3시 방향
    return { source: Position.Left, target: Position.Right };
  } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
    // 오른쪽 아래 (45도)
    return { source: Position.Top, target: Position.Bottom };
  } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
    // 아래 (90도) - 6시 방향
    return { source: Position.Top, target: Position.Bottom };
  } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
    // 왼쪽 아래 (135도)
    return { source: Position.Top, target: Position.Bottom };
  } else if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
    // 왼쪽 (180도) - 9시 방향
    return { source: Position.Right, target: Position.Left };
  } else if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
    // 왼쪽 위 (225도)
    return { source: Position.Bottom, target: Position.Top };
  } else if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
    // 위 (270도) - 12시 방향
    return { source: Position.Bottom, target: Position.Top };
  } else {
    // 오른쪽 위 (315도)
    return { source: Position.Bottom, target: Position.Top };
  }
}

// --------------------------------------
// DAGRE 계층 레이아웃 구현
// --------------------------------------

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
  // 서버는 모든 방향에서 연결을 받을 수 있으므로 기본 Handle 위치 유지
  positionedNodesMap.set(server.id, {
    ...server,
    position: {
      x: center.x - NODE_WIDTH / 2,
      y: center.y - NODE_HEIGHT / 2,
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data: {
      ...server.data,
      mode: "radial",
      angleInDegrees: 0, // 서버는 중앙이므로 각도 0
    },
  });

  // 2. 스위치 원형 배치
  const switchRadius = 400;
  const switchAngleStep = (2 * Math.PI) / Math.max(switches.length, 1);

  switches.forEach((sw, index) => {
    const angle = index * switchAngleStep;
    const x = center.x + Math.cos(angle) * switchRadius;
    const y = center.y + Math.sin(angle) * switchRadius;
    const angleInDegrees = (angle * 180) / Math.PI;

    // 각도에 따른 Handle 위치 계산
    const handlePositions = getHandlePositionsByAngle(angleInDegrees);

    positionedNodesMap.set(sw.id, {
      ...sw,
      position: {
        x: x - NODE_WIDTH / 2,
        y: y - NODE_HEIGHT / 2,
      },
      sourcePosition: handlePositions.source,
      targetPosition: handlePositions.target,
      data: {
        ...sw.data,
        mode: "radial",
        angle: angle, // 각도 저장 (라디안)
        angleInDegrees: angleInDegrees, // 각도 (도)
      },
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
        const connectedId = isSourceSwitch
          ? e.target
          : isTargetSwitch
          ? e.source
          : null;

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
    const switchAngle = switchNode.data?.angle || 0; // 스위치의 각도
    const pcRadius = 150 + connectedPCs.length * 5; // 동적 반지름
    const pcAngleStep = (2 * Math.PI) / Math.max(connectedPCs.length, 1);
    const startAngle = switchAngle - Math.PI / 2; // 스위치 각도를 기준으로 배치

    connectedPCs.forEach((pc, idx) => {
      const angle = startAngle + idx * pcAngleStep;
      const switchCenterX = switchPos.x + NODE_WIDTH / 2;
      const switchCenterY = switchPos.y + NODE_HEIGHT / 2;

      const px = switchCenterX + Math.cos(angle) * pcRadius;
      const py = switchCenterY + Math.sin(angle) * pcRadius;
      const pcAngleInDegrees = (angle * 180) / Math.PI;

      // PC의 각도에 따른 Handle 위치 계산
      const handlePositions = getHandlePositionsByAngle(pcAngleInDegrees);

      positionedNodesMap.set(pc.id, {
        ...pc,
        position: {
          x: px - NODE_WIDTH / 2,
          y: py - NODE_HEIGHT / 2,
        },
        sourcePosition: handlePositions.source,
        targetPosition: handlePositions.target,
        data: {
          ...pc.data,
          mode: "radial",
          angle: angle,
          angleInDegrees: pcAngleInDegrees,
        },
      });

      pcSet.add(pc.id);
    });
  });

  // 4. 위치가 계산되지 않은 노드들 처리 (고아 노드)
  inputNodes.forEach((node) => {
    if (!positionedNodesMap.has(node.id)) {
      console.warn(
        `⚠️ 노드 ${node.id} (${node.data?.label})의 위치가 계산되지 않았습니다. 기본 위치 할당.`
      );

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
        data: {
          ...node.data,
          mode: "radial",
          angleInDegrees: 0,
        },
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

  console.log(
    `📊 Radial 레이아웃 결과: ${finalNodes.length}개 노드, ${finalEdges.length}개 엣지`
  );

  return { nodes: finalNodes, edges: finalEdges };
}
