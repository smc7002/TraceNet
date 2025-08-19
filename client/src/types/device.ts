// src/types/device.ts

import type { Port } from "../types/port";
import { DeviceStatus } from "./status";

export interface Device {
  deviceId: number;
  name: string;
  type: string;
  ipAddress: string;
  ports?: Port[];
  portCount: number;
  rackId: number;
  enablePing: boolean;
  status: DeviceStatus;
  lastCheckedAt: string; // or Date if parsed
}
