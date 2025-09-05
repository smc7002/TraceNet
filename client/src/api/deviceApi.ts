/**
 * deviceApi.ts - Network device API client
 */

import axios, { AxiosError } from 'axios';

import type { Device } from '../types/device';
import type { Port } from '../types/port';
import type { DeviceStatus } from '../types/status';

/** Base API URL: defaults to '/api' when env is absent */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '');
const isDev = import.meta.env.DEV;

/** Shared axios instance */
const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { Accept: 'application/json' },
});

/** Auto-parse JSON strings (in case server responds with text/plain) */
http.interceptors.response.use((res) => {
  const d = res.data;
  if (typeof d === 'string') {
    const s = d.trim();
    if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
      try {
        res.data = JSON.parse(s);
      } catch {
        /* ignore malformed JSON */
      }
    }
  }
  return res;
});

/** Extract human-readable error message */
function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ message?: string }>;
    return ax.response?.data?.message ?? ax.message ?? 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return 'An unknown error occurred while processing the request.';
}

/** Ensure the value is an array (otherwise return empty array) */
function ensureArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

/* ═══════════════════════ Device API ═══════════════════════ */

export async function fetchDevices(): Promise<Device[]> {
  try {
    const res = await http.get('/device');

    if (isDev) {
      const data: unknown = res.data;

      // Array check
      if (Array.isArray(data)) {
        console.log('📡 /device response type:', typeof data, 'len:', data.length);
      }
      // Object with a length-like property
      else if (data && typeof data === 'object' && 'length' in data) {
        const len = (data as { length?: number }).length;
        console.log(
          '📡 /device response type:',
          typeof data,
          'len:',
          typeof len === 'number' ? len : 'unknown',
        );
      }
      // Otherwise
      else {
        console.log('📡 /device response type:', typeof data, 'len: unknown');
      }
    }

    return ensureArray<Device>(res.data);
  } catch (error) {
    console.error('Failed to fetch device list:', error);
    throw new Error(extractErrorMessage(error));
  }
}

/* ═══════════════════════ Port API ═══════════════════════ */

export async function fetchPortsByDevice(deviceId: number): Promise<Port[]> {
  try {
    const res = await http.get('/port', { params: { deviceId } });
    if (isDev) console.log(`📡 /port?deviceId=${deviceId} type:`, typeof res.data);
    return ensureArray<Port>(res.data);
  } catch (error) {
    console.error(`Failed to fetch ports (deviceId: ${deviceId}):`, error);
    throw new Error(extractErrorMessage(error));
  }
}

export async function fetchAllPorts(): Promise<Port[]> {
  try {
    const res = await http.get('/ports');
    if (isDev) console.log('📡 /ports type:', typeof res.data);
    return ensureArray<Port>(res.data);
  } catch (error) {
    console.error('Failed to fetch all ports:', error);
    throw new Error(extractErrorMessage(error));
  }
}

/* ═══════════════════════ Status Management ═══════════════════════ */

export async function updateDeviceStatus(
  deviceId: number,
  status: DeviceStatus,
  enablePing?: boolean,
): Promise<Device> {
  try {
    const res = await http.put(`/device/${deviceId}/status`, { status, enablePing });
    if (isDev)
      console.log(
        `✍️ status change #${deviceId} → ${status}${
          enablePing !== undefined ? `, ping=${enablePing}` : ''
        }`,
        res.data,
      );
    return res.data as Device;
  } catch (error) {
    console.error('Failed to update device status:', error);
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
    if (isDev)
      console.log(
        `✍️ bulk status change ${params.deviceIds.length} items → ${params.status}`,
        res.data,
      );
    return (res.data as number) ?? 0;
  } catch (error) {
    console.error('Failed to update device status in bulk:', error);
    throw new Error(extractErrorMessage(error));
  }
}

/* ═══════════════════════ Deletion ═══════════════════════ */

export async function deleteDevice(deviceId: number): Promise<void> {
  await http.delete(`/device/${deviceId}`);
}

export async function deleteCable(cableId: string | number): Promise<void> {
  await http.delete(`/cable/${cableId}`);
}
