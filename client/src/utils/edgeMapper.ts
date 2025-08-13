// 📁 src/utils/edgeMapper.ts
import type { Edge } from "react-flow-renderer";
import type { CableDto } from "../types/cable";
import type { CableEdge } from "../types/trace";

export const CABLE_EDGE_PREFIX = "cable-";

/* ---------------- helpers ---------------- */

function undirectedKey(a: number | string, b: number | string) {
  const A = String(a);
  const B = String(b);
  return A < B ? `${A}-${B}` : `${B}-${A}`;
}
const S = (v: number | string) => String(v);
const toNum = (v: number | string) => (typeof v === "number" ? v : Number(v));

/* -------- accept legacy PascalCase inputs (defensive) -------- */

interface LegacyCableDto {
  CableId: string | number;
  FromDeviceId: number | string;
  ToDeviceId: number | string;
  Description?: string;
}
interface LegacyCableEdge {
  CableId: string | number;
  FromDeviceId: number | string;
  ToDeviceId: number | string;
  FromPortId: number | string;
  ToPortId: number | string;
}

/** inputs we accept */
type CableDtoInput = CableDto | LegacyCableDto;
type CableEdgeInput = CableEdge | LegacyCableEdge;

/** normalized shapes used internally */
interface NormalizedCableDto {
  cableId: string;
  fromDeviceId: number;
  toDeviceId: number;
  description?: string;
}
interface NormalizedCableEdge {
  cableId: string;
  fromDeviceId: number;
  toDeviceId: number;
  fromPortId: number;
  toPortId: number;
}

function normalizeCableDto(c: CableDtoInput): NormalizedCableDto {
  if ("fromDeviceId" in c) {
    return {
      cableId: S(c.cableId),
      fromDeviceId: toNum(c.fromDeviceId),
      toDeviceId: toNum(c.toDeviceId),
      description: c.description,
    };
  }
  return {
    cableId: S(c.CableId),
    fromDeviceId: toNum(c.FromDeviceId),
    toDeviceId: toNum(c.ToDeviceId),
    description: c.Description,
  };
}

function normalizeCableEdge(e: CableEdgeInput): NormalizedCableEdge {
  if ("fromPortId" in e) {
    return {
      cableId: S(e.cableId),
      fromDeviceId: toNum(e.fromDeviceId),
      toDeviceId: toNum(e.toDeviceId),
      fromPortId: toNum(e.fromPortId),
      toPortId: toNum(e.toPortId),
    };
  }
  return {
    cableId: S(e.CableId),
    fromDeviceId: toNum(e.FromDeviceId),
    toDeviceId: toNum(e.ToDeviceId),
    fromPortId: toNum(e.FromPortId),
    toPortId: toNum(e.ToPortId),
  };
}

/* ---------------- base edges ---------------- */

export function mapCablesToEdges(cables: CableDtoInput[], isRadial: boolean): Edge[] {
  if (!Array.isArray(cables)) return [];

  return cables.map((raw) => {
    const c = normalizeCableDto(raw);
    const sourceId = S(c.fromDeviceId);
    const targetId = S(c.toDeviceId);

    const base: Edge = {
      id: `${CABLE_EDGE_PREFIX}${c.cableId}`,
      source: sourceId,
      target: targetId,
      type: isRadial ? "custom" : "default",
      style: isRadial ? undefined : { stroke: "#000", strokeWidth: 2.2 },
      label: c.description ?? "",
      labelStyle: {
        fontSize: 10,
        fontWeight: 500,
        transform: "translateY(-8px)",
        pointerEvents: "none",
      },
      data: {
        key: undirectedKey(sourceId, targetId),
        mode: isRadial ? "radial" : "hierarchical",
        cableId: c.cableId,
        fromDeviceId: sourceId,
        toDeviceId: targetId,
      },
    };

    return isRadial
      ? base
      : { ...base, sourceHandle: "source", targetHandle: "target" };
  });
}

/* ---------------- trace edges ---------------- */
/** return WITHOUT 'trace-' prefix; MainPage에서 최종 prefix 부여 */
export function mapTraceCablesToEdges(
  cables: CableEdgeInput[],
  timestamp: number,
  opts?: { mode?: "radial" | "hierarchical" }
): Edge[] {
  const mode = opts?.mode ?? "radial";

  return (cables ?? []).map((raw, index) => {
    const c = normalizeCableEdge(raw);
    const fromId = S(c.fromDeviceId);
    const toId = S(c.toDeviceId);

    return {
      id: `${c.cableId}-${c.fromPortId}-${c.toPortId}-${timestamp}-${index}`,
      source: fromId,
      target: toId,
      type: "custom",
      style: { stroke: "#10b981", strokeDasharray: "5 5", strokeWidth: 2 },
      label: `${fromId} → ${toId}`,
      animated: true,
      data: {
        key: undirectedKey(fromId, toId),
        isTrace: true,
        mode,
        cableId: c.cableId,
        fromDeviceId: fromId,
        toDeviceId: toId,
        fromPortId: S(c.fromPortId),
        toPortId: S(c.toPortId),
      },
    };
  });
}

/* ---------------- overlap filter ---------------- */
/** prefer cableId match; fallback to undirected from-to key */
export function excludeTraceOverlaps(baseEdges: Edge[], traceEdges: Edge[]): Edge[] {
  const traceCableIds = new Set<string>();
  const traceKeys = new Set<string>();

  for (const te of traceEdges) {
    const d = te.data as Record<string, unknown> | undefined;
    const cid = typeof d?.cableId === "string" ? d.cableId : undefined;
    const k = typeof d?.key === "string" ? d.key : undefined;
    if (cid) traceCableIds.add(cid);
    if (k) traceKeys.add(k);
  }

  return baseEdges.filter((be) => {
    const d = be.data as Record<string, unknown> | undefined;
    const baseCid = typeof d?.cableId === "string" ? d.cableId : undefined;
    if (baseCid && traceCableIds.has(baseCid)) return false;
    const baseKey = typeof d?.key === "string" ? d.key : undefined;
    if (baseKey && traceKeys.has(baseKey)) return false;
    return true;
  });
}
