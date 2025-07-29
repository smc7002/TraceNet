// 📁 src/pages/MainPage.tsx

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import { fetchCables } from "../api/cableApi";
import { DeviceStatus } from "../types/status";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
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
import LayoutSwitcher from "../components/LayoutSwitcher";
import CustomNode from "../components/CustomNode";
import CustomEdge from "../utils/CustomEdge";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

export default function MainPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [allCables, setAllCables] = useState<CableDto[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [traceResult, setTraceResult] = useState<TraceResponse | null>(null);
  const [selectedCable, setSelectedCable] = useState<CableDto | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(LayoutMode.Dagre);
  const [traceEdges, setTraceEdges] = useState<Edge[]>([]);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProblemOnly, setShowProblemOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renderKey, setRenderKey] = useState(0);
  const traceTimestampRef = useRef<number>(0);

  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);
  const [layoutedEdges, setLayoutedEdges] = useState<Edge[]>([]);

  useEffect(() => {
    setRenderKey((prev) => prev + 1);
  }, [layoutMode]);

  useEffect(() => {
    if (!selectedDevice) setTraceEdges([]);
  }, [selectedDevice]);

  const filteredDevices = useMemo(() => {
    if (!Array.isArray(devices)) return [];
    return devices.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.ipAddress.includes(searchQuery);
      const matchStatus = showProblemOnly
        ? d.status === DeviceStatus.Offline ||
          d.status === DeviceStatus.Unstable
        : true;
      return matchSearch && matchStatus;
    });
  }, [devices, searchQuery, showProblemOnly]);

  const filteredCables = useMemo(
    () =>
      allCables.filter(
        (c) =>
          c.cableId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.fromDevice.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.toDevice.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [allCables, searchQuery]
  );

  const baseEdges = useMemo(() => {
    const isRadial = layoutMode === LayoutMode.Radial;
    const base = mapCablesToEdges(allCables, isRadial);
    return excludeTraceOverlaps(base, traceEdges);
  }, [allCables, traceEdges, layoutMode]);

  const allEdges = useMemo(() => {
    const combined = [...baseEdges, ...traceEdges];
    console.log("🧪 [All Edges Combined]", combined);
    return combined;
  }, [baseEdges, traceEdges]);

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
      },
    }));
  }, [filteredDevices]);

  useEffect(() => {
    const layouted =
      layoutMode === LayoutMode.Radial
        ? getNewRadialLayoutedElements(allNodes, allEdges)
        : getDagreLayoutedElements(allNodes, allEdges);

    setLayoutedNodes(layouted.nodes);
    setLayoutedEdges(layouted.edges);

    console.log("🧩 [Layout 결과 노드]", layouted.nodes);
    console.log("🧩 [Layout 결과 엣지]", layouted.edges);
  }, [layoutMode, allNodes, allEdges]);

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
        setSelectedDevice(null);
        setTraceResult(null);
        setTraceError(null);
        setTraceEdges([]);
      }
    },
    [allCables]
  );

  if (loading) return <LoadingSpinner />;
  if (error)
    return (
      <ErrorState message={error} onRetry={() => window.location.reload()} />
    );

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <div className="border-b border-slate-200 shrink-0">
        <ControlBar
          onRefresh={() => window.location.reload()}
          onToggleProblemOnly={() => setShowProblemOnly((prev) => !prev)}
          showProblemOnly={showProblemOnly}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusCounts={{
            [DeviceStatus.Online]: devices.filter((d) => d.status === DeviceStatus.Online).length,
            [DeviceStatus.Offline]: devices.filter((d) => d.status === DeviceStatus.Offline).length,
            [DeviceStatus.Unstable]: devices.filter((d) => d.status === DeviceStatus.Unstable).length,
          }}
        />
      </div>

      <LayoutSwitcher layoutMode={layoutMode} onChange={setLayoutMode} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
          <NetworkDiagram
            key={renderKey}
            nodes={layoutedNodes}
            edges={layoutedEdges}
            selectedDevice={selectedDevice}
            onDeviceClick={handleDeviceClick}
            onCanvasClick={() => {
              setSelectedDevice(null);
              setSelectedCable(null);
              setTraceResult(null);
              setTraceError(null);
              setTraceEdges([]);
            }}
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
          refetchDevices={async () => {
            const devices = await fetchDevices();
            setDevices(devices);
          }}
          refetchCables={async () => {
            const cables = await fetchCables();
            setAllCables(cables);
          }}
          setSelectedCable={setSelectedCable}
          filteredCables={filteredCables}
        />
      </div>
    </div>
  );
}
