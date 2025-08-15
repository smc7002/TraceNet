// src/types/port.ts
export interface Port {
  readonly portId: number;
  readonly deviceId: number;
  readonly portNumber: number; // 1-based index
  isActive: boolean;
  name?: string | null;
}
