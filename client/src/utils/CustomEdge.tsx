// 📁 client/src/utils/CustomEdge.tsx

import React from "react";
import type { EdgeProps } from "react-flow-renderer";

function CustomEdge({
  //id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
  style,
}: EdgeProps) {
  const curvature = 0.25;
  const controlX = sourceX + (targetX - sourceX) * curvature;
  const controlY = sourceY + (targetY - sourceY) * curvature;

  const edgePath = `M${sourceX},${sourceY} Q${controlX},${controlY} ${targetX},${targetY}`;

  const mode = data?.mode ?? "hierarchical";
  const isTrace = data?.isTrace ?? false;

  const { strokeWidth = mode === "radial" ? 2.7 : 2.5 } = style ?? {};

  return (
    <g>
      {/* 그림자 레이어 (방사형 전용) */}
      {mode === "radial" && (
        <path
          d={edgePath}
          stroke="rgba(0, 0, 0, 0.1)"
          strokeWidth={
            typeof strokeWidth === "number"
              ? strokeWidth + 2
              : parseFloat(strokeWidth) + 2
          }
          fill="none"
          style={{ filter: "blur(2px)" }}
        />
      )}

      {/* 1. 기본 흰 실선 */}
      <path
        d={edgePath}
        stroke="#ffffff"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        markerEnd={markerEnd}
        style={{
          transition: "stroke 0.3s ease, stroke-width 0.3s ease",
        }}
      />

      {/* 2. trace 강조용 초록 점선 + 애니메이션 */}
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

      {/* 클릭 영역 확장용 투명 path */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={
          typeof strokeWidth === "number"
            ? strokeWidth + 10
            : parseFloat(strokeWidth) + 10
        }
        fill="none"
        cursor="pointer"
        pointerEvents="stroke"
      />
    </g>
  );
}

export default React.memo(CustomEdge);
