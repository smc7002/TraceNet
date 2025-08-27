// src/hooks/useSearchTrace.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef } from "react";
import { fetchTrace } from "../api/traceApi";
import type { Device } from "../types/device";
import { mapTraceCablesToEdges } from "../utils/edgeMapper";
import type { Edge } from "react-flow-renderer";
import type { TraceResponse } from "../types/trace";

export type SearchTraceState = {
  searchError?: string;
  traceResult: TraceResponse | null;
  traceEdges: Edge[];
  traceFilterNodes: Set<string> | null;
};

export function useSearchTrace(
  getDevices: () => Device[],
  setState: (patch: Partial<SearchTraceState>) => void
) {
  const traceTimestampRef = useRef<number>(0);

  const executeDeviceSearch = useCallback(async (query: string) => {
    const devices = getDevices();
    const trimmed = query.trim();
    if (!trimmed) {
      setState({ traceFilterNodes: null, traceEdges: [], traceResult: null, searchError: undefined });
      return;
    }

    const matched = devices.find(
      d => d.name.toLowerCase() === trimmed.toLowerCase() || d.ipAddress?.trim() === trimmed
    );
    if (!matched) {
      setState({ traceFilterNodes: null, traceEdges: [], traceResult: null, searchError: `'${trimmed}' 장비를 찾을 수 없습니다.` });
      return;
    }

    const callId = Date.now();
    traceTimestampRef.current = callId;
    try {
      const result = await fetchTrace(matched.deviceId);
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
      nodeIds.add(String(matched.deviceId));

      setState({
        traceFilterNodes: nodeIds,
        traceEdges: mapTraceCablesToEdges(result.cables ?? [], Date.now()),
        traceResult: result,
        searchError: undefined,
      });
    } catch {
      setState({ traceFilterNodes: null, traceEdges: [], traceResult: null, searchError: "Trace 정보를 불러오지 못했습니다." });
    }
  }, [getDevices, setState]);

  const runTraceForDevice = useCallback(async (device: Device) => {
    const callId = Date.now();
    traceTimestampRef.current = callId;

    if (device.type?.toLowerCase() === "server") {
      setState({ searchError: "서버는 트레이스 대상이 아닙니다." });
      return;
    }

    try {
      const result = await fetchTrace(device.deviceId);
      if (traceTimestampRef.current !== callId) return;
      const traceEdges = mapTraceCablesToEdges(result.cables ?? [], Date.now());
      setState({ traceEdges, traceResult: result, searchError: undefined });
    } catch (err) {
      setState({ traceResult: null, traceEdges: [], searchError: (err instanceof Error ? err.message : "트레이스 로드 실패") });
    }
  }, [setState]);

  const clearTrace = useCallback(() => {
    setState({ traceResult: null, traceEdges: [], traceFilterNodes: null, searchError: undefined });
  }, [setState]);

  return { executeDeviceSearch, runTraceForDevice, clearTrace };
}
