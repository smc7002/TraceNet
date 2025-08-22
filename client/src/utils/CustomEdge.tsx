/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @fileoverview 네트워크 다이어그램 커스텀 연결선 컴포넌트
 * @description React Flow용 케이블/연결 관계를 시각화하는 Edge 컴포넌트
 */

import React from "react";
import type { EdgeProps } from "react-flow-renderer";

// 노드 기본 크기 상수 (실제 노드 크기를 가져올 수 없을 때 사용)
const DEFAULT_W = 48;
const DEFAULT_H = 72;

/**
 * 값을 숫자로 안전하게 변환
 * @param v 변환할 값
 * @param fallback 변환 실패 시 기본값
 */
function toNum(v: unknown, fallback: number) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * trace 상태 여부를 판정 (다양한 타입 허용)
 * @param x 체크할 값
 * @returns true면 trace 경로임
 */
function isTruthyTrace(x: any): boolean {
  return x === true || x === 1 || x === "1" || x === "true";
}

/**
 * 네트워크 연결선을 렌더링하는 커스텀 Edge 컴포넌트
 * 
 * @description
 * - 기본 케이블: 흰색 실선
 * - 추적 경로: 초록색 점선 + 애니메이션
 * - 방사형 모드: 그림자 효과 추가
 * - 히트 영역: 클릭하기 쉽도록 투명한 넓은 영역
 * 
 * @param props React Flow EdgeProps
 */
function CustomEdge({
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
  
  // 1) 노드 중심점 기반 좌표 보정
  // React Flow 기본 좌표는 노드 가장자리라서 부정확할 수 있음
  let sx = sourceX, sy = sourceY, tx = targetX, ty = targetY;
  
  try {
    // 전역 React Flow 인스턴스에서 노드 정보 가져오기
    const inst = (window as any).reactFlowInstance;
    if (inst && typeof inst.getNode === "function") {
      const s = inst.getNode(source);
      const t = inst.getNode(target);
      
      if (s && t) {
        // 노드 크기 가져와서 중심점 계산
        const sw = s.width ?? DEFAULT_W;
        const sh = s.height ?? DEFAULT_H;
        const tw = t.width ?? DEFAULT_W;
        const th = t.height ?? DEFAULT_H;
        
        // 노드 중심점으로 좌표 수정
        sx = s.position.x + sw / 2;
        sy = s.position.y + sh / 2;
        tx = t.position.x + tw / 2;
        ty = t.position.y + th / 2;
      }
    }
  } catch {
    // 실패 시 원본 좌표 사용 (조용히 폴백)
  }

  // 2) 스타일 설정 해석
  const mode = (data?.mode as string) ?? "hierarchical";
  const isTrace = isTruthyTrace(data?.isTrace);
  
  // 선 굵기 (방사형일 때 조금 더 굵게)
  const baseStroke = toNum((style as any)?.strokeWidth, mode === "radial" ? 2.7 : 2.5);
  const hitStroke = baseStroke + 10;      // 클릭 영역 (더 넓게)
  const shadowStroke = baseStroke + 2;    // 그림자 (조금 더 굵게)

  // 3) 곡선 경로 생성 (SVG quadratic curve)
  const curvature = 0.25;  // 곡률 (0이면 직선, 1이면 완전한 곡선)
  const cx = sx + (tx - sx) * curvature;
  const cy = sy + (ty - sy) * curvature;
  const edgePath = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;

  // 4) SVG 렌더링 (레이어 순서 중요!)
  return (
    <g>
      {/* 그림자 효과 (방사형 모드에서만) */}
      {mode === "radial" && (
        <path
          d={edgePath}
          stroke="rgba(0, 0, 0, 0.1)"
          strokeWidth={shadowStroke}
          fill="none"
          style={{ filter: "blur(2px)" }}
        />
      )}

      {/* 기본 케이블 라인 (흰색 실선) */}
      <path
        d={edgePath}
        stroke="#ffffff"
        strokeWidth={baseStroke}
        strokeLinecap="round"
        fill="none"
        markerEnd={markerEnd}
        style={{ transition: "stroke 0.3s ease, stroke-width 0.3s ease" }}
      />

      {/* 추적 경로 강조 (초록색 점선 + 흐르는 애니메이션) */}
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

      {/* 클릭 히트 영역 (투명하고 넓음) */}
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

// React.memo로 성능 최적화 (props 변경시만 리렌더링)
export default React.memo(CustomEdge);

/**
 * CSS 애니메이션 (global.css에 추가 필요)
 * 
 * @keyframes dash-flow {
 *   0% { stroke-dashoffset: 0; }
 *   100% { stroke-dashoffset: -16; }
 * }
 */