// 📁 client/src/utils/nodeCenterCalculator.ts - 🚀 성능 최적화 버전

import type { Node, Edge } from "react-flow-renderer";

// ==========================================
// 📋 타입 정의
// ==========================================

interface NodeCenterInfo {
  nodeId: string;
  centerX: number;
  centerY: number;
  connectedNodeIds: string[];
  originalPosition: { x: number; y: number };
}

// 🚀 성능 캐시
const calculationCache = new Map<string, NodeCenterInfo>();
const edgeIndexCache = new Map<string, Edge[]>();
let lastEdgesHash = '';

// ==========================================
// 🧮 최적화된 핵심 로직
// ==========================================

/**
 * 🚀 엣지 인덱스 생성 및 캐싱
 * O(n²) → O(n) 변환의 핵심
 */
function buildEdgeIndex(edges: Edge[]): Map<string, Edge[]> {
  // 엣지 배열이 변경되었는지 체크 (간단한 해시)
  const edgesHash = `${edges.length}-${edges[0]?.id || ''}-${edges[edges.length - 1]?.id || ''}`;
  
  if (edgesHash === lastEdgesHash && edgeIndexCache.size > 0) {
    return edgeIndexCache; // 캐시된 결과 사용
  }

  // 새로운 인덱스 생성
  edgeIndexCache.clear();
  
  edges.forEach(edge => {
    // source 노드 인덱스
    if (!edgeIndexCache.has(edge.source)) {
      edgeIndexCache.set(edge.source, []);
    }
    edgeIndexCache.get(edge.source)!.push(edge);
    
    // target 노드 인덱스  
    if (!edgeIndexCache.has(edge.target)) {
      edgeIndexCache.set(edge.target, []);
    }
    edgeIndexCache.get(edge.target)!.push(edge);
  });

  lastEdgesHash = edgesHash;
  return edgeIndexCache;
}

/**
 * 🚀 노드 맵 생성 및 캐싱
 */
function buildNodeMap(nodes: Node[]): Map<string, Node> {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(node => {
    nodeMap.set(node.id, node);
  });
  return nodeMap;
}

/**
 * 🚀 최적화된 중심점 계산
 * 로깅 제거 + 인덱스 사용으로 성능 대폭 향상
 */
function calculateNodeCenterOptimized(
  targetNodeId: string,
  nodeMap: Map<string, Node>,
  edgeIndex: Map<string, Edge[]>
): NodeCenterInfo | null {
  // 캐시 확인
  if (calculationCache.has(targetNodeId)) {
    return calculationCache.get(targetNodeId)!;
  }

  const targetNode = nodeMap.get(targetNodeId);
  if (!targetNode?.position) return null;

  // 🚀 인덱스에서 연결된 엣지들 즉시 조회 (O(1))
  const connectedEdges = edgeIndex.get(targetNodeId) || [];
  if (connectedEdges.length === 0) return null;

  // 🚀 연결된 노드 위치 수집 (최적화됨)
  const connectedPositions: { x: number; y: number; nodeId: string }[] = [];
  
  for (const edge of connectedEdges) {
    const connectedNodeId = edge.source === targetNodeId ? edge.target : edge.source;
    const connectedNode = nodeMap.get(connectedNodeId);
    
    if (connectedNode?.position && 
        typeof connectedNode.position.x === 'number' && 
        typeof connectedNode.position.y === 'number' &&
        !isNaN(connectedNode.position.x) && 
        !isNaN(connectedNode.position.y)) {
      
      connectedPositions.push({
        x: connectedNode.position.x,
        y: connectedNode.position.y,
        nodeId: connectedNodeId,
      });
    }
  }

  if (connectedPositions.length === 0) return null;

  // 🚀 중심점 계산 (간단명료)
  const centerX = connectedPositions.reduce((sum, pos) => sum + pos.x, 0) / connectedPositions.length;
  const centerY = connectedPositions.reduce((sum, pos) => sum + pos.y, 0) / connectedPositions.length;

  if (isNaN(centerX) || isNaN(centerY)) return null;

  const centerInfo: NodeCenterInfo = {
    nodeId: targetNodeId,
    centerX: Math.round(centerX),
    centerY: Math.round(centerY),
    connectedNodeIds: connectedPositions.map(pos => pos.nodeId),
    originalPosition: { ...targetNode.position },
  };

  // 캐시에 저장
  calculationCache.set(targetNodeId, centerInfo);
  return centerInfo;
}

// ==========================================
// 🎯 메인 처리 함수들 (최적화)
// ==========================================

/**
 * 🚀 중심 노드들의 중심점 일괄 계산 (최적화 버전)
 */
export function calculateCentralNodesCenters(
  nodes: Node[],
  edges: Edge[]
): Map<string, NodeCenterInfo> {
  // 개발 환경에서만 로깅
  const isDebug = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  if (isDebug) console.log("🔄 중심점 계산 시작 (최적화 버전)");

  // 🚀 인덱스 생성 (한 번만)
  const edgeIndex = buildEdgeIndex(edges);
  const nodeMap = buildNodeMap(nodes);
  
  const centersMap = new Map<string, NodeCenterInfo>();

  // 🎯 중심 노드들만 필터링
  const centralNodes = nodes.filter(node => {
    const nodeType = node.data?.type?.toLowerCase();
    return nodeType === "server" || nodeType === "switch";
  });

  // 🚀 병렬 처리 가능한 구조로 계산
  for (const node of centralNodes) {
    const centerInfo = calculateNodeCenterOptimized(node.id, nodeMap, edgeIndex);
    if (centerInfo) {
      centersMap.set(node.id, centerInfo);
    }
  }

  if (isDebug) {
    console.log(`🎯 중심점 계산 완료: ${centersMap.size}/${centralNodes.length}개 노드`);
  }

  return centersMap;
}

/**
 * 🚀 노드 위치 업데이트 (최적화 버전)
 */
export function updateNodesWithCenters(
  nodes: Node[],
  centerInfoMap: Map<string, NodeCenterInfo>
): Node[] {
  if (centerInfoMap.size === 0) return nodes;

  // 🎯 노드 크기 정의 (상수화)
  const NODE_SIZES = {
    server: { width: 58, height: 80 },
    switch: { width: 48, height: 72 },
    router: { width: 48, height: 72 },
    pc: { width: 48, height: 72 },
  } as const;

  let updatedCount = 0;

  const updatedNodes = nodes.map(node => {
    const centerInfo = centerInfoMap.get(node.id);
    
    if (!centerInfo) return node; // 빠른 리턴

    updatedCount++;

    // 🚀 타입별 크기 조회 (최적화)
    const nodeType = (node.data?.type?.toLowerCase() || 'pc') as keyof typeof NODE_SIZES;
    const nodeSize = NODE_SIZES[nodeType] || NODE_SIZES.pc;

    // 🧮 중심점을 좌상단 좌표로 변환
    const adjustedX = centerInfo.centerX - nodeSize.width / 2;
    const adjustedY = centerInfo.centerY - nodeSize.height / 2;

    return {
      ...node,
      position: {
        x: adjustedX,
        y: adjustedY,
      },
      data: {
        ...node.data,
        centerAligned: true,
        originalPosition: centerInfo.originalPosition,
        calculatedCenter: {
          x: centerInfo.centerX,
          y: centerInfo.centerY,
        },
        connectedNodes: centerInfo.connectedNodeIds.length,
      },
    };
  });

  // 개발 환경에서만 로깅
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log(`✅ 노드 위치 업데이트: ${updatedCount}개 이동`);
  }

  return updatedNodes;
}

// ==========================================
// 🚀 통합 메인 함수 (최적화)
// ==========================================

/**
 * 🚀 노드 중심점 계산 및 정렬 통합 처리 (최적화 버전)
 */
export function alignNodesToCalculatedCenters(
  layoutedNodes: Node[],
  layoutedEdges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  // 개발 환경에서만 성능 측정
  const isDebug = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const startTime = isDebug ? performance.now() : 0;

  // 🧮 중심점 계산
  const centerInfoMap = calculateCentralNodesCenters(layoutedNodes, layoutedEdges);

  if (centerInfoMap.size === 0) {
    if (isDebug) console.warn("⚠️ 계산된 중심점이 없음");
    return { nodes: layoutedNodes, edges: layoutedEdges };
  }

  // 🎯 노드 위치 업데이트
  const alignedNodes = updateNodesWithCenters(layoutedNodes, centerInfoMap);

  // 성능 측정 결과
  if (isDebug) {
    const endTime = performance.now();
    console.log(`🚀 중심점 정렬 완료: ${Math.round(endTime - startTime)}ms`);
  }

  return {
    nodes: alignedNodes,
    edges: layoutedEdges,
  };
}

// 🚀 캐시 클리어 함수 (필요시 사용)
export function clearCalculationCache(): void {
  calculationCache.clear();
  edgeIndexCache.clear();
  lastEdgesHash = '';
}