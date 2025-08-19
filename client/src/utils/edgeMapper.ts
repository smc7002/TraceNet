/**
 * @fileoverview 네트워크 케이블 연결 관계를 React Flow 엣지로 변환하는 유틸리티
 * 
 * 주요 기능:
 * - 케이블 정보를 시각적 연결선(Edge)으로 변환
 * - 트레이스 경로 하이라이트 처리
 * - 기본 케이블과 트레이스 경로 중복 제거
 * - 레거시 API 형식 호환 (PascalCase ↔ camelCase)
 * 
 * 사용 예시:
 * ```typescript
 * // 기본 케이블을 엣지로 변환
 * const edges = mapCablesToEdges(cables, true);
 * 
 * // 트레이스 경로 생성
 * const traceEdges = mapTraceCablesToEdges(traceCables, Date.now());
 * 
 * // 중복 제거
 * const filteredEdges = excludeTraceOverlaps(baseEdges, traceEdges);
 * ```
 */

import type { Edge } from "react-flow-renderer";
import type { CableDto } from "../types/cable";
import type { CableEdge } from "../types/trace";

/** 케이블 엣지 ID 프리픽스 - 엣지 타입 구분용 */
export const CABLE_EDGE_PREFIX = "cable-";

// ==========================================
// 유틸리티 함수
// ==========================================

/**
 * 무방향 연결 키 생성
 * 
 * A-B 연결과 B-A 연결을 동일한 키로 처리하기 위해
 * 사전순으로 정렬하여 일관된 키 생성
 * 
 * @param a 첫 번째 노드 ID
 * @param b 두 번째 노드 ID
 * @returns 정규화된 연결 키 (예: "device1-device2")
 */
function undirectedKey(a: number | string, b: number | string): string {
  const A = String(a);
  const B = String(b);
  return A < B ? `${A}-${B}` : `${B}-${A}`;
}

/** 안전한 문자열 변환 */
const S = (v: number | string): string => String(v);

/** 안전한 숫자 변환 */
const toNum = (v: number | string): number => (typeof v === "number" ? v : Number(v));

// ==========================================
// 레거시 호환성 처리
// ==========================================

/**
 * 레거시 API 케이블 정보 (PascalCase)
 * 기존 시스템과의 호환성을 위해 유지
 */
interface LegacyCableDto {
  CableId: string | number;
  FromDeviceId: number | string;
  ToDeviceId: number | string;
  Description?: string;
}

/**
 * 레거시 API 케이블 엣지 정보 (PascalCase)
 */
interface LegacyCableEdge {
  CableId: string | number;
  FromDeviceId: number | string;
  ToDeviceId: number | string;
  FromPortId: number | string;
  ToPortId: number | string;
}

/** 입력 가능한 케이블 DTO 타입 (신규 + 레거시) */
type CableDtoInput = CableDto | LegacyCableDto;

/** 입력 가능한 케이블 엣지 타입 (신규 + 레거시) */
type CableEdgeInput = CableEdge | LegacyCableEdge;

/**
 * 내부 처리용 정규화된 케이블 DTO
 */
interface NormalizedCableDto {
  cableId: string;
  fromDeviceId: number;
  toDeviceId: number;
  description?: string;
}

/**
 * 내부 처리용 정규화된 케이블 엣지
 */
interface NormalizedCableEdge {
  cableId: string;
  fromDeviceId: number;
  toDeviceId: number;
  fromPortId: number;
  toPortId: number;
}

/**
 * 케이블 DTO 정규화 함수
 * 
 * 신규 API(camelCase)와 레거시 API(PascalCase) 형식을 모두 받아서
 * 내부적으로 일관된 camelCase 형식으로 변환
 * 
 * @param c 입력 케이블 DTO (신규 또는 레거시 형식)
 * @returns 정규화된 케이블 정보
 */
function normalizeCableDto(c: CableDtoInput): NormalizedCableDto {
  // 신규 API 형식 감지 (camelCase 속성 존재 여부로 판단)
  if ("fromDeviceId" in c) {
    return {
      cableId: S(c.cableId),
      fromDeviceId: toNum(c.fromDeviceId),
      toDeviceId: toNum(c.toDeviceId),
      description: c.description,
    };
  }
  
  // 레거시 API 형식 자동 변환 (PascalCase → camelCase)
  return {
    cableId: S(c.CableId),
    fromDeviceId: toNum(c.FromDeviceId),
    toDeviceId: toNum(c.ToDeviceId),
    description: c.Description,
  };
}

/**
 * 케이블 엣지 정규화 함수
 * 
 * @param e 입력 케이블 엣지 (신규 또는 레거시 형식)
 * @returns 정규화된 케이블 엣지 정보
 */
function normalizeCableEdge(e: CableEdgeInput): NormalizedCableEdge {
  // 신규 API 형식 처리
  if ("fromPortId" in e) {
    return {
      cableId: S(e.cableId),
      fromDeviceId: toNum(e.fromDeviceId),
      toDeviceId: toNum(e.toDeviceId),
      fromPortId: toNum(e.fromPortId),
      toPortId: toNum(e.toPortId),
    };
  }
  
  // 레거시 API 형식 자동 변환
  return {
    cableId: S(e.CableId),
    fromDeviceId: toNum(e.FromDeviceId),
    toDeviceId: toNum(e.ToDeviceId),
    fromPortId: toNum(e.FromPortId),
    toPortId: toNum(e.ToPortId),
  };
}

// ==========================================
// 기본 케이블 엣지 생성
// ==========================================

/**
 * 케이블 정보를 React Flow 엣지로 변환
 * 
 * 네트워크 인프라를 나타내는 기본 케이블들을 시각적 연결선으로 변환.
 * 레이아웃 모드에 따라 다른 스타일과 속성 적용.
 * 
 * @param cables 케이블 정보 배열 (신규/레거시 형식 모두 지원)
 * @param isRadial 방사형 레이아웃 여부 (true: 방사형, false: 계층형)
 * @returns React Flow Edge 배열
 */
export function mapCablesToEdges(cables: CableDtoInput[], isRadial: boolean): Edge[] {
  // 입력 검증
  if (!Array.isArray(cables)) {
    return [];
  }

  return cables.map((raw) => {
    // 입력 데이터 정규화
    const c = normalizeCableDto(raw);
    const sourceId = S(c.fromDeviceId);
    const targetId = S(c.toDeviceId);

    // 기본 엣지 속성 구성
    const base: Edge = {
      id: `${CABLE_EDGE_PREFIX}${c.cableId}`,
      source: sourceId,
      target: targetId,
      type: isRadial ? "custom" : "default",
      
      // 계층형 레이아웃에서만 기본 스타일 적용
      // 방사형에서는 CustomEdge 컴포넌트에서 스타일 처리
      style: isRadial ? undefined : { 
        stroke: "#000", 
        strokeWidth: 2.2 
      },
      
      // 케이블 설명을 라벨로 표시
      label: c.description ?? "",
      labelStyle: {
        fontSize: 10,
        fontWeight: 500,
        transform: "translateY(-8px)",  // 연결선 위로 약간 올려서 표시
        pointerEvents: "none",          // 라벨 클릭 방지
      },
      
      // 메타데이터 저장 (중복 제거 및 디버깅용)
      data: {
        key: undirectedKey(sourceId, targetId),  // 무방향 연결 키
        mode: isRadial ? "radial" : "hierarchical",
        cableId: c.cableId,
        fromDeviceId: sourceId,
        toDeviceId: targetId,
      },
    };

    // 계층형 레이아웃에서는 Handle 명시적 지정
    return isRadial
      ? base
      : { 
          ...base, 
          sourceHandle: "source", 
          targetHandle: "target" 
        };
  });
}

// ==========================================
// 트레이스 경로 엣지 생성
// ==========================================

/**
 * 트레이스 경로를 하이라이트 엣지로 변환
 * 
 * 네트워크 경로 추적 결과를 시각적으로 강조 표시하기 위한 엣지 생성.
 * 기본 케이블과 구별되는 스타일 적용 (초록색 점선 + 애니메이션).
 * 
 * 주의: 이 함수는 'trace-' 프리픽스를 추가하지 않음.
 *       MainPage.tsx에서 최종적으로 프리픽스 추가.
 * 
 * @param cables 트레이스 경로 케이블 정보
 * @param timestamp 유니크 ID 생성용 타임스탬프
 * @param opts 옵션 (레이아웃 모드 등)
 * @returns 트레이스 경로 Edge 배열
 */
export function mapTraceCablesToEdges(
  cables: CableEdgeInput[],
  timestamp: number,
  opts?: { mode?: "radial" | "hierarchical" }
): Edge[] {
  const mode = opts?.mode ?? "radial";

  return (cables ?? []).map((raw, index) => {
    // 입력 데이터 정규화
    const c = normalizeCableEdge(raw);
    const fromId = S(c.fromDeviceId);
    const toId = S(c.toDeviceId);

    return {
      // 충돌 방지를 위한 복합 ID 생성
      id: `${c.cableId}-${c.fromPortId}-${c.toPortId}-${timestamp}-${index}`,
      source: fromId,
      target: toId,
      type: "custom",  // 항상 커스텀 엣지 사용
      
      // 트레이스 전용 스타일: 초록색 점선 + 두꺼운 선
      style: { 
        stroke: "#10b981",        // 초록색 (emerald-500)
        strokeDasharray: "5 5",   // 점선 패턴
        strokeWidth: 2 
      },
      
      // 연결 방향 표시 라벨
      label: `${fromId} → ${toId}`,
      
      // 데이터 흐름 애니메이션 효과
      animated: true,
      
      // 메타데이터 (중복 제거용)
      data: {
        key: undirectedKey(fromId, toId),
        isTrace: true,              // 트레이스 엣지 식별용
        mode,
        cableId: c.cableId,
        fromDeviceId: fromId,
        toDeviceId: toId,
        fromPortId: S(c.fromPortId),
        toPortId: S(c.toPortId),
      },
    };
  });
}

// ==========================================
// 중복 제거 처리
// ==========================================

/**
 * 트레이스 경로와 겹치는 기본 케이블 엣지 제거
 * 
 * 트레이스 경로가 활성화될 때 같은 연결을 나타내는 기본 케이블 엣지를
 * 숨겨서 시각적 혼란을 방지. 두 단계 매칭으로 정확한 중복 감지.
 * 
 * 매칭 우선순위:
 * 1. 케이블 ID 직접 매칭 (정확한 물리적 케이블)
 * 2. 연결 키 매칭 (같은 장비 간 연결)
 * 
 * @param baseEdges 기본 케이블 엣지 배열
 * @param traceEdges 트레이스 경로 엣지 배열
 * @returns 중복이 제거된 기본 케이블 엣지 배열
 */
export function excludeTraceOverlaps(baseEdges: Edge[], traceEdges: Edge[]): Edge[] {
  // 트레이스 엣지들의 식별자 수집
  const traceCableIds = new Set<string>();
  const traceKeys = new Set<string>();

  for (const te of traceEdges) {
    const d = te.data as Record<string, unknown> | undefined;
    
    // 케이블 ID 수집 (물리적 케이블 식별)
    const cid = typeof d?.cableId === "string" ? d.cableId : undefined;
    if (cid) {
      traceCableIds.add(cid);
    }
    
    // 연결 키 수집 (논리적 연결 식별)  
    const k = typeof d?.key === "string" ? d.key : undefined;
    if (k) {
      traceKeys.add(k);
    }
  }

  // 기본 엣지에서 겹치는 것들 필터링
  return baseEdges.filter((be) => {
    const d = be.data as Record<string, unknown> | undefined;
    
    // 1순위: 케이블 ID 매칭 확인
    const baseCid = typeof d?.cableId === "string" ? d.cableId : undefined;
    if (baseCid && traceCableIds.has(baseCid)) {
      return false; // 같은 물리적 케이블이므로 제외
    }
    
    // 2순위: 연결 키 매칭 확인  
    const baseKey = typeof d?.key === "string" ? d.key : undefined;
    if (baseKey && traceKeys.has(baseKey)) {
      return false; // 같은 논리적 연결이므로 제외
    }
    
    return true; // 겹치지 않으므로 유지
  });
}

/**
 *  가이드
 * 
 * 1. 새로운 케이블 타입 추가:
 *    - CableDto, CableEdge 인터페이스에 속성 추가
 *    - normalizeCableDto, normalizeCableEdge 함수 수정
 *    - 필요시 새로운 스타일 매핑 추가
 * 
 * 2. 레거시 API 변경:
 *    - LegacyCableDto, LegacyCableEdge 인터페이스 수정
 *    - 정규화 함수의 변환 로직 업데이트
 *    - 하위 호환성 유지 필수
 * 
 * 3. 시각적 스타일 변경:
 *    - mapCablesToEdges의 style 속성 수정
 *    - mapTraceCablesToEdges의 색상/패턴 변경
 *    - CustomEdge 컴포넌트와 일관성 유지
 * 
 * 4. 성능 최적화:
 *    - 대량 케이블 처리 시 excludeTraceOverlaps 최적화 고려
 *    - Set 자료구조는 이미 O(1) 조회로 최적화됨
 *    - 메모이제이션 추가 시 timestamp 의존성 주의
 * 
 * 5. 디버깅:
 *    - 엣지 data 속성에 디버깅 정보 포함됨
 *    - undirectedKey로 연결 관계 추적 가능
 *    - 브라우저 개발자도구에서 엣지 클릭하여 메타데이터 확인
 */