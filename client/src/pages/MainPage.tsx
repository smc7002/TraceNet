/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MainPage.tsx - TraceNet 네트워크 모니터링 시스템 메인 페이지
 *
 * 주요 기능:
 * - 네트워크 토폴로지 시각화 (React Flow 기반, 수백개 노드 렌더링 가능)
 * - 실시간 Ping 모니터링 및 상태 표시 (Online/Offline/Unstable)
 * - 장비간 경로 추적(Trace) 및 케이블 연결 관계 시각화
 * - 줌 레벨별 성능 최적화 (PC 노드 동적 숨김/표시)
 *
 * 성능 최적화:x`
 * - useMemo/useCallback로 불필요한 리렌더링 방지
 * - 줌 < 0.7일 때 PC 노드 자동 숨김 (200+ 노드 → 10개 서버/스위치만)
 * - 스마트 PC 공개: 화면 중심 근처 스위치의 PC만 선택적 표시
 *
 * 역할:
 * - 대규모 토폴로지 렌더링(React Flow) + 성능 최적화(PC 가시성 제어)
 * - Trace 실행/표시, Ping 상태 집계 및 제어
 *
 * 성능 상수 근거:
 * - ZOOM_HIDE_PC=0.7, SMART_PC_RADIUS=900
 *   →  벤치(≈300~400 노드, 1000+ 엣지)에서 55~60fps 유지 기준
 *
 * 에러 채널 정책:
 * - searchError: 검색 제출/매칭 관련
 * - traceError: 트레이스 실행/자격(서버 노드 클릭 등)
 * - pingError : 핑 파이프라인 실패
 *
 * 불변식:
 * - 모든 node/edge ID는 문자열(String)로 정규화
 * - 현재 레이아웃은 Radial 고정 (토글 복귀 시 수정 포인트: baseEdges 플래그, layoutResult 분기, node.data.mode)
 */

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
  //getDagreLayoutedElements,  // 현재 방사형 레이아웃만 사용
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
import { useFps } from "../hooks/useFps";
import { alignNodesToCalculatedCenters } from "../utils/nodeCenterCalculator";

/**
 * 뷰포트 정보 타입 정의
 * NetworkDiagram 컴포넌트에서 실시간으로 전달받는 화면 상태
 * 스마트 PC 공개 기능에서 화면 중심 계산에 사용
 */
type ViewportInfo = {
  x: number; // 뷰포트 X 오프셋
  y: number; // 뷰포트 Y 오프셋
  zoom: number; // 현재 줌 레벨 (0.3 ~ 2.0)
  width: number; // 뷰포트 너비
  height: number; // 뷰포트 높이
  centerX: number; // Flow 좌표계 기준 화면 중심 X
  centerY: number; // Flow 좌표계 기준 화면 중심 Y
};

/**
 * 성능 최적화 상수 정의
 * 이 값들을 조정하여 성능과 사용성의 균형 조절 가능
 */
const SMART_PC_RADIUS = 900; // 화면 중심에서 이 반경(px) 안의 스위치 기준으로 PC 공개
const ZOOM_HIDE_PC = 0.7; // 이 줌 레벨 미만에서 PC 노드 전체 숨김
const SMART_PC_ZOOM = ZOOM_HIDE_PC; // 스마트 PC 공개 시작 줌 레벨

// React Flow 컴포넌트 설정
const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

/**
 * 메인 애플리케이션 상태 정의
 *
 * 구조:
 * - devices/cables: 백엔드에서 가져온 원본 데이터
 * - selected*: 현재 사용자가 선택한 항목들
 * - trace*: 경로 추적 관련 상태 (traceFilterNodes가 null이 아니면 트레이스 모드)
 * - layout*: 노드 배치 및 화면 표시 관련
 * - ui상태: 로딩, 에러, 검색 등 UI 제어 상태
 */
interface AppState {
  // 핵심 데이터
  devices: Device[]; // 모든 네트워크 장비 (서버/스위치/PC)
  cables: CableDto[]; // 케이블 연결 정보

  // 선택 상태
  selectedDevice: Device | null; // 현재 선택된 장비 (상세 정보 표시용)
  selectedCable: CableDto | null; // 현재 선택된 케이블

  // 트레이스 기능
  traceResult: TraceResponse | null; // 경로 추적 결과
  traceEdges: Edge[]; // 트레이스 경로를 시각화하는 엣지들
  traceError: string | null; // 트레이스 실행 에러
  traceFilterNodes: Set<string> | null; // 트레이스 모드일 때 표시할 노드 ID들

  // 레이아웃 및 필터
  layoutMode: LayoutMode; // 현재 사용하지 않음 (방사형 고정)
  searchQuery: string; // 검색어
  showProblemOnly: boolean; // 문제 장비만 표시 여부
  loading: boolean; // 초기 데이터 로딩 상태
  error: string; // 전역 에러 메시지
  renderKey: number; // React Flow 강제 리렌더링용

  // UI 제어
  isPinging: boolean; // Ping 실행 중 상태 (버튼 비활성화용)
  pingError: string | null; // Ping 실행 에러
  searchError: string | undefined; // 검색/트레이스 에러
  currentZoomLevel: number; // 현재 줌 레벨 (성능 최적화용)
  keyboardNavEnabled: boolean; // 키보드 네비게이션 활성화 여부
  layoutedNodes: Node[]; // 레이아웃 적용된 노드들 (위치 정보 포함)
  viewport: ViewportInfo | null; // 현재 뷰포트 정보
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

/**
 * 문제 장비 ID 집합 생성 커스텀 훅
 * "문제 장비만 보기" 기능을 위한 최적화된 필터링
 *
 * @param show - 문제 장비만 표시할지 여부
 * @param devices - 전체 장비 배열
 * @returns Online이 아닌 장비들의 ID Set (show=false면 null)
 */
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

  /**
   * 트레이스 요청 중복 방지용 타임스탬프
   * 사용자가 빠르게 여러 장비를 클릭할 때 이전 요청 결과가 늦게 와서
   * 현재 선택과 다른 결과가 표시되는 것을 방지
   */
  const traceTimestampRef = useRef<number>(0);

  /**
   * 상태 업데이트 헬퍼 함수들
   * TypeScript 타입 안전성을 보장하면서 상태 업데이트를 간소화
   */
  const updateState = useCallback(
    <K extends keyof AppState>(key: K, value: AppState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateMultipleStates = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // dev-only debug overlay flags
  const showDebug =
    typeof window !== "undefined" &&
    (import.meta.env.DEV || window.location.hostname === "localhost");

  const fps = useFps({ sampleMs: 500, smooth: 0.25, enabled: showDebug });

  // ────────────────── Search & Trace 핵심 로직 ──────────────────

  /**
   * 장비 검색 및 자동 트레이스 실행 함수
   *
   * 동작 순서:
   * 1. 검색어로 장비명/IP 매칭
   * 2. 매칭되면 자동으로 트레이스 실행
   * 3. 트레이스 결과로 경로상 노드들만 표시
   *
   * 성능 최적화:
   * - 타임스탬프로 오래된 응답 무시
   * - 빈 검색어면 즉시 리턴하여 불필요한 API 호출 방지
   */
  const executeDeviceSearch = useCallback(
    async (query: string, devices: Device[]) => {
      const trimmedQuery = query.trim();

      // 빈 검색어면 트레이스 모드 해제
      if (!trimmedQuery) {
        updateMultipleStates({
          traceFilterNodes: null,
          traceEdges: [],
          traceResult: null,
          searchError: undefined,
        });
        return;
      }

      // 장비명 또는 IP 주소로 정확히 매칭
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
        // 중복 요청 방지: 새로운 요청마다 고유 ID 생성
        const callId = Date.now();
        traceTimestampRef.current = callId;

        const result = await fetchTrace(matchedDevice.deviceId);

        // 이미 더 새로운 요청이 있으면 이 결과는 무시
        if (traceTimestampRef.current !== callId) return;

        /**
         * 트레이스 경로상 모든 노드 ID 수집
         * 백엔드 응답 형식이 일관되지 않을 수 있어서 대소문자 구분 없이 처리
         */
        const nodeIds = new Set<string>();

        // path 배열에서 노드 수집
        if (Array.isArray(result.path)) {
          for (const hop of result.path) {
            const fromId =
              (hop as any).fromDeviceId ?? (hop as any).FromDeviceId;
            const toId = (hop as any).toDeviceId ?? (hop as any).ToDeviceId;
            if (fromId != null) nodeIds.add(String(fromId));
            if (toId != null) nodeIds.add(String(toId));
          }
        }

        // cables 배열에서 노드 수집
        if (Array.isArray(result.cables)) {
          for (const cable of result.cables) {
            const fromId =
              (cable as any).fromDeviceId ?? (cable as any).FromDeviceId;
            const toId = (cable as any).toDeviceId ?? (cable as any).ToDeviceId;
            if (fromId != null) nodeIds.add(String(fromId));
            if (toId != null) nodeIds.add(String(toId));
          }
        }

        // 검색 대상 장비도 포함
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

  /**
   * 모든 선택 상태 초기화 (캔버스 클릭 시 호출)
   * 트레이스 모드도 함께 해제하여 전체 네트워크 보기로 복귀
   */
  const resetAllSelections = useCallback(() => {
    updateMultipleStates({
      selectedDevice: null,
      selectedCable: null,
      traceResult: null,
      traceError: null,
      traceEdges: [],
    });

    // 모든 노드의 선택 상태도 해제
    setState((prev) => ({
      ...prev,
      layoutedNodes: prev.layoutedNodes.map((n) => ({ ...n, selected: false })),
    }));
  }, [updateMultipleStates]);

  // ────────────────── 통계 및 집계 데이터 ──────────────────

  /**
   * 상태별 장비 수 집계 (상단 상태 표시용)
   * 성능 최적화: devices 배열이 변경될 때만 재계산
   */
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

  /**
   * 문제 장비 수 집계 ("문제 장비만" 버튼 표시용)
   */
  const problemCount = useMemo(
    () => state.devices.filter((d) => d.status !== DeviceStatus.Online).length,
    [state.devices]
  );

  /**
   * 전체 장비 상태 일괄 변경 함수
   * 관리자용 기능: 모든 장비를 특정 상태로 한 번에 변경
   *
   * 주요 기능:
   * - 사용자 확인 후 실행
   * - 낙관적 업데이트 (API 성공 가정하고 UI 먼저 업데이트)
   * - 기존 isPinging 상태 재활용하여 버튼들 비활성화
   */
  const handleBulkSetStatus = useCallback(
    async (status: DeviceStatus, enablePing?: boolean) => {
      const ids = state.devices.map((d) => d.deviceId);
      if (ids.length === 0) {
        alert("변경할 장비가 없습니다.");
        return;
      }

      // 사용자 확인 메시지 생성
      const human =
        `${status}` +
        (enablePing !== undefined ? `, Ping ${enablePing ? "ON" : "OFF"}` : "");
      if (!confirm(`전체 ${ids.length}대 장비를 "${human}" 으로 변경할까요?`))
        return;

      // UI 잠금 (isPinging 재활용)
      updateMultipleStates({ isPinging: true, pingError: null });

      try {
        await updateDeviceStatusBulk({ deviceIds: ids, status, enablePing });

        /**
         * 낙관적 업데이트 (Optimistic Update)
         * API 성공을 가정하고 로컬 상태를 즉시 업데이트
         * 사용자 경험 향상 (서버 응답 기다리지 않고 즉시 UI 반영)
         */
        const now = new Date().toISOString();
        const newDevices = state.devices.map((d) => ({
          ...d,
          status,
          enablePing: enablePing ?? d.enablePing,
          lastCheckedAt: now,
          latencyMs: null, // 상태 변경 시 기존 지연시간 초기화
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

  // ────────────────── 사이드 패널 필터링 ──────────────────

  /**
   * 케이블 검색 필터링 (사이드 패널 케이블 목록용)
   * 케이블 ID, 설명, 연결 장비명으로 검색 가능
   */
  const filteredCables = useMemo(() => {
    const q = state.searchQuery.toLowerCase();
    return state.cables.filter((c) => {
      const id = String(c.cableId).toLowerCase();
      const desc = c.description?.toLowerCase() ?? "";
      const from = c.fromDevice.toLowerCase();
      const to = c.toDevice.toLowerCase();
      return (
        id.includes(q) || desc.includes(q) || from.includes(q) || to.includes(q)
      );
    });
  }, [state.cables, state.searchQuery]);

  // ────────────────── React Flow 노드 및 엣지 생성 ──────────────────

  /**
   * 스마트 PC 공개를 위한 스위치-PC 매핑 생성
   * 각 스위치에 연결된 PC들의 ID를 Set으로 관리
   * 성능 최적화: 화면 중심 근처 스위치의 PC만 선택적으로 표시하기 위함
   */
  const switchPcMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const typeById = new Map<string, string>();

    // 1단계: 모든 장비의 타입 정보 매핑
    for (const d of state.devices) {
      typeById.set(String(d.deviceId), (d.type ?? "pc").toLowerCase());
    }

    // 2단계: 케이블 연결 정보로 스위치-PC 관계
    for (const c of state.cables) {
      const a = String(c.fromDeviceId);
      const b = String(c.toDeviceId);
      const ta = typeById.get(a);
      const tb = typeById.get(b);

      // 스위치 ↔ PC 연결 관계 처리
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

  /**
   * 모든 장비를 React Flow 노드로 변환
   *
   * 주의: 여기서는 필터링하지 않고 모든 노드를 생성
   * 실제 필터링은 finalNodes에서 적용됨 (성능상 레이아웃 계산 후 필터링이 효율적)
   */
  const allNodes: Node[] = useMemo(() => {
    return state.devices.map((device) => ({
      id: `${device.deviceId}`,
      type: "custom",
      position: { x: 0, y: 0 }, // 레이아웃 알고리즘에서 실제 위치 계산
      data: {
        label: device.name,
        type: device.type?.toLowerCase() ?? "pc",
        status: device.status,
        showLabel: true,
        mode: "radial", // 방사형 레이아웃 고정
        // 검색어 하이라이팅 (레이아웃에는 영향 없음)
        highlighted:
          !!state.searchQuery &&
          (device.name
            .toLowerCase()
            .includes(state.searchQuery.toLowerCase()) ||
            device.ipAddress?.includes(state.searchQuery)),
      },
    }));
  }, [state.devices, state.searchQuery /*state.layoutMode*/]);

  /**
   * 줌 레벨 기반 PC 노드 필터링
   *
   * 성능 최적화 핵심 로직:
   * - 줌 < 0.7: PC 노드 숨김 (200+ 노드 → 10개 서버/스위치만)
   * - 트레이스 모드나 문제 장비 모드일 때는 PC 숨김 비활성화
   */
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

  /**
   * 케이블 정보를 React Flow 엣지로 변환
   * 현재 방사형 레이아웃만 사용하므로 radial=true 고정
   */
  const baseEdges = useMemo(() => {
    return mapCablesToEdges(state.cables, true);
  }, [state.cables]);

  /**
   * 현재 화면에 표시되는 노드들 간의 엣지만 필터링
   * 보이지 않는 노드로 연결되는 엣지는 제거하여 성능 최적화
   */
  const layoutEdges = useMemo(() => {
    const nodeIds = new Set(zoomFilteredNodes.map((n) => n.id));
    return baseEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
  }, [baseEdges, zoomFilteredNodes]);

  /**
   * 레이아웃 알고리즘 실행 및 노드 중심점 정렬
   *
   * 2단계 처리:
   * 1. 방사형 레이아웃으로 기본 위치 계산
   * 2. 중심점 계산 알고리즘으로 노드 위치 미세 조정
   *
   * 성능 주의: 노드나 엣지 배열이 변경될 때만 재계산됨
   */
  const layoutResult = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const calculated = getNewRadialLayoutedElements(
      zoomFilteredNodes,
      layoutEdges
    );

    // 중심점 정렬 알고리즘 적용 (노드 겹침 방지 및 가독성 향상)
    const { nodes: alignedNodes } = alignNodesToCalculatedCenters(
      calculated.nodes,
      calculated.edges
    );

    return { nodes: alignedNodes, edges: calculated.edges as Edge[] };
  }, [zoomFilteredNodes, layoutEdges]);

  /**
   * 검색 결과 가시성 계산
   *
   * 검색어와 매칭되는 노드와 그 이웃 노드들을 포함
   * 이웃 노드까지 포함하는 이유: 네트워크 구조 이해를 위해 연결 관계 유지
   */
  const searchVisibleSet = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return null;

    // 검색어와 매칭되는 장비들
    const matched = new Set(
      state.devices
        .filter(
          (d) => d.name.toLowerCase().includes(q) || d.ipAddress?.includes(q)
        )
        .map((d) => String(d.deviceId))
    );

    // 케이블로 연결된 이웃 노드들도 포함 (네트워크 구조 유지)
    state.cables.forEach((c) => {
      const a = String(c.fromDeviceId);
      const b = String(c.toDeviceId);
      if (matched.has(a)) matched.add(b);
      if (matched.has(b)) matched.add(a);
    });

    return matched;
  }, [state.searchQuery, state.devices, state.cables]);

  /**
   * 문제 장비 전용 모드를 위한 필터 셋
   * useProblemDeviceIdSet 커스텀 훅 사용
   */
  const problemVisibleSet = useProblemDeviceIdSet(
    state.showProblemOnly,
    state.devices
  );

  /**
   * 최종 표시할 노드 결정 (다단계 필터링)
   *
   * 필터링 순서 (AND 조건):
   * 1. 문제 장비 전용 필터 (활성화 시)
   * 2. 트레이스 경로 필터 (트레이스 모드 시)
   * 3. 검색 결과 필터 (검색어 입력 시)
   * 4. 스마트 PC 공개 (특정 조건에서 PC 선택적 표시)
   *
   * 스마트 PC 공개 조건:
   * - 뷰포트 정보 유효
   * - 줌 레벨 >= 0.7
   * - 트레이스/문제/검색 모드가 아님
   */
  const finalNodes = useMemo(() => {
    let nodes = state.layoutedNodes;

    // 1. 문제 장비만 표시 (Online이 아닌 장비만)
    if (problemVisibleSet) {
      nodes = nodes.filter((n) => problemVisibleSet.has(n.id));
    }

    // 2. 트레이스 가시성 (검색/문제와 AND 조건)
    if (state.traceFilterNodes) {
      nodes = nodes.filter((n) => state.traceFilterNodes!.has(n.id));
    }

    // 3. 검색 가시성 (AND 조건)
    if (searchVisibleSet) {
      nodes = nodes.filter((n) => searchVisibleSet.has(n.id));
    }

    /**
     * 4. 스마트 PC 공개 로직
     *
     * 목적: 성능과 가독성의 균형
     * - 전체 PC 표시 시: 화면이 복잡해져 가독성 저하
     * - 전체 PC 숨김 시: 필요한 PC를 찾기 어려움
     * - 해결: 화면 중심 근처 스위치의 PC만 선택적 표시
     */
    const canSmartReveal =
      !!state.viewport &&
      Number.isFinite(state.viewport.centerX) &&
      Number.isFinite(state.viewport.centerY) &&
      state.currentZoomLevel >= SMART_PC_ZOOM &&
      !state.traceFilterNodes &&
      !state.showProblemOnly &&
      state.searchQuery.trim() === "";

    if (canSmartReveal) {
      // 화면 중심에서 가장 가까운 스위치 찾기
      const centerX = state.viewport!.centerX;
      const centerY = state.viewport!.centerY;

      let nearestSwitch: Node | null = null;
      let bestD2 = Number.POSITIVE_INFINITY;

      for (const n of state.layoutedNodes) {
        if (n.data?.type !== "switch") continue;
        const dx = (n.position?.x ?? 0) - centerX;
        const dy = (n.position?.y ?? 0) - centerY;
        const d2 = dx * dx + dy * dy; // 거리의 제곱 (성능상 sqrt 생략)
        if (d2 < bestD2) {
          bestD2 = d2;
          nearestSwitch = n;
        }
      }

      const radius2 = SMART_PC_RADIUS * SMART_PC_RADIUS;
      if (nearestSwitch && bestD2 <= radius2) {
        // 해당 스위치에 연결된 PC만 공개
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

  /**
   * 최종 엣지 목록 생성 (기본 케이블 + 트레이스 엣지)
   *
   * 처리 순서:
   * 1. 현재 표시되는 노드들 간의 기본 케이블 엣지 필터링
   * 2. 트레이스 엣지도 동일하게 필터링
   * 3. 겹치는 엣지 제거 (기본 케이블과 트레이스 경로가 겹칠 때)
   * 4. 트레이스 엣지에 고유 ID 부여하여 추가
   */
  const finalEdges = useMemo(() => {
    const nodeIds = new Set(finalNodes.map((n) => n.id));

    // 현재 보이는 노드들 간의 엣지만 필터링
    const baseFiltered = baseEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    const traceFiltered = state.traceEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    return [
      ...excludeTraceOverlaps(baseFiltered, traceFiltered), // 겹치는 엣지 제거 후 기본 엣지
      ...traceFiltered.map((e) => ({ ...e, id: `trace-${e.id}` })), // 트레이스 엣지 (고유 ID)
    ];
  }, [baseEdges, state.traceEdges, finalNodes]);

  // ────────────────── 이벤트 핸들러 ──────────────────

  /**
   * 줌 레벨 변경 핸들러
   * 성능 최적화를 위해 줌 레벨을 상태로 관리하여 PC 노드 표시/숨김 제어
   */
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

  /**
   * 뷰포트 변경 핸들러 (NetworkDiagram에서 호출)
   * 스마트 PC 공개 기능에서 화면 중심 계산에 사용되는 뷰포트 정보 수신
   */
  const handleViewportChange = useCallback(
    (vp: ViewportInfo) => {
      updateMultipleStates({
        viewport: vp,
        currentZoomLevel: vp.zoom, // 기존 줌 로직과 동기화
      });
      if (window.location.hostname === "localhost") {
        // console.log(
        //   `[VIEWPORT] zoom=${vp.zoom.toFixed(2)} center=(${Math.round(
        //     vp.centerX
        //   )}, ${Math.round(vp.centerY)})`
        // );
      }
    },
    [updateMultipleStates]
  );

  /**
   * 검색 실행 핸들러 (Enter 키 또는 검색 버튼 클릭 시)
   * executeDeviceSearch 함수를 호출하여 자동 트레이스 실행
   */
  const handleSearchSubmit = useCallback(async () => {
    await executeDeviceSearch(state.searchQuery, state.devices);
  }, [state.searchQuery, state.devices, executeDeviceSearch]);

  /**
   * 장비 노드 클릭 핸들러
   *
   * 동작:
   * 1. 선택된 장비 정보 업데이트
   * 2. 서버가 아닌 경우 자동으로 트레이스 실행
   * 3. 트레이스 결과를 시각화 엣지로 변환하여 표시
   *
   * 주의: 중복 요청 방지를 위한 타임스탬프 검증 포함
   */
  const handleDeviceClick = useCallback(
    async (device: Device) => {
      const callId = Date.now();
      traceTimestampRef.current = callId;

      // 선택 상태 업데이트 및 이전 트레이스 결과 초기화
      updateState("selectedDevice", device);
      updateMultipleStates({
        selectedCable: null,
        traceResult: null,
        traceError: null,
      });

      // 서버는 트레이스 대상이 아님
      if (device.type?.toLowerCase() === "server") {
        updateState("searchError", "서버는 트레이스 대상이 아닙니다.");
        return;
      }

      try {
        const result = await fetchTrace(device.deviceId);

        // 중복 요청 방지: 더 새로운 요청이 있으면 무시
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

  /**
   * 엣지(케이블) 클릭 핸들러
   *
   * 케이블 엣지만 처리하고 트레이스 엣지는 무시
   * 케이블 정보를 사이드 패널에 표시하고 트레이스 모드는 해제
   */
  const handleEdgeClick = useCallback(
    (_: unknown, edge: Edge) => {
      const id = edge.id;

      // 케이블 엣지만 처리 (트레이스 엣지는 무시)
      const isCable = id.startsWith(CABLE_EDGE_PREFIX);
      if (!isCable) return;

      const cableId = id.slice(CABLE_EDGE_PREFIX.length);
      const foundCable = state.cables.find((c) => c.cableId === cableId);

      if (foundCable) {
        updateMultipleStates({
          selectedCable: foundCable,
          selectedDevice: null,
          // 케이블 선택 시 트레이스 시각화는 해제
          traceResult: null,
          traceError: null,
          traceEdges: [],
        });
      }
    },
    [state.cables, updateMultipleStates]
  );

  /**
   * 전체 Ping 실행 핸들러
   *
   * 기능:
   * 1. enablePing=false인 장비들 확인 및 사용자 알림
   * 2. 모든 장비가 비활성화된 경우 실행 중단
   * 3. 일부만 비활성화된 경우 사용자 확인 후 진행
   * 4. Ping 결과로 장비 상태 업데이트
   * 5. 선택된 장비의 선택 상태 유지
   */
  const handlePingAll = useCallback(async () => {
    if (state.isPinging) return;

    // Ping 활성화 상태별 장비 분류
    const offList = state.devices.filter((d) => d.enablePing === false);
    const onList = state.devices.filter((d) => d.enablePing !== false); // undefined는 ON 취급

    // 모든 장비가 비활성화된 경우 경고
    if (onList.length === 0) {
      alert(
        "모든 장비에서 Ping이 비활성화되어 있어 실행할 수 없습니다.\n" +
          "사이드패널의 Enable Ping을 켜거나 [전체 상태] 메뉴에서 '모두 Online + Ping ON'을 사용하세요."
      );
      return;
    }

    // 일부 장비가 비활성화된 경우 사용자 확인
    if (offList.length > 0) {
      const ok = confirm(
        `Ping OFF 장비 ${offList.length}대를 건너뛰고 ` +
          `나머지 ${onList.length}대만 Ping할까요?`
      );
      if (!ok) return;
    }

    updateMultipleStates({ isPinging: true, pingError: null });

    try {
      const pingResults = await pingAllDevices();

      // Ping 결과로 장비 상태 업데이트
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

      // 선택된 장비의 선택 상태 유지
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

  /**
   * 새로고침 핸들러
   * Ping 에러 상태 초기화 후 페이지 전체 새로고침
   */
  const handleRefresh = useCallback(() => {
    updateState("pingError", null);
    window.location.reload();
  }, [updateState]);

  // ────────────────── Effect 훅들 ──────────────────

  /**
   * 레이아웃 결과와 선택된 장비에 따른 노드 선택 상태 동기화
   * 레이아웃이 변경되거나 장비 선택이 변경될 때마다 실행
   */
  useEffect(() => {
    const nodesWithSelection: Node[] = layoutResult.nodes.map((node) => ({
      ...node,
      selected: state.selectedDevice?.deviceId.toString() === node.id,
    }));
    updateState("layoutedNodes", nodesWithSelection);
  }, [layoutResult, state.selectedDevice, updateState]);

  /**
   * 애플리케이션 초기 데이터 로딩
   *
   * 기능:
   * 1. 장비 목록과 케이블 목록을 병렬로 가져오기
   * 2. 컴포넌트 언마운트 시 상태 업데이트 방지 (메모리 누수 방지)
   * 3. 로딩 상태 관리 및 에러 처리
   */
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        // 장비와 케이블 데이터를 병렬로 로딩 (성능 최적화)
        const [deviceData, cableData] = await Promise.all([
          fetchDevices(),
          fetchCables(),
        ]);

        // 컴포넌트가 아직 마운트된 상태에서만 상태 업데이트
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

    // 클린업: 컴포넌트 언마운트 시 상태 업데이트 방지
    return () => {
      isMounted = false;
    };
  }, [updateMultipleStates]);

  // ────────────────── 렌더링 ──────────────────

  // 로딩 상태 처리
  if (state.loading) return <LoadingSpinner />;

  // 에러 상태 처리
  if (state.error)
    return (
      <ErrorState
        message={state.error}
        onRetry={() => window.location.reload()}
      />
    );

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* 상단 제어 패널 */}
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

      {/* Ping 에러 알림 배너 */}
      {state.pingError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-6 mt-2">
          <div className="text-red-700 text-sm">
            <strong>Ping 오류:</strong> {state.pingError}
          </div>
        </div>
      )}

      {/* 검색/트레이스 알림 배너 */}
      {state.searchError && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 mx-6 mt-2">
          <div className="text-amber-800 text-sm">
            <strong>알림:</strong> {state.searchError}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 메인 네트워크 다이어그램 */}
        <div className="flex-1 relative bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
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

          {/* 개발 전용 FPS 오버레이 - 표출 조건: showDebug === true (DEV/localhost)*/}
          {showDebug && (
            <div className="absolute left-3 top-16 z-50 text-xs px-2 py-1 rounded bg-black/60 text-white pointer-events-none">
              FPS: {fps}
            </div>
          )}

          {/* 문제 장비 모드에서 표시할 장비가 없을 때 안내 메시지 */}
          {state.showProblemOnly && finalNodes.length === 0 && (
            <div className="mt-2 mx-2 text-sm bg-white/60 text-rose-700 border border-rose-300 rounded px-3 py-2">
              현재 표시할 <strong>문제 장비</strong>가 없습니다. (Online 외 상태
              없음)
            </div>
          )}

          {/* 장비가 없을 때 안내 메시지 */}
          {state.devices.length === 0 && (
            <div className="mt-6 text-white text-center text-sm bg-black/30 rounded p-2">
              장비가 없습니다. JSON 파일을 업로드해주세요.
            </div>
          )}
        </div>

        {/* 우측 사이드 패널 */}
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
