// 📁 src/api/deviceApi.ts

import axios from "axios";
import type { Device } from "../types/device";
import type { Port } from "../types/port";
import type { DeviceStatus } from "../types/status";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5285/api";
const isDev = import.meta.env.DEV;

/** 공통 에러 메세지 추출 (any 사용하지 않음) */
function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? error.message ?? "요청 처리 실패";
  }
  if (error instanceof Error) return error.message;
  return "요청 처리 중 알 수 없는 오류가 발생했습니다.";
}

/* -------------------- 장비 목록 -------------------- */
export async function fetchDevices(): Promise<Device[]> {
  try {
    const res = await axios.get(`${API_BASE}/device`);
    if (isDev) console.log("📡 장비 목록 API 응답:", res.data);
    if (!Array.isArray(res.data)) {
      console.warn("장비 목록 응답이 배열이 아닙니다:", typeof res.data);
      return [];
    }
    return res.data;
  } catch (error: unknown) {
    console.error("장비 목록 조회 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/* -------------------- 특정 장비 포트 -------------------- */
export async function fetchPortsByDevice(deviceId: number): Promise<Port[]> {
  try {
    const res = await axios.get(`${API_BASE}/port?deviceId=${deviceId}`);
    if (isDev) console.log(`📡 포트 조회 (deviceId: ${deviceId}):`, res.data);
    if (!Array.isArray(res.data)) {
      console.warn(`포트 목록 응답이 배열이 아닙니다 (deviceId: ${deviceId}):`, typeof res.data);
      return [];
    }
    return res.data;
  } catch (error: unknown) {
    console.error(`포트 목록 조회 실패 (deviceId: ${deviceId}):`, error);
    throw new Error(extractErrorMessage(error));
  }
}

/* -------------------- 전체 포트 -------------------- */
export async function fetchAllPorts(): Promise<Port[]> {
  try {
    const res = await axios.get(`${API_BASE}/ports`);
    if (isDev) console.log("📡 전체 포트 조회:", res.data);
    if (!Array.isArray(res.data)) {
      console.warn("전체 포트 목록 응답이 배열이 아닙니다:", typeof res.data);
      return [];
    }
    return res.data;
  } catch (error: unknown) {
    console.error("전체 포트 목록 조회 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/* -------------------- ✅ 단건 수동 상태 변경 -------------------- */
export async function updateDeviceStatus(
  deviceId: number,
  status: DeviceStatus,        // enum에 Unknown 포함되어 있으므로 별도 리터럴 불필요
  enablePing?: boolean
): Promise<Device> {
  try {
    const res = await axios.put(`${API_BASE}/device/${deviceId}/status`, { status, enablePing });
    if (isDev) console.log(`✍️ 상태 변경 완료 (#${deviceId} → ${status}${enablePing !== undefined ? `, enablePing=${enablePing}` : ""})`, res.data);
    return res.data as Device;
  } catch (error: unknown) {
    console.error("단건 상태 변경 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/* -------------------- (옵션) 일괄 상태 변경 -------------------- */
export async function updateDeviceStatusBulk(params: {
  deviceIds: number[];
  status: DeviceStatus;
  enablePing?: boolean;
}): Promise<number> {
  try {
    const res = await axios.put(`${API_BASE}/device/status/bulk`, params);
    if (isDev) console.log(`✍️ 일괄 상태 변경 완료 (${params.deviceIds.length}개 → ${params.status})`, res.data);
    return (res.data as number) ?? 0; // 서버가 변경 수(int) 반환한다고 가정
  } catch (error: unknown) {
    console.error("일괄 상태 변경 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

export async function deleteDevice(deviceId: number): Promise<void> {
  await axios.delete(`${API_BASE}/device/${deviceId}`);
}

export async function deleteCable(cableId: string | number): Promise<void> {
  await axios.delete(`${API_BASE}/cable/${cableId}`);
}