/**
 * CableForm.tsx - 네트워크 케이블 연결 등록 폼 컴포넌트
 * 
 * 주요 기능:
 * - 두 네트워크 장비 간의 물리적 케이블 연결 등록
 * - 장비별 포트 정보 동적 로딩 및 선택
 * - 네트워크 토폴로지 비즈니스 규칙 검증
 * - 실시간 유효성 검사 및 사용자 피드백
 * 
 * 설계 특징:
 * - 타입 안전성: 백엔드 API와 UI 타입 분리
 * - 성능 최적화: useMemo를 통한 계산 결과 캐싱
 * - 메모리 안전성: AbortController와 alive 플래그 활용
 * - 사용자 경험: 자동 포트 선택, 로딩 상태 관리
 * 
 * 비즈니스 규칙:
 * - PC는 SWITCH와만 연결 가능
 * - 동일 장비 간 연결 금지
 * - 동일 포트 중복 연결 방지
 * 
 * 확장성:
 * - 새로운 장비 타입 추가 시 비즈니스 규칙 확장 가능
 * - 포트 정렬 알고리즘 커스터마이징 가능
 * - 유효성 검증 규칙 외부 설정으로 분리 가능
 */

import { useState, useEffect, useMemo } from "react";
import axios, { AxiosError } from "axios";
import type { Device } from "../types/device";

/**
 * 백엔드 API 응답 포트 타입 (관리 API 전용)
 * 
 * 서버에서 반환하는 원본 포트 데이터 구조
 * 중첩된 device 객체와 함께 제공됨
 */
type ApiPort = {
  portId: number;                    // 포트 고유 ID
  name: string;                      // 포트 이름 (예: "GigabitEthernet0/1", "P01")
  device: { deviceId: number };      // 소속 장비 정보
};

/**
 * UI에서 사용하는 포트 타입
 * 
 * 백엔드 타입에서 필요한 정보만 추출하여 단순화
 * 렌더링 성능과 메모리 효율성을 위한 최적화된 구조
 */
type UiPort = {
  id: number;                        // 포트 ID (ApiPort.portId와 매핑)
  name: string;                      // 표시용 포트 이름
};

/**
 * CableForm 컴포넌트 Props 인터페이스
 */
interface CableFormProps {
  onSuccess: () => void;             // 케이블 등록 성공 시 호출되는 콜백
}

/**
 * 네트워크 케이블 연결 등록 폼 컴포넌트
 * 
 * 복잡한 상태 관리와 비즈니스 로직을 포함하는 핵심 컴포넌트
 * 300+ 라인의 코드를 논리적 섹션별로 구성하여 가독성 확보
 * 
 * @param props 컴포넌트 props
 * @param props.onSuccess 등록 성공 시 실행될 콜백 함수
 * @returns JSX.Element 렌더링된 케이블 등록 폼
 */
export default function CableForm({ onSuccess }: CableFormProps) {
  
  // ───────────────── 폼 입력 상태 관리 ─────────────────
  
  /**
   * 사용자 입력 필드 상태들
   * 각 입력값은 독립적으로 관리되어 세밀한 제어 가능
   */
  const [cableId, setCableId] = useState("");         // 케이블 식별자
  const [description, setDescription] = useState(""); // 케이블 설명 (선택사항)

  // ───────────────── 서버 데이터 상태 관리 ─────────────────
  
  /**
   * 백엔드에서 가져온 기준 데이터들
   * 초기 로딩 시 한 번 설정되고 폼 전체에서 참조됨
   */
  const [devices, setDevices] = useState<Device[]>([]);                           // 전체 장비 목록
  const [portsByDeviceId, setPortsByDeviceId] = useState<Record<number, UiPort[]>>({}); // 장비별 포트 매핑

  // ───────────────── 사용자 선택 상태 관리 ─────────────────
  
  /**
   * 케이블 연결을 위한 양단 선택 상태
   * 
   * 타입 설계 고려사항:
   * - number | "": select 요소의 빈 값("")과 실제 숫자 ID를 구분
   * - 타입 안전성 확보하면서도 HTML select 요소와 호환
   */
  const [fromDeviceId, setFromDeviceId] = useState<number | "">("");  // 출발 장비 ID
  const [toDeviceId, setToDeviceId] = useState<number | "">("");      // 도착 장비 ID
  const [fromPortId, setFromPortId] = useState<number | "">("");      // 출발 포트 ID
  const [toPortId, setToPortId] = useState<number | "">("");          // 도착 포트 ID

  // ───────────────── UI/요청 상태 관리 ─────────────────
  
  /**
   * 사용자 인터페이스 제어용 상태들
   * 로딩, 제출 등의 비동기 작업 상태 추적
   */
  const [loading, setLoading] = useState(false);       // 초기 데이터 로딩 상태
  const [submitting, setSubmitting] = useState(false); // 폼 제출 진행 상태

  // ───────────────── 성능 최적화된 계산 로직 ─────────────────
  
  /**
   * 장비 ID 기반 빠른 조회를 위한 Map 생성
   * 
   * 성능 고려사항:
   * - O(1) 조회 성능으로 장비 정보 접근
   * - devices 배열이 변경될 때만 재계산
   * - 유효성 검증 시 장비 타입 확인에 활용
   */
  const deviceById = useMemo(
    () => new Map<number, Device>(devices.map((d) => [d.deviceId, d])),
    [devices]
  );

  /**
   * 선택된 장비의 포트 목록 계산
   * 
   * 장비 선택 변경 시에만 재계산되어 불필요한 렌더링 방지
   * 타입 가드를 통해 안전한 배열 접근 보장
   */
  const fromPorts = useMemo(
    () => (typeof fromDeviceId === "number" ? portsByDeviceId[fromDeviceId] ?? [] : []),
    [fromDeviceId, portsByDeviceId]
  );
  
  const toPorts = useMemo(
    () => (typeof toDeviceId === "number" ? portsByDeviceId[toDeviceId] ?? [] : []),
    [toDeviceId, portsByDeviceId]
  );

  // ───────────────── 초기 데이터 로딩 (메모리 안전) ─────────────────
  
  /**
   * 컴포넌트 마운트 시 장비 및 포트 정보 로딩
   * 
   * 고급 에러 처리 패턴:
   * 1. AbortController: 컴포넌트 언마운트 시 요청 취소
   * 2. alive 플래그: 컴포넌트 생명주기 추적
   * 3. Promise.all: 병렬 요청으로 로딩 시간 최적화
   * 4. 세분화된 에러 처리: 취소/실패 구분
   */
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        
        // 장비 목록과 포트 목록을 병렬로 가져와 로딩 시간 단축
        const [deviceRes, portRes] = await Promise.all([
          axios.get<Device[]>("/api/device", { signal: controller.signal }),
          axios.get<ApiPort[]>("/api/ports", { signal: controller.signal }),
        ]);

        // 컴포넌트가 언마운트된 경우 상태 업데이트 중단
        if (!alive) return;

        setDevices(deviceRes.data);

        /**
         * 포트 데이터를 장비별로 그룹화
         * 
         * 알고리즘:
         * 1. 장비 ID별로 포트들을 그룹화
         * 2. ApiPort → UiPort 타입 변환
         * 3. 자연수 우선 정렬 적용
         */
        const map: Record<number, UiPort[]> = {};
        for (const p of portRes.data) {
          const devId = p.device?.deviceId;
          if (typeof devId !== "number") continue; // 유효하지 않은 장비 ID 건너뛰기
          
          if (!map[devId]) map[devId] = [];
          map[devId].push({ id: p.portId, name: p.name });
        }

        /**
         * 포트 이름 자연수 우선 정렬
         * 
         * 정렬 알고리즘:
         * 1. 포트 이름에서 숫자 추출 (예: "GigabitEthernet0/5" → 5)
         * 2. 숫자 기준 1차 정렬
         * 3. 문자열 기준 2차 정렬 (숫자가 같거나 없는 경우)
         * 
         * 결과: ["P1", "P2", "P10", "P20"] (문자열 정렬: ["P1", "P10", "P2", "P20"])
         */
        for (const k of Object.keys(map)) {
          map[Number(k)].sort((a, b) => {
            const na = parseInt(a.name.replace(/\D+/g, "") || "0", 10);
            const nb = parseInt(b.name.replace(/\D+/g, "") || "0", 10);
            return na - nb || a.name.localeCompare(b.name);
          });
        }

        setPortsByDeviceId(map);
      } catch (error) {
        // 요청 취소는 정상적인 종료이므로 에러로 처리하지 않음
        if (axios.isCancel(error)) return;
        
        console.error("장비/포트 로딩 실패:", error);
        alert("장비/포트 정보를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // 클린업: 메모리 누수 방지
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  // ───────────────── 자동 포트 선택 로직 ─────────────────
  
  /**
   * From 장비 변경 시 첫 번째 포트 자동 선택
   * 
   * UX 개선사항:
   * - 사용자가 매번 포트를 수동 선택할 필요 없음
   * - 장비 변경 시 이전 포트 선택이 유지되어 발생하는 오류 방지
   * - 빈 포트 목록인 경우 안전하게 빈 값으로 설정
   */
  useEffect(() => {
    if (typeof fromDeviceId === "number") {
      const first = portsByDeviceId[fromDeviceId]?.[0]?.id;
      setFromPortId(first ?? "");
    } else {
      setFromPortId("");
    }
  }, [fromDeviceId, portsByDeviceId]);

  /**
   * To 장비 변경 시 첫 번째 포트 자동 선택
   * From 포트와 동일한 로직 적용
   */
  useEffect(() => {
    if (typeof toDeviceId === "number") {
      const first = portsByDeviceId[toDeviceId]?.[0]?.id;
      setToPortId(first ?? "");
    } else {
      setToPortId("");
    }
  }, [toDeviceId, portsByDeviceId]);

  // ───────────────── 비즈니스 로직 유효성 검증 ─────────────────
  
  /**
   * 폼 데이터 유효성 검증 함수
   * 
   * 검증 단계:
   * 1. 필수 입력값 존재 여부
   * 2. 네트워크 토폴로지 비즈니스 규칙
   * 3. 데이터 일관성 검사
   * 
   * @returns 에러 메시지 문자열 또는 null (유효한 경우)
   */
  const validate = (): string | null => {
    // 1단계: 필수 입력값 검증
    if (!cableId.trim()) return "케이블 ID를 입력하세요.";
    if (typeof fromDeviceId !== "number" || typeof toDeviceId !== "number")
      return "From/To 장비를 선택하세요.";
    if (typeof fromPortId !== "number" || typeof toPortId !== "number")
      return "From/To 포트를 선택하세요.";

    // 2단계: 논리적 일관성 검증
    if (fromDeviceId === toDeviceId) return "같은 장비 간 연결은 허용되지 않습니다.";

    // 동일한 포트 간 연결 방지 (논리적으로 불가능)
    if (fromDeviceId === toDeviceId && fromPortId === toPortId)
      return "같은 포트를 서로 연결할 수 없습니다.";

    // 3단계: 장비 정보 존재 여부 확인
    const from = deviceById.get(fromDeviceId);
    const to = deviceById.get(toDeviceId);
    if (!from || !to) return "장비 정보를 찾을 수 없습니다.";

    // 4단계: 네트워크 토폴로지 비즈니스 규칙 적용
    const fType = (from.type ?? "").toLowerCase();
    const tType = (to.type ?? "").toLowerCase();

    /**
     * 비즈니스 규칙: PC-SWITCH 연결 제한
     * 
     * 네트워크 아키텍처 설계 원칙:
     * - PC는 직접적으로 SWITCH에만 연결
     * - PC-PC 직접 연결 금지 (네트워크 루프 방지)
     * - PC-SERVER 직접 연결 금지 (보안 및 관리 효율성)
     * 
     * 향후 확장 시 고려사항:
     * - 이 규칙을 외부 설정으로 분리 가능
     * - 새로운 장비 타입 추가 시 규칙 확장 필요
     */
    const invalidPc =
      (fType === "pc" && tType !== "switch") || 
      (tType === "pc" && fType !== "switch");
    if (invalidPc) return "PC는 SWITCH와만 연결할 수 있습니다.";

    return null; // 모든 검증 통과
  };

  // ───────────────── 폼 제출 처리 ─────────────────
  
  /**
   * 케이블 등록 제출 핸들러
   * 
   * 처리 흐름:
   * 1. 기본 브라우저 동작 방지
   * 2. 유효성 검증 실행
   * 3. API 호출 및 상태 관리
   * 4. 성공/실패 처리 및 사용자 피드백
   * 5. 폼 초기화 및 콜백 실행
   * 
   * @param e React 폼 이벤트
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검증 실행
    const err = validate();
    if (err) {
      alert(`❌ ${err}`);
      return;
    }

    try {
      setSubmitting(true);

      // 케이블 등록 API 호출
      await axios.post("/api/cable", {
        cableId: cableId.trim(),
        description: description.trim() || undefined, // 빈 문자열은 undefined로 변환
        fromPortId,
        toPortId,
      });

      alert("케이블이 성공적으로 연결되었습니다.");
      
      /**
       * 성공 후 폼 초기화
       * 사용자가 연속으로 케이블을 등록할 수 있도록 깔끔한 상태로 리셋
       */
      setCableId("");
      setDescription("");
      setFromDeviceId("");
      setToDeviceId("");
      setFromPortId("");
      setToPortId("");

      // 상위 컴포넌트에 성공 알림 (일반적으로 데이터 새로고침 용도)
      onSuccess();
    } catch (err) {
      /**
       * 세분화된 에러 처리
       * 
       * 에러 타입별 적절한 메시지 제공:
       * - 409 Conflict: 중복 연결 시도
       * - 기타 HTTP 에러: 서버 응답 메시지 사용
       * - 네트워크 에러: 일반적인 에러 메시지
       */
      const error = err as AxiosError<{ message?: string }>;
      const msg =
        error.response?.data?.message ??
        (error.response?.status === 409
          ? "중복된 케이블 연결입니다."
          : error.message);
      alert(`등록 실패: ${msg}`);
      console.error("케이블 등록 에러:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // ───────────────── 컴포넌트 렌더링 ─────────────────
  
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-md p-4">

      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={submitting || loading}>
        <h3 className="text-slate-700 font-semibold mb-2">📍 케이블 추가</h3>

        {/* 케이블 ID 입력 필드 */}
        <div>
          <label className="block text-sm mb-1" htmlFor="cable-id">케이블 ID</label>
          <input
            id="cable-id"
            type="text"
            className="input"
            placeholder="예: CABLE-001"
            value={cableId}
            onChange={(e) => setCableId(e.target.value)}
            required
            disabled={loading || submitting}
          />
        </div>

        {/* 케이블 설명 입력 필드 (선택사항) */}
        <div>
          <label className="block text-sm mb-1" htmlFor="cable-desc">설명</label>
          <input
            id="cable-desc"
            type="text"
            className="input"
            placeholder="예: PC-01 to SW-01"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading || submitting}
          />
        </div>

        {/* From 장비 선택 드롭다운 */}
        <div>
          <label className="block text-sm mb-1" htmlFor="from-device">From 장비</label>
          <select
            id="from-device"
            className="input"
            value={fromDeviceId}
            onChange={(e) => setFromDeviceId(e.target.value ? Number(e.target.value) : "")}
            required
            disabled={loading || submitting}
          >
            <option value="">-- 선택 --</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.name} ({d.type})
              </option>
            ))}
          </select>
        </div>

        {/* To 장비 선택 드롭다운 */}
        <div>
          <label className="block text-sm mb-1" htmlFor="to-device">To 장비</label>
          <select
            id="to-device"
            className="input"
            value={toDeviceId}
            onChange={(e) => setToDeviceId(e.target.value ? Number(e.target.value) : "")}
            required
            disabled={loading || submitting}
          >
            <option value="">-- 선택 --</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.name} ({d.type})
              </option>
            ))}
          </select>
        </div>

        {/* 포트 선택 섹션 */}
        <div className="space-y-4">
          {/* From 포트 선택 */}
          <div>
            <label className="block text-sm mb-1" htmlFor="from-port">From 포트</label>
            <select
              id="from-port"
              className="input"
              value={fromPortId}
              onChange={(e) => setFromPortId(e.target.value ? Number(e.target.value) : "")}
              disabled={loading || submitting || typeof fromDeviceId !== "number"}
            >
              <option value="">-- 선택 --</option>
              {fromPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* To 포트 선택 */}
          <div>
            <label className="block text-sm mb-1" htmlFor="to-port">To 포트</label>
            <select
              id="to-port"
              className="input"
              value={toPortId}
              onChange={(e) => setToPortId(e.target.value ? Number(e.target.value) : "")}
              disabled={loading || submitting || typeof toDeviceId !== "number"}
            >
              <option value="">-- 선택 --</option>
              {toPorts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 
                     disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={
            loading ||
            submitting ||
            !cableId ||
            typeof fromPortId !== "number" ||
            typeof toPortId !== "number"
          }
        >
          {submitting ? "등록 중…" : "케이블 연결"}
        </button>
      </form>
    </div>
  );
}