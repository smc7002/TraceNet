// src/types/cable.ts

export interface Cable {
  cableId: number;
  type?: string;
  description?: string;
}

export interface CableDto {
  cableId: string;
  description?: string;
  fromDevice: string;
  fromDeviceId: string;
  fromPort: string;
  toDevice: string;
  toDeviceId: string;
  toPort: string;
}
