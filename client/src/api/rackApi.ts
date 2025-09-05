// rackApi.ts
import axios, { AxiosError } from 'axios';

export interface Rack {
  rackId: number;
  name: string;
}

/** API base URL: falls back to '/api' when env is missing */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '');
const isDev = import.meta.env.DEV;

/** Shared axios instance */
const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

/** Auto-parse string(JSON) responses */
http.interceptors.response.use((res) => {
  const d = res.data;
  if (typeof d === 'string') {
    const s = d.trim();
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try {
        res.data = JSON.parse(s);
      } catch {
        /* ignore */
      }
    }
  }
  return res;
});

/** Normalize error message */
function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ message?: string }>;
    return ax.response?.data?.message ?? ax.message ?? 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return 'An unknown error occurred while processing the request.';
}

/** Ensure array (defensive) */
function ensureArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/** Fetch rack list: GET /api/rack */
export async function fetchRacks(): Promise<Rack[]> {
  try {
    const res = await http.get('/rack');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isDev) console.log('📡 /rack type:', typeof res.data, 'len:', (res.data as any)?.length);
    return ensureArray<Rack>(res.data);
  } catch (err) {
    console.error('Failed to fetch rack list:', err);
    throw new Error(extractErrorMessage(err));
  }
}
