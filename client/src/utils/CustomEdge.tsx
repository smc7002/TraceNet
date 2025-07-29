// 📁 client/src/utils/CustomEdge.tsx

import React from "react";
import { getBezierPath } from "react-flow-renderer";
import type { EdgeProps } from "react-flow-renderer";

/**
 * CustomEdge Component
 *
 * 네트워크 다이어그램에서 노드 간 연결을 시각화하는 커스텀 엣지 컴포넌트입니다.
 * React Flow의 기본 엣지를 확장하여 네트워크 토폴로지 특성에 맞는
 * 시각적 스타일링과 레이아웃별 차별화된 렌더링을 제공합니다.
 *
 * @component
 * @version 1.1.0
 */
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
  console.log("🟣 [CustomEdge] called for edge:", id);

  // 좌표 유효성 검사
  const valid =
    typeof sourceX === "number" &&
    typeof sourceY === "number" &&
    typeof targetX === "number" &&
    typeof targetY === "number";

  if (!valid) {
    console.warn("❌ CustomEdge: invalid coordinates", {
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
    return null;
  }

  // SVG path 생성
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY });

  console.log("🧪 getBezierPath result", {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    edgePath,
    isEdgePathValid: edgePath?.startsWith?.("M"),
  });

  // 🔒 path 유효성 방어 처리
  if (!edgePath || typeof edgePath !== "string" || !edgePath.startsWith("M")) {
    console.warn("❌ INVALID SVG PATH, SKIP RENDERING", {
      id,
      edgePath,
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
    return null;
  }

  // 🔍 path 유효성 확인
  const isValidNum = (v: unknown): v is number =>
    typeof v === "number" && !isNaN(v);

  if (
    !edgePath ||
    !edgePath.startsWith("M") ||
    !isValidNum(sourceX) ||
    !isValidNum(sourceY) ||
    !isValidNum(targetX) ||
    !isValidNum(targetY)
  ) {
    console.warn("❌ CustomEdge path malformed", {
      id,
      sourceX,
      sourceY,
      targetX,
      targetY,
      edgePath,
    });
  }

  console.warn("🎯 CustomEdge path:", {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    edgePath,
  });

  // 레이아웃 모드 판별
  const mode = data?.mode ?? "hierarchical";

  // 스타일 병합 (props.style 우선 적용)
  const {
    stroke = mode === "radial" ? "#fff" : "#000",
    strokeWidth = mode === "radial" ? 2 : 2.5,
    strokeDasharray = mode === "radial" ? "4 4" : undefined,
  } = style ?? {};

console.log("✅ [CustomEdge] rendering path:", {
    id,
    stroke,
    strokeWidth,
    edgePath,
  });

  // 최종 SVG path 렌더링
  return (
    <path
      id={id}
      d={edgePath}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      fill="none"
      markerEnd={markerEnd}
      cursor="pointer"
      style={{ zIndex: 1000 }}
    />
  );
}

export default React.memo(CustomEdge);
