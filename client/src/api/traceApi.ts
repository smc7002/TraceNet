import axios from "axios";
import type { Device } from "../types/device";

export interface TraceResponse {
  path: Device[];
  cableCount: number;
}

export async function fetchTrace(deviceId: number): Promise<TraceResponse> {
  const res = await axios.get(`/api/trace/${deviceId}`);
  return res.data;
}
