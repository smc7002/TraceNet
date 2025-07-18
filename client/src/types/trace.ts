// trace.ts

export interface TraceDto {
  cableId: number;
  fromDeviceId: number;
  fromDevice: string;
  fromPort: string;
  toDeviceId: number;
  toDevice: string;
  toPort: string;
}

export interface CableEdge {
  cableId: number;
  fromPortId: number;
  fromDeviceId: number;
  toPortId: number;
  toDeviceId: number;
}

export interface TraceResponse {
  startDeviceName: string;
  endDeviceName?: string;
  success: boolean;
  path: TraceDto[];       
  cables: CableEdge[];    
}
