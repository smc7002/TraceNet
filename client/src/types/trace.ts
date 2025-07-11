export interface CableEdge {
  cableId: string;
  fromPortId: number;
  fromDeviceId: number;
  toPortId: number;
  toDeviceId: number;
}

export interface TraceResponse {
  startDeviceName: string;
  endDeviceName?: string;
  success: boolean;
  //path: Device[];          // 이미 정의된 Device 타입 사용
  cables: CableEdge[];     // 🔥 여기에 포함됨
}
