import axios, { AxiosError } from "axios";
import type { TraceResponse } from "../types/trace";

/**
 * 특정 장비의 Trace 경로를 조회합니다.
 * @param deviceId 조회할 장비의 ID
 * @param opts     옵션: 요청 취소(signal), 타임아웃(ms)
 * @returns TraceResponse { path, cables, ... }
 */
export async function fetchTrace(
  deviceId: number,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<TraceResponse> {
  // 빠른 유효성 체크로 불필요한 네트워크 호출 방지
  if (!Number.isFinite(deviceId)) throw new Error("유효하지 않은 deviceId입니다.");

  try {
    // 취소/타임아웃 같은 런타임 옵션은 여기서만 관리
    const res = await axios.get<TraceResponse>(`/api/trace/${deviceId}`, {
      signal: opts.signal,
      timeout: opts.timeoutMs ?? 15000,
    });
    return res.data;
  } catch (err) {
    // 서버 메시지 → 타임아웃/취소 → 일반 오류 순서로 사용자 메시지 정규화
    const ax = err as AxiosError<{ message?: string }>;
    const msg =
      ax.response?.data?.message ??
      (ax.code === "ECONNABORTED" ? "요청 시간이 초과되었습니다." : undefined) ??
      (ax.message?.includes("canceled") ? "요청이 취소되었습니다." : undefined) ??
      "Trace 정보를 불러오지 못했습니다.";
    console.error("🚨 Trace API 오류:", ax);
    throw new Error(msg);
  }
}
