/**
 * cableApi.ts – Cable-related API client (refactored)
 *
 * Changes:
 * - Fix API_BASE default to '/api' (safe even without env)
 * - Use a shared axios instance (`http`) + Accept header
 * - Auto-parse JSON even when server returns text/plain
 * - Defensive programming via ensureArray()
 */

import axios, { AxiosError } from 'axios';

import type { CableDto } from '../types/cable';

/** Trace-only cable connection shape */
export interface CableConnection {
  cableId: string;
  type: string;
  description: string;
  fromPort: { id: number; name: string; deviceName: string };
  toPort: { id: number; name: string; deviceName: string };
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

/** Auto-parse JSON strings (in case server responds as text/plain) */
http.interceptors.response.use((res) => {
  const d = res.data;
  if (typeof d === 'string') {
    const s = d.trim();
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try {
        res.data = JSON.parse(s);
      } catch {
        /* ignore parse errors, leave as-is */
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

/** Ensure an array return (defensive) */
function ensureArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/* ═══════════════════════ API functions ═══════════════════════ */

/** Get trace cable list for a specific device: GET /api/trace/cables/{deviceId} */
export async function fetchTraceCables(deviceId: number): Promise<CableConnection[]> {
  try {
    const res = await http.get(`/trace/cables/${deviceId}`);
    if (isDev) console.log(`📡 /trace/cables/${deviceId} type:`, typeof res.data);
    return ensureArray<CableConnection>(res.data);
  } catch (error) {
    console.error('Failed to fetch trace cables:', error);
    throw new Error(extractErrorMessage(error));
  }
}

/** Get all cables: GET /api/cable */
export async function fetchCables(): Promise<CableDto[]> {
  try {
    const res = await http.get(`/cable`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (isDev) console.log('📡 /cable type:', typeof res.data, 'len:', (res.data as any)?.length);
    return ensureArray<CableDto>(res.data);
  } catch (error) {
    console.error('Failed to fetch cable list:', error);
    throw new Error(extractErrorMessage(error));
  }
}
