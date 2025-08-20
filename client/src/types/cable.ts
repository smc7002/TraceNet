/**
 * Cable 관련 타입 정의
 * 
 * Cable: 데이터베이스 엔티티 (기본 케이블 정보)
 * CableDto: API 응답/UI 표시용 (연결 정보 포함)
 */

/**
 * 기본 케이블 엔티티 (데이터베이스 모델)
 */
export interface Cable {
  cableId: number;
  type?: string;
  description?: string;
}

/**
 * 케이블 연결 정보 DTO (API 응답/UI 표시용)
 * 양쪽 장비의 상세 연결 정보를 포함
 */
export interface CableDto {
  cableId: string;        // API에서 문자열로 반환
  description?: string;
  fromDevice: string;     // 출발 장비명
  fromDeviceId: string;   // 출발 장비 ID
  fromPort: string;       // 출발 포트명
  toDevice: string;       // 도착 장비명  
  toDeviceId: string;     // 도착 장비 ID
  toPort: string;         // 도착 포트명
}