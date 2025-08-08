/* eslint-disable @typescript-eslint/no-explicit-any */
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

const ZOOM_HIDE_PC = 0.7; // PC 노드 숨김 임계값

const MainPage = () => {
  // 데이터 상태
  const [devices, setDevices] = useState<Device[]>([]);
  const [allCables, setAllCables] = useState<CableDto[]>([]);

  // 선택 상태
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedCable, setSelectedCable] = useState<CableDto | null>(null);

  // 트레이스 상태
  const [traceResult, setTraceResult] = useState<TraceResponse | null>(null);
  const [traceEdges, setTraceEdges] = useState<Edge[]>([]);
  const [traceError, setTraceError] = useState<string | null>(null);

  // UI 상태
  const [layoutMode] = useState<LayoutMode>(LayoutMode.Radial);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProblemOnly, setShowProblemOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renderKey, setRenderKey] = useState(0);

  // Ping 관련
  const [isPinging, setIsPinging] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);

  // 검색 에러 상태
  const [searchError, setSearchError] = useState<string | undefined>(undefined);

  // 줌 레벨
  const [currentZoomLevel, setCurrentZoomLevel] = useState(1.0);

  // 기타 설정
  const [keyboardNavEnabled, setKeyboardNavEnabled] = useState(true);
  const traceTimestampRef = useRef<number>(0);
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);

  const [traceFilterNodes, setTraceFilterNodes] = useState<Set<string> | null>(
    null
  );

  // 줌 레벨 변경 시 PC 노드 숨김 처리
  const handleZoomChange = useCallback((zoomLevel: number) => {
    setCurrentZoomLevel(zoomLevel);
    if (window.location.hostname === "localhost") {
      console.log(
        `[ZOOM] ${zoomLevel.toFixed(2)} hidePC=${zoomLevel < ZOOM_HIDE_PC}`
      );
    }
  }, []);

  // 모든 선택 및 트레이스 초기화
  const resetSelections = useCallback(() => {
    setSelectedDevice(null);
    setSelectedCable(null);
    setTraceResult(null);
    setTraceError(null);
    setTraceEdges([]); // 케이블 애니메이션 해제
    setLayoutedNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
  }, []);

  // 레이아웃 모드 변경 시 리렌더링
  useEffect(() => {
    setRenderKey((prev) => prev + 1);
  }, [layoutMode]);

  useEffect(() => {
    if (!selectedDevice) {
      // 선택 해제 시 트레이스 유지(화면 안정성)
    }
  }, [selectedDevice]);

  // 검색 및 문제 장비 필터링
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

  // 케이블 검색 필터링
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

  // 장비 데이터를 노드로 변환
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
        // 검색어 하이라이트
        highlighted:
          searchQuery.length > 0 &&
          (device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            device.ipAddress.includes(searchQuery)),
      },
    }));
  }, [devices, searchQuery, layoutMode]);

  // 레이아웃 계산용: 줌 기준 1차 필터(트레이스 필터 적용 X)
  const zoomFilteredNodes = useMemo(() => {
    if (currentZoomLevel < ZOOM_HIDE_PC) {
      const filtered = allNodes.filter((n) =>
        ["server", "switch", "router"].includes(n.data?.type)
      );
      if (window.location.hostname === "localhost") {
        console.log(`hide PC: ${allNodes.length} -> ${filtered.length}`);
      }
      return filtered;
    }
    return allNodes;
  }, [allNodes, currentZoomLevel]);

  // 검색 실행 함수
  const handleSearchSubmit = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) {
      // 입력이 비었으면 전체 복구
      setTraceFilterNodes(null);
      setTraceEdges([]);
      setTraceResult(null);
      setSearchError(undefined); // 🆕 에러 해제
      return;
    }

    // 정확 매칭 우선 (이름 대소문자 무시, 또는 IP 완전일치)
    const matched = devices.find(
      (d) => d.name.toLowerCase() === q.toLowerCase() || d.ipAddress === q
    );

    if (!matched) {
      // 🆕 존재하지 않음 → 에러 노출
      setTraceFilterNodes(null);
      setTraceEdges([]);
      setTraceResult(null);
      setSearchError(`'${q}' 장비를 찾을 수 없습니다.`);
      return;
    }

    try {
      const result = await fetchTrace(matched.deviceId);

      // 🆕 from/to 양쪽 다 모아 필터셋 구성 + 시작 장비 안전 포함
      const nodeIds = new Set<string>();
      if (Array.isArray(result.path)) {
        for (const hop of result.path) {
          const fromId = (hop.fromDeviceId ?? (hop as any).FromDeviceId) as
            | number
            | undefined;
          const toId = (hop.toDeviceId ?? (hop as any).ToDeviceId) as
            | number
            | undefined;
          if (fromId != null) nodeIds.add(String(fromId));
          if (toId != null) nodeIds.add(String(toId));
        }
      }
      if (Array.isArray(result.cables)) {
        for (const c of result.cables) {
          const fromId = (c.fromDeviceId ?? (c as any).FromDeviceId) as
            | number
            | undefined;
          const toId = (c.toDeviceId ?? (c as any).ToDeviceId) as
            | number
            | undefined;
          if (fromId != null) nodeIds.add(String(fromId));
          if (toId != null) nodeIds.add(String(toId));
        }
      }
      nodeIds.add(String(matched.deviceId)); // 시작 장비 강제 포함

      setTraceFilterNodes(nodeIds);
      setTraceEdges(mapTraceCablesToEdges(result.cables, Date.now()));
      setTraceResult(result);
      setSearchError(undefined); // 🆕 성공 시 에러 해제
    } catch (err) {
      console.error(err);
      setTraceFilterNodes(null);
      setTraceEdges([]);
      setTraceResult(null);
      setSearchError("Trace 정보를 불러오지 못했습니다.");
    }
  }, [searchQuery, devices]);

  // 케이블을 엣지로 변환 (베이스)
  const pureBaseEdges = useMemo(() => {
    const isRadial = layoutMode === LayoutMode.Radial;
    return mapCablesToEdges(allCables, isRadial);
  }, [allCables, layoutMode]);

  // 레이아웃 계산용 엣지 (트레이스 제외로 안정성 확보)
  const baseEdgesForLayout = useMemo(() => {
    const ids = new Set(zoomFilteredNodes.map((n) => n.id));
    return pureBaseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [pureBaseEdges, zoomFilteredNodes]);

  // 안정적인 레이아웃 계산 (트레이스 변경에 영향받지 않음)
  const layoutResult = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const base =
      layoutMode === LayoutMode.Radial
        ? getNewRadialLayoutedElements(zoomFilteredNodes, baseEdgesForLayout)
        : getDagreLayoutedElements(zoomFilteredNodes, baseEdgesForLayout);

    const { nodes: alignedNodes } = alignNodesToCalculatedCenters(
      base.nodes,
      base.edges
    );

    return { nodes: alignedNodes, edges: base.edges as Edge[] };
  }, [layoutMode, zoomFilteredNodes, baseEdgesForLayout]);

  // 선택 상태만 반영 (노드 위치는 고정)
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

  // ✅ 표시용 최종 노드: 레이아웃 좌표는 유지하고 trace 필터만 적용
  const finalNodes = useMemo(() => {
    if (!traceFilterNodes) return layoutedNodes;
    const idset = traceFilterNodes;
    return layoutedNodes.filter((n) => idset.has(n.id));
  }, [layoutedNodes, traceFilterNodes]);

  // 전체 장비 Ping 실행
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
        err instanceof Error
          ? err.message
          : "전체 Ping 중 오류가 발생했습니다.";
      setPingError(message);
    } finally {
      setIsPinging(false);
    }
  }, [isPinging]);

  // 렌더링용 엣지 (PC 숨김 + 트레이스 포함)
  const smartFilteredEdges = useMemo(() => {
    const nodeIds = new Set(finalNodes.map((n) => n.id));
    const baseFiltered = pureBaseEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    const traceFiltered = traceEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    return [
      ...excludeTraceOverlaps(baseFiltered, traceFiltered),
      ...traceFiltered.map((e) => ({ ...e, id: `trace-${e.id}` })),
    ];
  }, [pureBaseEdges, traceEdges, finalNodes]);

  // 노드 클릭 시 트레이스 실행
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
      const trace = mapTraceCablesToEdges(
        result.cables,
        traceTimestampRef.current
      );
      setTraceEdges(trace); // 새 트레이스로 교체
      setTraceResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "트레이스 로드 실패";
      setTraceError(msg);
    }
  }, []);

  // 엣지 클릭 시 케이블 선택
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

  // 페이지 새로고침
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
      {/* 상단 제어 패널 */}
      <div className="border-b border-slate-200 shrink-0">
        <ControlBar
          onRefresh={handleRefresh}
          onToggleProblemOnly={() => setShowProblemOnly((prev) => !prev)}
          showProblemOnly={showProblemOnly}
          searchQuery={searchQuery}
          onSearchChange={(v) => {
            setSearchQuery(v);
            setSearchError(undefined);
          }}
          onSearchSubmit={handleSearchSubmit}
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
          onPingAll={handlePingAll}
          isPinging={isPinging}
          keyboardNavEnabled={keyboardNavEnabled}
          onToggleKeyboardNav={() => setKeyboardNavEnabled((prev) => !prev)}
          searchError={searchError}
        />
      </div>

      {/* Ping 에러 알림 */}
      {pingError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-6 mt-2">
          <div className="text-red-700 text-sm">
            <strong>Ping 오류:</strong> {pingError}
          </div>
        </div>
      )}

      {/* 검색 에러 배너 */}
      {searchError && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 mx-6 mt-2">
          <div className="text-amber-800 text-sm">
            <strong>검색 오류:</strong> {searchError}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 메인 네트워크 다이어그램 */}
        <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
          <NetworkDiagram
            key={renderKey}
            nodes={finalNodes}
            edges={smartFilteredEdges} // 트레이스 포함된 최종 엣지
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
          {/* 빈 상태 메시지 */}
          {devices.length === 0 && (
            <div className="mt-6 text-white text-center text-sm bg-black/30 rounded p-2">
              ⚠️ 장비가 없습니다. JSON 파일을 업로드해주세요.
            </div>
          )}
        </div>

        {/* 우측 정보 패널 */}
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
