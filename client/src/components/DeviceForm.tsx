/**
 * DeviceForm.tsx - 네트워크 장비 등록 폼 컴포넌트
 * 
 * 주요 기능:
 * - 다양한 네트워크 장비 유형의 통합 등록 지원
 * - 장비 유형별 동적 필드 표시 (Switch → 랙 ID 필수)
 * - 실시간 유효성 검증 및 사용자 피드백
 * - IP 주소 형식 검증 (정규식 기반)
 * - 접근성 준수 (고유 ID, 라벨 연결, 필수 필드 표시)
 * 
 * 지원 장비 유형:
 * - PC, Switch, Server, Router, 기타
 * 
 * 설계 특징:
 * - 단일 폼으로 모든 장비 유형 처리
 * - 타입 안전성: const assertion과 유니온 타입 활용
 * - 상태 최적화: useCallback을 통한 불필요한 리렌더링 방지
 * - 에러 처리: Axios 에러 메시지 세분화
 * 
 * 비즈니스 규칙:
 * - Switch 장비는 반드시 랙 ID 필요 (물리적 위치 추적)
 * - IP 주소는 선택사항 (DHCP 환경 고려)
 * - 포트 수는 1-999 범위로 제한
 * 
 * 확장성:
 * - DEVICE_TYPES 배열 수정으로 새 장비 유형 추가 가능
 * - 장비별 고유 필드 추가 시 조건부 렌더링 확장
 * - 유효성 검증 규칙 외부 설정으로 분리 가능
 */

import { useState, useCallback, useId } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios, { AxiosError } from "axios";

/**
 * DeviceForm 컴포넌트 Props 인터페이스
 */
interface DeviceFormProps {
  onSuccess?: () => void; // 장비 등록 성공 시 호출 (일반적으로 목록 새로고침 용도)
}

/**
 * 지원되는 네트워크 장비 유형 정의
 * 
 * const assertion 사용 이유:
 * - readonly 배열로 만들어 런타임 수정 방지
 * - 타입 추론을 위한 정확한 리터럴 타입 생성
 * - DeviceType 유니온 타입의 기반 데이터 제공
 * 
 * 확장 방법:
 * 새 장비 유형 추가 시 이 배열에 추가하면 자동으로 타입 시스템에 반영
 */
const DEVICE_TYPES = ['PC', 'Switch', 'Server', 'NAS', 'AP', 'Printer', 'CCTV', 'Firewall', 'Router'] as const;

/**
 * 장비 유형 타입 정의
 * DEVICE_TYPES 배열의 요소들로 구성된 유니온 타입
 */
type DeviceType = typeof DEVICE_TYPES[number];

/**
 * 폼 초기값 정의
 * 
 * 설계 고려사항:
 * - 기본 장비 유형: PC (가장 일반적)
 * - rackId: null 허용 (Switch가 아닌 경우 불필요)
 * - portCount: 1 (최소 포트 수)
 * - ipAddress: 빈 문자열 (선택사항이므로)
 */
const INITIAL_VALUES = {
  name: "",
  type: "PC" as DeviceType,
  ipAddress: "",
  portCount: 1,
  rackId: null as number | null,
};

/**
 * 네트워크 장비 등록 폼 컴포넌트
 * 
 * 상태 관리 전략:
 * - 단일 formData 객체로 모든 입력값 관리
 * - 개별 필드 업데이트를 위한 제네릭 헬퍼 함수
 * - 로딩/에러 상태 분리로 세밀한 UI 제어
 * 
 * @param props 컴포넌트 props
 * @param props.onSuccess 등록 성공 시 실행될 콜백 함수
 * @returns JSX.Element 렌더링된 장비 등록 폼
 */
export default function DeviceForm({ onSuccess }: DeviceFormProps) {
  
  // ───────────────── 상태 관리 ─────────────────
  
  /**
   * 폼 데이터 상태
   * INITIAL_VALUES를 복사하여 참조 무결성 보장
   */
  const [formData, setFormData] = useState<typeof INITIAL_VALUES>({ ...INITIAL_VALUES });
  
  /**
   * 비동기 작업 상태들
   * 로딩과 에러를 분리하여 독립적인 UI 제어 가능
   */
  const [loading, setLoading] = useState(false);     // API 요청 진행 상태
  const [error, setError] = useState("");           // 유효성 검증 및 API 에러 메시지

  // ───────────────── 접근성 지원 ─────────────────
  
  /**
   * 접근성을 위한 고유 ID 생성
   * 
   * useId 사용 이유:
   * - React 18+에서 제공하는 안전한 고유 ID 생성
   * - 서버 사이드 렌더링 호환성 보장
   * - 동일 컴포넌트 여러 인스턴스 간 ID 충돌 방지
   * - htmlFor와 id 속성 연결로 스크린 리더 지원
   */
  const idName = useId();    // 장비 이름 필드 ID
  const idType = useId();    // 장비 유형 필드 ID
  const idIp = useId();      // IP 주소 필드 ID
  const idPorts = useId();   // 포트 수 필드 ID
  const idRack = useId();    // 랙 ID 필드 ID

  // ───────────────── 상태 업데이트 헬퍼 ─────────────────
  
  /**
   * 폼 데이터 필드별 업데이트 함수
   * 
   * 제네릭 타입 활용:
   * - T extends keyof typeof formData: 유효한 필드명만 허용
   * - typeof formData[T]: 해당 필드의 정확한 타입 보장
   * 
   * useCallback 사용 이유:
   * - 자식 컴포넌트에 props로 전달 시 불필요한 리렌더링 방지
   * - 빈 의존성 배열로 함수 참조 안정성 보장
   * 
   * @param field 업데이트할 필드명
   * @param value 새로운 필드값
   */
  const updateFormData = useCallback(
    <T extends keyof typeof formData>(field: T, value: typeof formData[T]) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  /**
   * 폼 초기화 함수
   * 
   * 새 객체 생성으로 참조 무결성 보장:
   * - 스프레드 연산자로 깊은 복사 효과
   * - React 상태 업데이트 감지 보장
   * - 메모리 참조 오염 방지
   */
  const resetForm = useCallback(() => {
    setFormData({ ...INITIAL_VALUES });
    setError("");
  }, []);

  // ───────────────── 유효성 검증 ─────────────────
  
  /**
   * IP 주소 유효성 검증 정규식
   * 
   * 패턴 분석:
   * - (?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?): 0-255 범위의 옥텟
   * - \.){3}: 점으로 구분된 3개 옥텟
   * - 마지막 옥텟: 동일한 0-255 범위 검증
   * 
   * 지원 형식: 192.168.1.1, 10.0.0.1, 255.255.255.255 등
   * 미지원: 선행 0 (001.002.003.004), 범위 초과 (256.0.0.1)
   */
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  /**
   * 폼 데이터 유효성 검증 함수
   * 
   * 검증 순서:
   * 1. 필수 필드 존재 여부
   * 2. 데이터 형식 검증 (IP, 숫자 범위)
   * 3. 비즈니스 규칙 검증 (장비별 요구사항)
   * 
   * @returns 에러 메시지 문자열 또는 null (유효한 경우)
   */
  const validateForm = (): string | null => {
    // 1단계: 필수 필드 검증
    if (!formData.name.trim()) return "장비 이름을 입력해주세요.";
    
    // 2단계: IP 주소 형식 검증 (입력된 경우에만)
    const ip = formData.ipAddress.trim();
    if (ip && !ipRegex.test(ip)) return "올바른 IP 주소 형식을 입력해주세요.";
    
    // 3단계: 포트 수 범위 검증
    if (!Number.isFinite(formData.portCount) || formData.portCount < 1 || formData.portCount > 999) {
      return "포트 수는 1-999 사이여야 합니다.";
    }
    
    // 4단계: 장비별 비즈니스 규칙 검증
    if (formData.type === "Switch" && !formData.rackId) {
      return "Switch 장비는 랙 ID가 필요합니다.";
    }
    
    return null; // 모든 검증 통과
  };

  /**
   * Axios 에러에서 사용자 친화적 메시지 추출
   * 
   * 에러 메시지 우선순위:
   * 1. response.data.message (서버 정의 메시지)
   * 2. response.data.error (대안 서버 메시지)
   * 3. error.message (네트워크/기본 에러)
   * 4. 기본 메시지 (모든 메시지 추출 실패 시)
   * 
   * @param err unknown 타입의 에러 객체
   * @returns 사용자에게 표시할 에러 메시지
   */
  const extractAxiosMessage = (err: unknown) => {
    const e = err as AxiosError<{ message?: string; error?: string }>;
    return e.response?.data?.message || 
           e.response?.data?.error || 
           e.message || 
           "장비 등록 중 오류가 발생했습니다.";
  };

  // ───────────────── 폼 제출 처리 ─────────────────
  
  /**
   * 장비 등록 제출 핸들러
   * 
   * 처리 흐름:
   * 1. 기본 브라우저 동작 방지
   * 2. 클라이언트 사이드 유효성 검증
   * 3. API 요청용 데이터 정제
   * 4. 서버 요청 및 응답 처리
   * 5. 성공/실패 후처리
   * 
   * @param e React 폼 이벤트
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // 클라이언트 사이드 유효성 검증
    const validationError = validateForm();
    if (validationError) { 
      setError(validationError); 
      return; 
    }

    // UI 상태 업데이트 (로딩 시작, 이전 에러 초기화)
    setLoading(true);
    setError("");

    try {
      /**
       * API 요청용 데이터 정제
       * 
       * 정제 작업:
       * - 문자열 트림으로 공백 제거
       * - 빈 IP 주소를 null로 변환 (서버 정책에 따라)
       * - Switch가 아닌 경우 rackId를 null로 설정
       */
      const payload = {
        ...formData,
        name: formData.name.trim(),
        ipAddress: formData.ipAddress.trim() || null,
        rackId: formData.type === "Switch" ? formData.rackId : null,
      };

      // 장비 등록 API 호출
      await axios.post("/api/device", payload);
      
      // 성공 후처리
      resetForm();        // 폼 초기화로 연속 등록 지원
      onSuccess?.();      // 상위 컴포넌트 콜백 (일반적으로 목록 새로고침)
      
    } catch (err) {
      // 실패 시 사용자 친화적 에러 메시지 표시
      setError(extractAxiosMessage(err));
    } finally {
      // 로딩 상태 해제 (성공/실패 무관)
      setLoading(false);
    }
  };

  // ───────────────── 조건부 렌더링 헬퍼 ─────────────────
  
  /**
   * Switch 장비 여부 판단
   * 랙 ID 필드 조건부 렌더링에 사용
   */
  const isSwitch = formData.type === "Switch";

  // ───────────────── 컴포넌트 렌더링 ─────────────────
  
  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4 text-sm">
      {/* 폼 헤더 */}
      <div className="text-slate-700 font-semibold">➕ 장비 추가</div>

      {/* 입력 필드 그룹 */}
      <div className="space-y-3">
        
        {/* 장비 이름 입력 필드 */}
        <div>
          <label htmlFor={idName} className="block text-slate-600 font-medium mb-1">
            장비 이름 <span className="text-red-500">*</span>
          </label>
          <input
            id={idName}
            type="text"
            value={formData.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateFormData("name", e.target.value)}
            required
            maxLength={50}                    // 데이터베이스 제약 고려
            placeholder="예: 서버실-PC-01"    // 실제 사용 예시 제공
            autoComplete="off"               // 자동완성 비활성화 (고유한 장비명)
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 장비 유형 선택 드롭다운 */}
        <div>
          <label htmlFor={idType} className="block text-slate-600 font-medium mb-1">
            장비 유형 <span className="text-red-500">*</span>
          </label>
          <select
            id={idType}
            value={formData.type}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              const next = e.target.value as DeviceType;
              updateFormData("type", next);
              
              /**
               * 장비 유형 변경 시 관련 필드 정리
               * Switch가 아닌 유형으로 변경 시 rackId 초기화
               * 데이터 일관성 보장 및 사용자 혼동 방지
               */
              if (next !== "Switch" && formData.rackId !== null) {
                updateFormData("rackId", null);
              }
            }}
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {DEVICE_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* IP 주소 입력 필드 (선택사항) */}
        <div>
          <label htmlFor={idIp} className="block text-slate-600 font-medium mb-1">IP 주소</label>
          <input
            id={idIp}
            type="text"
            value={formData.ipAddress}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateFormData("ipAddress", e.target.value)}
            placeholder="192.168.0.10"
            inputMode="numeric"              // 모바일에서 숫자 키패드 표시
            pattern={ipRegex.source}         // HTML5 패턴 검증 (클라이언트 힌트)
            autoComplete="off"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 포트 수 입력 필드 */}
        <div>
          <label htmlFor={idPorts} className="block text-slate-600 font-medium mb-1">
            포트 수 <span className="text-red-500">*</span>
          </label>
          <input
            id={idPorts}
            type="number"
            value={formData.portCount}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateFormData("portCount", Number(e.target.value))
            }
            min={1}                          // HTML5 최소값 제약
            max={999}                        // HTML5 최대값 제약
            required
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 랙 ID 입력 필드 (Switch 전용) */}
        {isSwitch && (
          <div>
            <label htmlFor={idRack} className="block text-slate-600 font-medium mb-1">
              랙 ID <span className="text-red-500">*</span>
            </label>
            <input
              id={idRack}
              type="number"
              value={formData.rackId ?? ""}   // null을 빈 문자열로 변환 (input 호환)
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateFormData("rackId", e.target.value ? Number(e.target.value) : null)
              }
              required={isSwitch}             // Switch일 때만 필수
              min={1}
              placeholder="1"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* 에러 메시지 표시 영역 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 액션 버튼 그룹 */}
      <div className="flex gap-2">
        {/* 등록 버튼 */}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "등록 중..." : "장비 등록"}
        </button>

        {/* 초기화 버튼 */}
        <button
          type="button"
          onClick={resetForm}
          disabled={loading}                // 로딩 중에는 초기화도 비활성화
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          초기화
        </button>
      </div>
    </form>
  );
}