import { useState, useEffect } from "react";
import axios, { AxiosError } from "axios";
import DeviceForm from "./DeviceForm";
import CableForm from "./CableForm";
import { fetchPortsByDevice, type Port } from "../api/deviceApi";
import type { Device } from "../types/device";
import type { CableDto } from "../types/cable";
import type { TraceResponse } from "../types/trace";

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

// 포트 연결 상태 타입 정의
interface PortConnection {
  portNumber: number;
  isActive: boolean;
  connectedDevice?: string;
  connectedDeviceType?: string;
  connectedDeviceIp?: string;
  connectedDeviceStatus?: string;
  cableId?: number;
}

export default function SidePanel({
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
}: SidePanelProps) {
  const [deleting, setDeleting] = useState(false);
  //const [ports] = useState<Port[]>([]);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [portConnections, setPortConnections] = useState<PortConnection[]>([]);

  // 포트 정보 로드
  useEffect(() => {
    if (selectedDevice && selectedDevice.type === "Switch") {
      loadPortConnections(selectedDevice.deviceId);
    } else {
      // setPorts([]); // 임시로 주석 처리
      setPortConnections([]);
    }
  }, [selectedDevice, filteredCables]);

  const loadPortConnections = async (deviceId: number) => {
    try {
      setLoadingPorts(true);
      const devicePorts = await fetchPortsByDevice(deviceId);
      // setPorts(devicePorts); // 임시로 주석 처리

      // 케이블 연결 정보와 매칭하여 포트 연결 상태 생성
      const connections = createPortConnections(
        devicePorts,
        filteredCables,
        selectedDevice!,
        devices 
      );
      setPortConnections(connections);
    } catch (error) {
      console.error("포트 정보 로드 실패:", error);
      // setPorts([]); // 임시로 주석 처리
      setPortConnections([]);
    } finally {
      setLoadingPorts(false);
    }
  };

  const createPortConnections = (
    devicePorts: Port[],
    cables: CableDto[],
    currentDevice: Device,
    devices: Device[]
  ): PortConnection[] => {
    const maxPorts = Math.max(24, devicePorts.length);
    const connections: PortConnection[] = [];

    for (let portNum = 1; portNum <= maxPorts; portNum++) {
      // 포트 정보가 없으면 기본 연결 상태 생성
      const port = devicePorts.find((p) => p.portNumber === portNum);

      const connection: PortConnection = {
        portNumber: portNum,
        isActive: port?.isActive ?? false,
      };

      // 포트 번호는 string으로 변환해서 비교해야 함
      const connectedCable = cables.find((cable) => {
        return (
          (cable.fromDevice === currentDevice.name &&
            cable.fromPort === String(portNum)) ||
          (cable.toDevice === currentDevice.name &&
            cable.toPort === String(portNum))
        );
      });

      if (connectedCable) {
        const isFrom = connectedCable.fromDevice === currentDevice.name;

        connection.connectedDevice = isFrom
          ? connectedCable.toDevice
          : connectedCable.fromDevice;

        // Cable ID는 string인데 PortConnection은 number로 예상했을 가능성 있으므로 Number() 처리
        connection.cableId = Number(connectedCable.cableId);

        // ✅ 연결된 장비의 상태 및 타입 찾아서 추가
        const targetDevice = devices.find(
          (d: Device) => d.name === connection.connectedDevice
        );

        connection.connectedDeviceStatus = targetDevice?.status ?? "Unknown";
        connection.connectedDeviceType = targetDevice?.type ?? "Unknown";
        connection.connectedDeviceIp = targetDevice?.ipAddress ?? undefined;
      }

      connections.push(connection);
    }

    return connections;
  };

  const handleDeleteDevice = async () => {
    if (!selectedDevice) return;

    const confirmDelete = confirm(
      `정말 ${selectedDevice.name} 장비를 삭제하시겠습니까?\n연결된 케이블들도 모두 삭제됩니다.`
    );
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      setSelectedDevice(null);
      setSelectedCable(null);
      await axios.delete(`/api/device/${selectedDevice.deviceId}`);
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

  if (!selectedDevice) {
    return (
      <aside className="w-80 shrink-0 bg-white border-l border-slate-200 p-6 space-y-6 overflow-y-auto shadow-inner">
        <h2 className="text-lg font-semibold">🔧 장비 및 케이블 등록</h2>

        <DeviceForm onSuccess={refetchDevices} />
        <CableForm onSuccess={refetchCables} />

        <section className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-600 mb-2">
            🔌 케이블 검색 결과
          </h3>
          <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
            {filteredCables.length === 0 ? (
              <div className="text-slate-400">검색 결과 없음</div>
            ) : (
              filteredCables.map((cable) => (
                <button
                  key={cable.cableId}
                  onClick={() => setSelectedCable(cable)}
                  className="block w-full text-left border px-2 py-1 rounded hover:bg-slate-100"
                >
                  {cable.description || cable.cableId}
                </button>
              ))
            )}
          </div>
        </section>
      </aside>
    );
  }

  if (selectedCable) {
    return (
      <aside className="w-80 shrink-0 bg-white border-l border-slate-200 p-6 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">🔌 케이블 정보</h2>
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
        <button
          className="mt-6 w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 transition"
          onClick={async () => {
            if (
              !confirm(
                `정말 케이블 ${selectedCable.cableId}을 삭제하시겠습니까?`
              )
            )
              return;
            try {
              await axios.delete(`/api/cable/${selectedCable.cableId}`);
              await Promise.all([refetchDevices(), refetchCables()]);
              setSelectedCable(null);
              alert("삭제 완료");
            } catch (err) {
              alert("삭제 실패");
              console.error(err);
            }
          }}
        >
          🗑️ 이 케이블 삭제하기
        </button>
      </aside>
    );
  }

  // 장비 선택 시 표시되는 패널
  return (
    <aside className="w-80 shrink-0 flex flex-col bg-white border-l border-slate-200 shadow-md">
      {/* 🔷 헤더 */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="text-lg font-semibold">{selectedDevice.name}</div>
        <div className="text-sm text-slate-500">
          {selectedDevice.ipAddress ?? "IP 미지정"} • {selectedDevice.status} •
          방금 전
        </div>
      </div>

      {/* 📦 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
        <section>
          <div className="text-slate-700 font-semibold mb-3">📊 장비 정보</div>
          <InfoItem label="IP 주소" value={selectedDevice.ipAddress ?? "-"} />
          <InfoItem label="장비 유형" value={selectedDevice.type} />
        </section>

        {/* 🔌 포트 연결 상태 (스위치일 때만 표시) */}
        {selectedDevice.type === "Switch" && (
          <section>
            <div className="text-slate-700 font-semibold mb-3">
              🔌 포트 연결 상태
            </div>
            {loadingPorts ? (
              <div className="text-slate-400 text-sm">포트 정보 로딩 중...</div>
            ) : (
              <div className="bg-slate-50 rounded-md p-3 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {portConnections.map((port) => (
                    <div
                      key={port.portNumber}
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
                            <div className="text-slate-500">
                              {port.connectedDeviceType}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">미연결</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

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
      </div>

      {/* 🧹 삭제 버튼 */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <button
          className="bg-red-500 text-white rounded w-full py-2 hover:bg-red-600 transition disabled:opacity-50"
          onClick={handleDeleteDevice}
          disabled={deleting}
        >
          🗑️ 이 장비 삭제하기
        </button>
      </div>
    </aside>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
