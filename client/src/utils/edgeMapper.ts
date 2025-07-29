// 📁 src/utils/edgeMapper.ts

import type { Edge } from "react-flow-renderer";
import type { CableDto } from "../types/cable";
import type { CableEdge } from "../types/trace";

/**
 * Edge Mapper Utilities
 * 
 * 네트워크 케이블 데이터를 React Flow의 Edge 객체로 변환하는 유틸리티 모듈입니다.
 * 다양한 케이블 타입(일반 케이블, 추적 케이블)을 시각적으로 구분하여 표현하고,
 * 레이아웃 모드에 따른 적절한 스타일링을 제공합니다.
 * 
 * 주요 기능:
 * - 일반 케이블 → 기본 연결선 변환
 * - 추적 케이블 → 강조된 애니메이션 연결선 변환
 * - 중복 케이블 필터링 (추적 시 기본 케이블 숨김)
 * - 레이아웃별 차별화된 스타일링 (계층형 vs 방사형)
 * 
 * @module EdgeMapper
 * @version 1.0.0
 */

// ================================
// 일반 케이블 매핑 함수
// ================================

/**
 * 기본 케이블 데이터를 React Flow Edge 객체로 변환합니다.
 * 
 * 이 함수는 데이터베이스의 케이블 정보를 시각적 다이어그램 요소로 변환하여
 * 네트워크의 물리적 연결 관계를 표현합니다. 레이아웃 모드에 따라
 * 다른 렌더링 방식과 스타일을 적용합니다.
 * 
 * 변환 과정:
 * 1. 케이블 ID 기반 고유 식별자 생성
 * 2. 장비 ID를 문자열로 변환하여 노드 연결
 * 3. 레이아웃 모드별 스타일 및 핸들 설정
 * 4. 케이블 설명을 라벨로 추가
 * 
 * @param cables - 변환할 케이블 DTO 배열
 * @param isRadial - 방사형 레이아웃 사용 여부
 * @returns React Flow Edge 객체 배열
 * 
 * @example
 * ```typescript
 * const cables = [
 *   { cableId: 1, fromDeviceId: 10, toDeviceId: 20, description: "백본 연결" }
 * ];
 * const edges = mapCablesToEdges(cables, false);
 * // → [{ id: "cable-1", source: "10", target: "20", ... }]
 * ```
 * 
 * @remarks
 * 레이아웃별 차이점:
 * - **계층형 (Hierarchical)**: 검은색 실선, sourceHandle/targetHandle 포함
 * - **방사형 (Radial)**: 커스텀 엣지 타입 사용, 핸들 정보 제외
 */
export function mapCablesToEdges(
  cables: CableDto[],
  isRadial: boolean
): Edge[] {
  // 입력 데이터 유효성 검사
  if (!Array.isArray(cables)) return [];

  return cables.map((cable) => {
    /**
     * 기본 Edge 객체 구성
     * 
     * 모든 레이아웃에서 공통으로 사용되는 기본 속성들을 정의합니다.
     * 각 케이블의 고유 특성을 반영하여 시각적 구분을 가능하게 합니다.
     */
    const baseEdge = {
      /** 케이블 고유 식별자 (prefix로 타입 구분) */
      id: `cable-${cable.cableId}`,
      
      /** 시작 노드 ID (장비 ID를 문자열로 변환) */
      source: cable.fromDeviceId.toString(),
      
      /** 끝 노드 ID (장비 ID를 문자열로 변환) */
      target: cable.toDeviceId.toString(),
      
      /** 
       * Edge 타입 결정
       * - 방사형: 커스텀 엣지 (CustomEdge 컴포넌트 사용)
       * - 계층형: 기본 엣지 (React Flow 내장 스타일)
       */
      type: isRadial ? "custom" : "default",
      
      /**
       * 계층형 레이아웃 전용 스타일
       * 방사형에서는 CustomEdge 컴포넌트가 스타일을 담당
       */
      style: isRadial ? undefined : { 
        stroke: "#000",      // 검은색 연결선
        strokeWidth: 2.2     // 적당한 굵기로 가독성 확보
      },
      
      /** 케이블 설명을 라벨로 표시 (선택적) */
      label: cable.description ?? "",
      
      /** 라벨 스타일링 */
      labelStyle: {
        fontSize: 10,                    // 작은 폰트로 방해받지 않게
        fontWeight: 500,                 // 중간 굵기로 가독성 확보
        transform: "translateY(-8px)",   // 연결선 위쪽에 배치
      },
      
      /** 메타데이터 */
      data: {
        /** 중복 검사용 키 (장비 ID 조합) */
        key: `${cable.fromDeviceId}-${cable.toDeviceId}`,
        
        /** 레이아웃 모드 정보 (CustomEdge에서 스타일 결정에 사용) */
        mode: isRadial ? "radial" : "hierarchical",
      },
    };

    /**
     * 레이아웃별 핸들 정보 추가
     * 
     * 계층형 레이아웃에서는 노드의 특정 위치(핸들)에 연결선을 고정하여
     * 정돈된 시각적 표현을 제공합니다. 방사형에서는 자유로운 연결을 위해
     * 핸들 정보를 제외합니다.
     */
    return isRadial
      ? baseEdge  // 방사형: 기본 객체만 반환
      : {
          ...baseEdge,
          /** 출발점 핸들 (노드 우측에서 시작) */
          sourceHandle: "source",
          /** 도착점 핸들 (노드 좌측으로 연결) */
          targetHandle: "target",
        };
  });
}

// ================================
// 추적 케이블 매핑 함수
// ================================

/**
 * 추적(Trace) 케이블을 강조된 Edge로 변환합니다.
 * 
 * 네트워크 경로 추적이나 장애 진단 시 특정 케이블 경로를 시각적으로
 * 강조하기 위한 특수 Edge를 생성합니다. 일반 케이블과 구별되는
 * 애니메이션 효과와 색상을 적용합니다.
 * 
 * 특징:
 * - 녹색 점선으로 추적 경로임을 시각적으로 구분
 * - 애니메이션 효과로 데이터 흐름 방향 표시
 * - 시간 기반 고유 ID로 동일 경로의 중복 추적 지원
 * - 포트 레벨의 상세 연결 정보 포함
 * 
 * @param cables - 추적할 케이블 엣지 배열
 * @param timestamp - 추적 시작 시각 (고유 ID 생성용)
 * @returns 강조된 React Flow Edge 객체 배열
 * 
 * @example
 * ```typescript
 * const traceCables = [
 *   { cableId: 1, fromDeviceId: 10, toDeviceId: 20, fromPortId: 1, toPortId: 2 }
 * ];
 * const traceEdges = mapTraceCablesToEdges(traceCables, Date.now());
 * ```
 */
export function mapTraceCablesToEdges(
  cables: CableEdge[],
  timestamp: number
): Edge[] {
  return cables.map((cable, index) => ({
    /**
     * 복합 고유 식별자 생성
     * 
     * 동일한 케이블에 대한 여러 추적 세션을 구분하기 위해
     * 케이블ID + 포트ID + 타임스탬프 + 인덱스를 조합합니다.
     */
    id: `trace-${cable.cableId}-${cable.fromPortId}-${cable.toPortId}-${timestamp}-${index}`,
    
    /** 연결 노드 정보 */
    source: cable.fromDeviceId.toString(),
    target: cable.toDeviceId.toString(),
    
    /** 계층형 레이아웃 핸들 (추적은 주로 상세 분석에서 사용) */
    sourceHandle: "source",
    targetHandle: "target",

    /** 추적 전용 시각적 스타일 */
    style: {
      stroke: "#10b981",        // 에메랄드 그린 (성공/활성 상태를 나타냄)
      strokeDasharray: "5 5",   // 점선 패턴으로 추적임을 명시
      strokeWidth: 2,           // 일반 케이블과 동일한 굵기
    },
    
    /** 상세한 연결 정보를 라벨로 표시 */
    label: `${cable.fromDeviceId} to ${cable.toDeviceId}`,
    
    /** 
     * 애니메이션 효과 활성화
     * 점선이 흐르는 듯한 효과로 데이터 흐름 방향을 시각화
     */
    animated: true,
    
    /** 메타데이터 */
    data: {
      /** 중복 검사용 키 */
      key: `${cable.fromDeviceId}-${cable.toDeviceId}`,
      
      /** 추적 케이블임을 표시하는 플래그 */
      isTrace: true,
    },
  }));
}

// ================================
// 중복 케이블 필터링 함수
// ================================

/**
 * 추적 케이블과 중복되는 기본 케이블 Edge를 제거합니다.
 * 
 * 네트워크 추적 시 동일한 물리적 케이블이 일반 연결과 추적 연결로
 * 중복 표시되는 것을 방지합니다. 추적 케이블이 우선 표시되고,
 * 해당 경로의 일반 케이블은 숨겨집니다.
 * 
 * 작동 원리:
 * 1. 추적 케이블들의 키(장비 ID 조합) 집합 생성
 * 2. 기본 케이블 중 동일한 키를 가진 항목 제외
 * 3. 중복되지 않는 기본 케이블만 반환
 * 
 * @param baseEdges - 필터링할 기본 케이블 Edge 배열
 * @param traceEdges - 우선 표시할 추적 케이블 Edge 배열
 * @returns 중복이 제거된 기본 케이블 Edge 배열
 * 
 * @example
 * ```typescript
 * const baseEdges = [
 *   { id: "cable-1", data: { key: "10-20" } },
 *   { id: "cable-2", data: { key: "20-30" } }
 * ];
 * const traceEdges = [
 *   { id: "trace-1", data: { key: "10-20" } }
 * ];
 * 
 * const filtered = excludeTraceOverlaps(baseEdges, traceEdges);
 * // → [{ id: "cable-2", data: { key: "20-30" } }]
 * ```
 * 
 * @performance
 * Set을 사용한 O(1) 룩업으로 대용량 네트워크에서도 효율적 처리
 */
export function excludeTraceOverlaps(
  baseEdges: Edge[],
  traceEdges: Edge[]
): Edge[] {
  /**
   * 추적 케이블 키 집합 생성
   * 
   * Set 자료구조를 사용하여 중복 검사 시 O(1) 시간 복잡도로
   * 빠른 필터링을 제공합니다.
   */
  const traceKeySet = new Set(traceEdges.map((edge) => edge.data?.key));
  
  /**
   * 중복되지 않는 기본 케이블만 필터링
   * 
   * 각 기본 케이블의 키가 추적 케이블 집합에 존재하지 않는
   * 경우에만 결과에 포함시킵니다.
   */
  return baseEdges.filter((edge) => !traceKeySet.has(edge.data?.key));
}