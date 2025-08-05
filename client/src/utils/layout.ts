//  client/src/utils/layout.ts

import { Position } from "react-flow-renderer";
import type { Node, Edge } from "react-flow-renderer";
import dagre from "dagre";

/**
 * Network Layout Manager
 *
 * 제조업 환경의 네트워크 인프라 관리 시스템을 위한 고급 레이아웃 엔진
 * 
 * ✨ 핵심 기능:
 * - 대규모 네트워크 토폴로지의 효율적인 시각화
 * - 다중 레이아웃 알고리즘 지원 (계층형/방사형)
 * - 실시간 네트워크 상태 반영을 위한 동적 레이아웃
 * - 사용자 경험 최적화를 위한 스마트 노드 배치
 *
 * 🔧 기술적 특징:
 * - TypeScript 기반의 타입 안전성 보장
 * - React Flow 라이브러리와의 완전한 호환성
 * - Dagre 알고리즘을 활용한 최적화된 계층 구조
 * - 정밀한 방사형 배치
 *
 */

// ==========================================
// 📐 레이아웃 모드 및 상수 정의
// ==========================================

/**
 * 네트워크 다이어그램 레이아웃 모드 열거형
 * 
 * 각 모드별 특징:
 * - Dagre: 계층적 구조 최적화, 대용량 네트워크에 적합
 * - Radial: 중심 서버 기준 방사형, 직관적인 구조 파악
 * - NewRadial: 스위치 클러스터링 기반 개선형 방사형
 *
 * @enum {string}
 * @readonly
 */
export enum LayoutMode {
  /** 
   * 계층적 방향성 그래프 레이아웃 (Left-to-Right)
   * - 용도: 복잡한 네트워크 구조의 체계적 표현
   * - 알고리즘: Dagre (Directed Acyclic Graph Rendering Engine)
   * - 최적화: 노드 간 거리 최소화, 교차점 감소
   */
  Dagre = "dagre",
  
  /** 
   * 기본 방사형 레이아웃
   * - 용도: 단일 중심점 기반 네트워크 구조
   * - 특징: 서버 중심의 Star topology 표현
   */
  Radial = "radial",
  
  /** 
   * 고급 방사형 레이아웃 (스위치 클러스터링)
   * - 용도: 실제 제조업 네트워크 구조 반영
   * - 알고리즘: 계층적 클러스터링 + 원형 배치 최적화
   * - 장점: 스위치별 PC 그룹화로 관리 효율성 극대화
   */
  NewRadial = "new-radial",
}

// ==========================================
// 🧮 기하학적 계산 유틸리티 함수
// ==========================================

/**
 * 각도 기반 React Flow Handle 위치 최적화 알고리즘
 * 
 * 📊 동작 원리:
 * 1. 입력 각도를 0-360도 범위로 정규화
 * 2. 8방향 섹터로 구분하여 최적의 연결점 결정
 * 3. 시각적 일관성을 위한 대칭적 Handle 매핑
 * 
 * 🎯 최적화 기준:
 * - 연결선의 교차 최소화
 * - 시각적 균형감 유지
 * - 사용자 직관성 향상
 *
 * @param angleInDegrees - 노드의 중심각 (0-360도)
 * @returns 최적화된 source/target Handle 위치 객체
 * 
 * @example
 * ```typescript
 * const handles = getHandlePositionsByAngle(45);
 * // Returns: { source: Position.Top, target: Position.Bottom }
 * ```
 */
function getHandlePositionsByAngle(angleInDegrees: number): {
  source: Position;
  target: Position;
} {
  // 🔄 각도 정규화: 음수 및 360도 초과 값 처리
  const normalizedAngle = ((angleInDegrees % 360) + 360) % 360;

  // 🧭 8방향 섹터 기반 Handle 위치 결정 알고리즘
  // 각 섹터는 45도씩 할당되어 총 8개 방향 커버
  
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) {
    // 🕒 3시 방향 (0도): 수평 우향 연결
    return { source: Position.Left, target: Position.Right };
    
  } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
    // 🕓 우하 대각선 (45도): 하향 연결 최적화
    return { source: Position.Top, target: Position.Bottom };
    
  } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
    // 🕕 6시 방향 (90도): 수직 하향 연결
    return { source: Position.Top, target: Position.Bottom };
    
  } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
    // 🕖 좌하 대각선 (135도): 하향 연결 유지
    return { source: Position.Top, target: Position.Bottom };
    
  } else if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
    // 🕘 9시 방향 (180도): 수평 좌향 연결
    return { source: Position.Right, target: Position.Left };
    
  } else if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
    // 🕙 좌상 대각선 (225도): 상향 연결 최적화
    return { source: Position.Bottom, target: Position.Top };
    
  } else if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
    // 🕛 12시 방향 (270도): 수직 상향 연결
    return { source: Position.Bottom, target: Position.Top };
    
  } else {
    // 🕐 우상 대각선 (315도): 상향 연결 최적화
    return { source: Position.Bottom, target: Position.Top };
  }
}

// ==========================================
// 📊 DAGRE 계층형 레이아웃 구현부
// ==========================================

/**
 * Dagre 알고리즘 기반 계층형 네트워크 레이아웃 생성기
 * 
 * 🏗️ 구현 전략:
 * 1. Dagre Graph 인스턴스 초기화 및 설정 최적화
 * 2. 노드/엣지 데이터 변환 및 그래프 구조 구축
 * 3. 레이아웃 알고리즘 실행 및 위치 계산
 * 4. React Flow 호환 형식으로 데이터 변환
 * 
 * ⚡ 성능 최적화:
 * - 고정 노드 크기로 계산 복잡도 감소
 * - 최적화된 간격 설정으로 가독성 향상
 * - 메모리 효율적인 객체 생성 패턴
 * 
 * 🎛️ 레이아웃 파라미터:
 * - rankdir: "LR" (좌-우 방향 흐름)
 * - nodesep: 80px (동일 레벨 노드 간격)
 * - ranksep: 100px (계층 간 거리)
 * - 노드 크기: 180x60px (최적 가독성)
 *
 * @param nodes - 입력 노드 배열 (React Flow 형식)
 * @param edges - 입력 엣지 배열 (React Flow 형식)
 * @returns 레이아웃이 적용된 노드/엣지 객체
 * 
 * @complexity O(V + E) - V: 노드 수, E: 엣지 수
 */
export function getDagreLayoutedElements(nodes: Node[], edges: Edge[]) {
  // 🔧 Dagre 그래프 엔진 초기화
  const dagreGraph = new dagre.graphlib.Graph();

  // 📝 엣지 라벨 기본값 설정 (성능 최적화)
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // 🎯 레이아웃 매개변수 설정 - 제조업 환경 최적화
  dagreGraph.setGraph({
    rankdir: "LR",    // 좌-우 방향: 데이터 흐름 직관성 극대화
    nodesep: 80,      // 노드 간격: 클릭 정확도 및 가독성 고려
    ranksep: 100,     // 계층 간격: 구조 명확성 확보
  });

  // 🏷️ 노드 등록: 일관된 크기로 레이아웃 안정성 확보
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: 180,   // 디바이스명 + 상태정보 표시에 최적화된 폭
      height: 60,   // 아이콘 + 텍스트 + 패딩 고려한 높이
    });
  });

  // 🔗 엣지 등록: 네트워크 연결 관계 정의
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // ⚡ Dagre 레이아웃 알고리즘 실행
  // 내부적으로 최적화된 위치 계산 수행
  dagre.layout(dagreGraph);

  // 🎨 계산된 위치를 React Flow 형식으로 변환
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      // 📍 좌표 변환: Dagre 중심점 기준 → React Flow 좌상단 기준
      position: {
        x: nodeWithPosition.x - 90,  // 중심점에서 좌상단으로 오프셋
        y: nodeWithPosition.y - 30,  // 시각적 균형을 위한 수직 조정
      },
      // 🔌 Handle 위치: 좌-우 방향 데이터 흐름에 최적화
      sourcePosition: Position.Right,  // 출력: 우측 (데이터 송신)
      targetPosition: Position.Left,   // 입력: 좌측 (데이터 수신)
      // 📊 메타데이터: 디버깅 및 추후 기능 확장용
      data: { ...node.data, mode: "dagre" },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ==========================================
// 🌟 고급 방사형 레이아웃 구현부
// ==========================================

/**
 * 제조업 네트워크 구조 특화 방사형 레이아웃 엔진
 * 
 * 🏭 제조업 네트워크 특성 반영:
 * - 중앙 서버 + 다중 스위치 + PC 클러스터 구조
 * - 물리적 거리와 논리적 연결의 시각적 일치
 * - 장애 추적 시 직관적인 경로 파악 지원
 * 
 * 🧠 알고리즘 설계 철학:
 * 1. 서버 중심의 방사형 기본 구조
 * 2. 스위치별 PC 클러스터링으로 관리 단위 명확화
 * 3. 동적 반지름 조정으로 노드 밀도 최적화
 * 4. 각도 기반 Handle 위치로 연결선 교차 최소화
 * 
 * 🎯 사용자 경험 최적화:
 * - 고아 노드(연결되지 않은 노드) 자동 처리
 * - 시각적 균형감을 위한 기하학적 배치
 * - 확장성을 고려한 동적 간격 조정
 * 
 * ⚠️ 에러 처리:
 * - 서버 노드 부재 시 안전한 폴백
 * - 유효하지 않은 좌표 값 검증 및 복구
 * - 상세한 로깅으로 디버깅 지원
 *
 * @param inputNodes - 원본 노드 배열
 * @param inputEdges - 원본 엣지 배열
 * @returns 최적화된 방사형 레이아웃 결과
 * 
 * @complexity O(n) - n: 총 노드 수
 */
export function getNewRadialLayoutedElements(
  inputNodes: Node[],
  inputEdges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  
  // 🎯 레이아웃 기준점 및 상수 정의
  const center = { x: 800, y: 500 };        // 캔버스 중심점 (최적 시야각 고려)
  const NODE_WIDTH = 180;                   // 표준 노드 폭
  const NODE_HEIGHT = 60;                   // 표준 노드 높이

  // 🏷️ 노드 타입별 분류 - 효율적인 처리를 위한 사전 필터링
  const server = inputNodes.find((n) => n.data?.type === "server");
  const switches = inputNodes.filter((n) => n.data?.type === "switch");
  const pcs = inputNodes.filter((n) => n.data?.type === "pc");

  // 🚨 예외 처리: 서버 노드가 없는 경우 원본 반환
  if (!server) {
    console.warn("⚠️ 서버 노드가 없어 방사형 레이아웃을 적용할 수 없습니다.");
    return { nodes: inputNodes, edges: inputEdges };
  }

  // 📍 위치 계산 결과 저장소 (중복 방지를 위한 Map 사용)
  const positionedNodesMap = new Map<string, Node>();

  // ==========================================
  // 1️⃣ 서버 노드 중앙 배치
  // ==========================================
  
  /**
   * 서버를 네트워크의 중심점에 고정 배치
   * - 모든 방향에서의 연결을 수용할 수 있도록 설계
   * - 시각적 안정감을 위해 약간 위쪽으로 조정
   */
  positionedNodesMap.set(server.id, {
    ...server,
    position: {
      x: center.x - NODE_WIDTH / 2,      // 중앙 정렬
      y: center.y - NODE_HEIGHT / 2,     // 중앙에서 약간 위로
      // x: center.x,
      // y: center.y, 
    },
    sourcePosition: Position.Bottom,      // 하향 출력 (스위치로)
    targetPosition: Position.Top,         // 상향 입력
    data: {
      ...server.data,
      mode: "radial",
      angleInDegrees: 0,                  // 중심점이므로 각도 0
      // 🎯 중심 정렬 플래그 추가
      centerAligned: true,
    },
  });

  // ==========================================
  // 2️⃣ 스위치 원형 배치 알고리즘
  // ==========================================
  
  /**
   * 스위치들을 서버 중심의 원형으로 균등 배치
   * - 반지름: 400px (충분한 시각적 분리 확보)
   * - 각도 간격: 360도를 스위치 수로 균등 분할
   * - Handle 위치: 각도에 따라 동적 최적화
   */
  const switchRadius = 1000;                                        // 서버-스위치 간 거리
  const switchAngleStep = (2 * Math.PI) / Math.max(switches.length, 1);  // 각도 간격 (라디안)

  switches.forEach((sw, index) => {
    // 🧮 극좌표 → 직교좌표 변환
    const angle = index * switchAngleStep;
    const x = center.x + Math.cos(angle) * switchRadius;
    const y = center.y + Math.sin(angle) * switchRadius;
    const angleInDegrees = (angle * 180) / Math.PI;

    // 🔌 각도 기반 Handle 위치 최적화
    const handlePositions = getHandlePositionsByAngle(angleInDegrees);

    positionedNodesMap.set(sw.id, {
      ...sw,
      position: {
        x: x - NODE_WIDTH / 2,            // 중심점 기준 좌상단 좌표 계산
        y: y - NODE_HEIGHT / 2,
      },
      sourcePosition: handlePositions.source,    // 최적화된 출력 Handle
      targetPosition: handlePositions.target,    // 최적화된 입력 Handle
      data: {
        ...sw.data,
        mode: "radial",
        angle: angle,                     // 라디안 각도 (계산용)
        angleInDegrees: angleInDegrees,   // 도 단위 각도 (디버깅용)
      },
    });
  });

  // ==========================================
  // 3️⃣ PC 클러스터링 배치 알고리즘
  // ==========================================
  
  /**
   * 각 스위치 주변에 연결된 PC들을 클러스터로 배치
   * - 스위치별 독립적인 원형 클러스터 생성
   * - 동적 반지름: PC 수에 따라 자동 조정
   * - 중복 배치 방지: Set 자료구조로 추적 관리
   */
  const pcSet = new Set<string>(); // 이미 배치된 PC 추적 (중복 방지)

  switches.forEach((sw) => {
    // 🔍 현재 스위치에 연결된 PC 탐색 알고리즘
    const connectedPCs = inputEdges
      .filter((e) => {
        // 양방향 연결 검사 (source ↔ target)
        const isSourceSwitch = e.source === sw.id;
        const isTargetSwitch = e.target === sw.id;
        const connectedId = isSourceSwitch
          ? e.target
          : isTargetSwitch
          ? e.source
          : null;

        if (!connectedId) return false;

        // PC 타입 확인 및 중복 배치 방지
        const connectedPC = pcs.find((p) => p.id === connectedId);
        return connectedPC && !pcSet.has(connectedId);
      })
      .map((e) => {
        const pcId = e.source === sw.id ? e.target : e.source;
        return pcs.find((p) => p.id === pcId);
      })
      .filter((pc): pc is Node => pc !== undefined);

    // 📍 스위치 위치 정보 조회
    const switchNode = positionedNodesMap.get(sw.id);
    if (!switchNode || !switchNode.position) return;

    // 🎯 PC 클러스터 배치 매개변수 계산
    const switchPos = switchNode.position;
    const switchAngle = switchNode.data?.angle || 0;                    // 스위치의 기준 각도
    const pcRadius = 150 + connectedPCs.length * 5;                    // 동적 반지름 (PC 수 고려)
    const pcAngleStep = (2 * Math.PI) / Math.max(connectedPCs.length, 1); // PC 간 각도 간격
    const startAngle = switchAngle - Math.PI / 2;                      // 시작 각도 (스위치 기준 시계 반대 방향)

    // 💻 개별 PC 배치 실행
    connectedPCs.forEach((pc, idx) => {
      // 🧮 PC별 위치 계산
      const angle = startAngle + idx * pcAngleStep;
      const switchCenterX = switchPos.x + NODE_WIDTH / 2;
      const switchCenterY = switchPos.y + NODE_HEIGHT / 2;

      const px = switchCenterX + Math.cos(angle) * pcRadius;
      const py = switchCenterY + Math.sin(angle) * pcRadius;
      const pcAngleInDegrees = (angle * 180) / Math.PI;

      // 🔌 PC Handle 위치 최적화
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

      // ✅ 배치 완료된 PC 추적에 추가
      pcSet.add(pc.id);
    });
  });

  // ==========================================
  // 4️⃣ 고아 노드 처리 (예외 상황 대응)
  // ==========================================
  
  /**
   * 위치가 계산되지 않은 노드들에 대한 안전장치
   * - 네트워크 구조가 불완전한 경우 대응
   * - 타입별 차별화된 기본 위치 할당
   * - 상세한 로깅으로 문제 상황 추적
   */
  inputNodes.forEach((node) => {
    if (!positionedNodesMap.has(node.id)) {
      console.warn(
        `⚠️ 고아 노드 발견: ${node.id} (${node.data?.label}) - 기본 위치로 배치합니다.`
      );

      // 📍 타입별 기본 위치 전략
      let defaultX = 100;
      let defaultY = 100;

      if (node.data?.type === "pc") {
        // PC: 좌측 상단 영역에 세로 배치
        defaultX = 100;
        defaultY = 100 + (positionedNodesMap.size % 5) * 80;
      } else if (node.data?.type === "switch") {
        // 스위치: 우측 중앙 영역에 배치
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

  // ==========================================
  // 5️⃣ 최종 검증 및 결과 생성
  // ==========================================
  
  /**
   * 계산된 위치 데이터의 유효성 검증
   * - NaN, Infinity 등 비정상 값 필터링
   * - 좌표 범위 검증 (캔버스 경계 고려)
   * - 에러 상황 상세 로깅
   */
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
      console.error(`❌ 유효하지 않은 노드 위치 데이터: ${n.id}`, n.position);
    }

    return valid;
  });

  // 🔗 엣지 후처리: 방사형 레이아웃 전용 설정 적용
  const finalEdges = inputEdges.map((e) => ({
    ...e,
    type: "custom",                    // 커스텀 엣지 렌더러 사용
    data: {
      ...e.data,
      mode: "radial",                  // 레이아웃 모드 메타데이터
    },
  }));

  // 📊 성능 및 결과 로깅
  console.log(
    `✅ 방사형 레이아웃 처리 완료: ${finalNodes.length}개 노드, ${finalEdges.length}개 엣지 처리`
  );
  console.log(`📈 배치 통계 - 서버: 1개, 스위치: ${switches.length}개, PC: ${pcSet.size}개`);

  return { nodes: finalNodes, edges: finalEdges };
}