// 📁 client/src/utils/nodeCenterCalculator.ts

import type { Node, Edge } from "react-flow-renderer";

/**
 * Node Center Calculator
 *
 * 네트워크 노드들의 최적 중심점을 계산하여
 * 연결선들이 시각적으로 정확한 위치에서 만나도록 보정하는 유틸리티
 *
 * 🎯 핵심 기능:
 * - 서버/스위치 노드의 실제 연결 중심점 계산
 * - 연결된 노드들의 무게중심 기반 위치 보정
 * - 시각적 일관성을 위한 노드 정렬
 *
 * @author Network Visualization Team
 * @version 1.0.0
 */

// ==========================================
// 📋 타입 정의
// ==========================================

/**
 * 노드의 계산된 중심점 정보를 담는 인터페이스
 */
interface NodeCenterInfo {
  /** 노드 ID */
  nodeId: string;
  /** 계산된 중심점 X 좌표 */
  centerX: number;
  /** 계산된 중심점 Y 좌표 */
  centerY: number;
  /** 연결된 다른 노드들의 ID 목록 */
  connectedNodeIds: string[];
  /** 원본 위치 (디버깅용) */
  originalPosition: { x: number; y: number };
}

// ==========================================
// 🧮 중심점 계산 핵심 로직
// ==========================================

/**
 * 특정 노드의 연결 중심점 계산
 *
 * 해당 노드와 연결된 모든 노드들의 위치를 분석하여
 * 가장 자연스러운 중심점을 계산합니다.
 *
 * 🧮 계산 방식:
 * 1. 연결된 모든 노드의 위치 수집
 * 2. 무게중심(centroid) 계산
 * 3. 시각적 최적화를 위한 미세 조정
 *
 * @param targetNodeId - 중심점을 계산할 노드 ID
 * @param nodes - 전체 노드 배열
 * @param edges - 전체 연결선 배열
 * @returns 계산된 중심점 정보 (연결이 없으면 null)
 */

function calculateNodeCenter(
  targetNodeId: string,
  nodes: Node[],
  edges: Edge[]
): NodeCenterInfo | null {
  console.log(`🔍 === ${targetNodeId} 중심점 계산 시작 ===`);

  // 🔍 1단계: 대상 노드 정보 조회
  const targetNode = nodes.find((n) => n.id === targetNodeId);
  if (!targetNode || !targetNode.position) {
    console.error(
      `❌ 노드 ${targetNodeId}를 찾을 수 없거나 position이 없습니다.`
    );
    console.log(
      "사용 가능한 노드 ID들:",
      nodes.map((n) => n.id)
    );
    return null;
  }

  console.log(`📍 대상 노드 원본 위치:`, targetNode.position);

  // 🔗 2단계: 연결된 엣지들 찾기
  const connectedEdges = edges.filter(
    (edge) => edge.source === targetNodeId || edge.target === targetNodeId
  );

  console.log(`🔗 연결된 엣지 수: ${connectedEdges.length}`);

  if (connectedEdges.length === 0) {
    console.warn(`⚠️ 노드 ${targetNodeId}에 연결된 엣지가 없습니다.`);
    return null;
  }

  // 📍 3단계: 연결된 노드들의 위치 수집 (강화된 디버깅)
  const connectedPositions: { x: number; y: number; nodeId: string }[] = [];

  connectedEdges.forEach((edge, index) => {
    const connectedNodeId =
      edge.source === targetNodeId ? edge.target : edge.source;
    const connectedNode = nodes.find((n) => n.id === connectedNodeId);

    console.log(`  🔗 [${index + 1}] 엣지: ${edge.source} → ${edge.target}`);
    console.log(`      연결된 노드 ID: ${connectedNodeId}`);

    if (connectedNode && connectedNode.position) {
      console.log(
        `      위치: (${connectedNode.position.x}, ${connectedNode.position.y})`
      );

      // 🚨 위치 값 검증
      if (
        typeof connectedNode.position.x !== "number" ||
        typeof connectedNode.position.y !== "number"
      ) {
        console.error(
          `❌ 노드 ${connectedNodeId}의 위치가 숫자가 아닙니다:`,
          connectedNode.position
        );
        return;
      }

      if (isNaN(connectedNode.position.x) || isNaN(connectedNode.position.y)) {
        console.error(
          `❌ 노드 ${connectedNodeId}의 위치가 NaN입니다:`,
          connectedNode.position
        );
        return;
      }

      connectedPositions.push({
        x: connectedNode.position.x,
        y: connectedNode.position.y,
        nodeId: connectedNodeId,
      });
    } else {
      console.error(
        `❌ 연결된 노드 ${connectedNodeId}를 찾을 수 없거나 position이 없습니다.`
      );
      if (connectedNode) {
        console.log(`      노드 데이터:`, connectedNode);
      }
    }
  });

  console.log(`📊 유효한 연결 위치 수: ${connectedPositions.length}`);

  if (connectedPositions.length === 0) {
    console.error(`❌ 유효한 연결된 노드 위치가 없습니다.`);
    return null;
  }

  // 🧮 4단계: 무게중심 계산 (상세 로깅)
  console.log(`🧮 중심점 계산 중...`);

  const sumX = connectedPositions.reduce((sum, pos) => {
    console.log(`  X: ${sum} + ${pos.x} = ${sum + pos.x}`);
    return sum + pos.x;
  }, 0);

  const sumY = connectedPositions.reduce((sum, pos) => {
    console.log(`  Y: ${sum} + ${pos.y} = ${sum + pos.y}`);
    return sum + pos.y;
  }, 0);

  const centerX = sumX / connectedPositions.length;
  const centerY = sumY / connectedPositions.length;

  console.log(`🧮 계산 결과:`);
  console.log(
    `  sumX: ${sumX}, count: ${connectedPositions.length}, centerX: ${centerX}`
  );
  console.log(
    `  sumY: ${sumY}, count: ${connectedPositions.length}, centerY: ${centerY}`
  );

  // 🚨 계산 결과 검증
  if (isNaN(centerX) || isNaN(centerY)) {
    console.error(`❌ 계산된 중심점이 NaN입니다: (${centerX}, ${centerY})`);
    return null;
  }

  // 📊 5단계: 결과 정보 구성
  const centerInfo: NodeCenterInfo = {
    nodeId: targetNodeId,
    centerX: Math.round(centerX),
    centerY: Math.round(centerY),
    connectedNodeIds: connectedPositions.map((pos) => pos.nodeId),
    originalPosition: { ...targetNode.position },
  };

  console.log(`✅ ${targetNode.data?.label || targetNodeId} 중심점 계산 완료:`);
  console.log(`   원본: (${targetNode.position.x}, ${targetNode.position.y})`);
  console.log(`   계산: (${centerInfo.centerX}, ${centerInfo.centerY})`);
  console.log(`   연결: ${connectedPositions.length}개 노드`);

  return centerInfo;
}

// ==========================================
// 🎯 메인 처리 함수들
// ==========================================

/**
 * 중심 역할을 하는 노드들의 중심점 일괄 계산
 *
 * 서버와 스위치 노드들을 대상으로 각각의 최적 중심점을 계산합니다.
 * 일반 PC 노드들은 제외하여 성능을 최적화합니다.
 *
 * @param nodes - 전체 노드 배열
 * @param edges - 전체 연결선 배열
 * @returns 노드 ID를 키로 하는 중심점 정보 맵
 */
export function calculateCentralNodesCenters(
  nodes: Node[],
  edges: Edge[]
): Map<string, NodeCenterInfo> {
  console.log("🔄 중심 노드들의 중심점 계산 시작...");

  const centersMap = new Map<string, NodeCenterInfo>();

  // 🎯 중심 역할을 하는 노드들만 필터링
  const centralNodes = nodes.filter((node) => {
    const nodeType = node.data?.type?.toLowerCase();
    return nodeType === "server" || nodeType === "switch";
  });

  console.log(`📊 대상 노드: ${centralNodes.length}개 (서버/스위치)`);

  // 🧮 각 중심 노드별로 중심점 계산
  centralNodes.forEach((node, index) => {
    const centerInfo = calculateNodeCenter(node.id, nodes, edges);

    if (centerInfo) {
      centersMap.set(node.id, centerInfo);
      console.log(
        `✅ [${index + 1}/${centralNodes.length}] ${node.data?.label} 계산 완료`
      );
    } else {
      console.log(
        `⏭️ [${index + 1}/${centralNodes.length}] ${node.data?.label} 스킵됨`
      );
    }
  });

  console.log(`🎯 중심점 계산 완료: ${centersMap.size}개 노드 처리됨`);
  return centersMap;
}

/**
 * 계산된 중심점으로 노드 위치 업데이트
 *
 * 계산된 중심점 정보를 바탕으로 실제 노드 객체들의 위치를 업데이트합니다.
 * 중심점이 계산되지 않은 노드들은 원래 위치를 유지합니다.
 *
 * @param nodes - 업데이트할 노드 배열
 * @param centerInfoMap - 계산된 중심점 정보 맵
 * @returns 위치가 업데이트된 새로운 노드 배열
 */

// updateNodesWithCenters 함수 수정

export function updateNodesWithCenters(
  nodes: Node[],
  centerInfoMap: Map<string, NodeCenterInfo>
): Node[] {
  console.log("🔄 노드 위치 업데이트 시작...");

  let updatedCount = 0;

  // 🎯 노드 크기 정의 (React Flow 렌더링용)
  const NODE_SIZES = {
    server: { width: 58, height: 80 }, // 180x60 → 58x80
    switch: { width: 48, height: 72 }, // 180x60 → 48x72
    router: { width: 48, height: 72 },
    pc: { width: 48, height: 72 },
  };

  const updatedNodes = nodes.map((node) => {
    const centerInfo = centerInfoMap.get(node.id);

    if (centerInfo) {
      updatedCount++;

      // 🎯 노드 타입별 크기 조회
      const nodeType = node.data?.type?.toLowerCase() || "pc";
      const nodeSize =
        NODE_SIZES[nodeType as keyof typeof NODE_SIZES] || NODE_SIZES.pc;

      // 🧮 중심점을 좌상단 좌표로 변환
      const adjustedX = centerInfo.centerX - nodeSize.width / 2;
      const adjustedY = centerInfo.centerY - nodeSize.height / 2;

      console.log(`🎯 ${node.data?.label} 위치 보정:`);
      console.log(`   중심점: (${centerInfo.centerX}, ${centerInfo.centerY})`);
      console.log(`   노드크기: ${nodeSize.width}x${nodeSize.height}`);
      console.log(`   최종위치: (${adjustedX}, ${adjustedY})`);

      return {
        ...node,
        position: {
          x: adjustedX,
          y: adjustedY,
        },
        data: {
          ...node.data,
          // 메타데이터 추가
          centerAligned: true,
          originalPosition: centerInfo.originalPosition,
          calculatedCenter: {
            x: centerInfo.centerX,
            y: centerInfo.centerY,
          },
          adjustedPosition: {
            x: adjustedX,
            y: adjustedY,
          },
          connectedNodes: centerInfo.connectedNodeIds.length,
        },
      };
    }

    // 중심점이 계산되지 않은 노드는 원래 위치 유지
    return node;
  });

  console.log(`✅ 노드 위치 업데이트 완료: ${updatedCount}개 노드 이동됨`);
  return updatedNodes;
}

// ==========================================
// 🚀 통합 메인 함수
// ==========================================

/**
 * 노드 중심점 계산 및 정렬 통합 처리 함수
 *
 * 레이아웃이 계산된 노드/엣지를 받아서 중심 노드들을
 * 실제 연결선들이 만나는 지점으로 이동시킵니다.
 *
 * 🔄 처리 흐름:
 * 1. 중심 노드들의 최적 중심점 계산
 * 2. 계산된 중심점으로 노드 위치 업데이트
 * 3. 업데이트된 노드/엣지 반환
 *
 * @param layoutedNodes - 레이아웃이 적용된 노드 배열
 * @param layoutedEdges - 레이아웃이 적용된 엣지 배열
 * @returns 중심점으로 정렬된 최종 노드/엣지 객체
 *
 * @example
 * ```typescript
 * const basicLayout = getNewRadialLayoutedElements(nodes, edges);
 * const finalLayout = alignNodesToCalculatedCenters(
 *   basicLayout.nodes,
 *   basicLayout.edges
 * );
 * ```
 */
export function alignNodesToCalculatedCenters(
  layoutedNodes: Node[],
  layoutedEdges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  console.log("🎯 === 노드 중심점 정렬 프로세스 시작 ===");
  console.log(
    `📊 입력: 노드 ${layoutedNodes.length}개, 엣지 ${layoutedEdges.length}개`
  );

  // 🧮 1단계: 중심점 계산
  const centerInfoMap = calculateCentralNodesCenters(
    layoutedNodes,
    layoutedEdges
  );

  if (centerInfoMap.size === 0) {
    console.warn("⚠️ 계산된 중심점이 없습니다. 원본 레이아웃을 반환합니다.");
    return { nodes: layoutedNodes, edges: layoutedEdges };
  }

  // 🎯 2단계: 노드 위치 업데이트
  const alignedNodes = updateNodesWithCenters(layoutedNodes, centerInfoMap);

  // 📊 3단계: 결과 검증 및 로깅
  const movedNodes = alignedNodes.filter((n) => n.data?.centerAligned);
  console.log(`🎯 === 노드 중심점 정렬 완료 ===`);
  console.log(`📈 결과: ${movedNodes.length}개 노드 중심점으로 이동됨`);

  // 🔍 상세 결과 로깅 (디버깅용)
  movedNodes.forEach((node) => {
    const original = node.data?.originalPosition;
    const current = node.position;
    const distance = Math.sqrt(
      Math.pow(current.x - original.x, 2) + Math.pow(current.y - original.y, 2)
    );
    console.log(`📍 ${node.data?.label}: 이동거리 ${Math.round(distance)}px`);
  });

  return {
    nodes: alignedNodes,
    edges: layoutedEdges, // 엣지는 변경하지 않음
  };
}
