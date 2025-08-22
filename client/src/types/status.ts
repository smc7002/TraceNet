/**
 * @fileoverview 네트워크 장비 상태 정의
 * @description TraceNet 시스템에서 사용하는 장비 상태 열거형
 */

/**
 * 네트워크 장비의 연결 상태
 */
export enum DeviceStatus {
  /** 정상 연결 (Ping 응답 성공, 지연시간 < 500ms) */
  Online = 'Online',
  
  /** 연결 실패 (Ping 응답 없음, 타임아웃) */
  Offline = 'Offline',
  
  /** 불안정 (높은 지연시간 또는 패킷 손실 발생) */
  Unstable = 'Unstable',
  
  /** 상태 불명 (IP 없음 또는 Ping 불가) */
  Unknown = 'Unknown',
  
  /** 도달 불가 (네트워크 경로 문제) */
  Unreachable = 'Unreachable',
}