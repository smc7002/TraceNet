// 📁 src/pages/MainPage.tsx

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import { fetchCables } from "../api/cableApi";
import { pingAllDevices } from "../api/pingApi";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
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
import CustomNode from "../components/CustomNode";
import CustomEdge from "../utils/CustomEdge";
import { alignNodesToCalculatedCenters } from "../utils/nodeCenterCalculator";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

const ZOOM_HIDE_PC = 0.7; // 이 값보다 작으면 PC 숨김

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

  // Ping
  const [isPinging, setIsPinging] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);

  // Zoom
  const [currentZoomLevel, setCurrentZoomLevel] = useState(1.0);

  // 기타
  const [keyboardNavEnabled, setKeyboardNavEnabled] = useState(true);
  const traceTimestampRef = useRef<number>(0);
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);

  // zoom 변경 콜백
  const handleZoomChange = useCallback((zoomLevel: number) => {
    setCurrentZoomLevel(zoomLevel);
    if (window.location.hostname === "localhost") {
      console.log(`[ZOOM] ${zoomLevel.toFixed(2)} hidePC=${zoomLevel < ZOOM_HIDE_PC}`);
    }
  }, []);

  const resetSelections = useCallback(() => {
    setSelectedDevice(null);
    setSelectedCable(null);
    setTraceResult(null);
    setTraceError(null);
    // 트레이스는 비우지 말자(레이아웃 흔들림 방지). 필요시 사용자가 새 트레이스 클릭하면 교체됨.
    setLayoutedNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
  }, []);

  useEffect(() => {
    setRenderKey((prev) => prev + 1);
  }, [layoutMode]);

  useEffect(() => {
    if (!selectedDevice) {
      // 선택 해제 시 트레이스 유지(화면 안정성)
    }
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
      const q = searchQuery.toLowerCase();
      return (
        c.cableId.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.fromDevice.toLowerCase().includes(q) ||
        c.toDevice.toLowerCase().includes(q)
      );
    });
  }, [allCables, searchQuery]);

  // 모든 장비 → 노드
  const allNodes: Node[] = useMemo(() => {
    return devices.map((device) => ({
      id: `${device.deviceId}`,
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        label: device.name,
        type: device.type.toLowerCase(),
        status: device.status,
        showLabel: true,
        mode: layoutMode,
        highlighted:
          searchQuery.length > 0 &&
          (device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            device.ipAddress.includes(searchQuery)),
      },
    }));
  }, [devices, searchQuery, layoutMode]);

  // Zoom 기준 노드 필터링 (줌 아웃 시 PC 제거)
  const smartFilteredNodes = useMemo(() => {
    if (currentZoomLevel < ZOOM_HIDE_PC) {
      const filtered = allNodes.filter((n) => {
        const t = n.data?.type;
        return t === "server" || t === "switch" || t === "router";
      });
      if (window.location.hostname === "localhost") {
        console.log(`hide PC: ${allNodes.length} -> ${filtered.length}`);
      }
      return filtered;
    }
    return allNodes;
  }, [allNodes, currentZoomLevel]);

  // 전체 케이블 → 엣지 (베이스)
  const pureBaseEdges = useMemo(() => {
    const isRadial = layoutMode === LayoutMode.Radial;
    return mapCablesToEdges(allCables, isRadial);
  }, [allCables, layoutMode]);

  // 렌더용 엣지(PC 숨김 반영 + 트레이스 포함)
  const smartFilteredEdges = useMemo(() => {
    const nodeIds = new Set(smartFilteredNodes.map((n) => n.id));
    const filteredBase = pureBaseEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    const filteredTrace = traceEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    const finalBase = excludeTraceOverlaps(filteredBase, filteredTrace);
    return [
      ...finalBase,
      ...filteredTrace.map((e) => ({ ...e, id: `trace-${e.id}` })),
    ];
  }, [pureBaseEdges, traceEdges, smartFilteredNodes]);

  // ✅ 레이아웃은 "베이스 엣지"만 사용해서 흔들림 방지
  const baseEdgesForLayout = useMemo(() => {
    const ids = new Set(smartFilteredNodes.map((n) => n.id));
    return pureBaseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [pureBaseEdges, smartFilteredNodes]);

  // ✅ 레이아웃 고정 계산 (선택/트레이스/줌 상태 변화와 분리)
  const layoutResult = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const base =
      layoutMode === LayoutMode.Radial
        ? getNewRadialLayoutedElements(smartFilteredNodes, baseEdgesForLayout)
        : getDagreLayoutedElements(smartFilteredNodes, baseEdgesForLayout);

    const { nodes: alignedNodes } = alignNodesToCalculatedCenters(
      base.nodes,
      base.edges
    );

    return { nodes: alignedNodes, edges: base.edges as Edge[] };
  }, [layoutMode, smartFilteredNodes, baseEdgesForLayout]);

  // ✅ 선택만 반영 (좌표 고정)
  useEffect(() => {
    const nodesWithSelection: Node[] = layoutResult.nodes.map((node) => ({
      ...node,
      selected: selectedDevice?.deviceId.toString() === node.id,
    }));
    setLayoutedNodes(nodesWithSelection);
  }, [layoutResult, selectedDevice]);

  // 초기 데이터 로드
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
        const msg = err instanceof Error ? err.message : "알 수 없는 오류입니다.";
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

  // Ping All
  const handlePingAll = useCallback(async () => {
    if (isPinging) return;
    setIsPinging(true);
    setPingError(null);
    try {
      const pingResults = await pingAllDevices();
      setDevices((prev) =>
        prev.map((d) => {
          const pr = pingResults.find((p) => p.deviceId === d.deviceId);
          return pr
            ? {
                ...d,
                status: pr.status as Device["status"],
                lastCheckedAt: pr.checkedAt,
              }
            : d;
        })
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "전체 Ping 중 오류가 발생했습니다.";
      setPingError(message);
    } finally {
      setIsPinging(false);
    }
  }, [isPinging]);

  // 노드 클릭 → 트레이스 (기존 트레이스 즉시 비우지 않음)
  const handleDeviceClick = useCallback(async (device: Device) => {
    setSelectedDevice(device);
    setTraceResult(null);
    setTraceError(null);

    if (device.type.toLowerCase() === "server") {
      alert("🔒 서버는 트레이스 대상이 아닙니다.");
      return;
    }

    try {
      const result = await fetchTrace(device.deviceId);
      traceTimestampRef.current = Date.now();
      const trace = mapTraceCablesToEdges(result.cables, traceTimestampRef.current);
      setTraceEdges(trace);     // 새 결과가 왔을 때만 교체
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

  const handleRefresh = useCallback(() => {
    setPingError(null);
    window.location.reload();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

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
            [DeviceStatus.Online]: devices.filter((d) => d.status === DeviceStatus.Online).length,
            [DeviceStatus.Offline]: devices.filter((d) => d.status === DeviceStatus.Offline).length,
            [DeviceStatus.Unstable]: devices.filter((d) => d.status === DeviceStatus.Unstable).length,
          }}
          onPingAll={handlePingAll}
          isPinging={isPinging}
          keyboardNavEnabled={keyboardNavEnabled}
          onToggleKeyboardNav={() => setKeyboardNavEnabled((prev) => !prev)}
        />
      </div>

      {pingError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-6 mt-2">
          <div className="text-red-700 text-sm">
            <strong>Ping 오류:</strong> {pingError}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
          <NetworkDiagram
            key={renderKey}
            nodes={layoutedNodes}
            edges={smartFilteredEdges}      // 렌더는 트레이스 포함
            selectedDevice={selectedDevice}
            onDeviceClick={handleDeviceClick}
            onCanvasClick={resetSelections}
            devices={devices}
            onEdgeClick={handleEdgeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            keyboardNavigationEnabled={keyboardNavEnabled}
            isPinging={isPinging}
            viewMode="full"
            showOnlyProblems={showProblemOnly}
            zoomLevel={currentZoomLevel}
            onZoomChange={handleZoomChange}
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
