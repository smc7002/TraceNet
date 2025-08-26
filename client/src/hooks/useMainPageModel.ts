// src/hooks/useMainPageModel.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import { fetchCables } from "../api/cableApi";
import { pingAllDevices } from "../api/pingApi";
import { updateDeviceStatusBulk } from "../api/deviceApi";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
import { DeviceStatus } from "../types/status";
import {
  mapCablesToEdges,
  mapTraceCablesToEdges,
  excludeTraceOverlaps,
  CABLE_EDGE_PREFIX,
} from "../utils/edgeMapper";
import {
  LayoutMode,
  getNewRadialLayoutedElements,
} from "../utils/layout";
import type { Node, Edge } from "react-flow-renderer";
import { alignNodesToCalculatedCenters } from "../utils/nodeCenterCalculator";
import { useFps } from "../hooks/useFps";

type ViewportInfo = {
  x: number; y: number; zoom: number;
  width: number; height: number;
  centerX: number; centerY: number;
};

const SMART_PC_RADIUS = 900;
const ZOOM_HIDE_PC = 0.7;
const SMART_PC_ZOOM = ZOOM_HIDE_PC;

export function useProblemDeviceIdSet(show: boolean, devices: Device[]) {
  return useMemo<Set<string> | null>(() => {
    if (!show) return null;
    const set = new Set<string>();
    for (const d of devices) if (d.status !== DeviceStatus.Online) set.add(String(d.deviceId));
    return set;
  }, [show, devices]);
}

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
  viewport: ViewportInfo | null;
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
  viewport: null,
};

export function useMainPageModel() {
  const [state, setState] = useState<AppState>(initialState);
  const updateState = useCallback(<K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);
  const updateMultipleStates = useCallback((updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);
  const traceTimestampRef = useRef<number>(0);

  const showDebug =
    typeof window !== "undefined" &&
    (import.meta.env.DEV || window.location.hostname === "localhost");
  const fps = useFps({ sampleMs: 500, smooth: 0.25, enabled: showDebug });

  // 검색 + 자동 Trace
  const executeDeviceSearch = useCallback(async (query: string, devices: Device[]) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) { // clear
      updateMultipleStates({ traceFilterNodes: null, traceEdges: [], traceResult: null, searchError: undefined });
      return;
    }
    const matchedDevice = devices.find(
      d => d.name.toLowerCase() === trimmedQuery.toLowerCase() || d.ipAddress?.trim() === trimmedQuery
    );
    if (!matchedDevice) {
      updateMultipleStates({ traceFilterNodes: null, traceEdges: [], traceResult: null,
        searchError: `'${trimmedQuery}' 장비를 찾을 수 없습니다.` });
      return;
    }
    try {
      const callId = Date.now();
      traceTimestampRef.current = callId;
      const result = await fetchTrace(matchedDevice.deviceId);
      if (traceTimestampRef.current !== callId) return;

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
        traceEdges: mapTraceCablesToEdges(result.cables ?? [], Date.now()),
        traceResult: result,
        searchError: undefined,
      });
    } catch {
      updateMultipleStates({
        traceFilterNodes: null, traceEdges: [], traceResult: null,
        searchError: "Trace 정보를 불러오지 못했습니다.",
      });
    }
  }, [updateMultipleStates]);

  // 선택 초기화
  const resetAllSelections = useCallback(() => {
    updateMultipleStates({ selectedDevice: null, selectedCable: null, traceResult: null, traceError: null, traceEdges: [] });
    setState(prev => ({ ...prev, layoutedNodes: prev.layoutedNodes.map(n => ({ ...n, selected: false })) }));
  }, [updateMultipleStates]);

  // 상단 카운트
  const deviceStatusCounts = useMemo(() => ({
    [DeviceStatus.Online]: state.devices.filter(d => d.status === DeviceStatus.Online).length,
    [DeviceStatus.Offline]: state.devices.filter(d => d.status === DeviceStatus.Offline).length,
    [DeviceStatus.Unstable]: state.devices.filter(d => d.status === DeviceStatus.Unstable).length,
  }), [state.devices]);

  const problemCount = useMemo(
    () => state.devices.filter(d => d.status !== DeviceStatus.Online).length,
    [state.devices]
  );

  // 전체 상태 일괄 변경
  const handleBulkSetStatus = useCallback(async (status: DeviceStatus, enablePing?: boolean) => {
    const ids = state.devices.map(d => d.deviceId);
    if (ids.length === 0) { alert("변경할 장비가 없습니다."); return; }
    const human = `${status}` + (enablePing !== undefined ? `, Ping ${enablePing ? "ON" : "OFF"}` : "");
    if (!confirm(`전체 ${ids.length}대 장비를 "${human}" 으로 변경할까요?`)) return;

    updateMultipleStates({ isPinging: true, pingError: null });
    try {
      await updateDeviceStatusBulk({ deviceIds: ids, status, enablePing });
      const now = new Date().toISOString();
      const newDevices = state.devices.map(d => ({
        ...d, status, enablePing: enablePing ?? d.enablePing, lastCheckedAt: now, latencyMs: null,
      }));
      updateState("devices", newDevices);
    } catch (err) {
      const message = err instanceof Error ? err.message : "일괄 상태 변경 중 오류가 발생했습니다.";
      alert(message);
      updateState("pingError", message);
    } finally { updateState("isPinging", false); }
  }, [state.devices, updateMultipleStates, updateState]);

  // 사이드패널 케이블 필터
  const filteredCables = useMemo(() => {
    const q = state.searchQuery.toLowerCase();
    return state.cables.filter(c => {
      const id = String(c.cableId).toLowerCase();
      const desc = c.description?.toLowerCase() ?? "";
      const from = c.fromDevice.toLowerCase();
      const to = c.toDevice.toLowerCase();
      return id.includes(q) || desc.includes(q) || from.includes(q) || to.includes(q);
    });
  }, [state.cables, state.searchQuery]);

  // 스위치-피씨 맵
  const switchPcMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const typeById = new Map<string, string>();
    for (const d of state.devices) typeById.set(String(d.deviceId), (d.type ?? "pc").toLowerCase());
    for (const c of state.cables) {
      const a = String(c.fromDeviceId), b = String(c.toDeviceId);
      const ta = typeById.get(a), tb = typeById.get(b);
      if (ta === "switch" && tb === "pc") { if (!map.has(a)) map.set(a, new Set()); map.get(a)!.add(b); }
      else if (ta === "pc" && tb === "switch") { if (!map.has(b)) map.set(b, new Set()); map.get(b)!.add(a); }
    }
    return map;
  }, [state.devices, state.cables]);

  // 모든 노드
  const allNodes: Node[] = useMemo(() => state.devices.map(device => ({
    id: `${device.deviceId}`,
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      label: device.name,
      type: device.type?.toLowerCase() ?? "pc",
      status: device.status,
      showLabel: true,
      mode: "radial",
      highlighted:
        !!state.searchQuery &&
        (device.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
         device.ipAddress?.includes(state.searchQuery)),
    },
  })), [state.devices, state.searchQuery]);

  // 줌 기반 PC 숨김
  const zoomFilteredNodes = useMemo(() => {
    if (state.traceFilterNodes || state.showProblemOnly) return allNodes;
    if (state.currentZoomLevel < ZOOM_HIDE_PC) {
      const filtered = allNodes.filter(n => ["server", "switch", "router"].includes(n.data?.type));
      if (window.location.hostname === "localhost") {
        console.log(`PC 노드 숨김: ${allNodes.length} -> ${filtered.length}`);
      }
      return filtered;
    }
    return allNodes;
  }, [allNodes, state.currentZoomLevel, state.traceFilterNodes, state.showProblemOnly]);

  const baseEdges = useMemo(() => mapCablesToEdges(state.cables, true), [state.cables]);

  const layoutEdges = useMemo(() => {
    const nodeIds = new Set(zoomFilteredNodes.map(n => n.id));
    return baseEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [baseEdges, zoomFilteredNodes]);

  const layoutResult = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const calculated = getNewRadialLayoutedElements(zoomFilteredNodes, layoutEdges);
    const { nodes: alignedNodes } = alignNodesToCalculatedCenters(calculated.nodes, calculated.edges);
    return { nodes: alignedNodes, edges: calculated.edges as Edge[] };
  }, [zoomFilteredNodes, layoutEdges]);

  const searchVisibleSet = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matched = new Set(
      state.devices
        .filter(d => d.name.toLowerCase().includes(q) || d.ipAddress?.includes(q))
        .map(d => String(d.deviceId))
    );
    state.cables.forEach(c => {
      const a = String(c.fromDeviceId), b = String(c.toDeviceId);
      if (matched.has(a)) matched.add(b);
      if (matched.has(b)) matched.add(a);
    });
    return matched;
  }, [state.searchQuery, state.devices, state.cables]);

  const problemVisibleSet = useProblemDeviceIdSet(state.showProblemOnly, state.devices);

  const finalNodes = useMemo(() => {
    let nodes = state.layoutedNodes;
    if (problemVisibleSet) nodes = nodes.filter(n => problemVisibleSet.has(n.id));
    if (state.traceFilterNodes) nodes = nodes.filter(n => state.traceFilterNodes!.has(n.id));
    if (searchVisibleSet) nodes = nodes.filter(n => searchVisibleSet.has(n.id));

    const canSmartReveal =
      !!state.viewport &&
      Number.isFinite(state.viewport.centerX) &&
      Number.isFinite(state.viewport.centerY) &&
      state.currentZoomLevel >= SMART_PC_ZOOM &&
      !state.traceFilterNodes &&
      !state.showProblemOnly &&
      state.searchQuery.trim() === "";

    if (canSmartReveal) {
      const { centerX, centerY } = state.viewport!;
      let nearestSwitch: Node | null = null;
      let bestD2 = Number.POSITIVE_INFINITY;
      for (const n of state.layoutedNodes) {
        if (n.data?.type !== "switch") continue;
        const dx = (n.position?.x ?? 0) - centerX;
        const dy = (n.position?.y ?? 0) - centerY;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; nearestSwitch = n; }
      }
      const radius2 = SMART_PC_RADIUS * SMART_PC_RADIUS;
      if (nearestSwitch && bestD2 <= radius2) {
        const allowedPcs = switchPcMap.get(nearestSwitch.id) ?? new Set<string>();
        nodes = nodes.filter(n => n.data?.type !== "pc" ? true : allowedPcs.has(n.id));
      } else {
        nodes = nodes.filter(n => n.data?.type !== "pc");
      }
    }
    return nodes;
  }, [
    state.layoutedNodes,
    problemVisibleSet,
    state.traceFilterNodes,
    searchVisibleSet,
    state.viewport,
    state.currentZoomLevel,
    state.showProblemOnly,
    state.searchQuery,
    switchPcMap,
  ]);

  const finalEdges = useMemo(() => {
    const nodeIds = new Set(finalNodes.map(n => n.id));
    const baseFiltered = baseEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    const traceFiltered = state.traceEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    return [
      ...excludeTraceOverlaps(baseFiltered, traceFiltered),
      ...traceFiltered.map(e => ({ ...e, id: `trace-${e.id}` })),
    ];
  }, [baseEdges, state.traceEdges, finalNodes]);

  // zoom/viewport
  const handleZoomChange = useCallback((zoomLevel: number) => {
    updateState("currentZoomLevel", zoomLevel);
    if (window.location.hostname === "localhost") {
      console.log(`[ZOOM] ${zoomLevel.toFixed(2)} hidePC=${zoomLevel < ZOOM_HIDE_PC}`);
    }
  }, [updateState]);

  const handleViewportChange = useCallback((vp: ViewportInfo) => {
    updateMultipleStates({ viewport: vp, currentZoomLevel: vp.zoom });
  }, [updateMultipleStates]);

  // search submit
  const handleSearchSubmit = useCallback(async () => {
    await executeDeviceSearch(state.searchQuery, state.devices);
  }, [state.searchQuery, state.devices, executeDeviceSearch]);

  // node click
  const handleDeviceClick = useCallback(async (device: Device) => {
    const callId = Date.now();
    traceTimestampRef.current = callId;
    updateState("selectedDevice", device);
    updateMultipleStates({ selectedCable: null, traceResult: null, traceError: null });

    if (device.type?.toLowerCase() === "server") {
      updateState("searchError", "서버는 트레이스 대상이 아닙니다.");
      return;
    }
    try {
      const result = await fetchTrace(device.deviceId);
      if (traceTimestampRef.current !== callId) return;
      traceTimestampRef.current = Date.now();
      const traceEdges = mapTraceCablesToEdges(result.cables ?? [], traceTimestampRef.current);
      updateMultipleStates({ traceEdges, traceResult: result, searchError: undefined });
    } catch (err) {
      const message = err instanceof Error ? err.message : "트레이스 로드 실패";
      updateState("traceError", message);
    }
  }, [updateState, updateMultipleStates]);

  // edge click
  const handleEdgeClick = useCallback((_: unknown, edge: Edge) => {
    const id = edge.id;
    const isCable = id.startsWith(CABLE_EDGE_PREFIX);
    if (!isCable) return;
    const cableId = id.slice(CABLE_EDGE_PREFIX.length);
    const foundCable = state.cables.find(c => c.cableId === cableId);
    if (foundCable) {
      updateMultipleStates({
        selectedCable: foundCable,
        selectedDevice: null,
        traceResult: null,
        traceError: null,
        traceEdges: [],
      });
    }
  }, [state.cables, updateMultipleStates]);

  // ping all
  const handlePingAll = useCallback(async () => {
    if (state.isPinging) return;
    const offList = state.devices.filter(d => d.enablePing === false);
    const onList  = state.devices.filter(d => d.enablePing !== false);
    if (onList.length === 0) { alert("모든 장비에서 Ping이 비활성화되어 있어 실행할 수 없습니다.\n사이드패널의 Enable Ping을 켜거나 [전체 상태] 메뉴에서 '모두 Online + Ping ON'을 사용하세요."); return; }
    if (offList.length > 0) {
      const ok = confirm(`Ping OFF 장비 ${offList.length}대를 건너뛰고 나머지 ${onList.length}대만 Ping할까요?`);
      if (!ok) return;
    }
    updateMultipleStates({ isPinging: true, pingError: null });
    try {
      const pingResults = await pingAllDevices();
      const updatedDevices = state.devices.map(device => {
        const r = pingResults.find(p => p.deviceId === device.deviceId);
        return r ? { ...device, status: (r.status as any) ?? device.status, lastCheckedAt: r.checkedAt } : device;
      });
      updateState("devices", updatedDevices);
      updateState("layoutedNodes",
        state.layoutedNodes.map(n => ({ ...n, selected: state.selectedDevice?.deviceId.toString() === n.id }))
      );
    } catch (err) {
      updateState("pingError", err instanceof Error ? err.message : "전체 Ping 중 오류가 발생했습니다.");
    } finally { updateState("isPinging", false); }
  }, [state.isPinging, state.devices, state.layoutedNodes, state.selectedDevice, updateState, updateMultipleStates]);

  const handleRefresh = useCallback(() => {
    updateState("pingError", null);
    window.location.reload();
  }, [updateState]);

  // layout selection sync
  useEffect(() => {
    const nodesWithSelection: Node[] = layoutResult.nodes.map(node => ({
      ...node, selected: state.selectedDevice?.deviceId.toString() === node.id,
    }));
    updateState("layoutedNodes", nodesWithSelection);
  }, [layoutResult, state.selectedDevice, updateState]);

  // initial load
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [deviceData, cableData] = await Promise.all([fetchDevices(), fetchCables()]);
        if (isMounted) updateMultipleStates({ devices: deviceData, cables: cableData, loading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : "알 수 없는 오류입니다.";
        if (isMounted) updateMultipleStates({ error: message, loading: false });
      }
    })();
    return () => { isMounted = false; };
  }, [updateMultipleStates]);

  return {
    // state
    state,
    // derived
    deviceStatusCounts, problemCount, filteredCables, finalNodes, finalEdges, fps, showDebug,
    // actions
    updateState, updateMultipleStates,
    resetAllSelections, executeDeviceSearch,
    handleBulkSetStatus, handleSearchSubmit,
    handleDeviceClick, handleEdgeClick,
    handlePingAll, handleRefresh,
    handleZoomChange, handleViewportChange,
    refetchDevices: async () => updateState("devices", await fetchDevices()),
    refetchCables: async () => updateState("cables", await fetchCables()),
  };
}
