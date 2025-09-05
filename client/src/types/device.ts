/**
 * device.ts — Network device type definitions
 *
 * Purpose: model physical network devices (PC, Switch, Server, etc.)
 * Data sources: GET /api/device responses; device create/update APIs.
 */

import type { Port } from '../types/port';
import { DeviceStatus } from './status';

/** Network device interface */
export interface Device {
  /** Unique device identifier (primary key) */
  deviceId: number;

  /** Device name (e.g., "ServerRoom-PC-01", "SW-Core-01") */
  name: string;

  /** Device type */
  type: string;

  /** IP address (e.g., "192.168.1.100"; may be empty when using DHCP) */
  ipAddress?: string | null;

  /**
   * Associated ports (optional join)
   * Include when detailed port info is needed (e.g., SidePanel port state).
   * Omit for basic lists to keep payloads small.
   */
  ports?: Port[];

  /** Total number of physical ports (1–999) */
  portCount: number;

  /** Rack ID (required for switches) */
  rackId?: number | null;

  /** Rack name (switch-only; provided by backend) */
  rackName?: string;

  /** Whether this device participates in bulk Ping monitoring */
  enablePing: boolean;

  /** Current device status (Online / Offline / Unstable / Unknown) */
  status: DeviceStatus;

  /** Last health-check timestamp (ISO string; parse to Date if needed) */
  lastCheckedAt?: string | null;
}
