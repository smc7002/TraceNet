/**
 * deviceApi.ts - 네트워크 장비 관련 API 통신 모듈 (리팩토링판)
 *
 * 변경점:
 * - API_BASE를 기본 '/api'로 고정 (env 없을 때도 안전)
 * - axios 인스턴스(http) 사용 + Accept 헤더 지정
 * - 서버가 text/plain으로 JSON 문자열을 주는 경우도 자동 파싱
 * - 배열 응답 보정(ensureArray)
 * - 쿼리스트링은 params로 처리
 */

import axios, { AxiosError } from "axios";
import type { Device } from "../types/device";
import type { Port } from "../types/port";
import type { DeviceStatus } from "../types/status";

/** API 기본 URL: env가 없으면 '/api' */
const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");
const isDev = import.meta.env.DEV;

/** 공통 axios 인스턴스 */
const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { Accept: "application/json" },
});

/** 문자열 JSON도 자동 파싱 (서버가 text/plain으로 보낼 때 대비) */
http.interceptors.response.use((res) => {
  const d = res.data;
  if (typeof d === "string") {
    const s = d.trim();
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try { res.data = JSON.parse(s); } catch { /* ignore */ }
    }
  }
  return res;
});

/** 에러 메시지 추출 */
function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ message?: string }>;
    return ax.response?.data?.message ?? ax.message ?? "요청 처리 실패";
  }
  if (error instanceof Error) return error.message;
  return "요청 처리 중 알 수 없는 오류가 발생했습니다.";
}

/** 배열 보정 */
function ensureArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/* ═══════════════════════ 장비 API ═══════════════════════ */

export async function fetchDevices(): Promise<Device[]> {
  try {
    const res = await http.get("/device");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isDev) console.log("📡 /device 응답 타입:", typeof res.data, "len:", (res.data as any)?.length);
    return ensureArray<Device>(res.data);
  } catch (error) {
    console.error("장비 목록 조회 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/* ═══════════════════════ 포트 API ═══════════════════════ */

export async function fetchPortsByDevice(deviceId: number): Promise<Port[]> {
  try {
    const res = await http.get("/port", { params: { deviceId } });
    if (isDev) console.log(`📡 /port?deviceId=${deviceId} 타입:`, typeof res.data);
    return ensureArray<Port>(res.data);
  } catch (error) {
    console.error(`포트 목록 조회 실패 (deviceId: ${deviceId}):`, error);
    throw new Error(extractErrorMessage(error));
  }
}

export async function fetchAllPorts(): Promise<Port[]> {
  try {
    const res = await http.get("/ports");
    if (isDev) console.log("📡 /ports 타입:", typeof res.data);
    return ensureArray<Port>(res.data);
  } catch (error) {
    console.error("전체 포트 목록 조회 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/* ═══════════════════════ 상태 관리 ═══════════════════════ */

export async function updateDeviceStatus(
  deviceId: number,
  status: DeviceStatus,
  enablePing?: boolean
): Promise<Device> {
  try {
    const res = await http.put(`/device/${deviceId}/status`, { status, enablePing });
    if (isDev) console.log(`✍️ 상태 변경 #${deviceId} → ${status}${enablePing !== undefined ? `, ping=${enablePing}` : ""}`, res.data);
    return res.data as Device;
  } catch (error) {
    console.error("단건 상태 변경 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

export async function updateDeviceStatusBulk(params: {
  deviceIds: number[];
  status: DeviceStatus;
  enablePing?: boolean;
}): Promise<number> {
  try {
    const res = await http.put(`/device/status/bulk`, params);
    if (isDev) console.log(`✍️ 일괄 상태 변경 ${params.deviceIds.length}개 → ${params.status}`, res.data);
    return (res.data as number) ?? 0;
  } catch (error) {
    console.error("일괄 상태 변경 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/* ═══════════════════════ 삭제 ═══════════════════════ */

export async function deleteDevice(deviceId: number): Promise<void> {
  await http.delete(`/device/${deviceId}`);
}

export async function deleteCable(cableId: string | number): Promise<void> {
  await http.delete(`/cable/${cableId}`);
}
