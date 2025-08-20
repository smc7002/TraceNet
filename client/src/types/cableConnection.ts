/**
 * cableConnection.ts - 케이블 연결 관계 타입 정의
 * 
 * 목적:
 * - 물리적 케이블과 논리적 포트 간의 연결 관계 모델링
 * - 네트워크 토폴로지의 핵심 연결 정보 표현
 * - 데이터베이스의 다대다 관계를 객체 관계로 매핑
 * 
 * 사용 시나리오:
 * - 네트워크 다이어그램의 엣지(연결선) 렌더링
 * - 케이블 추적 시 물리적 경로 계산
 * - 포트별 연결 상태 분석
 * - 케이블 관리 및 연결 정보 표시
 */

import type { Port } from "./port";
import type { Cable } from "./cable";

/**
 * 케이블 연결 정보 인터페이스
 * 
 * 데이터베이스 테이블: CableConnections
 * 
 * 관계 설명:
 * - 하나의 케이블이 두 개의 포트를 연결
 * - 각 연결은 출발 포트(from)와 도착 포트(to)를 가짐
 * - 양방향 연결이므로 from/to는 상대적 개념
 * 
 * 조인 관계:
 * - cable?: 연결된 케이블의 상세 정보 (LEFT JOIN)
 * - fromPort?: 출발 포트의 상세 정보 (LEFT JOIN)
 * - toPort?: 도착 포트의 상세 정보 (LEFT JOIN)
 * 
 */
export interface CableConnection {
  /** 케이블 연결의 고유 식별자 (Primary Key) */
  cableConnectionId: number;
  
  /** 연결된 케이블의 ID (Foreign Key → Cable.cableId) */
  cableId: number;
  
  /** 출발 포트의 ID (Foreign Key → Port.portId) */
  fromPortId: number;
  
  /** 도착 포트의 ID (Foreign Key → Port.portId) */
  toPortId: number;

  /** 
   * 연결된 케이블 객체 (조인 데이터)
   * 
   * 포함 시기:
   * - 케이블 상세 정보가 필요한 API 응답
   * - 케이블 타입, 설명 등 추가 정보 표시 시
   * 
   * 미포함 시기:
   * - ID만으로 충분한 간단한 조회
   * - 성능 최적화가 필요한 대량 데이터 처리
   */
  cable?: Cable;
  
  /** 
   * 출발 포트 객체 (조인 데이터)
   * 
   * 포함 정보:
   * - 포트 이름 (예: "GigabitEthernet0/1")
   * - 포트 활성 상태
   * - 소속 장비 정보
   */
  fromPort?: Port;
  
  /** 
   * 도착 포트 객체 (조인 데이터)
   * 
   * 활용 예시:
   * - 네트워크 다이어그램에서 연결선 라벨 표시
   * - 포트 상태에 따른 연결선 색상 변경
   * - 케이블 추적 시 경로 상세 정보 제공
   */
  toPort?: Port;
}