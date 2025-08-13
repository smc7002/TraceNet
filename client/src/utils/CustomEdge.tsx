/* eslint-disable @typescript-eslint/no-explicit-any */
// 📁 client/src/utils/CustomEdge.tsx

import React from "react";
import type { EdgeProps } from "react-flow-renderer";

const DEFAULT_W = 48;
const DEFAULT_H = 72;
//const RADIAL_USE_CURVE = true;

function toNum(v: unknown, fallback: number) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function isTruthyTrace(x: any): boolean {
  return x === true || x === 1 || x === "1" || x === "true";
}

function CustomEdge({
  // id,  // 전역 CSS 충돌 피하려면 사용 안 함
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
  style,
  source,
  target,
}: EdgeProps) {
  // 1) 좌표 보정(가능하면 노드 중심; 실패 시 원본)
  let sx = sourceX, sy = sourceY, tx = targetX, ty = targetY;
  try {
    const inst = (window as any).reactFlowInstance;
    if (inst && typeof inst.getNode === "function") {
      const s = inst.getNode(source);
      const t = inst.getNode(target);
      if (s && t) {
        const sw = s.width ?? DEFAULT_W;
        const sh = s.height ?? DEFAULT_H;
        const tw = t.width ?? DEFAULT_W;
        const th = t.height ?? DEFAULT_H;
        sx = s.position.x + sw / 2;
        sy = s.position.y + sh / 2;
        tx = t.position.x + tw / 2;
        ty = t.position.y + th / 2;
      }
    }
  } catch {
    // 조용히 폴백
  }

  // 2) 모드/스타일 해석 
  const mode = (data?.mode as string) ?? "hierarchical";
  const isTrace = isTruthyTrace(data?.isTrace);
  const baseStroke = toNum((style as any)?.strokeWidth, mode === "radial" ? 2.7 : 2.5);
  const hitStroke = baseStroke + 10;
  const shadowStroke = baseStroke + 2;

  // 3) 곡선 path 
  const curvature = 0.25;
  const cx = sx + (tx - sx) * curvature;
  const cy = sy + (ty - sy) * curvature;
  const edgePath = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;

  // 4) 렌더 
  return (
    <g>
      {/* 그림자 레이어 (방사형 전용) */}
      {mode === "radial" && (
        <path
          d={edgePath}
          stroke="rgba(0, 0, 0, 0.1)"
          strokeWidth={shadowStroke}
          fill="none"
          style={{ filter: "blur(2px)" }}
        />
      )}

      {/* 기본 흰 실선 */}
      <path
        d={edgePath}
        stroke="#ffffff"
        strokeWidth={baseStroke}
        strokeLinecap="round"
        fill="none"
        markerEnd={markerEnd}
        style={{ transition: "stroke 0.3s ease, stroke-width 0.3s ease" }}
      />

      {/* trace 강조(초록 점선 + 애니메이션) */}
      {isTrace && (
        <path
          d={edgePath}
          stroke="#22c55e"
          strokeWidth={2.5}
          strokeDasharray="10 6"
          strokeLinecap="round"
          fill="none"
          strokeOpacity={0.9}
          style={{
            animation: "dash-flow 2s linear infinite",
            filter: "drop-shadow(0 0 3px rgba(34, 197, 94, 0.5))",
          }}
        />
      )}

      {/* 클릭 히트영역(투명) */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={hitStroke}
        fill="none"
        cursor="pointer"
        pointerEvents="stroke"
      />
    </g>
  );
}

export default React.memo(CustomEdge);
