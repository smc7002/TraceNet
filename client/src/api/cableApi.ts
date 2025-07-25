// 📁 client/src/api/cableApi.ts
import axios from "axios";
import type { CableDto } from "../types/cable";

export interface CableConnection {
  cableId: string;
  type: string;
  description: string;
  fromPort: {
    id: number;
    name: string;
    deviceName: string;
  };
  toPort: {
    id: number;
    name: string;
    deviceName: string;
  };
}

// 📡 지정된 deviceId에서 trace된 cable 목록 가져오기
export async function fetchTraceCables(
  deviceId: number
): Promise<CableConnection[]> {
  const res = await axios.get(`/api/trace/cables/${deviceId}`);
  return res.data;
}

export async function fetchCables(): Promise<CableDto[]> {
  const res = await axios.get("/api/cable");

  if (!Array.isArray(res.data)) {
    console.error("❌ fetchCables(): API 응답이 배열이 아님", res.data);
    return [];
  }

  return res.data;
}
