import { getBezierPath } from "react-flow-renderer";
import type { EdgeProps } from "react-flow-renderer";

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  console.log("🧪 CustomEdge 위치 좌표", { sourceX, sourceY, targetX, targetY });

  if (!edgePath || edgePath === "") {
    console.warn("❌ 잘못된 edgePath", { sourceX, sourceY, targetX, targetY });
  }

  return (
    <path
      id={id}
      d={edgePath}
      stroke="#000" // ✅ 명시적으로 검정 지정
      strokeWidth={2.5} // ✅ 명시적으로 두께 지정
      fill="none"
      markerEnd={markerEnd}
      cursor="pointer" // ✅ 스타일 속성이 아닌 속성으로 지정
    />
  );
}
