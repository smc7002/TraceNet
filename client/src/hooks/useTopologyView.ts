// src/hooks/useTopologyView.ts
//
// Purpose:
// - Turn raw devices/cables into the graph the user actually sees.
// - Apply search/problem/trace filters, zoom-based pruning, and a radial layout.
// - Keep things fast with memoized slices and light-weight heuristics.

import { useMemo } from 'react';
import type { Edge, Node } from 'react-flow-renderer';

import type { CableDto } from '../types/cable';
import type { Device } from '../types/device';
import { DeviceStatus } from '../types/status';
import { excludeTraceOverlaps, mapCablesToEdges } from '../utils/edgeMapper';
import { getNewRadialLayoutedElements } from '../utils/layout';
import { alignNodesToCalculatedCenters } from '../utils/nodeCenterCalculator';

// hide PCs when zoomed out; selectively show nearby PCs when zoomed in.
const SMART_PC_RADIUS = 900;          // px radius around the nearest switch
const ZOOM_HIDE_PC = 0.7;             // below this, PCs are hidden
const SMART_PC_ZOOM = ZOOM_HIDE_PC;   // same threshold for "smart" reveal

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
  const {
    devices,
    cables,
    searchQuery,
    showProblemOnly,
    currentZoomLevel,
    traceEdges,
    traceFilterNodes,
    selectedDeviceId,
    viewport,
  } = params;

  // Subset of nodes with issues (used when "problem only" is on).
  const problemVisibleSet = useMemo(() => {
    if (!showProblemOnly) return null;
    const s = new Set<string>();
    for (const d of devices) if (d.status !== DeviceStatus.Online) s.add(String(d.deviceId));
    return s;
  }, [devices, showProblemOnly]);

  // Build all nodes in a neutral position; layout comes later.
  const allNodes: Node[] = useMemo(
    () =>
      devices.map((device) => ({
        id: `${device.deviceId}`,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: device.name,
          type: device.type?.toLowerCase() ?? 'pc',
          status: device.status,
          showLabel: true,
          mode: 'radial',
          // Soft highlight for text/IP matches; strict filtering happens later.
          highlighted:
            !!searchQuery &&
            (device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              device.ipAddress?.includes(searchQuery)),
        },
        selected: selectedDeviceId === String(device.deviceId),
      })),
    [devices, searchQuery, selectedDeviceId],
  );

  // Zoom-based pruning: when zoomed out, hide PCs unless we’re in a focused mode.
  const zoomFilteredNodes = useMemo(() => {
    if (traceFilterNodes || showProblemOnly) return allNodes;
    if (currentZoomLevel < ZOOM_HIDE_PC) {
      return allNodes.filter((n) => ['server', 'switch', 'router'].includes(n.data?.type));
    }
    return allNodes;
  }, [allNodes, currentZoomLevel, traceFilterNodes, showProblemOnly]);

  // Base edges from cables (non-trace). Keep only edges whose endpoints are visible.
  const baseEdges = useMemo(() => mapCablesToEdges(cables, true), [cables]);

  const layoutEdges = useMemo(() => {
    const ids = new Set(zoomFilteredNodes.map((n) => n.id));
    return baseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [baseEdges, zoomFilteredNodes]);

  // Radial layout + post-alignment to calculated centers (keeps the ring centered).
  const layoutedNodes = useMemo(() => {
    const calc = getNewRadialLayoutedElements(zoomFilteredNodes, layoutEdges);
    return alignNodesToCalculatedCenters(calc.nodes, calc.edges).nodes;
  }, [zoomFilteredNodes, layoutEdges]);

  // “Search bubble”: include direct matches and their immediate neighbors via cables.
  const searchVisibleSet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matched = new Set(
      devices
        .filter((d) => d.name.toLowerCase().includes(q) || d.ipAddress?.includes(q))
        .map((d) => String(d.deviceId)),
    );
    // Pull one hop of neighbors to avoid isolated highlights.
    cables.forEach((c) => {
      const a = String(c.fromDeviceId),
        b = String(c.toDeviceId);
      if (matched.has(a)) matched.add(b);
      if (matched.has(b)) matched.add(a);
    });
    return matched;
  }, [searchQuery, devices, cables]);

  // Compose the final node set: apply filters, then optionally reveal nearby PCs.
  const finalNodes = useMemo(() => {
    let nodes = layoutedNodes;

    if (problemVisibleSet) nodes = nodes.filter((n) => problemVisibleSet.has(n.id));
    if (traceFilterNodes) nodes = nodes.filter((n) => traceFilterNodes.has(n.id));
    if (searchVisibleSet) nodes = nodes.filter((n) => searchVisibleSet.has(n.id));

    // Smart PC reveal: when focused (zoomed in, no special filters), show PCs
    // connected to the nearest switch around the viewport center. This keeps the
    // scene readable while still letting users inspect local detail.
    const canSmart =
      !!viewport &&
      Number.isFinite(viewport.centerX) &&
      Number.isFinite(viewport.centerY) &&
      currentZoomLevel >= SMART_PC_ZOOM &&
      !traceFilterNodes &&
      !showProblemOnly &&
      searchQuery.trim() === '';

    if (!canSmart) return nodes;

    // Find the nearest switch to the viewport center.
    const { centerX, centerY } = viewport;
    let nearestSwitch: Node | null = null;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (const n of nodes) {
      if (n.data?.type !== 'switch') continue;
      const dx = (n.position?.x ?? 0) - centerX;
      const dy = (n.position?.y ?? 0) - centerY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        nearestSwitch = n;
      }
    }

    // If no close switch, hide PCs entirely (keep core topology visible).
    const radius2 = SMART_PC_RADIUS * SMART_PC_RADIUS;
    if (!nearestSwitch || bestD2 > radius2) {
      return nodes.filter((n) => n.data?.type !== 'pc');
    }

    // Keep only PCs directly cabled to that switch (1-hop heuristic for speed).
    const switchId = nearestSwitch.id;
    const pcs = new Set<string>();
    for (const c of cables) {
      const a = String(c.fromDeviceId),
        b = String(c.toDeviceId);
      if (a === switchId) pcs.add(b);
      if (b === switchId) pcs.add(a);
    }
    return nodes.filter((n) => (n.data?.type !== 'pc' ? true : pcs.has(n.id)));
  }, [
    layoutedNodes,
    problemVisibleSet,
    traceFilterNodes,
    searchVisibleSet,
    viewport,
    currentZoomLevel,
    showProblemOnly,
    searchQuery,
    cables,
  ]);

  // Final edges: baseline + trace overlay, avoiding double-draw where they overlap.
  const finalEdges = useMemo(() => {
    const ids = new Set(finalNodes.map((n) => n.id));
    const baseFiltered = baseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const traceFiltered = traceEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return [
      ...excludeTraceOverlaps(baseFiltered, traceFiltered),
      ...traceFiltered.map((e) => ({ ...e, id: `trace-${e.id}` })), // unique ids for overlay
    ];
  }, [baseEdges, traceEdges, finalNodes]);

  return { finalNodes, finalEdges };
}
