// src/api/deviceApi.ts

import axios from "axios";
import type { Device } from "../types/device";

// 환경별 API 기본 URL 설정
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5285/api";

// 개발 환경 감지
const isDev = import.meta.env.DEV;

/**
 * 장비 목록 조회
 * GET: /api/device
 */
export async function fetchDevices(): Promise<Device[]> {
  try {
    const res = await axios.get(`${API_BASE}/device`);
    
    if (isDev) {
      console.log("📡 장비 목록 API 응답:", res.data);
    }

    // 기본적인 응답 검증
    if (!Array.isArray(res.data)) {
      console.warn("장비 목록 응답이 배열이 아닙니다:", typeof res.data);
      return [];
    }

    return res.data;
  } catch (error) {
    console.error("장비 목록 조회 실패:", error);
    throw new Error("장비 정보를 불러올 수 없습니다.");
  }
}

/**
 * 포트 관련 타입 정의
 */
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
    
    if (isDev) {
      console.log(`📡 포트 조회 (deviceId: ${deviceId}):`, res.data);
    }

    // 기본적인 응답 검증
    if (!Array.isArray(res.data)) {
      console.warn(`포트 목록 응답이 배열이 아닙니다 (deviceId: ${deviceId}):`, typeof res.data);
      return [];
    }
    
    return res.data;
  } catch (error) {
    console.error(`포트 목록 조회 실패 (deviceId: ${deviceId}):`, error);
    throw new Error(`장비 ${deviceId}의 포트 정보를 불러올 수 없습니다.`);
  }
}

/**
 * 전체 포트 목록 조회 (장비 정보 포함)
 * GET: /api/ports
 */
export async function fetchAllPorts(): Promise<Port[]> {
  try {
    const res = await axios.get(`${API_BASE}/ports`);
    
    if (isDev) {
      console.log("📡 전체 포트 조회:", res.data);
    }

    // 기본적인 응답 검증
    if (!Array.isArray(res.data)) {
      console.warn("전체 포트 목록 응답이 배열이 아닙니다:", typeof res.data);
      return [];
    }
    
    return res.data;
  } catch (error) {
    console.error("전체 포트 목록 조회 실패:", error);
    throw new Error("포트 정보를 불러올 수 없습니다.");
  }
}