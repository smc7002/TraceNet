//  client/src/utils/layout.ts

import { Position } from "react-flow-renderer";
import type { Node, Edge } from "react-flow-renderer";
import dagre from "dagre";

/**
 * TraceNet Layout Engine
 * 
 * 제조업 환경 네트워크 인프라 시각화를 위한 레이아웃 관리 시스템
 * 
 * 주요 기능:
 * - 서버-스위치-PC 구조의 방사형 클러스터 배치
 * - 계층형(Dagre) 레이아웃 지원 (현재 사용 보류중)
 * - 동적 반지름 조정으로 노드 밀도 최적화
 * - 연결선 교차 최소화를 위한 Handle 위치 자동 최적화
 * 
 * 사용 예시:
 * - 200-300대 규모의 장비 네트워크 관리
 * - "A구역 PC 문제" 발생 시 해당 스위치 클러스터 즉시 식별
 * - 케이블 추적 시 물리적 연결 경로 시각적 확인
 */

// ==========================================
// 설정 및 열거형
// ==========================================

/**
 * 레이아웃 모드
 * 
 * Dagre: 계층형 구조 (복잡한 연결관계 정리용)
 * Radial: 단순 방사형 (현재 미사용)
 * NewRadial: 스위치 클러스터형 방사형 (권장, 현재 메인 사용)
 */
export enum LayoutMode {
  Dagre = "dagre",
  Radial = "radial", 
  NewRadial = "new-radial", // 메인 레이아웃
}

// ==========================================
// 유틸리티 함수들
// ==========================================

/**
 * 노드 연결선 방향 최적화 함수
 * 
 * 목적: 8방향 섹터로 나누어 연결선이 겹치지 않게 Handle 위치 결정
 * 
 * 작동 방식:
 * 1. 입력된 각도를 0-360도로 정규화
 * 2. 45도씩 8개 섹터로 구분
 * 3. 각 섹터에 맞는 최적의 source/target Handle 위치 반환
 * 
 * 예시: 45도 각도 → 우하향 → source: Top, target: Bottom
 * 
 * @param angleInDegrees 노드의 각도 (도 단위)
 * @returns source와 target의 최적 Handle 위치
 */
function getHandlePositionsByAngle(angleInDegrees: number): {
  source: Position;
  target: Position;
} {
  // 음수나 360도 넘는 각도를 0-360도 범위로 정규화
  const normalizedAngle = ((angleInDegrees % 360) + 360) % 360;

  // 8방향 섹터별 Handle 위치 매핑
  // 각 섹터는 45도씩 할당 (360도 ÷ 8 = 45도)
  
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) {
    // 3시 방향 (0도): 수평 우향
    return { source: Position.Left, target: Position.Right };
  } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
    // 1-2시 방향 (45도): 우하 대각선
    return { source: Position.Top, target: Position.Bottom };
  } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
    // 6시 방향 (90도): 수직 하향
    return { source: Position.Top, target: Position.Bottom };
  } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
    // 7-8시 방향 (135도): 좌하 대각선
    return { source: Position.Top, target: Position.Bottom };
  } else if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
    // 9시 방향 (180도): 수평 좌향
    return { source: Position.Right, target: Position.Left };
  } else if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
    // 10-11시 방향 (225도): 좌상 대각선
    return { source: Position.Bottom, target: Position.Top };
  } else if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
    // 12시 방향 (270도): 수직 상향
    return { source: Position.Bottom, target: Position.Top };
  } else {
    // 1-2시 방향 (315도): 우상 대각선
    return { source: Position.Bottom, target: Position.Top };
  }
}

/**
 * 동적 반지름 계산 설정
 * 
 * 설정값들의 의미:
 * - base: 기본 반지름 (노드가 적을 때 기준)
 * - targetSpacing: 인접한 노드 간 목표 거리 (호의 길이)
 * - min/max: 반지름 최소/최대 제한값
 * - growth: 노드 수 증가에 따른 추가 확장값
 * - pad: 여유 공간
 */
type RingConfig = {
  base?: number;        // 기본 반지름
  targetSpacing?: number; // 노드 간 목표 간격
  min?: number;         // 최소 반지름
  max?: number;         // 최대 반지름  
  growth?: number;      // 선형 증가 계수
  pad?: number;         // 패딩
};

/**
 * 노드 개수에 따른 최적 반지름 계산
 * 
 * 계산 로직:
 * 1. 길이 기반 계산: 노드 간 간격을 보장하는 최소 반지름
 * 2. 선형 증가 계산: 노드 수에 비례한 반지름 증가
 * 3. 둘 중 큰 값을 사용하되 min/max 범위 내에서 제한
 * 
 * 예시: 스위치 15개 → 약 900px 반지름으로 자동 계산
 * 
 * @param count 배치할 노드 개수
 * @param cfg 반지름 계산 설정 (옵션)
 * @returns 계산된 최적 반지름 (px)
 */
function ringRadius(count: number, cfg: RingConfig = {}): number {
  const k = Math.max(1, count);
  const base = cfg.base ?? 600;
  const spacing = cfg.targetSpacing ?? 160;
  const min = cfg.min ?? 420;
  const max = cfg.max ?? 1400;
  const growth = cfg.growth ?? 6;
  const pad = cfg.pad ?? 0;

  // 방법 1: 호의 길이를 기반으로 필요한 반지름 계산
  // 공식: 반지름 = (목표간격 × 노드수) / (2π) + 패딩
  const rBySpacing = (spacing * k) / (2 * Math.PI) + pad;
  
  // 방법 2: 노드 수에 따른 선형 증가 반지름
  // 노드가 한쪽에 몰려도 적당한 공간 확보
  const rByLinear = base + growth * (k - 1);

  // 두 계산값 중 큰 값을 사용하여 충분한 공간 보장
  const r = Math.max(min, Math.max(rBySpacing, rByLinear));
  return Math.min(max, Math.round(r));
}

// ==========================================
// Dagre 계층형 레이아웃 (현재 사용 보류중)
// ==========================================

/**
 * Dagre 알고리즘 기반 계층형 레이아웃
 * 
 * 사용 시기: 복잡한 네트워크에서 연결 관계를 체계적으로 정리할 때
 * 
 * 특징:
 * - 좌→우 방향으로 계층 구조 배치
 * - 서버 → 스위치 → PC 순서로 단계별 정렬
 * - 연결선 교차 최소화 자동 처리
 * 
 * 설정값:
 * - rankdir: "LR" (Left to Right, 좌→우 배치)
 * - nodesep: 80px (같은 레벨 노드 간 간격)
 * - ranksep: 100px (계층 간 거리)
 * - 노드 크기: 180×60px (고정)
 * 
 * @param nodes 배치할 노드 배열
 * @param edges 연결 관계 배열
 * @returns 계층형으로 배치된 노드와 엣지
 */
export function getDagreLayoutedElements(nodes: Node[], edges: Edge[]) {
  // Dagre 그래프 엔진 초기화
  const dagreGraph = new dagre.graphlib.Graph();
  
  // 엣지 라벨 기본값 설정 (성능 최적화)
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 레이아웃 파라미터 설정
  dagreGraph.setGraph({
    rankdir: "LR",    // 좌→우 방향 배치
    nodesep: 80,      // 동일 레벨 노드 간격
    ranksep: 100,     // 계층 간 거리
  });

  // 모든 노드를 고정 크기로 등록
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: 180,   // 장비명 + 상태 표시용 최적 폭
      height: 60,   // 아이콘 + 텍스트용 최적 높이
    });
  });

  // 연결 관계 등록
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Dagre 레이아웃 알고리즘 실행
  dagre.layout(dagreGraph);

  // React Flow 형식으로 결과 변환
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      position: {
        // Dagre는 중심점 기준이므로 좌상단 기준으로 변환
        x: nodeWithPosition.x - 90,  // 폭의 절반만큼 좌측으로
        y: nodeWithPosition.y - 30,  // 높이의 절반만큼 위로
      },
      sourcePosition: Position.Right,  // 출력: 우측
      targetPosition: Position.Left,   // 입력: 좌측
      data: { ...node.data, mode: "dagre" },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ==========================================
// 방사형 클러스터 레이아웃 (메인)
// ==========================================

/**
 * 방사형 클러스터 레이아웃 - TraceNet의 핵심 레이아웃
 * 
 * 구조 설계:
 * 1. 서버를 중앙(800, 500)에 배치
 * 2. 스위치들을 서버 중심 원형으로 배치 (반지름 자동 계산)
 * 3. 각 스위치 주변에 연결된 PC들을 클러스터로 배치
 * 
 * 실무 활용:
 * - "3층 A구역 인터넷 문제" → 해당 스위치 클러스터에서 문제 PC 즉시 식별
 * - 케이블 추적 시 물리적 연결 경로 시각화
 * - 스위치별 관리 단위로 그룹화되어 유지보수 효율성 극대화
 * 
 * 핵심 알고리즘:
 * - 동적 반지름: 노드 수에 따라 자동 조정
 * - 클러스터링: 스위치별 PC 그룹화
 * - Handle 최적화: 연결선 교차 최소화
 * 
 * @param inputNodes 배치할 노드 배열
 * @param inputEdges 연결 관계 배열  
 * @returns 방사형 클러스터로 배치된 노드와 엣지
 */
export function getNewRadialLayoutedElements(
  inputNodes: Node[],
  inputEdges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  
  // ============ 기본 설정 ============
  const center = { x: 800, y: 500 };  // 캔버스 중심점
  const NODE_WIDTH = 180;             // 노드 표준 폭
  const NODE_HEIGHT = 60;             // 노드 표준 높이

  // ============ 노드 타입별 분류 ============
  const server = inputNodes.find((n) => n.data?.type === "server");
  const switches = inputNodes.filter((n) => n.data?.type === "switch");
  const pcs = inputNodes.filter((n) => n.data?.type === "pc");

  // 서버가 없으면 원본 그대로 반환
  if (!server) {
    console.warn("서버 노드가 없어 방사형 레이아웃을 적용할 수 없습니다.");
    return { nodes: inputNodes, edges: inputEdges };
  }

  // 위치 계산 결과 저장용 Map
  const positionedNodesMap = new Map<string, Node>();

  // ============ 1단계: 서버 중앙 배치 ============
  positionedNodesMap.set(server.id, {
    ...server,
    position: {
      x: center.x - NODE_WIDTH / 2,   // 중앙 정렬
      y: center.y - NODE_HEIGHT / 2,  // 중앙 정렬
    },
    sourcePosition: Position.Bottom,   // 스위치로 향하는 출력
    targetPosition: Position.Top,      // 상향 입력
    data: {
      ...server.data,
      mode: "radial",
      angleInDegrees: 0,              // 중심점이므로 각도 0
      centerAligned: true,            // 중심 배치 플래그
    },
  });

  // ============ 2단계: 스위치 원형 배치 ============
  
  // 스위치 개수에 따른 최적 반지름 계산
  const switchRadius = ringRadius(switches.length, {
    base: 820,          // 기본 반지름 (스위치 적을 때)
    targetSpacing: 220, // 스위치 간 목표 간격
    min: 600,           // 최소 반지름
    max: 1800,          // 최대 반지름
    growth: 12,         // 개수당 추가 확장
    pad: 120,           // 여유 공간
  });
  
  // 스위치 간 각도 간격 (라디안)
  const switchAngleStep = (2 * Math.PI) / Math.max(switches.length, 1);

  switches.forEach((sw, index) => {
    // 극좌표 → 직교좌표 변환
    const angle = index * switchAngleStep;  // 현재 스위치 각도
    const x = center.x + Math.cos(angle) * switchRadius;
    const y = center.y + Math.sin(angle) * switchRadius;
    const angleInDegrees = (angle * 180) / Math.PI;

    // 각도에 따른 최적 Handle 위치 계산
    const handlePositions = getHandlePositionsByAngle(angleInDegrees);

    positionedNodesMap.set(sw.id, {
      ...sw,
      position: {
        x: x - NODE_WIDTH / 2,   // 중심점 → 좌상단 변환
        y: y - NODE_HEIGHT / 2,
      },
      sourcePosition: handlePositions.source,  // 최적화된 출력 Handle
      targetPosition: handlePositions.target,  // 최적화된 입력 Handle
      data: {
        ...sw.data,
        mode: "radial",
        angle: angle,                          // 라디안 각도 (계산용)
        angleInDegrees: angleInDegrees,        // 도 단위 각도 (디버깅용)
      },
    });
  });

  // ============ 3단계: PC 클러스터 배치 ============
  
  const pcSet = new Set<string>(); // 배치 완료된 PC 추적

  switches.forEach((sw) => {
    // 현재 스위치에 연결된 PC 찾기
    const connectedPCs = inputEdges
      .filter((e) => {
        // 양방향 연결 확인 (source ↔ target)
        const isSourceSwitch = e.source === sw.id;
        const isTargetSwitch = e.target === sw.id;
        const connectedId = isSourceSwitch
          ? e.target
          : isTargetSwitch
          ? e.source
          : null;

        if (!connectedId) return false;

        // PC 타입 확인 + 중복 배치 방지
        const connectedPC = pcs.find((p) => p.id === connectedId);
        return connectedPC && !pcSet.has(connectedId);
      })
      .map((e) => {
        const pcId = e.source === sw.id ? e.target : e.source;
        return pcs.find((p) => p.id === pcId);
      })
      .filter((pc): pc is Node => pc !== undefined);

    // 스위치 위치 정보 가져오기
    const switchNode = positionedNodesMap.get(sw.id);
    if (!switchNode || !switchNode.position) return;

    // PC 클러스터 배치 계산
    const switchPos = switchNode.position;
    const switchAngle = switchNode.data?.angle || 0;        // 스위치 기준 각도
    const pcRadius = 150 + connectedPCs.length * 5;        // 동적 반지름 (PC 수 고려)
    const pcAngleStep = (2 * Math.PI) / Math.max(connectedPCs.length, 1); // PC 간 각도
    const startAngle = switchAngle - Math.PI / 2;          // 시작 각도 (90도 회전)

    // 각 PC를 스위치 중심으로 원형 배치
    connectedPCs.forEach((pc, idx) => {
      const angle = startAngle + idx * pcAngleStep;  // PC별 각도
      
      // 스위치 중심점 계산
      const switchCenterX = switchPos.x + NODE_WIDTH / 2;
      const switchCenterY = switchPos.y + NODE_HEIGHT / 2;

      // PC 위치 계산
      const px = switchCenterX + Math.cos(angle) * pcRadius;
      const py = switchCenterY + Math.sin(angle) * pcRadius;
      const pcAngleInDegrees = (angle * 180) / Math.PI;

      // PC Handle 위치 최적화
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

      // 배치 완료 표시
      pcSet.add(pc.id);
    });
  });

  // ============ 4단계: 고아 노드 처리 ============
  
  // 위치가 계산되지 않은 노드들을 기본 위치에 배치
  inputNodes.forEach((node) => {
    if (!positionedNodesMap.has(node.id)) {
      console.warn(
        `연결되지 않은 노드 발견: ${node.id} (${node.data?.label}) - 기본 위치에 배치`
      );

      // 타입별 기본 위치 설정
      let defaultX = 100;
      let defaultY = 100;

      if (node.data?.type === "pc") {
        // PC: 좌측 상단에 세로로 배치
        defaultX = 100;
        defaultY = 100 + (positionedNodesMap.size % 5) * 80;
      } else if (node.data?.type === "switch") {
        // 스위치: 우측 중앙에 배치
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

  // ============ 5단계: 최종 검증 및 결과 반환 ============
  
  // 계산된 위치값이 유효한지 검증
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
      console.error(`유효하지 않은 노드 위치: ${n.id}`, n.position);
    }

    return valid;
  });

  // 엣지에 커스텀 렌더러 및 메타데이터 추가
  const finalEdges = inputEdges.map((e) => ({
    ...e,
    type: "custom",     // 커스텀 엣지 렌더러 사용
    data: {
      ...e.data,
      mode: "radial",   // 레이아웃 모드 정보
    },
  }));

  // 배치 완료 로그
  console.log(
    `방사형 레이아웃 완료: ${finalNodes.length}개 노드, ${finalEdges.length}개 엣지`
  );
  console.log(
    `배치 통계 - 서버: 1개, 스위치: ${switches.length}개, PC: ${pcSet.size}개`
  );

  return { nodes: finalNodes, edges: finalEdges };
}

// ==========================================
// 레이아웃 설정 변경 가이드
// ==========================================

/**
 * 레이아웃 설정 변경 가이드
 * 
 * 1. 스위치 간격 조정:
 *    - switchRadius의 base값 변경 (현재: 820)
 *    - targetSpacing값 조정 (현재: 220)
 * 
 * 2. PC 클러스터 크기 조정:
 *    - pcRadius 계산식의 150 (기본값) 변경
 *    - connectedPCs.length * 5 (증가값) 조정
 * 
 * 3. 전체 레이아웃 크기 조정:
 *    - center 좌표 변경 (현재: {x: 800, y: 500})
 *    - NODE_WIDTH, NODE_HEIGHT 조정
 * 
 * 4. 새 레이아웃 모드 추가:
 *    - LayoutMode enum에 새 모드 추가
 *    - get[모드명]LayoutedElements 함수 구현
 *    - 메인 컴포넌트에서 케이스 추가
 * 
 * 주의사항:
 * - center 좌표 변경 시 캔버스 크기 고려
 * - 반지름 값 변경 시 화면 밖으로 노드가 벗어나지 않는지 확인
 * - Handle 위치 변경 시 연결선 렌더링 확인
 */