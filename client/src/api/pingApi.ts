// 📁 src/api/pingApi.ts

import axios from "axios";
import type { PingResultDto, MultiPingRequestDto, TracePingResultDto } from "../types/ping";

const API_BASE = "http://localhost:5285/api";

/**
 * 단일 장비 Ping을 실행합니다.
 * @param deviceId 핑할 장비의 ID
 * @returns PingResultDto
 */
export async function pingDevice(deviceId: number): Promise<PingResultDto> {
  try {
    console.log(`📡 단일 Ping 시작: Device ID ${deviceId}`);
    
    const response = await axios.post<PingResultDto>(`${API_BASE}/device/${deviceId}/ping`, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`✅ 단일 Ping 완료: ${response.data.deviceName} - ${response.data.status}`);
    return response.data;
  } catch (error) {
    console.error(`❌ 단일 Ping 실패 (Device ID: ${deviceId}):`, error);
    throw new Error(`Device ID ${deviceId} Ping에 실패했습니다.`);
  }
}

/**
 * 여러 장비를 일괄 Ping합니다.
 * @param request MultiPingRequestDto
 * @returns PingResultDto[]
 */
export async function pingMultipleDevices(request: MultiPingRequestDto): Promise<PingResultDto[]> {
  try {
    console.log(`📡 일괄 Ping 시작: ${request.deviceIds.length}개 장비`);
    
    const response = await axios.post<PingResultDto[]>(`${API_BASE}/device/ping/multi`, request, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    const results = response.data;
    const online = results.filter(r => r.status === "Online").length;
    const offline = results.filter(r => r.status === "Offline").length;
    const unstable = results.filter(r => r.status === "Unstable").length;
    
    console.log(`✅ 일괄 Ping 완료: 총 ${results.length}개 - 온라인: ${online}, 오프라인: ${offline}, 불안정: ${unstable}`);
    return results;
  } catch (error) {
    console.error("❌ 일괄 Ping 실패:", error);
    throw new Error("여러 장비 Ping에 실패했습니다.");
  }
}

/**
 * 모든 장비를 Ping합니다.
 * @returns PingResultDto[]
 */
export async function pingAllDevices(): Promise<PingResultDto[]> {
  try {
    console.log("📡 전체 Ping 시작: 모든 등록된 장비");
    
    const response = await axios.post<PingResultDto[]>(`${API_BASE}/device/ping/all`, {}, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    const results = response.data;
    const online = results.filter(r => r.status === "Online").length;
    const offline = results.filter(r => r.status === "Offline").length;
    const unstable = results.filter(r => r.status === "Unstable").length;
    const unreachable = results.filter(r => r.status === "Unreachable").length;
    
    console.log(`✅ 전체 Ping 완료: 총 ${results.length}개 - 온라인: ${online}, 오프라인: ${offline}, 불안정: ${unstable}, 도달불가: ${unreachable}`);
    return results;
  } catch (error) {
    console.error("❌ 전체 Ping 실패:", error);
    throw new Error("모든 장비 Ping에 실패했습니다.");
  }
}

/**
 * TracePath에 포함된 장비들을 Ping합니다.
 * @param deviceId Trace 시작 장비의 ID
 * @returns TracePingResultDto
 */
export async function pingTracePath(deviceId: number): Promise<TracePingResultDto> {
  try {
    console.log(`📡 TracePath Ping 시작: Device ID ${deviceId}`);
    
    const response = await axios.get<TracePingResultDto>(`${API_BASE}/trace/${deviceId}/ping`);
    
    const result = response.data;
    console.log(`✅ TracePath Ping 완료: ${result.totalDevices}개 장비 - 온라인: ${result.onlineDevices}, 오프라인: ${result.offlineDevices}`);
    return result;
  } catch (error) {
    console.error(`❌ TracePath Ping 실패 (Device ID: ${deviceId}):`, error);
    throw new Error(`Device ID ${deviceId}의 TracePath Ping에 실패했습니다.`);
  }
}