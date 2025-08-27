// src/hooks/useMainPageModel.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDevices, updateDeviceStatusBulk } from "../api/deviceApi";
import { fetchCables } from "../api/cableApi";
import { pingAllDevices } from "../api/pingApi";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
import { DeviceStatus } from "../types/status";
import { CABLE_EDGE_PREFIX } from "../utils/edgeMapper";
import { LayoutMode } from "../utils/layout";
import type { Node, Edge } from "react-flow-renderer";
import { useFps } from "../hooks/useFps";

// ⬇️ 새로 분리한 훅들
import { useSearchTrace } from "./useSearchTrace";
import { useTopologyView } from "./useTopologyView";

type ViewportInfo = {
  x: number; y: number; zoom: number;
  width: number; height: number;
  centerX: number; centerY: number;
};

interface AppState {
  devices: Device[];
  cables: CableDto[];
  selectedDevice: Device | null;
  selectedCable: CableDto | null;

  // trace/search
  traceResult: TraceResponse | null;
  traceEdges: Edge[];
  traceError: string | null;
  traceFilterNodes: Set<string> | null;
  searchQuery: string;
  searchError?: string;

  // ui & layout
  layoutMode: LayoutMode;
  showProblemOnly: boolean;
  currentZoomLevel: number;
  keyboardNavEnabled: boolean;
  viewport: ViewportInfo | null;

  // loading/error
  loading: boolean;
  error: string;
  isPinging: boolean;
  pingError: string | null;

  // misc
  renderKey: number;

  // (호환용) 레이아웃된 노드 캐시
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
  searchQuery: "",
  searchError: undefined,

  layoutMode: LayoutMode.Radial,
  showProblemOnly: false,
  currentZoomLevel: 1.0,
  keyboardNavEnabled: true,
  viewport: null,

  loading: true,
  error: "",
  isPinging: false,
  pingError: null,

  renderKey: 0,
  layoutedNodes: [],
};

export function useMainPageModel() {
  const [state, setState] = useState<AppState>(initialState);

  const updateState = useCallback(<K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateMultipleStates = useCallback((updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // DEV/localhost에서만 FPS 오버레이
  const showDebug =
    typeof window !== "undefined" &&
    (import.meta.env.DEV || window.location.hostname === "localhost");
  const fps = useFps({ sampleMs: 500, smooth: 0.25, enabled: showDebug });

  // ────────────────── 분리된 훅 연결 ──────────────────
  // 검색/트레이스 파이프라인
  const { executeDeviceSearch, runTraceForDevice, clearTrace } = useSearchTrace(
    () => state.devices,
    (patch) => updateMultipleStates(patch)
  );

  // 토폴로지 가시성/레이아웃 계산
  const { finalNodes, finalEdges } = useTopologyView({
    devices: state.devices,
    cables: state.cables,
    searchQuery: state.searchQuery,
    showProblemOnly: state.showProblemOnly,
    currentZoomLevel: state.currentZoomLevel,
    traceEdges: state.traceEdges,
    traceFilterNodes: state.traceFilterNodes,
    selectedDeviceId: state.selectedDevice ? String(state.selectedDevice.deviceId) : null,
    viewport: state.viewport ? { centerX: state.viewport.centerX, centerY: state.viewport.centerY } : null,
  });

  // ────────────────── 파생 데이터 ──────────────────
  const deviceStatusCounts = useMemo(() => ({
    [DeviceStatus.Online]: state.devices.filter(d => d.status === DeviceStatus.Online).length,
    [DeviceStatus.Offline]: state.devices.filter(d => d.status === DeviceStatus.Offline).length,
    [DeviceStatus.Unstable]: state.devices.filter(d => d.status === DeviceStatus.Unstable).length,
  }), [state.devices]);

  const problemCount = useMemo(
    () => state.devices.filter(d => d.status !== DeviceStatus.Online).length,
    [state.devices]
  );

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

  // ────────────────── 핸들러 ──────────────────
  const handleZoomChange = useCallback((zoomLevel: number) => {
    updateState("currentZoomLevel", zoomLevel);
    if (window.location.hostname === "localhost") {
      console.log(`[ZOOM] ${zoomLevel.toFixed(2)} hidePC=${zoomLevel < 0.7}`);
    }
  }, [updateState]);

  const handleViewportChange = useCallback((vp: ViewportInfo) => {
    updateMultipleStates({ viewport: vp, currentZoomLevel: vp.zoom });
  }, [updateMultipleStates]);

  const handleSearchSubmit = useCallback(async () => {
    await executeDeviceSearch(state.searchQuery);
  }, [executeDeviceSearch, state.searchQuery]);

  const handleDeviceClick = useCallback(async (device: Device) => {
    updateState("selectedDevice", device);
    updateMultipleStates({ selectedCable: null, traceResult: null, traceError: null });
    await runTraceForDevice(device);
  }, [runTraceForDevice, updateMultipleStates, updateState]);

  const handleEdgeClick = useCallback((_: unknown, edge: Edge) => {
    const id = edge.id;
    if (!id.startsWith(CABLE_EDGE_PREFIX)) return;
    const cableId = id.slice(CABLE_EDGE_PREFIX.length);
    const found = state.cables.find(c => c.cableId === cableId);
    if (!found) return;
    updateMultipleStates({
      selectedCable: found,
      selectedDevice: null,
    });
    clearTrace();
  }, [state.cables, updateMultipleStates, clearTrace]);

  const handlePingAll = useCallback(async () => {
    if (state.isPinging) return;
    const offList = state.devices.filter(d => d.enablePing === false);
    const onList  = state.devices.filter(d => d.enablePing !== false);
    if (onList.length === 0) {
      alert("모든 장비에서 Ping이 비활성화되어 실행할 수 없습니다.\n사이드패널의 Enable Ping을 켜거나 [전체 상태] 메뉴에서 '모두 Online + Ping ON'을 사용하세요.");
      return;
    }
    if (offList.length > 0) {
      const ok = confirm(`Ping OFF 장비 ${offList.length}대를 건너뛰고 나머지 ${onList.length}대만 Ping할까요?`);
      if (!ok) return;
    }
    updateMultipleStates({ isPinging: true, pingError: null });
    try {
      const pingResults = await pingAllDevices();
      const updated = state.devices.map(device => {
        const r = pingResults.find(p => p.deviceId === device.deviceId);
        return r ? { ...device, status: (r.status as any) ?? device.status, lastCheckedAt: r.checkedAt } : device;
      });
      updateState("devices", updated);
      // (호환) 선택 상태 유지 위해 layoutedNodes도 갱신
      updateState("layoutedNodes",
        finalNodes.map(n => ({ ...n, selected: state.selectedDevice?.deviceId.toString() === n.id }))
      );
    } catch (err) {
      updateState("pingError", err instanceof Error ? err.message : "전체 Ping 중 오류가 발생했습니다.");
    } finally {
      updateState("isPinging", false);
    }
  }, [state.isPinging, state.devices, state.selectedDevice, finalNodes, updateState, updateMultipleStates]);

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
    } finally {
      updateState("isPinging", false);
    }
  }, [state.devices, updateMultipleStates, updateState]);

  const handleRefresh = useCallback(() => {
    updateState("pingError", null);
    window.location.reload();
  }, [updateState]);

  const resetAllSelections = useCallback(() => {
    updateMultipleStates({ selectedDevice: null, selectedCable: null });
    clearTrace();
    // (호환) 기존 selection flag 초기화
    setState(prev => ({ ...prev, layoutedNodes: prev.layoutedNodes.map(n => ({ ...n, selected: false })) }));
  }, [clearTrace, updateMultipleStates]);

  // ────────────────── Effects ──────────────────
  // 초기 데이터 로드
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

  // (호환) 외부에서 기대할 수 있는 layoutedNodes 갱신
  useEffect(() => {
    updateState("layoutedNodes", finalNodes as Node[]);
  }, [finalNodes, updateState]);

  return {
    // state
    state,

    // derived
    deviceStatusCounts,
    problemCount,
    filteredCables,
    finalNodes,
    finalEdges,
    fps,
    showDebug,

    // actions
    updateState,
    updateMultipleStates,
    resetAllSelections,
    executeDeviceSearch,
    handleBulkSetStatus,
    handleSearchSubmit,
    handleDeviceClick,
    handleEdgeClick,
    handlePingAll,
    handleRefresh,
    handleZoomChange,
    handleViewportChange,

    // refetch
    refetchDevices: async () => updateState("devices", await fetchDevices()),
    refetchCables: async () => updateState("cables", await fetchCables()),
  };
}
