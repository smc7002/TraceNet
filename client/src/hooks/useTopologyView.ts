// src/hooks/useTopologyView.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import type { Node, Edge } from "react-flow-renderer";
import { mapCablesToEdges, excludeTraceOverlaps } from "../utils/edgeMapper";
import { getNewRadialLayoutedElements } from "../utils/layout";
import { alignNodesToCalculatedCenters } from "../utils/nodeCenterCalculator";
import { DeviceStatus } from "../types/status";
import type { Device } from "../types/device";
import type { CableDto } from "../types/cable";

const SMART_PC_RADIUS = 900;
const ZOOM_HIDE_PC = 0.7;
const SMART_PC_ZOOM = ZOOM_HIDE_PC;

export function useTopologyView(params: {
  devices: Device[];
  cables: CableDto[];
  searchQuery: string;
  showProblemOnly: boolean;
  currentZoomLevel: number;
  traceEdges: Edge[];
  traceFilterNodes: Set<string> | null;
  selectedDeviceId: string | null;
  viewport: { centerX: number; centerY: number } | null;
}) {
  const { devices, cables, searchQuery, showProblemOnly, currentZoomLevel, traceEdges, traceFilterNodes, selectedDeviceId, viewport } = params;

  // 문제 장비 Set
  const problemVisibleSet = useMemo(() => {
    if (!showProblemOnly) return null;
    const s = new Set<string>();
    for (const d of devices) if (d.status !== DeviceStatus.Online) s.add(String(d.deviceId));
    return s;
  }, [devices, showProblemOnly]);

  // 모든 노드
  const allNodes: Node[] = useMemo(() => devices.map(device => ({
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
        !!searchQuery &&
        (device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         device.ipAddress?.includes(searchQuery)),
    },
    selected: selectedDeviceId === String(device.deviceId),
  })), [devices, searchQuery, selectedDeviceId]);

  // 줌 기반 필터
  const zoomFilteredNodes = useMemo(() => {
    if (traceFilterNodes || showProblemOnly) return allNodes;
    if (currentZoomLevel < ZOOM_HIDE_PC) {
      return allNodes.filter(n => ["server", "switch", "router"].includes(n.data?.type));
    }
    return allNodes;
  }, [allNodes, currentZoomLevel, traceFilterNodes, showProblemOnly]);

  const baseEdges = useMemo(() => mapCablesToEdges(cables, true), [cables]);

  const layoutEdges = useMemo(() => {
    const ids = new Set(zoomFilteredNodes.map(n => n.id));
    return baseEdges.filter(e => ids.has(e.source) && ids.has(e.target));
  }, [baseEdges, zoomFilteredNodes]);

  // 레이아웃 + 중심 보정
  const layoutedNodes = useMemo(() => {
    const calc = getNewRadialLayoutedElements(zoomFilteredNodes, layoutEdges);
    return alignNodesToCalculatedCenters(calc.nodes, calc.edges).nodes;
  }, [zoomFilteredNodes, layoutEdges]);

  // 검색 보조 세트
  const searchVisibleSet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matched = new Set(
      devices
        .filter(d => d.name.toLowerCase().includes(q) || d.ipAddress?.includes(q))
        .map(d => String(d.deviceId))
    );
    cables.forEach(c => {
      const a = String(c.fromDeviceId), b = String(c.toDeviceId);
      if (matched.has(a)) matched.add(b);
      if (matched.has(b)) matched.add(a);
    });
    return matched;
  }, [searchQuery, devices, cables]);

  // 최종 노드
  const finalNodes = useMemo(() => {
    let nodes = layoutedNodes;

    if (problemVisibleSet) nodes = nodes.filter(n => problemVisibleSet.has(n.id));
    if (traceFilterNodes) nodes = nodes.filter(n => traceFilterNodes.has(n.id));
    if (searchVisibleSet) nodes = nodes.filter(n => searchVisibleSet.has(n.id));

    const canSmart =
      !!viewport &&
      Number.isFinite(viewport.centerX) && Number.isFinite(viewport.centerY) &&
      currentZoomLevel >= SMART_PC_ZOOM &&
      !traceFilterNodes && !showProblemOnly && searchQuery.trim() === "";

    if (!canSmart) return nodes;

    // 스마트 PC 공개: 중심 근처 스위치 기준 반경 내 PC만
    const { centerX, centerY } = viewport;
    let nearestSwitch: Node | null = null;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (const n of nodes) {
      if (n.data?.type !== "switch") continue;
      const dx = (n.position?.x ?? 0) - centerX;
      const dy = (n.position?.y ?? 0) - centerY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; nearestSwitch = n; }
    }
    const radius2 = SMART_PC_RADIUS * SMART_PC_RADIUS;
    if (!nearestSwitch || bestD2 > radius2) {
      return nodes.filter(n => n.data?.type !== "pc");
    }

    // 연결 PC만 남기는 간단 버전: 케이블 기반 필터 (성능 위해 근사치)
    const switchId = nearestSwitch.id;
    const pcs = new Set<string>();
    for (const c of cables) {
      const a = String(c.fromDeviceId), b = String(c.toDeviceId);
      if (a === switchId) pcs.add(b);
      if (b === switchId) pcs.add(a);
    }
    return nodes.filter(n => n.data?.type !== "pc" ? true : pcs.has(n.id));
  }, [
    layoutedNodes, problemVisibleSet, traceFilterNodes, searchVisibleSet,
    viewport, currentZoomLevel, showProblemOnly, searchQuery, cables
  ]);

  // 최종 엣지
  const finalEdges = useMemo(() => {
    const ids = new Set(finalNodes.map(n => n.id));
    const baseFiltered = baseEdges.filter(e => ids.has(e.source) && ids.has(e.target));
    const traceFiltered = traceEdges.filter(e => ids.has(e.source) && ids.has(e.target));
    return [...excludeTraceOverlaps(baseFiltered, traceFiltered),
            ...traceFiltered.map(e => ({ ...e, id: `trace-${e.id}` }))];
  }, [baseEdges, traceEdges, finalNodes]);

  return { finalNodes, finalEdges };
}
