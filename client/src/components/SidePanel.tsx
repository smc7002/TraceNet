import { useState, useEffect } from "react";
import type { AxiosError } from "axios";
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

interface SidePanelProps {
  selectedDevice: Device | null;
  selectedCable: CableDto | null;
  traceResult: TraceResponse | null;
  traceError: string | null;
  filteredCables: CableDto[];
  setSelectedDevice: (device: Device | null) => void;
  setSelectedCable: (cable: CableDto | null) => void;
  refetchDevices: () => Promise<void>;
  refetchCables: () => Promise<void>;
  devices: Device[];
}

interface PortConnection {
  portNumber: number;
  isActive: boolean;
  connectedDevice?: string;
  connectedDeviceType?: string;
  connectedDeviceStatus?: string;
  cableId?: number;
}

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

  // 🎯 렌더링 분기
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

// 🏗️ 장비 등록 패널
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

      <DeviceForm onSuccess={refetchDevices} />
      <CableForm onSuccess={refetchCables} />

      <section className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-600 mb-2">
          🔌 케이블 검색 결과
        </h3>
        <CableSearchResults
          filteredCables={filteredCables}
          onSelectCable={setSelectedCable}
        />
      </section>
    </aside>
  );
}

// 🔌 케이블 정보 패널
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
  const handleDelete = async () => {
    if (!confirm(`정말 케이블 ${selectedCable.cableId}을 삭제하시겠습니까?`))
      return;

    try {
      await deleteCable(selectedCable.cableId);
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

      <div className="space-y-3">
        <InfoItem label="케이블 ID" value={selectedCable.cableId} />
        <InfoItem label="설명" value={selectedCable.description ?? "-"} />
        <InfoItem
          label="From 장비"
          value={`${selectedCable.fromDevice} (${selectedCable.fromPort})`}
        />
        <InfoItem
          label="To 장비"
          value={`${selectedCable.toDevice} (${selectedCable.toPort})`}
        />
      </div>

      <button
        className="mt-6 w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 transition"
        onClick={handleDelete}
      >
        🗑️ 이 케이블 삭제하기
      </button>
    </aside>
  );
}

// 📱 장비 정보 패널
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

  const handleDelete = async () => {
    if (
      !confirm(
        `정말 ${selectedDevice.name} 장비를 삭제하시겠습니까?\n연결된 케이블들도 모두 삭제됩니다.`
      )
    )
      return;

    try {
      setDeleting(true);
      setSelectedDevice(null);
      await deleteDevice(selectedDevice.deviceId);
      await Promise.all([refetchDevices(), refetchCables()]);
      console.log("✅ 삭제 완료 및 상태 갱신됨");
    } catch (err) {
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
      {/* 헤더 */}
      <DeviceHeader device={selectedDevice} />

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
        <DeviceBasicInfo device={selectedDevice} />

        {selectedDevice.type === "Switch" && (
          <PortConnectionStatus
            device={selectedDevice}
            filteredCables={filteredCables}
            devices={devices}
          />
        )}

        <TraceResultSection traceResult={traceResult} traceError={traceError} />

        <DeviceStatusControls
          device={selectedDevice}
          setSelectedDevice={setSelectedDevice}
          refetchDevices={refetchDevices}
        />
      </div>

      {/* 삭제 버튼 */}
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

// 🔧 하위 컴포넌트들

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
            key={cable.cableId}
            onClick={() => onSelectCable(cable)}
            className="block w-full text-left border px-2 py-1 rounded hover:bg-slate-100"
          >
            {cable.description || cable.cableId}
          </button>
        ))
      )}
    </div>
  );
}

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

function DeviceBasicInfo({ device }: { device: Device }) {
  return (
    <section>
      <div className="text-slate-700 font-semibold mb-3">📊 장비 정보</div>
      <div className="space-y-2">
        <InfoItem label="IP 주소" value={device.ipAddress ?? "-"} />
        <InfoItem label="장비 유형" value={device.type} />
      </div>
    </section>
  );
}

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

  useEffect(() => {
    loadPortConnections();
  }, [device.deviceId, filteredCables, devices]);

  const loadPortConnections = async () => {
    try {
      setLoadingPorts(true);
      const devicePorts = await fetchPortsByDevice(device.deviceId);
      const connections = createPortConnections(
        devicePorts,
        filteredCables,
        device,
        devices
      );
      setPortConnections(connections);
    } catch (error) {
      console.error("포트 정보 로드 실패:", error);
      setPortConnections([]);
    } finally {
      setLoadingPorts(false);
    }
  };

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

function PortConnectionItem({ port }: { port: PortConnection }) {
  return (
    <div
      className={`flex justify-between items-center p-2 rounded border ${
        port.connectedDevice
          ? "bg-green-50 border-green-200"
          : "bg-slate-100 border-slate-200"
      }`}
    >
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
              {idx + 1}. {trace.fromDevice} ({trace.fromPort}) →{" "}
              {trace.toDevice} ({trace.toPort})
            </div>
          ))}
        </div>
      ) : (
        <div className="text-slate-400 text-sm">경로 정보가 없습니다.</div>
      )}
    </section>
  );
}

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

  const handleStatusChange = async (newStatus: DeviceStatus) => {
    try {
      setSaving(true);
      const updated = await updateDeviceStatus(device.deviceId, newStatus);
      setSelectedDevice({
        ...device,
        status: updated.status,
        lastCheckedAt: updated.lastCheckedAt,
        enablePing: updated.enablePing,
      });
      await refetchDevices();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePing = async () => {
    try {
      setSaving(true);
      const updated = await updateDeviceStatus(
        device.deviceId,
        device.status as DeviceStatus,
        !device.enablePing
      );
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
        {saving && (
          <span className="ml-2 text-xs text-slate-500">저장 중…</span>
        )}
      </div>
    </section>
  );
}

// 🔧 유틸리티 함수들
function parsePortNumber(label: string | number | undefined): number {
  if (typeof label === "number") return label;
  if (!label) return NaN;
  const match = String(label).match(/\d+/);
  return match ? Number(match[0]) : NaN;
}

function createPortConnections(
  devicePorts: Port[],
  cables: CableDto[],
  currentDevice: Device,
  devices: Device[]
): PortConnection[] {
  const maxPorts = Math.max(24, devicePorts.length);
  const connections: PortConnection[] = [];

  for (let portNum = 1; portNum <= maxPorts; portNum++) {
    const port = devicePorts.find((p) => p.portNumber === portNum);

    const connection: PortConnection = {
      portNumber: portNum,
      isActive: port?.isActive ?? false,
    };

    const connectedCable = cables.find((cable) => {
      const fromNum = parsePortNumber(cable.fromPort);
      const toNum = parsePortNumber(cable.toPort);
      return (
        (cable.fromDevice === currentDevice.name && fromNum === portNum) ||
        (cable.toDevice === currentDevice.name && toNum === portNum)
      );
    });

    if (connectedCable) {
      const isFrom = connectedCable.fromDevice === currentDevice.name;
      connection.connectedDevice = isFrom
        ? connectedCable.toDevice
        : connectedCable.fromDevice;
      connection.cableId = Number(connectedCable.cableId);

      const targetDevice = devices.find(
        (d) => d.name === connection.connectedDevice
      );
      connection.connectedDeviceStatus = targetDevice?.status ?? "Unknown";
      connection.connectedDeviceType = targetDevice?.type ?? "Unknown";
    }

    connections.push(connection);
  }

  return connections;
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
