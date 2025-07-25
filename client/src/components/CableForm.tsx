// CableForm.tsx

import { useState, useEffect } from "react";
import axios, { AxiosError } from "axios";
import type { Device } from "../types/device";
import type { Port } from "../types/port";

/**
 * 케이블 연결 등록을 위한 폼 컴포넌트
 *
 * @description
 * - 네트워크 장비 간 케이블 연결을 생성하기 위한 사용자 인터페이스
 * - 장비 타입별 연결 제약사항 검증 (PC는 SWITCH와만 연결 가능)
 * - 포트 선택의 기본/고급 모드 지원
 * - 실시간 데이터 검증 및 사용자 피드백 제공
 */
interface CableFormProps {
  /** 케이블 등록 성공 시 호출되는 콜백 함수 */
  onSuccess: () => void;
}

/**
 * 케이블 연결 등록 폼 컴포넌트
 *
 * @param props - 컴포넌트 속성
 * @returns 케이블 등록 폼 JSX 엘리먼트
 *
 * @example
 * ```tsx
 * <CableForm onSuccess={() => {
 *   console.log('케이블 등록 완료!');
 *   refreshNetworkDiagram();
 * }} />
 * ```
 */
export default function CableForm({ onSuccess }: CableFormProps) {
  // ==================== 폼 입력 상태 관리 ====================

  /** 사용자가 입력한 케이블 식별자 (예: CABLE-001) */
  const [cableId, setCableId] = useState("");

  /** 케이블 연결에 대한 설명 (예: PC-01 to SW-01) */
  const [description, setDescription] = useState("");

  // ==================== 데이터 상태 관리 ====================

  /** 시스템에 등록된 모든 네트워크 장비 목록 */
  const [devices, setDevices] = useState<Device[]>([]);

  /**
   * 장비 ID별 포트 매핑 객체
   * @example { 1: [Port1, Port2], 2: [Port3, Port4] }
   */
  const [portsByDeviceId, setPortsByDeviceId] = useState<
    Record<number, Port[]>
  >({});

  // ==================== 선택된 연결 정보 상태 ====================

  /** 케이블 연결 시작점 장비 ID */
  const [fromDeviceId, setFromDeviceId] = useState<number | null>(null);

  /** 케이블 연결 종료점 장비 ID */
  const [toDeviceId, setToDeviceId] = useState<number | null>(null);

  /** 케이블 연결 시작점 포트 ID */
  const [fromPortId, setFromPortId] = useState<number | null>(null);

  /** 케이블 연결 종료점 포트 ID */
  const [toPortId, setToPortId] = useState<number | null>(null);

  // ==================== UI 상태 관리 ====================

  /** 고급 포트 선택 모드 표시 여부 */
  //const [showAdvanced, setShowAdvanced] = useState(false);

  /**
   * 컴포넌트 마운트 시 초기 데이터 로딩
   *
   * @description
   * - 네트워크 장비 목록과 포트 정보를 병렬로 로드
   * - 포트 데이터를 장비 ID별로 그룹화하여 효율적인 접근 제공
   * - API 응답 구조에 맞춰 타입 안전한 데이터 변환 수행
   */
  useEffect(() => {
    const loadDevicesAndPorts = async () => {
      try {
        // 장비 목록과 포트 목록을 병렬로 로드하여 성능 최적화
        const [deviceRes, portRes] = await Promise.all([
          axios.get("/api/device"),
          axios.get("/api/ports"),
        ]);

        // 장비 목록 상태 업데이트
        const devices: Device[] = deviceRes.data;
        setDevices(devices);

        // 포트 데이터를 장비 ID별로 그룹화
        const portMap: Record<number, Port[]> = {};

        // API 응답 구조에 맞춘 포트 데이터 변환 및 그룹화
        for (const apiPort of portRes.data as {
          portId: number;
          name: string;
          device: { deviceId: number };
        }[]) {
          const deviceId = apiPort.device.deviceId;

          // 내부 Port 타입으로 변환
          const port: Port = {
            portId: apiPort.portId,
            name: apiPort.name,
            deviceId: deviceId,
          };

          // 해당 장비의 포트 배열 초기화 (필요시)
          if (!portMap[deviceId]) portMap[deviceId] = [];
          portMap[deviceId].push(port);
        }

        setPortsByDeviceId(portMap);
      } catch (error) {
        console.error("장비 및 포트 데이터 로딩 실패:", error);
        alert("장비 정보를 불러오는데 실패했습니다.");
      }
    };

    loadDevicesAndPorts();
  }, []);

  /**
   * 장비 선택 시 기본 포트 자동 선택 처리
   *
   * @description
   * - 기본 모드에서는 각 장비의 첫 번째 포트를 자동 선택
   * - 장비 변경 시마다 해당 장비의 사용 가능한 포트로 자동 업데이트
   */
  useEffect(() => {
    if (fromDeviceId && portsByDeviceId[fromDeviceId]?.length > 0) {
      setFromPortId(portsByDeviceId[fromDeviceId][0].portId);
    }

    if (toDeviceId && portsByDeviceId[toDeviceId]?.length > 0) {
      setToPortId(portsByDeviceId[toDeviceId][0].portId);
    }
  }, [fromDeviceId, toDeviceId, portsByDeviceId]);

  /**
   * 케이블 연결 등록 요청 처리
   *
   * @description
   * - 입력 데이터 유효성 검증
   * - 네트워크 토폴로지 제약사항 확인 (PC-SWITCH 연결 규칙)
   * - 서버 API 호출 및 응답 처리
   * - 성공/실패에 따른 사용자 피드백 및 상태 초기화
   *
   * @param e - 폼 제출 이벤트 객체
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ==================== 입력 데이터 유효성 검증 ====================
    if (!cableId || !fromPortId || !toPortId) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    // ==================== 장비 정보 조회 및 검증 ====================
    const fromDevice = devices.find(
      (device) => device.deviceId === fromDeviceId
    );
    const toDevice = devices.find((device) => device.deviceId === toDeviceId);

    if (!fromDevice || !toDevice) {
      alert("장비 정보를 불러오는 데 실패했습니다.");
      return;
    }

    // ==================== 네트워크 토폴로지 제약사항 검증 ====================

    // 장비 타입을 대문자로 정규화하여 일관된 비교 수행
    const fromType = fromDevice.type.toUpperCase();
    const toType = toDevice.type.toUpperCase();

    // 비즈니스 규칙: PC는 반드시 SWITCH와만 연결 가능
    const isInvalidConnection =
      (fromType === "PC" && toType !== "SWITCH") ||
      (toType === "PC" && fromType !== "SWITCH");

    if (isInvalidConnection) {
      alert("❌ PC는 SWITCH와만 연결할 수 있습니다.");
      return;
    }

    // ==================== API 요청 및 응답 처리 ====================
    try {
      // 케이블 등록 API 호출
      await axios.post("/api/cable", {
        cableId,
        description,
        fromPortId,
        toPortId,
      });

      // 성공 시 사용자 피드백 및 상태 초기화
      alert("케이블이 성공적으로 연결되었습니다.");

      // 폼 입력 상태 초기화
      setCableId("");
      setDescription("");
      setFromDeviceId(null);
      setToDeviceId(null);
      setFromPortId(null);
      setToPortId(null);

      // 상위 컴포넌트에 성공 알림 (네트워크 다이어그램 새로고침 등)
      onSuccess();
    } catch (err) {
      // ==================== 에러 처리 및 사용자 피드백 ====================

      const error = err as AxiosError<{ message: string }>;

      // 서버 에러 메시지 우선, 없으면 클라이언트 에러 메시지 사용
      const errorMessage = error.response?.data?.message ?? error.message;

      alert(`등록 실패: ${errorMessage}`);
      console.error("케이블 등록 에러:", err);
    }
  };

  // ==================== UI 렌더링 ====================

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-md p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-slate-700 font-semibold mb-2">📍 케이블 추가</h3>

        {/* 케이블 ID 입력 필드 */}
        <div>
          <label className="block text-sm mb-1">케이블 ID</label>
          <input
            type="text"
            className="input"
            placeholder="예: CABLE-001"
            value={cableId}
            onChange={(e) => setCableId(e.target.value)}
            required
            aria-describedby="케이블의 고유 식별자를 입력하세요"
          />
        </div>

        {/* 케이블 설명 입력 필드 */}
        <div>
          <label className="block text-sm mb-1">설명</label>
          <input
            type="text"
            className="input"
            placeholder="예: PC-01 to SW-01"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-describedby="케이블 연결에 대한 설명을 입력하세요"
          />
        </div>

        {/* From 장비 선택 드롭다운 */}
        <div>
          <label className="block text-sm mb-1">From 장비</label>
          <select
            className="input"
            value={fromDeviceId ?? ""}
            onChange={(e) => setFromDeviceId(Number(e.target.value))}
            required
            aria-describedby="케이블 연결 시작점 장비를 선택하세요"
          >
            <option value="">-- 선택 --</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.name} ({device.type})
              </option>
            ))}
          </select>
        </div>

        {/* To 장비 선택 드롭다운 */}
        <div>
          <label className="block text-sm mb-1">To 장비</label>
          <select
            className="input"
            value={toDeviceId ?? ""}
            onChange={(e) => setToDeviceId(Number(e.target.value))}
            required
            aria-describedby="케이블 연결 종료점 장비를 선택하세요"
          >
            <option value="">-- 선택 --</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.name} ({device.type})
              </option>
            ))}
          </select>
        </div>

        {/* 고급 포트 선택 모드 토글 버튼 */}
        {/* <button
        type="button"
        onClick={() => setShowAdvanced((prev) => !prev)}
        className="text-blue-500 text-sm underline hover:text-blue-700 transition-colors"
        aria-expanded={showAdvanced}
        aria-controls="advanced-port-selection"
      >
        {showAdvanced ? "기본 포트로 숨기기" : "포트 선택"}
      </button> */}

        {/* 고급 포트 선택 섹션 (조건부 렌더링) */}
        <div className="space-y-4">
          {/* From 포트 선택 드롭다운 */}
          <div>
            <label className="block text-sm mb-1">From 포트</label>
            <select
              className="input"
              value={fromPortId ?? ""}
              onChange={(e) => setFromPortId(Number(e.target.value))}
              disabled={!fromDeviceId}
              aria-describedby="케이블 연결 시작점 포트를 선택하세요"
            >
              <option value="">-- 선택 --</option>
              {fromDeviceId &&
                portsByDeviceId[fromDeviceId]?.map((port) => (
                  <option key={port.portId} value={port.portId}>
                    {port.name}
                  </option>
                ))}
            </select>
          </div>

          {/* To 포트 선택 드롭다운 */}
          <div>
            <label className="block text-sm mb-1">To 포트</label>
            <select
              className="input"
              value={toPortId ?? ""}
              onChange={(e) => setToPortId(Number(e.target.value))}
              disabled={!toDeviceId}
              aria-describedby="케이블 연결 종료점 포트를 선택하세요"
            >
              <option value="">-- 선택 --</option>
              {toDeviceId &&
                portsByDeviceId[toDeviceId]?.map((port) => (
                  <option key={port.portId} value={port.portId}>
                    {port.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* 케이블 연결 등록 버튼 */}
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 
                   disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={!cableId || !fromPortId || !toPortId}
          aria-describedby="모든 필드를 입력한 후 클릭하여 케이블을 등록하세요"
        >
          케이블 연결
        </button>
      </form>
    </div>
  );
}
