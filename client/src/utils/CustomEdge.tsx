// CustomEdge.tsx
import React from "react";
import type { EdgeProps } from "react-flow-renderer";

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
  style,
}: EdgeProps) {
  // 베지어 곡선을 위한 제어점 계산
  const curvature = 0.25;
  const controlX = sourceX + (targetX - sourceX) * curvature;
  const controlY = sourceY + (targetY - sourceY) * curvature;

  const edgePath = `M${sourceX},${sourceY} Q${controlX},${controlY} ${targetX},${targetY}`;

  const mode = data?.mode ?? "hierarchical";
  const isTrace = data?.isTrace ?? false; // 트레이스 엣지인지 확인

  // 스타일 설정
  const {
    stroke = mode === "radial" ? (isTrace ? "#10b981" : "#ffffff") : "#000000",
    strokeWidth = mode === "radial" ? 1.5 : 2.5,
    strokeDasharray = isTrace ? "5 5" : undefined,
  } = style ?? {};

  // strokeWidth를 string으로 변환

  return (
    <g>
      {/* 그림자 효과 (radial 모드에서만) */}
      {mode === "radial" && (
        <path
          d={edgePath}
          stroke="rgba(0, 0, 0, 0.1)"
          strokeWidth={typeof strokeWidth === "number" ? strokeWidth + 2 : parseFloat(strokeWidth) + 2}
          fill="none"
          style={{
            filter: "blur(2px)",
          }}
        />
      )}

      {/* 실제 경로 */}
      <path
        id={id}
        d={edgePath}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
        markerEnd={markerEnd}
        cursor="pointer"
        style={{
          transition: "stroke 0.3s ease, stroke-width 0.3s ease",
          ...(isTrace && { animation: "dash 20s linear infinite" }),
        }}
      />

      {/* 호버 감지용 투명 경로 (더 쉽게 클릭하도록) */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={typeof strokeWidth === "number" ? strokeWidth + 10 : parseFloat(strokeWidth) + 10}
        fill="none"
        cursor="pointer"
        pointerEvents="stroke"
      />
    </g>
  );
}

export default React.memo(CustomEdge);
