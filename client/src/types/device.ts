/**
 * device.ts - 네트워크 장비 타입 정의
 * 
 * 용도: 물리적 네트워크 장비 정보 모델링 (PC, Switch, Server 등)
 * 데이터 소스: GET /api/device 응답, 장비 등록/수정 API
 */

import type { Port } from "../types/port";
import { DeviceStatus } from "./status";

/**
 * 네트워크 장비 인터페이스
 */
export interface Device {
  /** 장비 고유 식별자 (Primary Key) */
  deviceId: number;
  
  /** 장비 이름 (예: "서버실-PC-01", "SW-Core-01") */
  name: string;
  
  /** 장비 유형  */
  type: string;
  
  /** IP 주소 (예: "192.168.1.100", DHCP인 경우 빈 값 가능) */
  ipAddress?: string | null;
  
  /** 
   * 소속 포트 목록 (선택적 조인)
   * 포함: 포트 상세 정보 필요 시 (예: SidePanel 포트 상태)
   * 미포함: 기본 장비 목록 조회 시 (성능 최적화)
   */
  ports?: Port[];
  
  /** 총 포트 수 (물리적 포트 개수, 1~999) */
  portCount: number;
  
  /** 랙 ID (Switch는 필수) */
  rackId?: number | null;

   /** 랙 이름 (Switch 전용, 백엔드에서 내려옴) */
  rackName?: string;
  
  /** Ping 모니터링 활성화 여부 (전체 Ping 시 이 장비 포함할지 결정) */
  enablePing: boolean;
  
  /** 현재 장비 상태 (Online/Offline/Unstable/Unknown) */
  status: DeviceStatus;
  
  /** 마지막 상태 확인 시간 (ISO 문자열, 파싱하면 Date 객체로 사용) */
  lastCheckedAt?: string | null;
}