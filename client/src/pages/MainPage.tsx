// 📁 src/pages/MainPage.tsx

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import { fetchCables } from "../api/cableApi";
import { pingAllDevices } from "../api/pingApi"; // 🆕 Ping API 추가
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
//import type { PingResultDto } from "../types/ping";
import { DeviceStatus } from "../types/status";
import {
  LayoutMode,
  getNewRadialLayoutedElements,
  getDagreLayoutedElements,
} from "../utils/layout";
import {
  mapCablesToEdges,
  mapTraceCablesToEdges,
  excludeTraceOverlaps,
} from "../utils/edgeMapper";
import type { Node, Edge } from "react-flow-renderer";

import NetworkDiagram from "../components/NetworkDiagram";
import SidePanel from "../components/SidePanel";
import ControlBar from "../components/ControlBar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
//import LayoutSwitcher from "../components/LayoutSwitcher";
import CustomNode from "../components/CustomNode";
import CustomEdge from "../utils/CustomEdge";
import { alignNodesToCalculatedCenters } from "../utils/nodeCenterCalculator";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

const MainPage = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [allCables, setAllCables] = useState<CableDto[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [traceResult, setTraceResult] = useState<TraceResponse | null>(null);
  const [selectedCable, setSelectedCable] = useState<CableDto | null>(null);
  const [layoutMode] = useState<LayoutMode>(LayoutMode.Radial);
  const [traceEdges, setTraceEdges] = useState<Edge[]>([]);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProblemOnly, setShowProblemOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renderKey, setRenderKey] = useState(0);
  
  // 🆕 Ping 관련 상태 추가
  const [isPinging, setIsPinging] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);
  
  const traceTimestampRef = useRef<number>(0);

  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);

  const resetSelections = useCallback(() => {
    setSelectedDevice(null);
    setSelectedCable(null);
    setTraceResult(null);
    setTraceError(null);
    setTraceEdges([]);
    setLayoutedNodes(prev => 
    prev.map(node => ({ ...node, selected: false }))
  );
  }, []);

  useEffect(() => {
    setRenderKey((prev) => prev + 1);
  }, [layoutMode]);

  useEffect(() => {
    if (!selectedDevice) setTraceEdges([]);
  }, [selectedDevice]);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.ipAddress.includes(searchQuery);
      const matchStatus = showProblemOnly
        ? d.status === "Offline" || d.status === "Unstable"
        : true;
      return matchSearch && matchStatus;
    });
  }, [devices, searchQuery, showProblemOnly]);

  const filteredCables = useMemo(() => {
    return allCables.filter((c) => {
      return (
        c.cableId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.fromDevice.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.toDevice.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [allCables, searchQuery]);

  const allNodes: Node[] = useMemo(() => {
    return filteredDevices.map((device) => ({
      id: `${device.deviceId}`,
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        label: device.name,
        type: device.type.toLowerCase(),
        status: device.status,
        showLabel: true,
        mode: layoutMode,
      },
    }));
  }, [filteredDevices, layoutMode]);

  const pureBaseEdges = useMemo(() => {
    const isRadial = layoutMode === LayoutMode.Radial;
    return mapCablesToEdges(allCables, isRadial);
  }, [allCables, layoutMode]);

  const renderEdges = useMemo(() => {
    const filteredBase = excludeTraceOverlaps(pureBaseEdges, traceEdges);
    return [
      ...filteredBase,
      ...traceEdges.map((edge) => ({
        ...edge,
        id: `trace-${edge.id}`,
      })),
    ];
  }, [pureBaseEdges, traceEdges]);

  useEffect(() => {
    const layout =
      layoutMode === LayoutMode.Radial
        ? getNewRadialLayoutedElements(allNodes, pureBaseEdges)
        : getDagreLayoutedElements(allNodes, pureBaseEdges);

    const final = alignNodesToCalculatedCenters(layout.nodes, layout.edges);

    // ✅ 각 노드에 selected 상태 명시적으로 설정
    const nodesWithSelection = final.nodes.map((node) => ({
      ...node,
      selected: selectedDevice?.deviceId.toString() === node.id, // 🎯 핵심 수정
    }));

    setLayoutedNodes(nodesWithSelection);
  }, [layoutMode, allNodes, pureBaseEdges, selectedDevice]); // 🎯 selectedDevice 의존성 추가

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [deviceData, cableData] = await Promise.all([
          fetchDevices(),
          fetchCables(),
        ]);
        if (isMounted) {
          setDevices(deviceData);
          setAllCables(cableData);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "알 수 없는 오류입니다.";
        if (isMounted) setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // 🆕 전체 Ping 실행 함수
  const handlePingAll = useCallback(async () => {
    if (isPinging) return; // 중복 실행 방지
    
    setIsPinging(true);
    setPingError(null);
    
    try {
      console.log("🚀 전체 Ping 시작...");
      const pingResults = await pingAllDevices();
      
      // 🎯 기존 devices 상태를 Ping 결과로 업데이트
      setDevices(prevDevices => {
        return prevDevices.map(device => {
          const pingResult = pingResults.find(p => p.deviceId === device.deviceId);
          if (pingResult) {
            return {
              ...device,
              status: pingResult.status as Device['status'], // 타입 안전성 확보
              lastCheckedAt: pingResult.checkedAt,
            };
          }
          return device;
        });
      });
      
      // 성공 메시지 표시 (선택적)
      const online = pingResults.filter(r => r.status === "Online").length;
      const total = pingResults.length;
      console.log(`✅ 전체 Ping 완료: ${online}/${total}개 온라인`);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : "전체 Ping 중 오류가 발생했습니다.";
      setPingError(message);
      console.error("❌ 전체 Ping 실패:", err);
    } finally {
      setIsPinging(false);
    }
  }, [isPinging]);

  const handleDeviceClick = useCallback(async (device: Device) => {
    setSelectedDevice(device);
    setTraceResult(null);
    setTraceError(null);
    setTraceEdges([]);

    if (device.type.toLowerCase() === "server") {
      alert("🔒 서버는 트레이스 대상이 아닙니다.");
      return;
    }

    try {
      const result = await fetchTrace(device.deviceId);
      traceTimestampRef.current = Date.now();
      const trace = mapTraceCablesToEdges(
        result.cables,
        traceTimestampRef.current
      );
      setTraceEdges(trace);
      setTraceResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "트레이스 로드 실패";
      setTraceError(msg);
    }
  }, []);

  const handleEdgeClick = useCallback(
    (_: unknown, edge: Edge) => {
      const cableId = edge.id.replace("cable-", "");
      const found = allCables.find((c) => c.cableId === cableId);
      if (found) {
        setSelectedCable(found);
        resetSelections();
      }
    },
    [allCables, resetSelections]
  );

  // 🆕 새로고침 함수 (Ping 에러도 초기화)
  const handleRefresh = useCallback(() => {
    setPingError(null);
    window.location.reload();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error)
    return (
      <ErrorState message={error} onRetry={() => window.location.reload()} />
    );

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <div className="border-b border-slate-200 shrink-0">
        <ControlBar
          onRefresh={handleRefresh}
          onToggleProblemOnly={() => setShowProblemOnly((prev) => !prev)}
          showProblemOnly={showProblemOnly}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusCounts={{
            [DeviceStatus.Online]: devices.filter(
              (d) => d.status === DeviceStatus.Online
            ).length,
            [DeviceStatus.Offline]: devices.filter(
              (d) => d.status === DeviceStatus.Offline
            ).length,
            [DeviceStatus.Unstable]: devices.filter(
              (d) => d.status === DeviceStatus.Unstable
            ).length,
          }}
          // 🆕 Ping 관련 props 추가
          onPingAll={handlePingAll}
          isPinging={isPinging}
        />
      </div>

      {/* 🆕 Ping 에러 표시 */}
      {pingError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-6 mt-2">
          <div className="text-red-700 text-sm">
            <strong>Ping 오류:</strong> {pingError}
          </div>
        </div>
      )}

      {/* <LayoutSwitcher layoutMode={layoutMode} onChange={setLayoutMode} /> */}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
          <NetworkDiagram
            key={renderKey}
            nodes={layoutedNodes}
            edges={renderEdges}
            selectedDevice={selectedDevice}
            onDeviceClick={handleDeviceClick}
            onCanvasClick={resetSelections}
            devices={filteredDevices}
            onEdgeClick={handleEdgeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
          />
          {devices.length === 0 && (
            <div className="mt-6 text-white text-center text-sm bg-black/30 rounded p-2">
              ⚠️ 장비가 없습니다. JSON 파일을 업로드해주세요.
            </div>
          )}
        </div>

        <SidePanel
          selectedDevice={selectedDevice}
          selectedCable={selectedCable}
          traceResult={traceResult}
          traceError={traceError}
          setSelectedDevice={setSelectedDevice}
          setSelectedCable={setSelectedCable}
          filteredCables={filteredCables}
          refetchDevices={async () => setDevices(await fetchDevices())}
          refetchCables={async () => setAllCables(await fetchCables())}
          devices={devices}
        />
      </div>
    </div>
  );
};

export default MainPage;