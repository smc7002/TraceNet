// 📁 src/types/ping.ts

/**
 * 단일 장비 Ping 결과
 */
export interface PingResultDto {
  deviceId: number;
  deviceName: string;
  ipAddress: string;
  status: "Online" | "Offline" | "Unstable" | "Unknown" | "Unreachable";
  latencyMs: number | null;
  checkedAt: string; // ISO DateTime
  errorMessage: string | null;
}

/**
 * 여러 장비 일괄 Ping 요청
 */
export interface MultiPingRequestDto {
  deviceIds: number[];
  timeoutMs?: number;      // 기본값: 2000ms
  maxConcurrency?: number; // 기본값: 10
  updateDatabase?: boolean; // 기본값: true
}

/**
 * TracePath Ping 결과 (TraceDto 임포트 필요)
 */
export interface TracePingResultDto {
  success: boolean;
  errorMessage: string | null;
  tracePath: unknown; // TraceResultDto - 필요시 trace.ts에서 임포트
  pingResults: PingResultDto[];
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  unstableDevices: number;
  checkedAt: string; // ISO DateTime
}

/**
 * Ping 진행 상태
 */
export interface PingProgress {
  isRunning: boolean;
  completed: number;
  total: number;
  currentDevice?: string;
}