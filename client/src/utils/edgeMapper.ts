// 📁 src/utils/edgeMapper.ts
import type { Edge } from "react-flow-renderer";
import type { CableDto } from "../types/cable";
import type { CableEdge } from "../types/trace";

// 전체 케이블 → Edge 변환 (회색)
export function mapCablesToEdges(cables: CableDto[]): Edge[] {
  if (!Array.isArray(cables)) return []; 

  return cables.map((cable) => ({
    id: `cable-${cable.cableId}`,
    source: cable.fromDeviceId.toString(),
    target: cable.toDevice.toString(),
    style: { stroke: "#aaa", strokeWidth: 1 },
    label: cable.description ?? "",
  }));
}

// Trace 강조 케이블 → Edge 변환 (초록색 + 애니메이션)
export function mapTraceCablesToEdges(cables: CableEdge[]): Edge[] {
  return cables.map((cable) => ({
    id: `trace-${cable.cableId}`,
    source: cable.fromDeviceId.toString(),
    target: cable.toDeviceId.toString(),
    animated: true,
    style: { stroke: "lime", strokeWidth: 2 },
  }));
}
