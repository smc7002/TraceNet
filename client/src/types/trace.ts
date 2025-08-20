/**
 * trace.ts 
 * 
 * 용도: TraceNet의 핵심 기능인 장비간 케이블 경로 추적
 * 데이터 소스: GET /api/trace/{deviceId} 응답
 */

/**
 * 추적 경로의 개별 hop 정보
 * 
 * 용도: SidePanel에서 "PC-01 → Switch-01 → Server-01" 형태로 경로 표시
 */
export interface TraceDto {
  cableId: number;        // 해당 홉에서 사용된 케이블 ID
  fromDeviceId: number;   // 출발 장비 ID
  fromDevice: string;     // 출발 장비명 (표시용)
  fromPort: string;       // 출발 포트명 (예: "GigabitEthernet0/1")
  toDeviceId: number;     // 도착 장비 ID  
  toDevice: string;       // 도착 장비명 (표시용)
  toPort: string;         // 도착 포트명
}

/**
 * 케이블 엣지 정보 (다이어그램 렌더링용)
 * 
 * 용도: NetworkDiagram에서 추적된 경로를 하이라이트된 연결선으로 표시
 * TraceDto와 차이점: 포트 ID 포함으로 정확한 연결점 식별
 */
export interface CableEdge {
  cableId: number;        // 케이블 고유 ID
  fromPortId: number;     // 출발 포트 ID (정확한 연결점 식별)
  fromDeviceId: number;   // 출발 장비 ID
  toPortId: number;       // 도착 포트 ID
  toDeviceId: number;     // 도착 장비 ID
}

/**
 * 전체 추적 결과 응답
 * 
 * 데이터 이중화 이유:
 * - path: 사용자에게 보여줄 텍스트 경로
 * - cables: 다이어그램에서 시각화할 연결선 데이터
 */
export interface TraceResponse {
  startDeviceName: string;  // 추적 시작 장비명
  endDeviceName?: string;   // 추적 종료 장비명 (도달 가능한 경우)
  success: boolean;         // 추적 성공 여부
  path: TraceDto[];         // 홉별 상세 경로 (텍스트 표시용)
  cables: CableEdge[];      // 케이블 연결 정보 (다이어그램 하이라이트용)
}