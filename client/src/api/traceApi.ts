import axios, { AxiosError } from 'axios';

import type { TraceResponse } from '../types/trace';

/**
 * Fetches the Trace path for a specific device.
 * @param deviceId ID of the device to trace
 * @param opts     Options: request cancel signal, timeout in ms
 * @returns TraceResponse { path, cables, ... }
 */
export async function fetchTrace(
  deviceId: number,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<TraceResponse> {
  // Fast validation to avoid unnecessary network calls
  if (!Number.isFinite(deviceId)) throw new Error('Invalid deviceId.');

  try {
    // Runtime options (cancel/timeout) are handled only here
    const res = await axios.get<TraceResponse>(`/api/trace/${deviceId}`, {
      signal: opts.signal,
      timeout: opts.timeoutMs ?? 15000,
    });
    return res.data;
  } catch (err) {
    // Normalize user-facing message: server message → timeout/cancel → generic error
    const ax = err as AxiosError<{ message?: string }>;
    const msg =
      ax.response?.data?.message ??
      (ax.code === 'ECONNABORTED' ? 'The request timed out.' : undefined) ??
      (ax.message?.includes('canceled') ? 'The request was canceled.' : undefined) ??
      'Failed to load trace information.';
    console.error('🚨 Trace API error:', ax);
    throw new Error(msg);
  }
}
