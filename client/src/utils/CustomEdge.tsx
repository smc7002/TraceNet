/* eslint-disable @typescript-eslint/no-explicit-any */
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
 source,
 target,
}: EdgeProps) {
 // 🎯 React Flow 인스턴스에서 정확한 노드 중심 좌표 계산
 let correctedSourceX = sourceX;
 let correctedSourceY = sourceY;
 let correctedTargetX = targetX;
 let correctedTargetY = targetY;

 try {
   const reactFlowInstance = (window as any).reactFlowInstance;
   if (reactFlowInstance) {
     const sourceNode = reactFlowInstance.getNode(source);
     const targetNode = reactFlowInstance.getNode(target);
     
     if (sourceNode && targetNode) {
       // 📍 정확한 노드 중심점 계산
       correctedSourceX = sourceNode.position.x + (sourceNode.width || 48) / 2;
       correctedSourceY = sourceNode.position.y + (sourceNode.height || 72) / 2;
       correctedTargetX = targetNode.position.x + (targetNode.width || 48) / 2;
       correctedTargetY = targetNode.position.y + (targetNode.height || 72) / 2;
     }
   }
 } catch (error) {
   // React Flow 인스턴스가 없거나 오류 시 원본 좌표 사용
   console.warn("CustomEdge: React Flow 인스턴스 접근 실패, 원본 좌표 사용");
 }

 const curvature = 0.25;
 const controlX = correctedSourceX + (correctedTargetX - correctedSourceX) * curvature;
 const controlY = correctedSourceY + (correctedTargetY - correctedSourceY) * curvature;

 const edgePath = `M${correctedSourceX},${correctedSourceY} Q${controlX},${controlY} ${correctedTargetX},${correctedTargetY}`;

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

