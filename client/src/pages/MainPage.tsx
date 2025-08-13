/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/MainPage.tsx – stabilized layout & search visibility

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
  CABLE_EDGE_PREFIX,
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

// Component config
const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };
const ZOOM_HIDE_PC = 0.7;

interface AppState {
  devices: Device[];
  cables: CableDto[];

  selectedDevice: Device | null;
  selectedCable: CableDto | null;

  traceResult: TraceResponse | null;
  traceEdges: Edge[];
  traceError: string | null;
  traceFilterNodes: Set<string> | null;

  layoutMode: LayoutMode;
  searchQuery: string;
  showProblemOnly: boolean;
  loading: boolean;
  error: string;
  renderKey: number;

  isPinging: boolean;
  pingError: string | null;
  searchError: string | undefined;
  currentZoomLevel: number;
  keyboardNavEnabled: boolean;
  layoutedNodes: Node[];
}

const initialState: AppState = {
  devices: [],
  cables: [],
  selectedDevice: null,
  selectedCable: null,
  traceResult: null,
  traceEdges: [],
  traceError: null,
  traceFilterNodes: null,
  layoutMode: LayoutMode.Radial,
  searchQuery: "",
  showProblemOnly: false,
  loading: true,
  error: "",
  renderKey: 0,
  isPinging: false,
  pingError: null,
  searchError: undefined,
  currentZoomLevel: 1.0,
  keyboardNavEnabled: true,
  layoutedNodes: [],
};

const MainPage = () => {
  const [state, setState] = useState<AppState>(initialState);
  const traceTimestampRef = useRef<number>(0);

  const updateState = useCallback(<K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);
  const updateMultipleStates = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // ────────────────── Search & Trace ──────────────────
  const executeDeviceSearch = useCallback(
    async (query: string, devices: Device[]) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        updateMultipleStates({
          traceFilterNodes: null,
          traceEdges: [],
          traceResult: null,
          searchError: undefined,
        });
        return;
      }

      const matchedDevice = devices.find(
        (d) =>
          d.name.toLowerCase() === trimmedQuery.toLowerCase() ||
          d.ipAddress === trimmedQuery
      );

      if (!matchedDevice) {
        updateMultipleStates({
          traceFilterNodes: null,
          traceEdges: [],
          traceResult: null,
          searchError: `'${trimmedQuery}' 장비를 찾을 수 없습니다.`,
        });
        return;
      }

      try {
        const result = await fetchTrace(matchedDevice.deviceId);

        // collect nodes on path
        const nodeIds = new Set<string>();
        if (Array.isArray(result.path)) {
          for (const hop of result.path) {
            const fromId = (hop as any).fromDeviceId ?? (hop as any).FromDeviceId;
            const toId = (hop as any).toDeviceId ?? (hop as any).ToDeviceId;
            if (fromId != null) nodeIds.add(String(fromId));
            if (toId != null) nodeIds.add(String(toId));
          }
        }
        if (Array.isArray(result.cables)) {
          for (const cable of result.cables) {
            const fromId = (cable as any).fromDeviceId ?? (cable as any).FromDeviceId;
            const toId = (cable as any).toDeviceId ?? (cable as any).ToDeviceId;
            if (fromId != null) nodeIds.add(String(fromId));
            if (toId != null) nodeIds.add(String(toId));
          }
        }
        nodeIds.add(String(matchedDevice.deviceId));

        updateMultipleStates({
          traceFilterNodes: nodeIds,
          traceEdges: mapTraceCablesToEdges(result.cables, Date.now()),
          traceResult: result,
          searchError: undefined,
        });
      } catch (err) {
        console.error("트레이스 실행 실패:", err);
        updateMultipleStates({
          traceFilterNodes: null,
          traceEdges: [],
          traceResult: null,
          searchError: "Trace 정보를 불러오지 못했습니다.",
        });
      }
    },
    [updateMultipleStates]
  );

  const resetAllSelections = useCallback(() => {
    updateMultipleStates({
      selectedDevice: null,
      selectedCable: null,
      traceResult: null,
      traceError: null,
      traceEdges: [],
      layoutedNodes: state.layoutedNodes.map((n) => ({ ...n, selected: false })),
    });
  }, [state.layoutedNodes, updateMultipleStates]);

  // ────────────────── Aggregations ──────────────────
  const deviceStatusCounts = useMemo(
    () => ({
      [DeviceStatus.Online]: state.devices.filter((d) => d.status === DeviceStatus.Online).length,
      [DeviceStatus.Offline]: state.devices.filter((d) => d.status === DeviceStatus.Offline).length,
      [DeviceStatus.Unstable]: state.devices.filter((d) => d.status === DeviceStatus.Unstable).length,
    }),
    [state.devices]
  );

  // ────────────────── Filters (for side panel) ──────────────────
  const filteredCables = useMemo(() => {
    const query = state.searchQuery.toLowerCase();
    return state.cables.filter(
      (cable) =>
        cable.cableId.toLowerCase().includes(query) ||
        cable.description?.toLowerCase().includes(query) ||
        cable.fromDevice.toLowerCase().includes(query) ||
        cable.toDevice.toLowerCase().includes(query)
    );
  }, [state.cables, state.searchQuery]);

  // ────────────────── Nodes & Edges (React Flow) ──────────────────

  /** Build ALL nodes (no filtering here!) – filtering is applied only at the final render step */
  const allNodes: Node[] = useMemo(() => {
    return state.devices.map((device) => ({
      id: `${device.deviceId}`,
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        label: device.name,
        type: device.type?.toLowerCase() ?? "pc",
        status: device.status,
        showLabel: true,
        mode: state.layoutMode,
        // search only affects highlighting, not layout membership
        highlighted:
          !!state.searchQuery &&
          (device.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            device.ipAddress.includes(state.searchQuery)),
      },
    }));
  }, [state.devices, state.searchQuery, state.layoutMode]);

  /** Zoom-based PC hiding; during trace focus show all */
  const zoomFilteredNodes = useMemo(() => {
    if (state.traceFilterNodes) return allNodes;
    if (state.currentZoomLevel < ZOOM_HIDE_PC) {
      const filtered = allNodes.filter((n) =>
        ["server", "switch", "router"].includes(n.data?.type)
      );
      if (window.location.hostname === "localhost") {
        console.log(`PC 노드 숨김: ${allNodes.length} -> ${filtered.length}`);
      }
      return filtered;
    }
    return allNodes;
  }, [allNodes, state.currentZoomLevel, state.traceFilterNodes]);

  const baseEdges = useMemo(() => {
    const isRadial = state.layoutMode === LayoutMode.Radial;
    return mapCablesToEdges(state.cables, isRadial);
  }, [state.cables, state.layoutMode]);

  /** Only edges connecting currently visible nodes */
  const layoutEdges = useMemo(() => {
    const nodeIds = new Set(zoomFilteredNodes.map((n) => n.id));
    return baseEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [baseEdges, zoomFilteredNodes]);

  /** Layout + secondary alignment */
  const layoutResult = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const calculated =
      state.layoutMode === LayoutMode.Radial
        ? getNewRadialLayoutedElements(zoomFilteredNodes, layoutEdges)
        : getDagreLayoutedElements(zoomFilteredNodes, layoutEdges);

    const { nodes: alignedNodes } = alignNodesToCalculatedCenters(
      calculated.nodes,
      calculated.edges
    );

    return { nodes: alignedNodes, edges: calculated.edges as Edge[] };
  }, [state.layoutMode, zoomFilteredNodes, layoutEdges]);

  /** Search visibility: matched nodes + their cable neighbors (keeps structure) */
  const searchVisibleSet = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matched = new Set(
      state.devices
        .filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.ipAddress.includes(state.searchQuery)
        )
        .map((d) => String(d.deviceId))
    );

    // also include neighbors via cables
    state.cables.forEach((c) => {
      const a = String(c.fromDeviceId);
      const b = String(c.toDeviceId);
      if (matched.has(a)) matched.add(b);
      if (matched.has(b)) matched.add(a);
    });

    return matched;
  }, [state.searchQuery, state.devices, state.cables]);

  /** Final nodes (apply trace filter and search visibility only here) */
  const finalNodes = useMemo(() => {
    let nodes = state.layoutedNodes;
    if (state.traceFilterNodes) {
      nodes = nodes.filter((n) => state.traceFilterNodes!.has(n.id));
    }
    if (searchVisibleSet) {
      nodes = nodes.filter((n) => searchVisibleSet.has(n.id));
    }
    return nodes;
  }, [state.layoutedNodes, state.traceFilterNodes, searchVisibleSet]);

  /** Final edges aligned to final nodes; add trace edges after overlap removal */
  const finalEdges = useMemo(() => {
    const nodeIds = new Set(finalNodes.map((n) => n.id));
    const baseFiltered = baseEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    const traceFiltered = state.traceEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    return [
      ...excludeTraceOverlaps(baseFiltered, traceFiltered),
      ...traceFiltered.map((e) => ({ ...e, id: `trace-${e.id}` })),
    ];
  }, [baseEdges, state.traceEdges, finalNodes]);

  // ────────────────── Handlers ──────────────────

  const handleZoomChange = useCallback(
    (zoomLevel: number) => {
      updateState("currentZoomLevel", zoomLevel);
      if (window.location.hostname === "localhost") {
        console.log(`[ZOOM] ${zoomLevel.toFixed(2)} hidePC=${zoomLevel < ZOOM_HIDE_PC}`);
      }
    },
    [updateState]
  );

  const handleSearchSubmit = useCallback(async () => {
    await executeDeviceSearch(state.searchQuery, state.devices);
  }, [state.searchQuery, state.devices, executeDeviceSearch]);

  const handleDeviceClick = useCallback(
    async (device: Device) => {
      updateState("selectedDevice", device);
      updateMultipleStates({
        selectedCable: null,
        traceResult: null,
        traceError: null,
      });

      if (device.type?.toLowerCase() === "server") {
        updateState("searchError", "서버는 트레이스 대상이 아닙니다.");
        return;
      }

      try {
        const result = await fetchTrace(device.deviceId);
        traceTimestampRef.current = Date.now();
        const traceEdges = mapTraceCablesToEdges(result.cables, traceTimestampRef.current);

        updateMultipleStates({
          traceEdges,
          traceResult: result,
          searchError: undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "트레이스 로드 실패";
        updateState("traceError", message);
      }
    },
    [updateState, updateMultipleStates]
  );

  const handleEdgeClick = useCallback(
    (_: unknown, edge: Edge) => {
      const id = edge.id;
      // Only cable edges open cable detail
      const isCable = id.startsWith(CABLE_EDGE_PREFIX);
      if (!isCable) return;

      const cableId = id.slice(CABLE_EDGE_PREFIX.length);
      const foundCable = state.cables.find((c) => c.cableId === cableId);
      if (foundCable) {
        updateMultipleStates({
          selectedCable: foundCable,
          selectedDevice: null,
          // keep cable selection; clear trace visuals
          traceResult: null,
          traceError: null,
          traceEdges: [],
        });
      }
    },
    [state.cables, updateMultipleStates]
  );

  const handlePingAll = useCallback(async () => {
    if (state.isPinging) return;

    updateMultipleStates({ isPinging: true, pingError: null });

    try {
      const pingResults = await pingAllDevices();
      const updatedDevices = state.devices.map((device) => {
        const pingResult = pingResults.find((p) => p.deviceId === device.deviceId);
        return pingResult
          ? {
              ...device,
              status: pingResult.status as Device["status"],
              lastCheckedAt: pingResult.checkedAt,
            }
          : device;
      });
      updateState("devices", updatedDevices);

      // keep selection highlight consistent after ping
      updateState(
        "layoutedNodes",
        state.layoutedNodes.map((n) => ({
          ...n,
          selected: state.selectedDevice?.deviceId.toString() === n.id,
        }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "전체 Ping 중 오류가 발생했습니다.";
      updateState("pingError", message);
    } finally {
      updateState("isPinging", false);
    }
  }, [state.isPinging, state.devices, state.layoutedNodes, state.selectedDevice, updateState, updateMultipleStates]);

  const handleRefresh = useCallback(() => {
    updateState("pingError", null);
    window.location.reload();
  }, [updateState]);

  // ────────────────── Effects ──────────────────

  useEffect(() => {
    const nodesWithSelection: Node[] = layoutResult.nodes.map((node) => ({
      ...node,
      selected: state.selectedDevice?.deviceId.toString() === node.id,
    }));
    updateState("layoutedNodes", nodesWithSelection);
  }, [layoutResult, state.selectedDevice, updateState]);

  useEffect(() => {
    setState((prev) => ({ ...prev, renderKey: prev.renderKey + 1 }));
  }, [state.layoutMode]);

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      try {
        const [deviceData, cableData] = await Promise.all([fetchDevices(), fetchCables()]);
        if (isMounted) {
          updateMultipleStates({
            devices: deviceData,
            cables: cableData,
            loading: false,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "알 수 없는 오류입니다.";
        if (isMounted) {
          updateMultipleStates({ error: message, loading: false });
        }
      }
    };
    loadInitialData();
    return () => { isMounted = false; };
  }, [updateMultipleStates]);

  // ────────────────── Render ──────────────────
  if (state.loading) return <LoadingSpinner />;
  if (state.error) return <ErrorState message={state.error} onRetry={() => window.location.reload()} />;

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Top control bar */}
      <div className="border-b border-slate-200 shrink-0">
        <ControlBar
          onRefresh={handleRefresh}
          onToggleProblemOnly={() => updateState("showProblemOnly", !state.showProblemOnly)}
          showProblemOnly={state.showProblemOnly}
          searchQuery={state.searchQuery}
          onSearchChange={(value) =>
            updateMultipleStates({ searchQuery: value, searchError: undefined })
          }
          onSearchSubmit={handleSearchSubmit}
          statusCounts={deviceStatusCounts}
          onPingAll={handlePingAll}
          isPinging={state.isPinging}
          keyboardNavEnabled={state.keyboardNavEnabled}
          onToggleKeyboardNav={() =>
            updateState("keyboardNavEnabled", !state.keyboardNavEnabled)
          }
          searchError={state.searchError}
        />
      </div>

      {/* Ping error banner */}
      {state.pingError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-6 mt-2">
          <div className="text-red-700 text-sm">
            <strong>Ping 오류:</strong> {state.pingError}
          </div>
        </div>
      )}

      {/* Info / search banner */}
      {state.searchError && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 mx-6 mt-2">
          <div className="text-amber-800 text-sm">
            <strong>알림:</strong> {state.searchError}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Diagram */}
        <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
          <NetworkDiagram
            key={state.renderKey}
            nodes={finalNodes}
            edges={finalEdges}
            selectedDevice={state.selectedDevice}
            onDeviceClick={handleDeviceClick}
            onCanvasClick={resetAllSelections}
            devices={state.devices}
            onEdgeClick={handleEdgeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            keyboardNavigationEnabled={state.keyboardNavEnabled}
            isPinging={state.isPinging}
            viewMode="full"
            showOnlyProblems={state.showProblemOnly}
            zoomLevel={state.currentZoomLevel}
            onZoomChange={handleZoomChange}
          />

          {/* Empty state */}
          {state.devices.length === 0 && (
            <div className="mt-6 text-white text-center text-sm bg-black/30 rounded p-2">
              ⚠️ 장비가 없습니다. JSON 파일을 업로드해주세요.
            </div>
          )}
        </div>

        {/* Right side panel */}
        <SidePanel
          selectedDevice={state.selectedDevice}
          selectedCable={state.selectedCable}
          traceResult={state.traceResult}
          traceError={state.traceError}
          setSelectedDevice={(device) => updateState("selectedDevice", device)}
          setSelectedCable={(cable) => updateState("selectedCable", cable)}
          filteredCables={filteredCables}
          refetchDevices={async () => updateState("devices", await fetchDevices())}
          refetchCables={async () => updateState("cables", await fetchCables())}
          devices={state.devices}
        />
      </div>
    </div>
  );
};

export default MainPage;
