// src/types/ping.ts

/**
 * Ping result for a single device
 */
export interface PingResultDto {
  deviceId: number;
  deviceName: string;
  ipAddress: string;
  status: 'Online' | 'Offline' | 'Unstable' | 'Unknown' | 'Unreachable';
  latencyMs: number | null;
  checkedAt: string; // ISO DateTime
  errorMessage: string | null;
}

/**
 * Batch ping request for multiple devices
 */
export interface MultiPingRequestDto {
  deviceIds: number[];
  timeoutMs?: number;       // default: 2000ms
  maxConcurrency?: number;  // default: 10
  updateDatabase?: boolean; // default: true
}

/**
 * TracePath ping result (import Trace DTO if needed)
 */
export interface TracePingResultDto {
  success: boolean;
  errorMessage: string | null;
  tracePath: unknown; // TraceResultDto — import from trace.ts if needed
  pingResults: PingResultDto[];
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  unstableDevices: number;
  checkedAt: string; // ISO DateTime
}

/**
 * Ping progress state
 */
export interface PingProgress {
  isRunning: boolean;
  completed: number;
  total: number;
  currentDevice?: string;
}
