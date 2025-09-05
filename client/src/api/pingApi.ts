/**
 * @fileoverview Network Device Ping API Client
 * @description API client for the Ping features of the TraceNet network monitoring system
 */

import axios from 'axios';

import type { MultiPingRequestDto, PingResultDto, TracePingResultDto } from '../types/ping';

// API base URL — override with env in production
const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '');

/**
 * Executes a Ping test for a single device.
 *
 * @description
 * Checks connectivity for the network device corresponding to the given device ID.
 * Classifies status based on response time and packet loss rate.
 *
 * @param {number} deviceId - Unique identifier of the device to ping
 * @returns {Promise<PingResultDto>} Ping result (status, latency, timestamp, etc.)
 *
 * @throws {Error} Throws on network errors, missing device, or insufficient permissions
 *
 * @example
 * ```typescript
 * try {
 *   const result = await pingDevice(123);
 *   console.log(`Status: ${result.status}, Latency: ${result.latencyMs}ms`);
 * } catch (error) {
 *   console.error('Ping failed:', (error as Error).message);
 * }
 * ```
 */
export async function pingDevice(deviceId: number): Promise<PingResultDto> {
  try {
    console.log(`📡 Single ping start: Device ID ${deviceId}`);

    const response = await axios.post<PingResultDto>(`${API_BASE}/device/${deviceId}/ping`, {
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(`✅ Single ping complete: ${response.data.deviceName} - ${response.data.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Single ping failed (Device ID: ${deviceId}):`, error);
    throw new Error(`Failed to ping Device ID ${deviceId}.`);
  }
}

/**
 * Executes a batch Ping test for multiple devices.
 *
 * @description
 * Pings multiple selected devices in parallel to check network status in bulk.
 * Processed asynchronously on the server to optimize overall response time.
 *
 * @param {MultiPingRequestDto} request - Batch Ping request (includes an array of device IDs)
 * @returns {Promise<PingResultDto[]>} Array of per-device Ping results
 *
 * @throws {Error} Throws on network connectivity or server errors
 *
 * @performance
 * - Recommended max concurrent pings: 50
 * - Expected processing time: ~2–5s per device
 *
 * @example
 * ```typescript
 * const request = { deviceIds: [1, 2, 3, 4, 5] };
 * const results = await pingMultipleDevices(request);
 * const onlineCount = results.filter(r => r.status === 'Online').length;
 * ```
 */
export async function pingMultipleDevices(request: MultiPingRequestDto): Promise<PingResultDto[]> {
  try {
    console.log(`📡 Batch ping start: ${request.deviceIds.length} devices`);

    const response = await axios.post<PingResultDto[]>(`${API_BASE}/device/ping/multi`, request, {
      headers: { 'Content-Type': 'application/json' },
    });

    const results = response.data;

    // Compute and log summary
    const online = results.filter((r) => r.status === 'Online').length;
    const offline = results.filter((r) => r.status === 'Offline').length;
    const unstable = results.filter((r) => r.status === 'Unstable').length;

    console.log(
      `✅ Batch ping complete: total ${results.length} — online: ${online}, offline: ${offline}, unstable: ${unstable}`,
    );
    return results;
  } catch (error) {
    console.error('❌ Batch ping failed:', error);
    throw new Error('Failed to ping multiple devices.');
  }
}

/**
 * Executes a full Ping test for all registered devices.
 *
 * @description
 * Checks the status of all network devices registered in the database.
 * Useful for understanding overall connectivity in large-scale networks.
 *
 * @returns {Promise<PingResultDto[]>} Array of Ping results for all devices
 *
 * @throws {Error} Provides specific error messages for various network/server failures
 *
 * @performance
 * - Current environment: ~5–8s for ~200 devices
 * - Bandwidth: ~50–100KB data transfer
 * - Timeout: 2000ms per device
 *
 * @security
 * Consider the following in production:
 * - ICMP allowance per network policy
 * - Firewall/security group rules
 * - Prevent excessive Ping traffic that could cause load
 *
 * @example
 * ```typescript
 * try {
 *   const allResults = await pingAllDevices();
 *   const healthReport = {
 *     total: allResults.length,
 *     online: allResults.filter(r => r.status === 'Online').length,
 *     issues: allResults.filter(r => r.status !== 'Online').length
 *   };
 *   console.log('Network health report:', healthReport);
 * } catch (error) {
 *   console.error('Full ping failed:', (error as Error).message);
 * }
 * ```
 */
export async function pingAllDevices(): Promise<PingResultDto[]> {
  try {
    console.log('📡 Full ping start: all registered devices');

    const response = await axios.post<PingResultDto[]>(
      `${API_BASE}/device/ping/all`,
      {},
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const results = response.data;

    // Aggregate by status
    const online = results.filter((r) => r.status === 'Online').length;
    const offline = results.filter((r) => r.status === 'Offline').length;
    const unstable = results.filter((r) => r.status === 'Unstable').length;
    const unreachable = results.filter((r) => r.status === 'Unreachable').length;

    console.log(
      `✅ Full ping complete: total ${results.length} — online: ${online}, offline: ${offline}, unstable: ${unstable}, unreachable: ${unreachable}`,
    );
    return results;
  } catch (error) {
    // Detailed handling per network error
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to the server. Please check your network.');
      }
      if (error.response?.status === 500) {
        throw new Error('A server error occurred. Please contact the administrator.');
      }
    }
    throw new Error('Failed to ping all devices.');
  }
}

/**
 * Pings all devices included in the TracePath from a given starting device.
 *
 * @description
 * Checks connectivity for every intermediate device that appears in the
 * network path tracing (TracePath) result. Useful for quickly identifying
 * issues along the network route.
 *
 * @param {number} deviceId - ID of the device that serves as the TracePath starting point
 * @returns {Promise<TracePingResultDto>} Ping results and summary for all devices on the path
 *
 * @throws {Error} Throws on trace failures or ping test errors
 *
 * @use_case
 * - Diagnose outages along a path
 * - Determine the cause of issues for a specific device
 * - Inspect overall topology health
 *
 * @integration
 * Works in conjunction with the TraceController’s path-tracing feature.
 * A valid TracePath should be obtained first for accurate results.
 *
 * @example
 * ```typescript
 * // Check the status of all devices along the path from a specific PC to a server
 * const traceResult = await pingTracePath(42);
 * console.log(`On-path devices: ${traceResult.totalDevices}, online: ${traceResult.onlineDevices}`);
 *
 * if (traceResult.offlineDevices > 0) {
 *   console.log('Offline devices found along the path. A network check is recommended.');
 * }
 * ```
 */
export async function pingTracePath(deviceId: number): Promise<TracePingResultDto> {
  try {
    console.log(`📡 TracePath ping start: Device ID ${deviceId}`);

    const response = await axios.get<TracePingResultDto>(`${API_BASE}/trace/${deviceId}/ping`);

    const result = response.data;
    console.log(
      `✅ TracePath ping complete: ${result.totalDevices} devices — online: ${result.onlineDevices}, offline: ${result.offlineDevices}`,
    );
    return result;
  } catch (error) {
    console.error(`❌ TracePath ping failed (Device ID: ${deviceId}):`, error);
    throw new Error(`Failed to ping TracePath for Device ID ${deviceId}.`);
  }
}

/**
 * @todo Future improvements
 *
 * 1. Real-time ping monitoring
 *    - Live updates via WebSocket
 *    - Periodic auto-ping scheduling
 *
 * 2. Performance optimization
 *    - Caching for ping results
 *    - Partial updates support
 *    - Dynamic batch sizing
 *
 * 3. Advanced diagnostics
 *    - Traceroute integration
 *    - Detailed packet loss analysis
 *    - Latency history tracking
 *
 * 4. Security hardening
 *    - API key–based authentication
 *    - Implement rate limiting
 *    - Audit logging
 */

/**
 * @deployment_guide Deployment checklist
 *
 * 1. Network environment
 *    - Verify ICMP allowance policy
 *    - Open firewall ports if needed
 *    - Validate DNS configuration
 *
 * 2. Server settings
 *    - Set API_BASE to the actual server address
 *    - Tune timeout values for the environment
 *    - Configure log levels
 *
 * 3. Permissions
 *    - Ensure network privileges for the server app
 *    - Configure OS-level ICMP permissions
 *    - Review user account privileges
 */
