// rackApi.ts (리팩토링판)
import axios, { AxiosError } from "axios";

export interface Rack {
  rackId: number;
  name: string;
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

/** 문자열(JSON) 응답 자동 파싱 */
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

/** 랙 목록 조회: GET /api/rack */
export async function fetchRacks(): Promise<Rack[]> {
  try {
    const res = await http.get("/rack");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isDev) console.log("📡 /rack 타입:", typeof res.data, "len:", (res.data as any)?.length);
    return ensureArray<Rack>(res.data);
  } catch (err) {
    console.error("랙 목록 조회 실패:", err);
    throw new Error(extractErrorMessage(err));
  }
}
