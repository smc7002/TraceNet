// 📁 src/utils/edgeMapper.ts

import type { Edge } from "react-flow-renderer";
import type { CableDto } from "../types/cable";
import type { CableEdge } from "../types/trace";

/**
 * 기본 케이블 데이터를 React Flow Edge 객체로 변환
 *
 * @description
 * - 일반 케이블 연결을 시각적으로 표현하기 위한 Edge 생성
 * - 검은색 실선으로 렌더링되며 케이블 설명을 라벨로 표시
 * - 각 케이블은 고유한 ID와 스타일을 가짐
 *
 * @param cables - 변환할 케이블 데이터 배열
 * @returns React Flow에서 사용할 수 있는 Edge 배열
 *
 * @example
 * ```typescript
 * const cables = [
 *   { cableId: 1, fromDeviceId: 10, toDeviceId: 20, description: "Main Cable" }
 * ];
 * const edges = mapCablesToEdges(cables);
 * ```
 */
export function mapCablesToEdges(cables: CableDto[]): Edge[] {
  // 입력 데이터 유효성 검사 - 배열이 아닐 경우 빈 배열 반환
  if (!Array.isArray(cables)) return [];

  return cables.map((cable) => ({
    // 케이블 ID를 기반으로 한 고유 식별자 생성
    id: `cable-${cable.cableId}`,
    //type: "custom",

    // 연결 시작점과 끝점 설정 (문자열로 변환 필요)
    source: cable.fromDeviceId.toString(),
    target: cable.toDeviceId.toString(),

    // 시각적 스타일 정의 - 검은색 실선
    style: {
      stroke: "#000", // 선 색상
      strokeWidth: 2.2, // 선 두께
    },

    // 케이블 설명을 라벨로 표시 (nullable 처리)
    label: cable.description ?? "",

    // 라벨 스타일 정의
    labelStyle: {
      fontSize: 10, // 폰트 크기
      fontWeight: 500, // 폰트 굵기
      transform: "translateY(-8px)", // 라벨 위치 조정 (위로 8px)
    },

    // 추가 데이터 저장 - 중복 제거 시 사용
    data: {
      key: `${cable.fromDeviceId}-${cable.toDeviceId}`,
    },
  }));
}

/**
 * 추적(Trace) 케이블을 강조된 Edge로 변환
 *
 * @description
 * - 네트워크 추적 결과를 시각적으로 강조하여 표시
 * - 초록색 점선으로 렌더링되며 애니메이션 효과 적용
 * - React 키 충돌 방지를 위해 타임스탬프와 인덱스 사용
 *
 * @param cables - 추적된 케이블 연결 정보 배열
 * @param timestamp - React 키 충돌 방지를 위한 고유 타임스탬프
 * @returns 강조된 스타일이 적용된 Edge 배열
 *
 * @example
 * ```typescript
 * const traceCables = [
 *   { cableId: 1, fromDeviceId: 10, toDeviceId: 20, fromPortId: 1, toPortId: 2 }
 * ];
 * const timestamp = Date.now();
 * const traceEdges = mapTraceCablesToEdges(traceCables, timestamp);
 * ```
 */
export function mapTraceCablesToEdges(
  cables: CableEdge[],
  timestamp: number
): Edge[] {
  return cables.map((cable, index) => ({
    // 고유 ID 생성 - 케이블ID, 포트ID, 타임스탬프, 배열 인덱스를 조합하여 충돌 방지
    id: `trace-${cable.cableId}-${cable.fromPortId}-${cable.toPortId}-${timestamp}-${index}`,

    // 연결 시작점과 끝점 설정
    source: cable.fromDeviceId.toString(),
    target: cable.toDeviceId.toString(),

    // 추적 케이블 전용 시각적 스타일
    style: {
      stroke: "#10b981", // 초록색 (Tailwind green-500)
      strokeDasharray: "5 5", // 점선 패턴 (5px 실선, 5px 공백)
      strokeWidth: 2, // 선 두께
    },

    // 연결 정보를 포함한 라벨 생성
    label: `${cable.fromDeviceId} to ${cable.toDeviceId}`,

    // 추적 케이블임을 나타내는 애니메이션 효과
    animated: true,

    // 추적 케이블 식별을 위한 메타데이터
    data: {
      isTrace: true,
    },
  }));
}

/**
 * 추적 케이블과 중복되는 기본 케이블 Edge를 제거
 *
 * @description
 * - 동일한 경로의 기본 케이블과 추적 케이블이 겹치는 것을 방지
 * - 추적 케이블이 우선적으로 표시되도록 기본 케이블을 필터링
 * - 성능 최적화: Set을 사용하여 O(1) 검색 시간 복잡도 달성
 *
 * @param baseEdges - 필터링할 기본 케이블 Edge 배열
 * @param traceEdges - 기준이 되는 추적 케이블 Edge 배열
 * @returns 중복이 제거된 기본 케이블 Edge 배열
 *
 * @example
 * ```typescript
 * const baseEdges = mapCablesToEdges(allCables);
 * const traceEdges = mapTraceCablesToEdges(tracedCables, timestamp);
 * const filteredEdges = excludeTraceOverlaps(baseEdges, traceEdges);
 * ```
 *
 * @performance
 * - 시간 복잡도: O(n + m) where n = traceEdges.length, m = baseEdges.length
 * - 공간 복잡도: O(n) for the Set creation
 */
export function excludeTraceOverlaps(
  baseEdges: Edge[],
  traceEdges: Edge[]
): Edge[] {
  // 추적 케이블의 연결 키들을 Set으로 구성하여 빠른 검색 지원
  const traceKeySet = new Set(traceEdges.map((edge) => edge.data?.key));

  // 기본 케이블 중 추적 케이블과 중복되지 않는 것들만 필터링
  return baseEdges.filter((edge) => !traceKeySet.has(edge.data?.key));
}
