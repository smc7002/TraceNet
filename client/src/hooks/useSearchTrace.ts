// src/hooks/useSearchTrace.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef } from 'react';
import type { Edge } from 'react-flow-renderer';

import { fetchTrace } from '../api/traceApi';
import type { Device } from '../types/device';
import type { TraceResponse } from '../types/trace';
import { mapTraceCablesToEdges } from '../utils/edgeMapper';

export type SearchTraceState = {
  // Message shown near the search box (kept in KR as authored).
  searchError?: string;
  // Raw trace payload for detail panes.
  traceResult: TraceResponse | null;
  // Edges that highlight traced cables.
  traceEdges: Edge[];
  // Nodes to spotlight (null = no filter). 
  traceFilterNodes: Set<string> | null;
};

/**
 * Returns helpers to:
 * - executeDeviceSearch(query)
 * - runTraceForDevice(device)
 * - clearTrace()
 */
export function useSearchTrace(
  getDevices: () => Device[],
  setState: (patch: Partial<SearchTraceState>) => void,
) {
  /** Drop stale async results; only the most recent callId wins. */
  const traceTimestampRef = useRef<number>(0);

  /** Find by exact name (ci) or exact IP; empty query clears overlays. */
  const executeDeviceSearch = useCallback(
    async (query: string) => {
      const devices = getDevices();
      const trimmed = query.trim();

      // Empty → clear and bail
      if (!trimmed) {
        setState({ traceFilterNodes: null, traceEdges: [], traceResult: null, searchError: undefined });
        return;
      }

      // Resolve device
      const matched = devices.find(
        (d) => d.name.toLowerCase() === trimmed.toLowerCase() || d.ipAddress?.trim() === trimmed,
      );

      if (!matched) {
        setState({
          traceFilterNodes: null,
          traceEdges: [],
          traceResult: null,
          searchError: `'${trimmed}' 장비를 찾을 수 없습니다.`,
        });
        return;
      }

      // Race guard
      const callId = Date.now();
      traceTimestampRef.current = callId;

      try {
        const result = await fetchTrace(matched.deviceId);
        if (traceTimestampRef.current !== callId) return;

        // Collect node ids from path/cables (API fields may vary in casing)
        const nodeIds = new Set<string>();

        // Build the set of device IDs that appear in the traced path.
        // Note: API fields may come in camelCase or PascalCase — check both.
        // Cast to string to match React Flow node IDs; Set handles de-duplication.
        if (Array.isArray(result.path)) {
          for (const hop of result.path) {
            const fromId = (hop as any).fromDeviceId ?? (hop as any).FromDeviceId;
            const toId = (hop as any).toDeviceId ?? (hop as any).ToDeviceId;
            if (fromId != null) nodeIds.add(String(fromId));
            if (toId != null) nodeIds.add(String(toId));
          }
        }

        // Include endpoints from cable data as well; in some payloads,
        // cables can cover nodes not listed in `path`
        if (Array.isArray(result.cables)) {
          for (const cable of result.cables) {
            const fromId = (cable as any).fromDeviceId ?? (cable as any).FromDeviceId;
            const toId = (cable as any).toDeviceId ?? (cable as any).ToDeviceId;
            if (fromId != null) nodeIds.add(String(fromId));
            if (toId != null) nodeIds.add(String(toId));
          }
        }

        // Always include the source device
        nodeIds.add(String(matched.deviceId));

        // Commit overlays + payload
        setState({
          traceFilterNodes: nodeIds,
          traceEdges: mapTraceCablesToEdges(result.cables ?? [], Date.now()),
          traceResult: result,
          searchError: undefined,
        });
      } catch {
        // Keep original KR copy
        setState({
          traceFilterNodes: null,
          traceEdges: [],
          traceResult: null,
          searchError: 'Trace 정보를 불러오지 못했습니다.',
        });
      }
    },
    [getDevices, setState],
  );

  /** Run trace for a clicked node; we don’t trace from servers (product rule). */
  const runTraceForDevice = useCallback(
    async (device: Device) => {
      const callId = Date.now();
      traceTimestampRef.current = callId;

      if (device.type?.toLowerCase() === 'server') {
        setState({ searchError: '서버는 트레이스 대상이 아닙니다.' });
        return;
      }

      try {
        const result = await fetchTrace(device.deviceId);
        if (traceTimestampRef.current !== callId) return;

        const traceEdges = mapTraceCablesToEdges(result.cables ?? [], Date.now());
        setState({ traceEdges, traceResult: result, searchError: undefined });
      } catch (err) {
        setState({
          traceResult: null,
          traceEdges: [],
          searchError: err instanceof Error ? err.message : '트레이스 로드 실패',
        });
      }
    },
    [setState],
  );

  /** Clear overlays + filter + error. */
  const clearTrace = useCallback(() => {
    setState({ traceResult: null, traceEdges: [], traceFilterNodes: null, searchError: undefined });
  }, [setState]);

  return { executeDeviceSearch, runTraceForDevice, clearTrace };
}
