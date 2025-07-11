// 📁 src/types/device.ts

export interface Device {
  deviceId: number;
  name: string;
  type: string;
  ipAddress: string;
  portCount: number;
  rackId: number;
  status: 'Online' | 'Offline' | 'Unstable' | 'Unknown';
  lastCheckedAt: string; // or Date if parsed
}
