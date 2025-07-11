// 📁 src/api/traceApi.ts
import axios from "axios";
import type { Device } from "../types/device";

export interface TraceResponse {
  path: Device[];
  cableCount: number;
}

/**
 * 특정 장비의 Trace 경로를 조회합니다.
 * @param deviceId 조회할 장비의 ID
 * @returns TraceResponse { path, cableCount }
 */
export async function fetchTrace(deviceId: number): Promise<TraceResponse> {
  try {
    const response = await axios.get<TraceResponse>(`/api/trace/${deviceId}`);
    return response.data;
  } catch (error) {
    console.error("🚨 Trace API 오류:", error);
    throw new Error("Trace 정보를 불러오지 못했습니다.");
  }
}
