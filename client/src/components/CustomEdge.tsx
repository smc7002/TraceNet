/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @fileoverview Custom edge component for the network diagram
 * @description React Flow Edge that visualizes cable/connection relationships
 */

import React from 'react';
import type { EdgeProps } from 'react-flow-renderer';

// Fallback node size constants (used when actual node size can't be retrieved)
const DEFAULT_W = 48;
const DEFAULT_H = 72;

/**
 * Safely convert a value to a number
 * @param v value to convert
 * @param fallback default value when conversion fails
 */
function toNum(v: unknown, fallback: number) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * Determine whether a value indicates a "trace" state (accepts multiple types)
 * @param x value to check
 * @returns true if this edge is a trace path
 */
function isTruthyTrace(x: any): boolean {
  return x === true || x === 1 || x === '1' || x === 'true';
}

/**
 * Custom Edge component that renders a network connection line
 *
 * @description
 * - Base cable: white solid line
 * - Trace path: green dashed line with animation
 * - Radial mode: adds a soft shadow for depth
 * - Hit area: wide transparent stroke to make clicking easier
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
  // 1) Adjust coordinates to node centers
  // React Flow provides edge anchors at the node boundary by default, which can be imprecise
  let sx = sourceX,
    sy = sourceY,
    tx = targetX,
    ty = targetY;

  try {
    // Try to retrieve node details from a global React Flow instance
    const inst = (window as any).reactFlowInstance;
    if (inst && typeof inst.getNode === 'function') {
      const s = inst.getNode(source);
      const t = inst.getNode(target);

      if (s && t) {
        // Compute centers using node sizes
        const sw = s.width ?? DEFAULT_W;
        const sh = s.height ?? DEFAULT_H;
        const tw = t.width ?? DEFAULT_W;
        const th = t.height ?? DEFAULT_H;

        // Shift coordinates to the node centers
        sx = s.position.x + sw / 2;
        sy = s.position.y + sh / 2;
        tx = t.position.x + tw / 2;
        ty = t.position.y + th / 2;
      }
    }
  } catch {
    // If anything fails, silently fall back to the original coordinates
  }

  // 2) Interpret styling options
  const mode = (data?.mode as string) ?? 'hierarchical';
  const isTrace = isTruthyTrace(data?.isTrace);

  // Stroke widths (slightly thicker in radial mode)
  const baseStroke = toNum((style as any)?.strokeWidth, mode === 'radial' ? 2.7 : 2.5);
  const hitStroke = baseStroke + 10;   // click target (wide)
  const shadowStroke = baseStroke + 2; // subtle shadow thickness

  // 3) Build a quadratic Bezier path (SVG)
  const curvature = 0.25; // 0 = straight line, 1 = strong curve
  const cx = sx + (tx - sx) * curvature;
  const cy = sy + (ty - sy) * curvature;
  const edgePath = `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;

  // 4) Render SVG (layer order matters!)
  return (
    <g>
      {/* Soft shadow (radial mode only) */}
      {mode === 'radial' && (
        <path
          d={edgePath}
          stroke="rgba(0, 0, 0, 0.1)"
          strokeWidth={shadowStroke}
          fill="none"
          style={{ filter: 'blur(2px)' }}
        />
      )}

      {/* Base cable line (white solid) */}
      <path
        d={edgePath}
        stroke="#ffffff"
        strokeWidth={baseStroke}
        strokeLinecap="round"
        fill="none"
        markerEnd={markerEnd}
        style={{ transition: 'stroke 0.3s ease, stroke-width 0.3s ease' }}
      />

      {/* Trace highlight (green dashed + flowing animation) */}
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
            animation: 'dash-flow 2s linear infinite',
            filter: 'drop-shadow(0 0 3px rgba(34, 197, 94, 0.5))',
          }}
        />
      )}

      {/* Wide transparent hit area for easier click/hover */}
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

// Optimize with React.memo (re-render only when props change)
export default React.memo(CustomEdge);

/**
 * CSS animation (add to your global.css)
 *
 * @keyframes dash-flow {
 *   0%   { stroke-dashoffset: 0; }
 *   100% { stroke-dashoffset: -16; }
 * }
 */
