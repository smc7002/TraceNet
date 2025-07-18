// 📁 src/types/device.ts

import type { Port } from "../types/port";

export interface Device {
  deviceId: number;
  name: string;
  type: string;
  ipAddress: string;
  ports?: Port[];
  portCount: number;
  rackId: number;
  status: 'Online' | 'Offline' | 'Unstable' | 'Unknown';
  lastCheckedAt: string; // or Date if parsed
}
