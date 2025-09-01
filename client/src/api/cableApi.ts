/**
 * cableApi.ts - 케이블 관련 API 통신 모듈 (리팩토링판)
 *
 * 변경점
 * - API_BASE 기본 '/api' 고정 (env 없을 때도 안전)
 * - axios 인스턴스(http) 사용 + Accept 헤더 지정
 * - 서버가 text/plain으로 JSON 문자열을 반환해도 자동 파싱
 * - 배열 보정(ensureArray)로 방어적 프로그래밍
 */

import axios, { AxiosError } from "axios";
import type { CableDto } from "../types/cable";

/** trace 케이블 연결 정보 (트레이스 전용) */
export interface CableConnection {
  cableId: string;
  type: string;
  description: string;
  fromPort: { id: number; name: string; deviceName: string };
  toPort:   { id: number; name: string; deviceName: string };
}

/** API 기본 URL: env 없으면 '/api' */
const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");
const isDev = import.meta.env.DEV;

/** 공통 axios 인스턴스 */
const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { Accept: "application/json" },
});

/** 문자열 JSON도 자동 파싱 (서버가 text/plain일 때 대비) */
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

/** 에러 메시지 정규화 */
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

/* ═══════════════════════ API 함수들 ═══════════════════════ */

/** 특정 장비의 트레이스 케이블 목록 조회: GET /api/trace/cables/{deviceId} */
export async function fetchTraceCables(deviceId: number): Promise<CableConnection[]> {
  try {
    const res = await http.get(`/trace/cables/${deviceId}`);
    if (isDev) console.log(`📡 /trace/cables/${deviceId} 타입:`, typeof res.data);
    return ensureArray<CableConnection>(res.data);
  } catch (error) {
    console.error("트레이스 케이블 조회 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/** 전체 케이블 목록: GET /api/cable */
export async function fetchCables(): Promise<CableDto[]> {
  try {
    const res = await http.get(`/cable`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isDev) console.log("📡 /cable 타입:", typeof res.data, "len:", (res.data as any)?.length);
    return ensureArray<CableDto>(res.data);
  } catch (error) {
    console.error("전체 케이블 목록 조회 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}
