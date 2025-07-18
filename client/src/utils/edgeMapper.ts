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
    target: cable.toDeviceId.toString(),
    style: {
      stroke: "#000",       // ✅ 검정색 선
      strokeWidth: 2.2,     // ✅ 선 두께 약간 증가 (기존 1 → 2.2)
    },
    label: cable.description ?? "",
    labelStyle: {
      fontSize: 10,
      fontWeight: 500,
      transform: "translateY(-8px)",
    },
    //labelPosition: "top",
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
