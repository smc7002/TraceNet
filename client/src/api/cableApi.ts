/**
 * cableApi.ts - 케이블 관련 API 통신 모듈
 * 
 * 백엔드 의존성:
 * - GET /api/cable - 전체 케이블 목록 조회
 * - GET /api/trace/cables/{deviceId} - 특정 장비의 트레이스 케이블 조회
 * 
 * 데이터 흐름:
 * - fetchCables: 메인 다이어그램 케이블 렌더링용
 * - fetchTraceCables: 경로 추적 시각화용
 * 
 * 에러 처리:
 * - 네트워크 에러: axios 기본 에러 전파
 * - 데이터 형식 오류: 빈 배열 반환 (방어적 프로그래밍)
 */

import axios from "axios";
import type { CableDto } from "../types/cable";

/**
 * trace 케이블 연결 정보 인터페이스
 * 
 * 용도: 네트워크 경로 추적 시 케이블 연결 상세 정보 표시
 * 데이터 소스: GET /api/trace/cables/{deviceId} 응답
 * 
 * CableDto와의 차이점:
 * - 더 상세한 포트 정보 (ID + 이름 + 장비명)
 * - 트레이스 컨텍스트에 최적화된 구조
 */
export interface CableConnection {
  cableId: string;
  type: string;
  description: string;
  fromPort: {
    id: number;        // 포트 고유 ID
    name: string;      // 포트 표시명 (예: "GigabitEthernet0/1")
    deviceName: string; // 소속 장비명
  };
  toPort: {
    id: number;
    name: string;
    deviceName: string;
  };
}

/**
 * 특정 장비의 트레이스 케이블 목록 조회
 * 
 * API 엔드포인트: GET /api/trace/cables/{deviceId}
 * 
 * 사용 시나리오:
 * - 사용자가 장비 클릭 시 해당 장비로부터의 네트워크 경로 추적
 * - TraceNet의 핵심 기능인 "케이블 추적" 구현
 * - 결과는 NetworkDiagram에서 하이라이트된 연결선으로 표시
 * 
 * @param deviceId 추적할 장비의 고유 ID
 * @returns Promise<CableConnection[]> 트레이스된 케이블 연결 정보 배열
 * 
 * @throws AxiosError 네트워크 오류 또는 서버 에러 (4xx, 5xx)
 * 
 * @example
 * ```typescript
 * // PC-01(deviceId: 5)에서 시작하는 케이블 추적
 * const tracedCables = await fetchTraceCables(5);
 * console.log(tracedCables); // [{ cableId: "C001", fromPort: {...}, toPort: {...} }]
 * ```
 */
export async function fetchTraceCables(
  deviceId: number
): Promise<CableConnection[]> {
  const res = await axios.get(`/api/trace/cables/${deviceId}`);
  return res.data;
}

/**
 * 전체 케이블 목록 조회
 * 
 * API 엔드포인트: GET /api/cable
 * 
 * 사용 시나리오:
 * - 애플리케이션 초기 로딩 시 모든 케이블 정보 가져오기
 * - NetworkDiagram에서 기본 연결선 렌더링용 데이터
 * - SidePanel에서 케이블 검색/필터링용 데이터
 * 
 * 데이터 안전성:
 * - 백엔드 응답이 배열이 아닌 경우 빈 배열 반환
 * - 방어적 프로그래밍으로 UI 크래시 방지
 * - 에러 로깅으로 디버깅 지원
 * 
 * @returns Promise<CableDto[]> 케이블 목록 배열
 * 
 * @throws AxiosError 네트워크 오류 또는 서버 에러
 * 
 * @example
 * ```typescript
 * // 전체 케이블 목록 가져오기
 * const cables = await fetchCables();
 * console.log(cables); // [{ cableId: "C001", fromDevice: "PC-01", ... }]
 * ```
 */
export async function fetchCables(): Promise<CableDto[]> {
  const res = await axios.get("/api/cable");

  /**
   * 데이터 무결성 검증
   * 
   * 이유: 백엔드 API 변경이나 네트워크 이슈로 인해
   * 예상과 다른 응답 형식이 올 수 있음
   * 
   * 대응: 배열이 아닌 경우 빈 배열 반환하여
   * 프론트엔드 렌더링 로직이 안전하게 동작하도록 보장
   */
  if (!Array.isArray(res.data)) {
    console.error("❌ fetchCables(): API 응답이 배열이 아님", res.data);
    return [];
  }

  return res.data;
}