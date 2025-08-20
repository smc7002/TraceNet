/**
 * SidePanel.tsx - 네트워크 장비 및 케이블 관리를 위한 사이드 패널 컴포넌트
 * 
 * 주요 기능:
 * - 선택된 장비의 상세 정보 표시 및 설정 관리
 * - 케이블 연결 정보 조회 및 관리
 * - 새 장비/케이블 등록 폼 제공
 * - 실시간 포트 연결 상태 모니터링 (스위치 전용)
 * - 네트워크 경로 추적(Trace) 결과 표시
 * 
 * 컴포넌트 구조:
 * - 조건부 렌더링으로 3가지 패널 모드 제공
 * - 각 패널은 독립적인 기능을 담당하는 하위 컴포넌트로 구성
 * - 에러 처리 및 로딩 상태 관리를 통한 안정적인 UX 제공
 * 
 * 사용 사례:
 * - 네트워크 관리자의 장비 설정 및 모니터링
 * - 케이블 연결 관계 파악 및 문제 진단
 * - 신규 장비 등록 및 기존 장비 삭제
 */

import { useState, useEffect } from "react";
import type { AxiosError } from "axios";
import type { ReactNode } from "react";
import DeviceForm from "./DeviceForm";
import CableForm from "./CableForm";
import {
  fetchPortsByDevice,
  updateDeviceStatus,
  deleteDevice,
  deleteCable,
} from "../api/deviceApi";
import type { Device } from "../types/device";
import type { CableDto } from "../types/cable";
import type { TraceResponse } from "../types/trace";
import type { Port } from "../types/port";
import { DeviceStatus } from "../types/status";

/**
 * SidePanel 컴포넌트의 Props 인터페이스
 * 메인 페이지에서 전달받는 모든 상태와 콜백 함수들을 정의
 */
interface SidePanelProps {
  selectedDevice: Device | null;              // 현재 선택된 장비
  selectedCable: CableDto | null;             // 현재 선택된 케이블
  traceResult: TraceResponse | null;          // 경로 추적 결과
  traceError: string | null;                  // 추적 에러 메시지
  filteredCables: CableDto[];                 // 검색 필터링된 케이블 목록
  setSelectedDevice: (device: Device | null) => void;     // 장비 선택 상태 변경
  setSelectedCable: (cable: CableDto | null) => void;     // 케이블 선택 상태 변경
  refetchDevices: () => Promise<void>;        // 장비 목록 재조회
  refetchCables: () => Promise<void>;         // 케이블 목록 재조회
  devices: Device[];                          // 전체 장비 목록 (포트 연결 정보용)
}

/**
 * 스위치 포트의 연결 상태를 나타내는 인터페이스
 * 물리적 포트와 논리적 케이블 연결 정보를 통합 관리
 */
interface PortConnection {
  portNumber: number;                         // 포트 번호 (1부터 시작)
  isActive: boolean;                          // 포트 활성화 상태
  connectedDevice?: string;                   // 연결된 장비명
  connectedDeviceType?: string;               // 연결된 장비 타입
  connectedDeviceStatus?: string;             // 연결된 장비 상태
  cableId?: string | number;                  // 케이블 ID (연결된 경우)
}

/**
 * SidePanel 메인 컴포넌트
 * 
 * 선택 상태에 따라 다른 패널을 조건부 렌더링:
 * 1. 아무것도 선택되지 않음 → 등록 패널 (장비/케이블 등록 폼)
 * 2. 케이블 선택됨 → 케이블 정보 패널
 * 3. 장비 선택됨 → 장비 정보 패널 (상세 정보, 포트 상태, 설정)
 */
export default function SidePanel(props: SidePanelProps) {
  const {
    selectedDevice,
    selectedCable,
    traceResult,
    traceError,
    filteredCables,
    setSelectedDevice,
    setSelectedCable,
    refetchDevices,
    refetchCables,
    devices,
  } = props;

  /**
   * 렌더링 분기 로직
   * 
   * 우선순위:
   * 1. 케이블 선택 > 장비 선택 (케이블 정보가 더 구체적)
   * 2. 장비 선택 > 기본 상태 (장비 상세 정보)
   * 3. 기본 상태 > 등록 패널 (신규 등록)
   */
  if (!selectedDevice) {
    return (
      <RegistrationPanel
        filteredCables={filteredCables}
        setSelectedCable={setSelectedCable}
        refetchDevices={refetchDevices}
        refetchCables={refetchCables}
      />
    );
  }

  if (selectedCable) {
    return (
      <CableInfoPanel
        selectedCable={selectedCable}
        setSelectedCable={setSelectedCable}
        refetchDevices={refetchDevices}
        refetchCables={refetchCables}
      />
    );
  }

  return (
    <DeviceInfoPanel
      selectedDevice={selectedDevice}
      setSelectedDevice={setSelectedDevice}
      refetchDevices={refetchDevices}
      refetchCables={refetchCables}
      traceResult={traceResult}
      traceError={traceError}
      filteredCables={filteredCables}
      devices={devices}
    />
  );
}

/* ───────────────────────── 등록 패널 ───────────────────────── */

/**
 * 등록 패널 컴포넌트
 * 
 * 기능:
 * - 새 장비 등록 폼 제공
 * - 새 케이블 등록 폼 제공
 * - 케이블 검색 결과 표시 및 선택 기능
 * 
 * 표시 조건: 아무 장비도 선택되지 않은 기본 상태
 */
function RegistrationPanel({
  filteredCables,
  setSelectedCable,
  refetchDevices,
  refetchCables,
}: {
  filteredCables: CableDto[];
  setSelectedCable: (cable: CableDto | null) => void;
  refetchDevices: () => Promise<void>;
  refetchCables: () => Promise<void>;
}) {
  return (
    <aside className="w-80 shrink-0 bg-white border-l border-slate-200 p-6 space-y-6 overflow-y-auto shadow-inner">
      <h2 className="text-lg font-semibold">🔧 장비 및 케이블 등록</h2>

      {/* 장비 등록 폼 - 성공 시 자동으로 장비 목록 새로고침 */}
      <DeviceForm onSuccess={refetchDevices} />
      
      {/* 케이블 등록 폼 - 성공 시 자동으로 케이블 목록 새로고침 */}
      <CableForm onSuccess={refetchCables} />

      {/* 케이블 검색 결과 섹션 */}
      <section className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-600 mb-2">🔌 케이블 검색 결과</h3>
        <CableSearchResults filteredCables={filteredCables} onSelectCable={setSelectedCable} />
      </section>
    </aside>
  );
}

/* ───────────────────────── 케이블 패널 ───────────────────────── */

/**
 * 케이블 정보 패널 컴포넌트
 * 
 * 기능:
 * - 선택된 케이블의 상세 정보 표시
 * - 케이블 삭제 기능 (확인 다이얼로그 포함)
 * - 연결된 장비 정보 표시 (From/To)
 * 
 * 표시 조건: 케이블이 선택된 상태
 */
function CableInfoPanel({
  selectedCable,
  setSelectedCable,
  refetchDevices,
  refetchCables,
}: {
  selectedCable: CableDto;
  setSelectedCable: (cable: CableDto | null) => void;
  refetchDevices: () => Promise<void>;
  refetchCables: () => Promise<void>;
}) {
  /**
   * 케이블 삭제 핸들러
   * 
   * 처리 순서:
   * 1. 사용자 확인 다이얼로그
   * 2. API 호출로 케이블 삭제
   * 3. 장비/케이블 목록 재조회 (연결 관계 업데이트)
   * 4. 선택 상태 해제
   * 5. 에러 처리 및 사용자 알림
   */
  const handleDelete = async () => {
    if (!confirm(`정말 케이블 ${selectedCable.cableId}을 삭제하시겠습니까?`)) return;

    try {
      await deleteCable(selectedCable.cableId);
      // 케이블 삭제 후 장비와 케이블 목록 모두 새로고침 (연결 상태 동기화)
      await Promise.all([refetchDevices(), refetchCables()]);
      setSelectedCable(null);
      alert("삭제 완료");
    } catch (err) {
      alert("삭제 실패");
      console.error(err);
    }
  };

  return (
    <aside className="w-80 shrink-0 bg-white border-l border-slate-200 p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">🔌 케이블 정보</h2>

      {/* 케이블 기본 정보 표시 */}
      <div className="space-y-3">
        <InfoItem label="케이블 ID" value={String(selectedCable.cableId)} />
        <InfoItem label="설명" value={selectedCable.description ?? "-"} />
        <InfoItem label="From 장비" value={`${selectedCable.fromDevice} (${selectedCable.fromPort})`} />
        <InfoItem label="To 장비" value={`${selectedCable.toDevice} (${selectedCable.toPort})`} />
      </div>

      {/* 케이블 삭제 버튼 */}
      <button
        className="mt-6 w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 transition"
        onClick={handleDelete}
      >
        🗑️ 이 케이블 삭제하기
      </button>
    </aside>
  );
}

/* ───────────────────────── 장비 패널 ───────────────────────── */

/**
 * 장비 정보 패널 컴포넌트
 * 
 * 기능:
 * - 장비 기본 정보 표시 (이름, IP, 타입 등)
 * - 스위치인 경우 포트 연결 상태 모니터링
 * - 네트워크 경로 추적 결과 표시
 * - 장비 상태 및 Ping 설정 제어
 * - 장비 삭제 기능 (연결된 케이블도 함께 삭제)
 * 
 * 표시 조건: 장비가 선택되었지만 케이블은 선택되지 않은 상태
 */
function DeviceInfoPanel({
  selectedDevice,
  setSelectedDevice,
  refetchDevices,
  refetchCables,
  traceResult,
  traceError,
  filteredCables,
  devices,
}: {
  selectedDevice: Device;
  setSelectedDevice: (device: Device | null) => void;
  refetchDevices: () => Promise<void>;
  refetchCables: () => Promise<void>;
  traceResult: TraceResponse | null;
  traceError: string | null;
  filteredCables: CableDto[];
  devices: Device[];
}) {
  const [deleting, setDeleting] = useState(false);

  /**
   * 장비 삭제 핸들러
   * 
   * 고급 에러 처리 패턴:
   * 1. 낙관적 업데이트: 즉시 선택 해제 (빠른 UX)
   * 2. API 호출 및 데이터 새로고침
   * 3. 실패 시 선택 상태 복원 (롤백)
   * 4. 상세한 에러 메시지 표시
   */
  const handleDelete = async () => {
    if (
      !confirm(
        `정말 ${selectedDevice.name} 장비를 삭제하시겠습니까?\n연결된 케이블들도 모두 삭제됩니다.`
      )
    )
      return;

    try {
      setDeleting(true);
      
      // 낙관적 업데이트: 즉시 UI에서 제거 (사용자 경험 향상)
      setSelectedDevice(null);
      
      // 실제 삭제 작업 수행
      await deleteDevice(selectedDevice.deviceId);
      
      // 장비와 케이블 목록 모두 새로고침 (CASCADE 삭제 반영)
      await Promise.all([refetchDevices(), refetchCables()]);
      
      console.log("✅ 삭제 완료 및 상태 갱신됨");
    } catch (err) {
      // 실패 시 선택 상태 복원 (롤백)
      setSelectedDevice(selectedDevice);
      
      // 상세한 에러 메시지 추출 및 표시
      const error = err as AxiosError<{ message: string }>;
      const message = error.response?.data?.message ?? error.message;
      alert(`삭제 실패: ${message}`);
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <aside className="w-80 shrink-0 flex flex-col bg-white border-l border-slate-200 shadow-md">
      {/* 장비 정보 헤더 */}
      <DeviceHeader device={selectedDevice} />

      {/* 메인 콘텐츠 영역 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
        {/* 기본 장비 정보 */}
        <DeviceBasicInfo device={selectedDevice} />

        {/* 스위치인 경우에만 포트 연결 상태 표시 */}
        {selectedDevice.type?.toLowerCase() === "switch" && (
          <PortConnectionStatus
            device={selectedDevice}
            filteredCables={filteredCables}
            devices={devices}
          />
        )}

        {/* 네트워크 경로 추적 결과 */}
        <TraceResultSection traceResult={traceResult} traceError={traceError} />

        {/* 장비 상태 및 Ping 설정 제어 */}
        <DeviceStatusControls
          device={selectedDevice}
          setSelectedDevice={setSelectedDevice}
          refetchDevices={refetchDevices}
        />
      </div>

      {/* 하단 고정 삭제 버튼 */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <button
          className="bg-red-500 text-white rounded w-full py-2 hover:bg-red-600 transition disabled:opacity-50"
          onClick={handleDelete}
          disabled={deleting}
        >
          🗑️ 이 장비 삭제하기
        </button>
      </div>
    </aside>
  );
}

/* ───────────────────────── 하위 컴포넌트 ───────────────────────── */

/**
 * 케이블 검색 결과 표시 컴포넌트
 * 
 * 기능:
 * - 필터링된 케이블 목록을 버튼 형태로 표시
 * - 케이블 클릭 시 상세 정보 패널로 전환
 * - 빈 결과에 대한 적절한 안내 메시지
 */
function CableSearchResults({
  filteredCables,
  onSelectCable,
}: {
  filteredCables: CableDto[];
  onSelectCable: (cable: CableDto | null) => void;
}) {
  return (
    <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
      {filteredCables.length === 0 ? (
        <div className="text-slate-400">검색 결과 없음</div>
      ) : (
        filteredCables.map((cable) => (
          <button
            key={String(cable.cableId)}
            onClick={() => onSelectCable(cable)}
            className="block w-full text-left border px-2 py-1 rounded hover:bg-slate-100"
          >
            {/* 케이블 설명이 있으면 표시, 없으면 ID만 표시 */}
            {(cable.description ? `${cable.description} — ` : "")}(
            {String(cable.cableId)})
          </button>
        ))
      )}
    </div>
  );
}

/**
 * 장비 헤더 컴포넌트
 * 선택된 장비의 기본 식별 정보를 상단에 고정 표시
 */
function DeviceHeader({ device }: { device: Device }) {
  return (
    <div className="p-4 border-b border-slate-200 bg-slate-50">
      <div className="text-lg font-semibold">{device.name}</div>
      <div className="text-sm text-slate-500">
        {device.ipAddress ?? "IP 미지정"} • {device.status} • 방금 전
      </div>
    </div>
  );
}

/**
 * 장비 기본 정보 컴포넌트
 * IP 주소, 장비 타입 등 기본적인 장비 속성 표시
 */
function DeviceBasicInfo({ device }: { device: Device }) {
  return (
    <section>
      <div className="text-slate-700 font-semibold mb-3">📊 장비 정보</div>
      <div className="space-y-2">
        <InfoItem label="IP 주소" value={device.ipAddress ?? "-"} />
        <InfoItem label="장비 유형" value={device.type ?? "-"} />
      </div>
    </section>
  );
}

/* ───────── 포트 연결 상태 ───────── */

/**
 * 포트 연결 상태 컴포넌트 (스위치 전용)
 * 
 * 기능:
 * - 스위치의 모든 포트 상태를 실시간으로 조회 및 표시
 * - 각 포트별 연결된 장비 정보 표시
 * - 포트 활성화 상태 시각적 표시 (LED 스타일)
 * - 케이블 연결 정보와 장비 정보를 통합하여 표시
 * 
 * 데이터 소스:
 * - 포트 정보: fetchPortsByDevice API (물리적 포트 상태)
 * - 연결 정보: filteredCables (논리적 케이블 연결)
 * - 장비 정보: devices (연결된 장비의 상태/타입)
 */
function PortConnectionStatus({
  device,
  filteredCables,
  devices,
}: {
  device: Device;
  filteredCables: CableDto[];
  devices: Device[];
}) {
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [portConnections, setPortConnections] = useState<PortConnection[]>([]);

  /**
   * 성능 최적화: device 객체 직접 의존 대신 필요한 값만 추출
   * device 객체의 다른 속성 변경 시 불필요한 재실행 방지
   */
  const deviceId = device.deviceId;
  const currentName = device.name;

  /**
   * 포트 정보 로딩 Effect
   * 
   * 처리 과정:
   * 1. 백엔드에서 물리적 포트 정보 조회
   * 2. 케이블 정보와 매칭하여 논리적 연결 관계 구성
   * 3. 연결된 장비의 상태 정보 추가
   * 4. 통합된 포트 연결 상태 생성
   * 
   * 성능 고려사항:
   * - alive 플래그로 컴포넌트 언마운트 시 상태 업데이트 방지
   * - 에러 발생 시 빈 배열로 초기화하여 UI 안정성 확보
   */
  useEffect(() => {
    let alive = true;
    
    (async () => {
      try {
        setLoadingPorts(true);
        
        // 1. 물리적 포트 정보 조회
        const devicePorts = await fetchPortsByDevice(deviceId);

        // 2. 장비 이름 기반 빠른 조회를 위한 Map 생성
        const devicesByName = new Map<string, Device>(
          devices.map((d) => [d.name, d])
        );

        // 3. 포트-케이블-장비 정보 통합
        const connections = createPortConnections(
          devicePorts,
          filteredCables,
          currentName,
          devicesByName
        );
        
        // 4. 컴포넌트가 아직 마운트된 상태에서만 상태 업데이트
        if (alive) setPortConnections(connections);
      } catch (error) {
        if (alive) setPortConnections([]);
        console.error("포트 정보 로드 실패:", error);
      } finally {
        if (alive) setLoadingPorts(false);
      }
    })();
    
    // 클린업: 컴포넌트 언마운트 시 상태 업데이트 방지
    return () => {
      alive = false;
    };
  }, [deviceId, currentName, filteredCables, devices]);

  return (
    <section>
      <div className="text-slate-700 font-semibold mb-3">🔌 포트 연결 상태</div>
      {loadingPorts ? (
        <div className="text-slate-400 text-sm">포트 정보 로딩 중...</div>
      ) : (
        <div className="bg-slate-50 rounded-md p-3 max-h-64 overflow-y-auto">
          <div className="grid grid-cols-1 gap-2 text-xs">
            {portConnections.map((port) => (
              <PortConnectionItem key={port.portNumber} port={port} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * 개별 포트 연결 상태 표시 컴포넌트
 * 
 * 시각적 요소:
 * - 포트 번호: 고정폭 폰트로 정렬된 표시
 * - 활성화 LED: 초록(활성)/회색(비활성) 원형 표시기
 * - 연결 상태: 연결된 장비명과 타입 또는 "미연결" 표시
 * - 배경색: 연결 상태에 따른 시각적 구분
 */
function PortConnectionItem({ port }: { port: PortConnection }) {
  return (
    <div
      className={`flex justify-between items-center p-2 rounded border ${
        port.connectedDevice
          ? "bg-green-50 border-green-200"  // 연결됨: 초록색 테마
          : "bg-slate-100 border-slate-200" // 미연결: 회색 테마
      }`}
    >
      {/* 왼쪽: 포트 번호 및 활성화 상태 */}
      <div className="flex items-center space-x-2">
        <span className="font-mono font-semibold">
          P{port.portNumber.toString().padStart(2, "0")}
        </span>
        <div
          className={`w-2 h-2 rounded-full ${
            port.isActive ? "bg-green-400" : "bg-slate-300"
          }`}
        />
      </div>

      {/* 오른쪽: 연결된 장비 정보 */}
      <div className="text-right">
        {port.connectedDevice ? (
          <div>
            <div className="font-medium text-slate-700">
              {port.connectedDevice}
            </div>
            <div className="text-slate-500">{port.connectedDeviceType}</div>
          </div>
        ) : (
          <span className="text-slate-400">미연결</span>
        )}
      </div>
    </div>
  );
}

/* ───────── 트레이스 결과 ───────── */

/**
 * 네트워크 경로 추적 결과 표시 컴포넌트
 * 
 * 기능:
 * - 트레이스 에러 메시지 표시
 * - 로딩 상태 안내
 * - 경로 정보가 있는 경우 hop-by-hop 경로 표시
 * - 경로 정보가 없는 경우 적절한 안내 메시지
 * 
 * 표시 형식: "순번. 출발장비 (출발포트) → 도착장비 (도착포트)"
 */
function TraceResultSection({
  traceResult,
  traceError,
}: {
  traceResult: TraceResponse | null;
  traceError: string | null;
}) {
  return (
    <section>
      <div className="text-slate-700 font-semibold mb-3">🛤️ Trace 결과</div>
      {traceError ? (
        <div className="text-red-500 text-sm">{traceError}</div>
      ) : !traceResult ? (
        <div className="text-slate-400 text-sm">
          Trace 정보를 불러오는 중입니다...
        </div>
      ) : traceResult.path?.length > 0 ? (
        <div className="bg-slate-50 rounded-md p-3 text-[12px] font-mono space-y-1 text-slate-700">
          {traceResult.path.map((trace, idx) => (
            <div key={idx}>
              {idx + 1}. {trace.fromDevice} ({trace.fromPort}) → {trace.toDevice} (
              {trace.toPort})
            </div>
          ))}
        </div>
      ) : (
        <div className="text-slate-400 text-sm">경로 정보가 없습니다.</div>
      )}
    </section>
  );
}

/* ───────── 상태/핑 컨트롤 ───────── */

/**
 * 장비 상태 및 Ping 설정 제어 컴포넌트
 * 
 * 기능:
 * - 장비 상태 변경 (Online/Offline/Unstable/Unknown)
 * - Ping 활성화/비활성화 토글
 * - 변경 사항 실시간 반영 및 에러 처리
 * - 저장 중 상태 표시 및 UI 잠금
 * 
 * 상태 동기화:
 * - 로컬 상태 즉시 업데이트 (낙관적 업데이트)
 * - 백엔드 API 호출로 영구 저장
 * - 전역 장비 목록 새로고침으로 일관성 유지
 */
function DeviceStatusControls({
  device,
  setSelectedDevice,
  refetchDevices,
}: {
  device: Device;
  setSelectedDevice: (device: Device | null) => void;
  refetchDevices: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  /**
   * 장비 상태 변경 핸들러
   * 
   * 처리 순서:
   * 1. 저장 상태 활성화 (UI 잠금)
   * 2. 백엔드 API 호출
   * 3. 응답 데이터로 로컬 선택 상태 업데이트
   * 4. 전역 장비 목록 새로고침
   * 5. 에러 처리 및 사용자 알림
   */
  const handleStatusChange = async (newStatus: DeviceStatus) => {
    try {
      setSaving(true);
      const updated = await updateDeviceStatus(device.deviceId, newStatus);
      
      // 로컬 선택 상태 즉시 업데이트
      setSelectedDevice({
        ...device,
        status: updated.status,
        lastCheckedAt: updated.lastCheckedAt,
        enablePing: updated.enablePing,
      });
      
      // 전역 상태와 동기화
      await refetchDevices();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Ping 활성화/비활성화 토글 핸들러
   * 
   * 현재 enablePing 상태를 반전시켜서 업데이트
   * 장비 상태는 변경하지 않고 Ping 설정만 토글
   */
  const handleTogglePing = async () => {
    try {
      setSaving(true);
      const updated = await updateDeviceStatus(
        device.deviceId,
        device.status as DeviceStatus,
        !device.enablePing  // 현재 상태의 반대로 설정
      );
      
      // Ping 설정과 마지막 확인 시간만 업데이트
      setSelectedDevice({
        ...device,
        enablePing: updated.enablePing,
        lastCheckedAt: updated.lastCheckedAt,
      });
      
      await refetchDevices();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="text-slate-700 font-semibold">⚙️ 상태 / Ping</div>

      {/* 장비 상태 선택 드롭다운 */}
      <div className="flex items-center gap-2">
        <label className="text-sm w-24 text-slate-600">상태</label>
        <select
          className="flex-1 border rounded px-2 py-1 text-sm"
          value={device.status}
          disabled={saving}
          onChange={(e) => handleStatusChange(e.target.value as DeviceStatus)}
        >
          <option value="Online">Online</option>
          <option value="Offline">Offline</option>
          <option value="Unstable">Unstable</option>
          <option value="Unknown">Unknown</option>
        </select>
      </div>

      {/* Ping 활성화 토글 버튼 */}
      <div className="flex items-center gap-2">
        <label className="text-sm w-24 text-slate-600">Enable Ping</label>
        <button
          type="button"
          disabled={saving}
          onClick={handleTogglePing}
          className={`px-3 py-1 rounded text-sm border transition ${
            device.enablePing
              ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
          }`}
        >
          {device.enablePing ? "ON" : "OFF"}
        </button>
        {saving && <span className="ml-2 text-xs text-slate-500">저장 중…</span>}
      </div>
    </section>
  );
}

/* ───────── 유틸리티 함수들 ───────── */

/**
 * 포트 문자열에서 숫자 추출 함수
 * 
 * 다양한 포트 표기법을 처리:
 * - "Gi1/0/10" → 10 (마지막 숫자)
 * - "P05" → 5
 * - "FastEthernet0/1" → 1
 * - 24 → 24 (숫자 그대로)
 * 
 * @param label 포트 라벨 (문자열, 숫자, 또는 undefined)
 * @returns 추출된 포트 번호 (실패 시 NaN)
 */
function parsePortNumber(label: string | number | undefined): number {
  if (typeof label === "number") return label;
  if (!label) return NaN;
  
  // 정규식: 문자열에서 마지막 연속된 숫자 그룹 찾기
  const m = String(label).match(/(\d+)(?!.*\d)/);
  return m ? Number(m[1]) : NaN;
}

/**
 * 포트 연결 정보 생성 함수
 * 
 * 기능:
 * - 물리적 포트 정보와 논리적 케이블 연결을 통합
 * - 각 포트별 연결된 장비 정보 매핑
 * - 동적 포트 범위 계산 (최소 24포트, 실제 사용 포트까지 확장)
 * 
 * @param devicePorts 물리적 포트 상태 배열
 * @param cables 케이블 연결 정보 배열
 * @param currentDeviceName 현재 조회 중인 장비명
 * @param devicesByName 장비명 → 장비 객체 매핑
 * @returns 통합된 포트 연결 정보 배열
 */
function createPortConnections(
  devicePorts: Port[],
  cables: CableDto[],
  currentDeviceName: string,
  devicesByName: Map<string, Device>
): PortConnection[] {
  /**
   * 1단계: 케이블 연결 정보를 포트 기준으로 인덱싱
   * 
   * 구조: "장비명#포트번호" → 케이블 객체
   * 예: "Switch01#5" → { fromDevice: "Switch01", toDevice: "PC01", ... }
   */
  const byEnd = new Map<string, CableDto>();
  for (const cable of cables) {
    const fp = parsePortNumber(cable.fromPort as unknown as string | number | undefined);
    const tp = parsePortNumber(cable.toPort as unknown as string | number | undefined);
    
    // 유효한 포트 번호만 매핑에 추가
    if (!Number.isNaN(fp)) byEnd.set(`${cable.fromDevice}#${fp}`, cable);
    if (!Number.isNaN(tp)) byEnd.set(`${cable.toDevice}#${tp}`, cable);
  }

  /**
   * 2단계: 동적 포트 범위 계산
   * 
   * 고려 요소:
   * - 물리적으로 존재하는 포트 중 최대 번호
   * - 케이블로 연결된 포트 중 최대 번호
   * - 최소 24포트 보장 (일반적인 스위치 기본 포트 수)
   */
  const maxObserved = Math.max(
    // 물리적 포트 중 최대 번호
    devicePorts.reduce((m, p) => Math.max(m, p.portNumber || 0), 0),
    
    // 케이블 연결된 포트 중 최대 번호
    ...cables.map((c) =>
      Math.max(
        c.fromDevice === currentDeviceName
          ? parsePortNumber(c.fromPort as unknown as string | number | undefined)
          : 0,
        c.toDevice === currentDeviceName
          ? parsePortNumber(c.toPort as unknown as string | number | undefined)
          : 0
      )
    ),
    
    // 최소 24포트 보장
    24
  );

  /**
   * 3단계: 각 포트별 연결 정보 생성
   * 
   * 처리 과정:
   * 1. 포트 번호별로 물리적 상태 조회
   * 2. 케이블 연결 정보 매칭
   * 3. 연결된 장비의 상태/타입 정보 추가
   */
  const connections: PortConnection[] = [];
  for (let portNum = 1; portNum <= maxObserved; portNum++) {
    // 물리적 포트 정보 조회
    const port = devicePorts.find((p) => p.portNumber === portNum);
    
    const connection: PortConnection = {
      portNumber: portNum,
      isActive: Boolean(port?.isActive),  // undefined/null을 false로 변환
    };

    // 케이블 연결 정보 매칭
    const hit = byEnd.get(`${currentDeviceName}#${portNum}`);
    if (hit) {
      // 현재 장비가 From인지 To인지 판단
      const isFrom = hit.fromDevice === currentDeviceName;
      connection.connectedDevice = isFrom ? hit.toDevice : hit.fromDevice;

      // 케이블 ID 추출 (타입 안전성 확보)
      const id = (hit as { cableId?: string | number }).cableId;
      connection.cableId =
        typeof id === "string" || typeof id === "number" ? id : undefined;

      // 연결된 장비의 상태 및 타입 정보 추가
      const target = connection.connectedDevice
        ? devicesByName.get(connection.connectedDevice)
        : undefined;
      connection.connectedDeviceStatus = target?.status ?? "Unknown";
      connection.connectedDeviceType = target?.type ?? "Unknown";
    }

    connections.push(connection);
  }

  return connections;
}

/**
 * 정보 항목 표시 컴포넌트
 * 
 * 라벨-값 쌍을 일관된 형태로 표시하는 재사용 가능한 컴포넌트
 * 장비 정보, 케이블 정보 등에서 공통으로 사용
 * 
 * @param label 항목 라벨 (예: "IP 주소", "장비 유형")
 * @param value 항목 값 (문자열, 숫자, JSX 요소 등)
 */
function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}