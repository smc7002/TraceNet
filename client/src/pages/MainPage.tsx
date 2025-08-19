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
import { updateDeviceStatusBulk } from "../api/deviceApi";
import { DeviceStatus } from "../types/status";
import {
  LayoutMode,
  getNewRadialLayoutedElements,
  //getDagreLayoutedElements,
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

// 뷰포트 정보 (NetworkDiagram이 올려주는 값과 동일한 형태)
type ViewportInfo = {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
  centerX: number; // Flow 좌표계 기준 화면 중심 X
  centerY: number; // Flow 좌표계 기준 화면 중심 Y
};

// PC 스마트 공개 임계값
//const SMART_PC_ZOOM = 0.95; // 이 줌 이상에서만 "근처 스위치의 PC 공개"
const SMART_PC_RADIUS = 900; // 화면 중심에서 이 반경 안에 있는 스위치를 기준으로 PC 공개 (Flow 좌표계 px)

// Component config
const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };
const ZOOM_HIDE_PC = 0.7;
const SMART_PC_ZOOM = ZOOM_HIDE_PC;

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

const useProblemDeviceIdSet = (show: boolean, devices: Device[]) => {
  return useMemo<Set<string> | null>(() => {
    if (!show) return null;
    const set = new Set<string>();
    for (const d of devices) {
      if (d.status !== DeviceStatus.Online) set.add(String(d.deviceId));
    }
    return set;
  }, [show, devices]);
};

const MainPage = () => {
  const [state, setState] = useState<AppState>(initialState);
  const traceTimestampRef = useRef<number>(0);

  const updateState = useCallback(
    <K extends keyof AppState>(key: K, value: AppState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );
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
          d.ipAddress?.trim() === trimmedQuery
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
        const callId = Date.now();
        traceTimestampRef.current = callId;
        const result = await fetchTrace(matchedDevice.deviceId);
        if (traceTimestampRef.current !== callId) return; // 오래된 응답 무시

        // collect nodes on path
        const nodeIds = new Set<string>();
        if (Array.isArray(result.path)) {
          for (const hop of result.path) {
            const fromId =
              (hop as any).fromDeviceId ?? (hop as any).FromDeviceId;
            const toId = (hop as any).toDeviceId ?? (hop as any).ToDeviceId;
            if (fromId != null) nodeIds.add(String(fromId));
            if (toId != null) nodeIds.add(String(toId));
          }
        }
        if (Array.isArray(result.cables)) {
          for (const cable of result.cables) {
            const fromId =
              (cable as any).fromDeviceId ?? (cable as any).FromDeviceId;
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
      layoutedNodes: state.layoutedNodes.map((n) => ({
        ...n,
        selected: false,
      })),
    });
  }, [state.layoutedNodes, updateMultipleStates]);

  // ────────────────── Aggregations ──────────────────
  const deviceStatusCounts = useMemo(
    () => ({
      [DeviceStatus.Online]: state.devices.filter(
        (d) => d.status === DeviceStatus.Online
      ).length,
      [DeviceStatus.Offline]: state.devices.filter(
        (d) => d.status === DeviceStatus.Offline
      ).length,
      [DeviceStatus.Unstable]: state.devices.filter(
        (d) => d.status === DeviceStatus.Unstable
      ).length,
    }),
    [state.devices]
  );

  const problemCount = useMemo(
    () => state.devices.filter((d) => d.status !== DeviceStatus.Online).length,
    [state.devices]
  );

  // 🆕 전체 상태 일괄 변경
  const handleBulkSetStatus = useCallback(
    async (status: DeviceStatus, enablePing?: boolean) => {
      const ids = state.devices.map((d) => d.deviceId);
      if (ids.length === 0) {
        alert("변경할 장비가 없습니다.");
        return;
      }

      const human =
        `${status}` +
        (enablePing !== undefined ? `, Ping ${enablePing ? "ON" : "OFF"}` : "");
      if (!confirm(`전체 ${ids.length}대 장비를 "${human}" 으로 변경할까요?`))
        return;

      // 기존 isPinging 재활용해서 상단 버튼들 비활성화
      updateMultipleStates({ isPinging: true, pingError: null });

      try {
        await updateDeviceStatusBulk({ deviceIds: ids, status, enablePing });

        // 🔄 로컬 상태도 즉시 반영(낙관적 업데이트)
        const now = new Date().toISOString();
        const newDevices = state.devices.map((d) => ({
          ...d,
          status,
          enablePing: enablePing ?? d.enablePing,
          lastCheckedAt: now,
          latencyMs: null,
        }));
        updateState("devices", newDevices);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "일괄 상태 변경 중 오류가 발생했습니다.";
        alert(message);
        updateState("pingError", message);
      } finally {
        updateState("isPinging", false);
      }
    },
    [state.devices, updateMultipleStates, updateState]
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

  // 스위치 -> PC 목록 매핑 (케이블 기준)
  const switchPcMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const typeById = new Map<string, string>();
    for (const d of state.devices) {
      typeById.set(String(d.deviceId), (d.type ?? "pc").toLowerCase());
    }
    for (const c of state.cables) {
      const a = String(c.fromDeviceId);
      const b = String(c.toDeviceId);
      const ta = typeById.get(a);
      const tb = typeById.get(b);
      if (ta === "switch" && tb === "pc") {
        if (!map.has(a)) map.set(a, new Set());
        map.get(a)!.add(b);
      } else if (ta === "pc" && tb === "switch") {
        if (!map.has(b)) map.set(b, new Set());
        map.get(b)!.add(a);
      }
    }
    return map;
  }, [state.devices, state.cables]);

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
        //mode: state.layoutMode,
        mode: "radial",
        // search only affects highlighting, not layout membership
        highlighted:
          !!state.searchQuery &&
          (device.name
            .toLowerCase()
            .includes(state.searchQuery.toLowerCase()) ||
            device.ipAddress?.includes(state.searchQuery)),
      },
    }));
  }, [state.devices, state.searchQuery, state.layoutMode]);

  /** Zoom-based PC hiding; during trace focus show all */
  const zoomFilteredNodes = useMemo(() => {
    // 트레이스 중이거나 문제전용이면 PC 숨김을 끈다
    if (state.traceFilterNodes || state.showProblemOnly) return allNodes;

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
  }, [
    allNodes,
    state.currentZoomLevel,
    state.traceFilterNodes,
    state.showProblemOnly,
  ]);

  const baseEdges = useMemo(() => {
    //   const isRadial = state.layoutMode === LayoutMode.Radial;
    //   return mapCablesToEdges(state.cables, isRadial);
    // }, [state.cables, state.layoutMode]);
    return mapCablesToEdges(state.cables, true);
  }, [state.cables]);

  /** Only edges connecting currently visible nodes */
  const layoutEdges = useMemo(() => {
    const nodeIds = new Set(zoomFilteredNodes.map((n) => n.id));
    return baseEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
  }, [baseEdges, zoomFilteredNodes]);

  /** Layout + secondary alignment */
  const layoutResult = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    // const calculated =
    //   state.layoutMode === LayoutMode.Radial
    //     ? getNewRadialLayoutedElements(zoomFilteredNodes, layoutEdges)
    //     : getDagreLayoutedElements(zoomFilteredNodes, layoutEdges);

    const calculated = getNewRadialLayoutedElements(
      zoomFilteredNodes,
      layoutEdges
    );

    const { nodes: alignedNodes } = alignNodesToCalculatedCenters(
      calculated.nodes,
      calculated.edges
    );

    return { nodes: alignedNodes, edges: calculated.edges as Edge[] };
    //}, [state.layoutMode, zoomFilteredNodes, layoutEdges]);
  }, [zoomFilteredNodes, layoutEdges]);

  /** Search visibility: matched nodes + their cable neighbors (keeps structure) */
  const searchVisibleSet = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matched = new Set(
      state.devices
        .filter(
          (d) => d.name.toLowerCase().includes(q) || d.ipAddress?.includes(q)
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

  // Problem-only filter set
  const problemVisibleSet = useProblemDeviceIdSet(
    state.showProblemOnly,
    state.devices
  );

  /** Final nodes (apply problem-only, trace filter and search visibility only here) */
  const finalNodes = useMemo(() => {
    let nodes = state.layoutedNodes;

    // Problem-only: Online이 아닌 장비만 표시
    if (problemVisibleSet) {
      nodes = nodes.filter((n) => problemVisibleSet.has(n.id));
    }

    // Trace 가시성(검색/문제와 AND)
    if (state.traceFilterNodes) {
      nodes = nodes.filter((n) => state.traceFilterNodes!.has(n.id));
    }

    // 검색 가시성(AND)
    if (searchVisibleSet) {
      nodes = nodes.filter((n) => searchVisibleSet.has(n.id));
    }

    // ───── 스마트 PC 공개: 스위치 근처에서만 PC 전체 공개 ─────
    const canSmartReveal =
      !!state.viewport &&
      state.currentZoomLevel >= SMART_PC_ZOOM &&
      !state.traceFilterNodes &&
      !state.showProblemOnly &&
      state.searchQuery.trim() === "";

    if (canSmartReveal) {
      // 레이아웃된 스위치들 중 뷰포트 중심과 가장 가까운 스위치 찾기
      const centerX = state.viewport!.centerX;
      const centerY = state.viewport!.centerY;

      let nearestSwitch: Node | null = null;
      let bestD2 = Number.POSITIVE_INFINITY;

      for (const n of state.layoutedNodes) {
        if (n.data?.type !== "switch") continue;
        const dx = (n.position?.x ?? 0) - centerX;
        const dy = (n.position?.y ?? 0) - centerY;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          nearestSwitch = n;
        }
      }

      const radius2 = SMART_PC_RADIUS * SMART_PC_RADIUS;
      if (nearestSwitch && bestD2 <= radius2) {
        // 이 스위치에 연결된 PC만 공개
        const allowedPcs =
          switchPcMap.get(nearestSwitch.id) ?? new Set<string>();
        nodes = nodes.filter((n) => {
          const t = n.data?.type;
          if (t !== "pc") return true; // 서버/스위치는 항상 표시
          return allowedPcs.has(n.id); // 해당 스위치의 PC만
        });
      } else {
        // 근처 스위치가 없으면 PC는 전부 숨김 (서버/스위치만)
        nodes = nodes.filter((n) => n.data?.type !== "pc");
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
        console.log(
          `[ZOOM] ${zoomLevel.toFixed(2)} hidePC=${zoomLevel < ZOOM_HIDE_PC}`
        );
      }
    },
    [updateState]
  );

  // NetworkDiagram가 보고하는 뷰포트/줌 정보 수신
  const handleViewportChange = useCallback(
    (vp: ViewportInfo) => {
      updateMultipleStates({
        viewport: vp,
        currentZoomLevel: vp.zoom, // 기존 로직과 동기화
      });
      if (window.location.hostname === "localhost") {
        console.log(
          `[VIEWPORT] zoom=${vp.zoom.toFixed(2)} center=(${Math.round(
            vp.centerX
          )}, ${Math.round(vp.centerY)})`
        );
      }
    },
    [updateMultipleStates]
  );

  const handleSearchSubmit = useCallback(async () => {
    await executeDeviceSearch(state.searchQuery, state.devices);
  }, [state.searchQuery, state.devices, executeDeviceSearch]);

  const handleDeviceClick = useCallback(
    async (device: Device) => {
      const callId = Date.now();
      traceTimestampRef.current = callId;

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
        if (traceTimestampRef.current !== callId) return;
        traceTimestampRef.current = Date.now();
        const traceEdges = mapTraceCablesToEdges(
          result.cables ?? [],
          traceTimestampRef.current
        );

        updateMultipleStates({
          traceEdges,
          traceResult: result,
          searchError: undefined,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "트레이스 로드 실패";
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

  // 기존 handlePingAll을 이 버전으로 교체
  const handlePingAll = useCallback(async () => {
    if (state.isPinging) return;

    // ✅ Ping OFF/ON 집계
    const offList = state.devices.filter((d) => d.enablePing === false);
    const onList = state.devices.filter((d) => d.enablePing !== false); // undefined는 ON 취급

    // ✅ 전부 OFF면 경고 후 중단
    if (onList.length === 0) {
      alert(
        "⚠️ 모든 장비에서 Ping이 비활성화되어 있어 실행할 수 없습니다.\n" +
          "사이드패널의 Enable Ping을 켜거나 [전체 상태] 메뉴에서 ‘모두 Online + Ping ON’을 사용하세요."
      );
      return;
    }

    // ✅ 일부 OFF면 사용자에게 알려주고 계속할지 확인
    if (offList.length > 0) {
      const ok = confirm(
        `Ping OFF 장비 ${offList.length}대를 건너뛰고 ` +
          `나머지 ${onList.length}대만 Ping할까요?`
      );
      if (!ok) return;
    }

    updateMultipleStates({ isPinging: true, pingError: null });

    try {
      // (A) 지금처럼 백엔드가 OFF를 자체적으로 건너뛴다면 그대로 호출
      const pingResults = await pingAllDevices();

      // (B) 만약 ON인 장비만 정확히 치고 싶다면,
      // pingMultipleDevices(onList.map(d => d.deviceId)) 를 사용하세요.
      // → 이미 /api/device/ping/multi 있으니 프런트에 함수만 있으면 됨.

      const updatedDevices = state.devices.map((device) => {
        const r = pingResults.find((p) => p.deviceId === device.deviceId);
        return r
          ? {
              ...device,
              status: (r.status as any) ?? device.status,
              lastCheckedAt: r.checkedAt,
            }
          : device;
      });

      updateState("devices", updatedDevices);
      // 선택 유지
      updateState(
        "layoutedNodes",
        state.layoutedNodes.map((n) => ({
          ...n,
          selected: state.selectedDevice?.deviceId.toString() === n.id,
        }))
      );
    } catch (err) {
      updateState(
        "pingError",
        err instanceof Error ? err.message : "전체 Ping 중 오류가 발생했습니다."
      );
    } finally {
      updateState("isPinging", false);
    }
  }, [
    state.isPinging,
    state.devices,
    state.layoutedNodes,
    state.selectedDevice,
    updateState,
    updateMultipleStates,
  ]);

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

  // 레이아웃 모드 변경시 리렌더링 (현재 모드 변경 비활성화)
  // useEffect(() => {
  //   setState((prev) => ({ ...prev, renderKey: prev.renderKey + 1 }));
  // }, [state.layoutMode]);

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      try {
        const [deviceData, cableData] = await Promise.all([
          fetchDevices(),
          fetchCables(),
        ]);
        if (isMounted) {
          updateMultipleStates({
            devices: deviceData,
            cables: cableData,
            loading: false,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "알 수 없는 오류입니다.";
        if (isMounted) {
          updateMultipleStates({ error: message, loading: false });
        }
      }
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [updateMultipleStates]);

  // ────────────────── Render ──────────────────
  if (state.loading) return <LoadingSpinner />;
  if (state.error)
    return (
      <ErrorState
        message={state.error}
        onRetry={() => window.location.reload()}
      />
    );

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Top control bar */}
      <div className="border-b border-slate-200 shrink-0">
        <ControlBar
          onRefresh={handleRefresh}
          onToggleProblemOnly={() =>
            updateState("showProblemOnly", !state.showProblemOnly)
          }
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
          onBulkSetStatus={handleBulkSetStatus}
          problemCount={problemCount}
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
            onViewportChange={handleViewportChange}
          />

          {state.showProblemOnly && finalNodes.length === 0 && (
            <div className="mt-2 mx-2 text-sm bg-white/60 text-rose-700 border border-rose-300 rounded px-3 py-2">
              현재 표시할 <strong>문제 장비</strong>가 없습니다. (Online 외 상태
              없음)
            </div>
          )}

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
          refetchDevices={async () =>
            updateState("devices", await fetchDevices())
          }
          refetchCables={async () => updateState("cables", await fetchCables())}
          devices={state.devices}
        />
      </div>
    </div>
  );
};

export default MainPage;
