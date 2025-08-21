/**
 * @fileoverview Network Device Ping API Client
 * @description TraceNet 네트워크 모니터링 시스템의 Ping 기능을 위한 API 클라이언트
 */

import axios from "axios";
import type {
  PingResultDto,
  MultiPingRequestDto,
  TracePingResultDto,
} from "../types/ping";

// API 기본 URL 설정 - 실제 배포 시 환경변수로 변경
const API_BASE = "http://localhost:5285/api";

/**
 * 단일 장비에 대한 Ping 테스트를 수행합니다.
 * 
 * @description 
 * 지정된 장비 ID에 해당하는 네트워크 장비의 연결 상태를 확인합니다.
 * 응답 시간과 패킷 손실률을 기반으로 상태를 분류합니다.
 * 
 * @param {number} deviceId - 핑할 장비의 고유 식별자
 * @returns {Promise<PingResultDto>} Ping 테스트 결과 (상태, 지연시간, 타임스탬프 포함)
 * 
 * @throws {Error} 네트워크 오류, 장비 미존재, 권한 부족 시 예외 발생
 * 
 * @example
 * ```typescript
 * try {
 *   const result = await pingDevice(123);
 *   console.log(`장비 상태: ${result.status}, 지연시간: ${result.latencyMs}ms`);
 * } catch (error) {
 *   console.error('Ping 실패:', error.message);
 * }
 * ```
 */
export async function pingDevice(deviceId: number): Promise<PingResultDto> {
  try {
    console.log(`📡 단일 Ping 시작: Device ID ${deviceId}`);

    const response = await axios.post<PingResultDto>(
      `${API_BASE}/device/${deviceId}/ping`,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    console.log(
      `✅ 단일 Ping 완료: ${response.data.deviceName} - ${response.data.status}`
    );
    return response.data;
  } catch (error) {
    console.error(`❌ 단일 Ping 실패 (Device ID: ${deviceId}):`, error);
    throw new Error(`Device ID ${deviceId} Ping에 실패했습니다.`);
  }
}

/**
 * 여러 장비에 대한 일괄 Ping 테스트를 수행합니다.
 * 
 * @description 
 * 선택된 여러 장비들을 병렬로 Ping하여 네트워크 상태를 일괄 확인합니다.
 * 서버에서 비동기적으로 처리되어 전체 응답 시간을 최적화합니다.
 * 
 * @param {MultiPingRequestDto} request - 일괄 Ping 요청 객체 (장비 ID 배열 포함)
 * @returns {Promise<PingResultDto[]>} 각 장비별 Ping 테스트 결과 배열
 * 
 * @throws {Error} 네트워크 연결 실패 또는 서버 오류 시 예외 발생
 * 
 * @performance 
 * - 권장 최대 동시 Ping 수: 50개
 * - 예상 처리 시간: 장비당 평균 2-5초
 * 
 * @example
 * ```typescript
 * const request = { deviceIds: [1, 2, 3, 4, 5] };
 * const results = await pingMultipleDevices(request);
 * const onlineCount = results.filter(r => r.status === 'Online').length;
 * ```
 */
export async function pingMultipleDevices(
  request: MultiPingRequestDto
): Promise<PingResultDto[]> {
  try {
    console.log(`📡 일괄 Ping 시작: ${request.deviceIds.length}개 장비`);

    const response = await axios.post<PingResultDto[]>(
      `${API_BASE}/device/ping/multi`,
      request,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const results = response.data;
    
    // 결과 통계 계산 및 로깅
    const online = results.filter((r) => r.status === "Online").length;
    const offline = results.filter((r) => r.status === "Offline").length;
    const unstable = results.filter((r) => r.status === "Unstable").length;

    console.log(
      `✅ 일괄 Ping 완료: 총 ${results.length}개 - 온라인: ${online}, 오프라인: ${offline}, 불안정: ${unstable}`
    );
    return results;
  } catch (error) {
    console.error("❌ 일괄 Ping 실패:", error);
    throw new Error("여러 장비 Ping에 실패했습니다.");
  }
}

/**
 * 시스템에 등록된 모든 장비에 대한 전체 Ping 테스트를 수행합니다.
 * 
 * @description 
 * 데이터베이스에 등록된 모든 네트워크 장비의 상태를 일괄적으로 확인합니다.
 * 대규모 네트워크 환경에서 전체적인 연결 상태를 파악하는 데 사용됩니다.
 * 
 * @returns {Promise<PingResultDto[]>} 모든 장비의 Ping 테스트 결과 배열
 * 
 * @throws {Error} 다양한 네트워크 및 서버 오류에 대한 구체적인 예외 메시지 제공
 * 
 * @performance 
 * - 현재 환경: 200개 장비 기준 5-8초 소요
 * - 메모리 사용량: 약 50-100KB 데이터 전송
 * - 타임아웃: 장비당 2000ms 설정
 * 
 * @security 
 * 실제 운영 환경에서는 다음 사항을 고려해야 합니다:
 * - 네트워크 정책에 따른 ICMP 패킷 허용 여부
 * - 방화벽 설정 및 보안 그룹 규칙
 * - 과도한 Ping으로 인한 네트워크 부하 방지
 * 
 * @example
 * ```typescript
 * try {
 *   const allResults = await pingAllDevices();
 *   const healthReport = {
 *     total: allResults.length,
 *     online: allResults.filter(r => r.status === 'Online').length,
 *     issues: allResults.filter(r => r.status !== 'Online').length
 *   };
 *   console.log('네트워크 상태 리포트:', healthReport);
 * } catch (error) {
 *   console.error('전체 Ping 실행 실패:', error.message);
 * }
 * ```
 */
export async function pingAllDevices(): Promise<PingResultDto[]> {
  try {
    console.log("📡 전체 Ping 시작: 모든 등록된 장비");

    const response = await axios.post<PingResultDto[]>(
      `${API_BASE}/device/ping/all`,
      {},
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const results = response.data;
    
    // 상태별 통계 집계
    const online = results.filter((r) => r.status === "Online").length;
    const offline = results.filter((r) => r.status === "Offline").length;
    const unstable = results.filter((r) => r.status === "Unstable").length;
    const unreachable = results.filter(
      (r) => r.status === "Unreachable"
    ).length;

    console.log(
      `✅ 전체 Ping 완료: 총 ${results.length}개 - 온라인: ${online}, 오프라인: ${offline}, 불안정: ${unstable}, 도달불가: ${unreachable}`
    );
    return results;
  } catch (error) {
    // 네트워크 오류별 상세한 에러 처리
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNREFUSED") {
        throw new Error("서버에 연결할 수 없습니다. 네트워크를 확인해주세요.");
      }
      if (error.response?.status === 500) {
        throw new Error(
          "서버 내부 오류가 발생했습니다. 관리자에게 문의하세요."
        );
      }
    }
    throw new Error("모든 장비 Ping에 실패했습니다.");
  }
}

/**
 * 특정 장비로부터의 TracePath에 포함된 모든 장비들을 Ping합니다.
 * 
 * @description 
 * 네트워크 경로 추적(TracePath) 결과에 나타나는 모든 중간 장비들의 연결 상태를 확인합니다.
 * 네트워크 경로상의 문제점을 빠르게 식별하는 데 유용합니다.
 * 
 * @param {number} deviceId - Trace 경로의 시작점이 되는 장비의 ID
 * @returns {Promise<TracePingResultDto>} 경로상 모든 장비의 Ping 결과와 통계 정보
 * 
 * @throws {Error} 경로 추적 실패 또는 Ping 테스트 실패 시 예외 발생
 * 
 * @use_case 
 * - 네트워크 장애 진단 시 경로상 문제 지점 파악
 * - 특정 장비 연결 문제의 원인 분석
 * - 네트워크 토폴로지 상태 점검
 * 
 * @integration 
 * 이 함수는 TraceController의 경로 추적 기능과 연동되어 동작합니다.
 * 먼저 TracePath가 실행되어야 유효한 결과를 얻을 수 있습니다.
 * 
 * @example
 * ```typescript
 * // 특정 PC에서 서버까지의 경로상 모든 장비 상태 확인
 * const traceResult = await pingTracePath(42);
 * console.log(`경로상 장비 ${traceResult.totalDevices}개 중 ${traceResult.onlineDevices}개 정상`);
 * 
 * if (traceResult.offlineDevices > 0) {
 *   console.log('경로상에 오프라인 장비가 발견되었습니다. 네트워크 점검이 필요합니다.');
 * }
 * ```
 */
export async function pingTracePath(
  deviceId: number
): Promise<TracePingResultDto> {
  try {
    console.log(`📡 TracePath Ping 시작: Device ID ${deviceId}`);

    const response = await axios.get<TracePingResultDto>(
      `${API_BASE}/trace/${deviceId}/ping`
    );

    const result = response.data;
    console.log(
      `✅ TracePath Ping 완료: ${result.totalDevices}개 장비 - 온라인: ${result.onlineDevices}, 오프라인: ${result.offlineDevices}`
    );
    return result;
  } catch (error) {
    console.error(`❌ TracePath Ping 실패 (Device ID: ${deviceId}):`, error);
    throw new Error(`Device ID ${deviceId}의 TracePath Ping에 실패했습니다.`);
  }
}

/**
 * @todo 향후 개선 사항
 * 
 * 1. 실시간 Ping 모니터링
 *    - WebSocket을 통한 실시간 상태 업데이트
 *    - 주기적 자동 Ping 스케줄링
 * 
 * 2. 성능 최적화
 *    - Ping 결과 캐싱 메커니즘
 *    - 부분적 업데이트 지원
 *    - 배치 크기 동적 조정
 * 
 * 3. 고급 진단 기능
 *    - Traceroute 통합
 *    - 패킷 손실률 상세 분석
 *    - 네트워크 지연 히스토리 추적
 * 
 * 4. 보안 강화
 *    - API 키 기반 인증
 *    - Rate limiting 구현
 *    - 감사 로그 기록
 */

/**
 * @deployment_guide 배포 시 확인 사항
 * 
 * 1. 네트워크 환경 설정
 *    - ICMP 패킷 허용 정책 확인
 *    - 방화벽 포트 개방 (필요시)
 *    - DNS 설정 검증
 * 
 * 2. 서버 설정
 *    - API_BASE URL을 실제 서버 주소로 변경
 *    - 타임아웃 값 환경에 맞게 조정
 *    - 로그 레벨 설정
 * 
 * 3. 권한 설정
 *    - 서버 애플리케이션의 네트워크 권한 확인
 *    - 운영체제별 ICMP 권한 설정
 *    - 사용자 계정 권한 검토
 */