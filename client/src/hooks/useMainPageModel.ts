// src/hooks/useMainPageModel.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Edge, Node } from 'react-flow-renderer';

import { fetchCables } from '../api/cableApi';
import { fetchDevices, updateDeviceStatusBulk } from '../api/deviceApi';
import { pingAllDevices } from '../api/pingApi';
import { useFps } from '../hooks/useFps';
import type { CableDto } from '../types/cable';
import type { Device } from '../types/device';
import { DeviceStatus } from '../types/status';
import type { TraceResponse } from '../types/trace';
import { CABLE_EDGE_PREFIX } from '../utils/edgeMapper';
import { LayoutMode } from '../utils/layout';
// ⬇️ Newly separated hooks
import { useSearchTrace } from './useSearchTrace';
import { useTopologyView } from './useTopologyView';

type ViewportInfo = {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
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

  // (compat) cache for layouted nodes
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
  searchQuery: '',
  searchError: undefined,

  layoutMode: LayoutMode.Radial,
  showProblemOnly: false,
  currentZoomLevel: 1.0,
  keyboardNavEnabled: true,
  viewport: null,

  loading: true,
  error: '',
  isPinging: false,
  pingError: null,

  renderKey: 0,
  layoutedNodes: [],
};

export function useMainPageModel() {
  const [state, setState] = useState<AppState>(initialState);

  const updateState = useCallback(<K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateMultipleStates = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Show FPS overlay only in DEV/localhost
  const showDebug =
    typeof window !== 'undefined' &&
    (import.meta.env.DEV || window.location.hostname === 'localhost');
  const fps = useFps({ sampleMs: 500, smooth: 0.25, enabled: showDebug });

  // ────────────────── Wire separated hooks ──────────────────
  // Search/trace pipeline
  const { executeDeviceSearch, runTraceForDevice, clearTrace } = useSearchTrace(
    () => state.devices,
    (patch) => updateMultipleStates(patch),
  );

  // Topology visibility/layout computation
  const { finalNodes, finalEdges } = useTopologyView({
    devices: state.devices,
    cables: state.cables,
    searchQuery: state.searchQuery,
    showProblemOnly: state.showProblemOnly,
    currentZoomLevel: state.currentZoomLevel,
    traceEdges: state.traceEdges,
    traceFilterNodes: state.traceFilterNodes,
    selectedDeviceId: state.selectedDevice ? String(state.selectedDevice.deviceId) : null,
    viewport: state.viewport
      ? { centerX: state.viewport.centerX, centerY: state.viewport.centerY }
      : null,
  });

  // ────────────────── Derived data ──────────────────
  const deviceStatusCounts = useMemo(
    () => ({
      [DeviceStatus.Online]: state.devices.filter((d) => d.status === DeviceStatus.Online).length,
      [DeviceStatus.Offline]: state.devices.filter((d) => d.status === DeviceStatus.Offline).length,
      [DeviceStatus.Unstable]: state.devices.filter((d) => d.status === DeviceStatus.Unstable)
        .length,
    }),
    [state.devices],
  );

  const problemCount = useMemo(
    () => state.devices.filter((d) => d.status !== DeviceStatus.Online).length,
    [state.devices],
  );

  const filteredCables = useMemo(() => {
    const q = state.searchQuery.toLowerCase();
    return state.cables.filter((c) => {
      const id = String(c.cableId).toLowerCase();
      const desc = c.description?.toLowerCase() ?? '';
      const from = c.fromDevice.toLowerCase();
      const to = c.toDevice.toLowerCase();
      return id.includes(q) || desc.includes(q) || from.includes(q) || to.includes(q);
    });
  }, [state.cables, state.searchQuery]);

  // ────────────────── Handlers ──────────────────
  const handleZoomChange = useCallback(
    (zoomLevel: number) => {
      updateState('currentZoomLevel', zoomLevel);
      if (window.location.hostname === 'localhost') {
        console.log(`[ZOOM] ${zoomLevel.toFixed(2)} hidePC=${zoomLevel < 0.7}`);
      }
    },
    [updateState],
  );

  const handleViewportChange = useCallback(
    (vp: ViewportInfo) => {
      updateMultipleStates({ viewport: vp, currentZoomLevel: vp.zoom });
    },
    [updateMultipleStates],
  );

  const handleSearchSubmit = useCallback(async () => {
    await executeDeviceSearch(state.searchQuery);
  }, [executeDeviceSearch, state.searchQuery]);

  const handleDeviceClick = useCallback(
    async (device: Device) => {
      updateState('selectedDevice', device);
      updateMultipleStates({
        selectedCable: null,
        traceResult: null,
        traceError: null,
      });
      await runTraceForDevice(device);
    },
    [runTraceForDevice, updateMultipleStates, updateState],
  );

  const handleEdgeClick = useCallback(
    (_: unknown, edge: Edge) => {
      const id = edge.id;
      if (!id.startsWith(CABLE_EDGE_PREFIX)) return;
      const cableId = id.slice(CABLE_EDGE_PREFIX.length);
      const found = state.cables.find((c) => c.cableId === cableId);
      if (!found) return;
      updateMultipleStates({
        selectedCable: found,
        selectedDevice: null,
      });
      clearTrace();
    },
    [state.cables, updateMultipleStates, clearTrace],
  );

  const handlePingAll = useCallback(async () => {
    if (state.isPinging) return;
    const offList = state.devices.filter((d) => d.enablePing === false);
    const onList = state.devices.filter((d) => d.enablePing !== false);
    if (onList.length === 0) {
      alert(
        "Ping is disabled on all devices. Cannot execute.\nTurn on 'Enable Ping' in the side panel, or use 'All Online + Ping ON' from the [Change Status] menu.",
      );
      return;
    }
    if (offList.length > 0) {
      const ok = confirm(
        `Skip ${offList.length} devices with Ping OFF and ping only the remaining ${onList.length} devices?`,
      );
      if (!ok) return;
    }
    updateMultipleStates({ isPinging: true, pingError: null });
    try {
      const pingResults = await pingAllDevices();
      const updated = state.devices.map((device) => {
        const r = pingResults.find((p) => p.deviceId === device.deviceId);
        return r
          ? {
              ...device,
              status: (r.status as any) ?? device.status,
              lastCheckedAt: r.checkedAt,
            }
          : device;
      });
      updateState('devices', updated);
      // (compat) also update layoutedNodes to keep selection state
      updateState(
        'layoutedNodes',
        finalNodes.map((n) => ({
          ...n,
          selected: state.selectedDevice?.deviceId.toString() === n.id,
        })),
      );
    } catch (err) {
      updateState('pingError', err instanceof Error ? err.message : 'An error occurred during full ping.');
    } finally {
      updateState('isPinging', false);
    }
  }, [
    state.isPinging,
    state.devices,
    state.selectedDevice,
    finalNodes,
    updateState,
    updateMultipleStates,
  ]);

  const handleBulkSetStatus = useCallback(
    async (status: DeviceStatus, enablePing?: boolean) => {
      const ids = state.devices.map((d) => d.deviceId);
      if (ids.length === 0) {
        alert('There are no devices to update.');
        return;
      }
      const human = `${status}` + (enablePing !== undefined ? `, Ping ${enablePing ? 'ON' : 'OFF'}` : '');
      if (!confirm(`Change all ${ids.length} devices to "${human}"?`)) return;

      updateMultipleStates({ isPinging: true, pingError: null });
      try {
        await updateDeviceStatusBulk({ deviceIds: ids, status, enablePing });
        const now = new Date().toISOString();
        const newDevices = state.devices.map((d) => ({
          ...d,
          status,
          enablePing: enablePing ?? d.enablePing,
          lastCheckedAt: now,
          latencyMs: null,
        }));
        updateState('devices', newDevices);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred during bulk status update.';
        alert(message);
        updateState('pingError', message);
      } finally {
        updateState('isPinging', false);
      }
    },
    [state.devices, updateMultipleStates, updateState],
  );

  const handleRefresh = useCallback(() => {
    updateState('pingError', null);
    window.location.reload();
  }, [updateState]);

  const resetAllSelections = useCallback(() => {
    updateMultipleStates({ selectedDevice: null, selectedCable: null });
    clearTrace();
    // (compat) reset legacy selection flag
    setState((prev) => ({
      ...prev,
      layoutedNodes: prev.layoutedNodes.map((n) => ({ ...n, selected: false })),
    }));
  }, [clearTrace, updateMultipleStates]);

  // ────────────────── Effects ──────────────────
  // Initial data load
  useEffect(() => {
    let isMounted = true;

    // alert("useMainPageModel useEffect triggered!");
    // console.error("🚨🚨🚨 useMainPageModel run-check");

    (async () => {
      try {
        console.log('🔄 Starting data load...');
        const [deviceData, cableData] = await Promise.all([fetchDevices(), fetchCables()]);

        console.log('📊 devices received:', deviceData);
        console.log('📊 device count:', deviceData?.length);
        console.log('📊 cables received:', cableData);
        console.log('📊 cable count:', cableData?.length);

        if (isMounted) {
          console.log('✅ Saved data into state');
          updateMultipleStates({
            devices: deviceData,
            cables: cableData,
            loading: false,
          });
        }
      } catch (err) {
        console.error('❌ Data load error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error.';
        if (isMounted) updateMultipleStates({ error: message, loading: false });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [updateMultipleStates]);

  // (compat) keep layoutedNodes updated for external consumers
  useEffect(() => {
    updateState('layoutedNodes', finalNodes as Node[]);
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
    refetchDevices: async () => updateState('devices', await fetchDevices()),
    refetchCables: async () => updateState('cables', await fetchCables()),
  };
}
