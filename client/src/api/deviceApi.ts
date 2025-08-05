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

// 🔌 포트 관련 타입 정의
export interface Port {
  portId: number;
  deviceId: number;
  portNumber: number;
  isActive: boolean;
  device?: {
    deviceId: number;
    name: string;
    type: string;
    ipAddress?: string;
    status: string;
  };
}

/**
 * 특정 장비의 포트 목록 조회
 * GET: /api/port?deviceId=3
 */
export async function fetchPortsByDevice(deviceId: number): Promise<Port[]> {
  try {
    const res = await axios.get(`${API_BASE}/port?deviceId=${deviceId}`);
    
    console.log(`📡 포트 조회 (deviceId: ${deviceId}):`, res.data);
    
    return res.data;
  } catch (error) {
    console.error(`❌ fetchPortsByDevice 에러 (deviceId: ${deviceId}):`, error);
    throw error;
  }
}

/**
 * 전체 포트 목록 조회 (장비 정보 포함)
 * GET: /api/ports
 */
export async function fetchAllPorts(): Promise<Port[]> {
  try {
    const res = await axios.get(`${API_BASE}/ports`);
    
    console.log("📡 전체 포트 조회:", res.data);
    
    return res.data;
  } catch (error) {
    console.error("❌ fetchAllPorts 에러:", error);
    throw error;
  }
}