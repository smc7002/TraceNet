/**
 * deviceApi.ts - 네트워크 장비 관련 API 통신 모듈
 * 
 * 백엔드 의존성:
 * - GET /api/device - 전체 장비 목록
 * - GET /api/port?deviceId={id} - 특정 장비 포트 목록
 * - GET /api/ports - 전체 포트 목록
 * - PUT /api/device/{id}/status - 단일 장비 상태 변경
 * - PUT /api/device/status/bulk - 다중 장비 상태 일괄 변경
 * - DELETE /api/device/{id} - 장비 삭제
 * - DELETE /api/cable/{id} - 케이블 삭제
 * 
 * 주요 기능:
 * - 장비 CRUD 작업
 * - 실시간 상태 관리 (Online/Offline/Unstable/Unknown)
 * - 포트 정보 조회 (스위치 포트 상태용)
 * - 관리자용 일괄 작업 지원
 * 
 * 에러 처리 전략:
 * - 타입 안전한 에러 메시지 추출
 * - 개발 환경에서 상세 로깅
 * - 방어적 프로그래밍 (배열 응답 검증)
 */

import axios from "axios";
import type { Device } from "../types/device";
import type { Port } from "../types/port";
import type { DeviceStatus } from "../types/status";

/**
 * API 기본 URL 설정
 * 
 * 환경별 구성:
 * - 개발: VITE_API_BASE 환경변수 또는 기본 localhost
 * - 프로덕션: 빌드 시 환경변수로 주입
 */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5285/api";

/**
 * 개발 환경 여부 판단
 * 디버그 로깅 활성화/비활성화에 사용
 */
const isDev = import.meta.env.DEV;

/**
 * 타입 안전한 에러 메시지 추출 함수
 * 
 * 처리 우선순위:
 * 1. Axios 에러 → 서버 응답 메시지 추출
 * 2. 일반 Error 객체 → message 속성
 * 3. 알 수 없는 타입 → 기본 메시지
 * 
 * any 타입 사용 없이 안전한 타입 가드 구현
 * 
 * @param error 에러 객체 (unknown 타입)
 * @returns 사용자에게 표시할 에러 메시지
 */
function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    return data?.message ?? error.message ?? "요청 처리 실패";
  }
  if (error instanceof Error) return error.message;
  return "요청 처리 중 알 수 없는 오류가 발생했습니다.";
}

/* ═══════════════════════ 장비 관리 API ═══════════════════════ */

/**
 * 전체 장비 목록 조회
 * 
 * API 엔드포인트: GET /api/device
 * 
 * 사용 시나리오:
 * - 애플리케이션 초기 로딩
 * - 네트워크 다이어그램 노드 렌더링
 * - 케이블 폼에서 장비 선택 옵션 제공
 * 
 * 데이터 안전성:
 * - 응답이 배열이 아닌 경우 빈 배열 반환
 * - 개발 환경에서 응답 데이터 로깅
 * 
 * @returns Promise<Device[]> 장비 목록 배열
 * @throws Error 네트워크 오류 또는 서버 에러 시
 * 
 * @example
 * ```typescript
 * const devices = await fetchDevices();
 * console.log(`총 ${devices.length}개 장비 로딩됨`);
 * ```
 */
export async function fetchDevices(): Promise<Device[]> {
  try {
    const res = await axios.get(`${API_BASE}/device`);
    if (isDev) console.log("📡 장비 목록 API 응답:", res.data);
    
    if (!Array.isArray(res.data)) {
      console.warn("장비 목록 응답이 배열이 아닙니다:", typeof res.data);
      return [];
    }
    return res.data;
  } catch (error: unknown) {
    console.error("장비 목록 조회 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/* ═══════════════════════ 포트 관리 API ═══════════════════════ */

/**
 * 특정 장비의 포트 목록 조회
 * 
 * API 엔드포인트: GET /api/port?deviceId={deviceId}
 * 
 * 사용 시나리오:
 * - SidePanel에서 스위치 포트 연결 상태 표시
 * - 특정 장비의 포트 상세 정보 필요할 때
 * - 케이블 연결 시 사용 가능한 포트 조회
 * 
 * @param deviceId 조회할 장비의 고유 ID
 * @returns Promise<Port[]> 해당 장비의 포트 목록
 * @throws Error 네트워크 오류 또는 서버 에러 시
 * 
 * @example
 * ```typescript
 * // 스위치 ID 5번의 포트 목록 조회
 * const switchPorts = await fetchPortsByDevice(5);
 * console.log(`스위치에 ${switchPorts.length}개 포트 존재`);
 * ```
 */
export async function fetchPortsByDevice(deviceId: number): Promise<Port[]> {
  try {
    const res = await axios.get(`${API_BASE}/port?deviceId=${deviceId}`);
    if (isDev) console.log(`📡 포트 조회 (deviceId: ${deviceId}):`, res.data);
    
    if (!Array.isArray(res.data)) {
      console.warn(`포트 목록 응답이 배열이 아닙니다 (deviceId: ${deviceId}):`, typeof res.data);
      return [];
    }
    return res.data;
  } catch (error: unknown) {
    console.error(`포트 목록 조회 실패 (deviceId: ${deviceId}):`, error);
    throw new Error(extractErrorMessage(error));
  }
}

/**
 * 전체 포트 목록 조회
 * 
 * API 엔드포인트: GET /api/ports
 * 
 * 사용 시나리오:
 * - CableForm에서 모든 포트 옵션 제공
 * - 전체 네트워크 포트 현황 분석
 * - 포트별 케이블 연결 매핑 생성
 * 
 * @returns Promise<Port[]> 전체 포트 목록 배열
 * @throws Error 네트워크 오류 또는 서버 에러 시
 * 
 * @example
 * ```typescript
 * const allPorts = await fetchAllPorts();
 * const portsByDevice = groupBy(allPorts, 'deviceId');
 * ```
 */
export async function fetchAllPorts(): Promise<Port[]> {
  try {
    const res = await axios.get(`${API_BASE}/ports`);
    if (isDev) console.log("📡 전체 포트 조회:", res.data);
    
    if (!Array.isArray(res.data)) {
      console.warn("전체 포트 목록 응답이 배열이 아닙니다:", typeof res.data);
      return [];
    }
    return res.data;
  } catch (error: unknown) {
    console.error("전체 포트 목록 조회 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/* ═══════════════════════ 장비 상태 관리 API ═══════════════════════ */

/**
 * 단일 장비 상태 변경
 * 
 * API 엔드포인트: PUT /api/device/{deviceId}/status
 * 
 * 사용 시나리오:
 * - SidePanel에서 개별 장비 상태 수동 변경
 * - Ping 활성화/비활성화 토글
 * - 관리자의 장비 상태 강제 설정
 * 
 * 상태 변경 규칙:
 * - Online: 정상 작동 상태
 * - Offline: 응답 없음 또는 의도적 차단
 * - Unstable: 간헐적 응답 또는 성능 이슈
 * - Unknown: 상태 확인 불가
 * 
 * @param deviceId 상태를 변경할 장비 ID
 * @param status 새로운 장비 상태
 * @param enablePing Ping 활성화 여부 (선택사항)
 * @returns Promise<Device> 업데이트된 장비 정보
 * @throws Error 권한 없음, 장비 없음, 네트워크 오류 등
 * 
 * @example
 * ```typescript
 * // PC-01을 오프라인으로 설정하고 Ping 비활성화
 * const updated = await updateDeviceStatus(5, "Offline", false);
 * console.log(`${updated.name} 상태 변경됨: ${updated.status}`);
 * ```
 */
export async function updateDeviceStatus(
  deviceId: number,
  status: DeviceStatus,
  enablePing?: boolean
): Promise<Device> {
  try {
    const res = await axios.put(`${API_BASE}/device/${deviceId}/status`, { 
      status, 
      enablePing 
    });
    if (isDev) {
      console.log(
        `✍️ 상태 변경 완료 (#${deviceId} → ${status}${
          enablePing !== undefined ? `, enablePing=${enablePing}` : ""
        })`, 
        res.data
      );
    }
    return res.data as Device;
  } catch (error: unknown) {
    console.error("단건 상태 변경 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/**
 * 다중 장비 상태 일괄 변경
 * 
 * API 엔드포인트: PUT /api/device/status/bulk
 * 
 * 사용 시나리오:
 * - 관리자의 전체 장비 상태 일괄 설정
 * - 특정 조건의 장비들 상태 동시 변경
 * - 시스템 점검 모드 진입/해제
 * 
 * 성능 고려사항:
 * - 대량 장비 처리 시 서버 응답 시간 증가 가능
 * - 부분 실패 시에도 성공한 장비 수 반환
 * 
 * @param params 일괄 변경 파라미터
 * @param params.deviceIds 변경할 장비 ID 배열
 * @param params.status 새로운 상태
 * @param params.enablePing Ping 활성화 여부 (선택사항)
 * @returns Promise<number> 실제 변경된 장비 수
 * @throws Error 권한 없음, 잘못된 파라미터, 네트워크 오류 등
 * 
 * @example
 * ```typescript
 * // 모든 PC를 온라인으로 설정하고 Ping 활성화
 * const pcIds = devices.filter(d => d.type === 'PC').map(d => d.deviceId);
 * const changed = await updateDeviceStatusBulk({
 *   deviceIds: pcIds,
 *   status: "Online",
 *   enablePing: true
 * });
 * console.log(`${changed}개 PC 상태 변경됨`);
 * ```
 */
export async function updateDeviceStatusBulk(params: {
  deviceIds: number[];
  status: DeviceStatus;
  enablePing?: boolean;
}): Promise<number> {
  try {
    const res = await axios.put(`${API_BASE}/device/status/bulk`, params);
    if (isDev) {
      console.log(
        `✍️ 일괄 상태 변경 완료 (${params.deviceIds.length}개 → ${params.status})`, 
        res.data
      );
    }
    return (res.data as number) ?? 0; // 서버가 변경된 장비 수 반환
  } catch (error: unknown) {
    console.error("일괄 상태 변경 실패:", error);
    throw new Error(extractErrorMessage(error));
  }
}

/* ═══════════════════════ 삭제 작업 API ═══════════════════════ */

/**
 * 장비 삭제
 * 
 * API 엔드포인트: DELETE /api/device/{deviceId}
 * 
 * 사용 시나리오:
 * - SidePanel에서 장비 삭제 버튼 클릭
 * - 시스템에서 더 이상 사용하지 않는 장비 제거
 * 
 * 주의사항:
 * - CASCADE 삭제: 연결된 케이블도 함께 삭제됨
 * - 복구 불가능한 작업이므로 사용자 확인 필수
 * - 네트워크 토폴로지에 영향을 미칠 수 있음
 * 
 * @param deviceId 삭제할 장비의 고유 ID
 * @returns Promise<void> 삭제 완료 시 resolve
 * @throws Error 권한 없음, 장비 없음, 참조 무결성 오류 등
 * 
 * @example
 * ```typescript
 * if (confirm('정말 삭제하시겠습니까?')) {
 *   await deleteDevice(5);
 *   console.log('장비 삭제 완료');
 * }
 * ```
 */
export async function deleteDevice(deviceId: number): Promise<void> {
  await axios.delete(`${API_BASE}/device/${deviceId}`);
}

/**
 * 케이블 삭제
 * 
 * API 엔드포인트: DELETE /api/cable/{cableId}
 * 
 * 사용 시나리오:
 * - SidePanel에서 케이블 정보 보기 중 삭제
 * - 잘못 등록된 케이블 연결 제거
 * - 네트워크 재구성 시 기존 연결 정리
 * 
 * 파라미터 유연성:
 * - string | number 타입 지원 (백엔드 구현에 따라)
 * - API가 다양한 ID 형식 허용할 수 있음
 * 
 * @param cableId 삭제할 케이블의 고유 ID
 * @returns Promise<void> 삭제 완료 시 resolve
 * @throws Error 권한 없음, 케이블 없음, 네트워크 오류 등
 * 
 * @example
 * ```typescript
 * // 문자열 ID로 케이블 삭제
 * await deleteCable("CABLE-001");
 * 
 * // 숫자 ID로 케이블 삭제
 * await deleteCable(123);
 * ```
 */
export async function deleteCable(cableId: string | number): Promise<void> {
  await axios.delete(`${API_BASE}/cable/${cableId}`);
}