// src/types/port.ts
import type { CableConnection } from "../types/cableConnection"; // 없으면 아래에 같이 만들자

export interface Port {
  portId: number;
  name: string;
  connectionCableConnectionId?: number;
  deviceId: number;
  connection?: CableConnection;
  toConnections?: CableConnection[];
}
