// 📁 src/api/deviceApi.ts

import axios from "axios";
import type { Device } from "../types/device";

const API_BASE = "http://localhost:5285/api";

export async function fetchDevices(): Promise<Device[]> {
  try {
    const res = await axios.get(`${API_BASE}/device`);
    console.log("📡 API 응답 전체:", res); // 👉 응답 전체 로그
    console.log("📡 res.data:", res.data); // 👉 실제 데이터 부분만 확인

    return res.data;
  } catch (error) {
    console.error("❌ fetchDevices 에러:", error);
    throw error;
  }
}
