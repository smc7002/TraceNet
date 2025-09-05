/**
 * useFps.ts — Real-time FPS (Frames Per Second) measurement custom hook
 *
 * Purpose:
 * - Monitor rendering performance of a React application in real time
 * - Identify performance bottlenecks in complex visuals (e.g., network diagrams)
 * - Provide guidance for performance tuning during development
 *
 * Measurement principle:
 * - Count frames via requestAnimationFrame
 * - Compute and update FPS at a specified sampling interval
 * - Smooth the FPS value using exponential smoothing
 *
 * Performance considerations:
 * - Recommended to disable in production (enabled = false)
 * - Implement precise cleanup to prevent memory leaks
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Options for the FPS hook
 */
interface UseFpsOptions {
  sampleMs?: number; // Sampling interval for FPS calculation (milliseconds)
  smooth?: number;   // Smoothing factor (0–1, higher = more responsive)
  enabled?: boolean; // Whether measurement is enabled
}

/**
 * Real-time FPS measurement hook
 *
 * @param opts Options
 * @param opts.sampleMs Sampling interval (default: 500ms)
 * @param opts.smooth Smoothing factor (default: 0.2; lower = more stable)
 * @param opts.enabled Enable measurement (default: true)
 * @returns Current FPS value (integer)
 *
 * @example
 * ```tsx
 * // Basic usage
 * const fps = useFps();
 *
 * // Custom settings
 * const fps = useFps({
 *   sampleMs: 1000,  // measure every second
 *   smooth: 0.1,     // smoother (less jumpy) value
 *   enabled: process.env.NODE_ENV === 'development'
 * });
 *
 * return <div>FPS: {fps}</div>;
 * ```
 */
export function useFps(opts: UseFpsOptions = {}) {
  // Default options
  const { sampleMs = 500, smooth = 0.2, enabled = true } = opts;

  /**
   * Refs for performance measurement
   * Why useRef instead of useState: we need to update values without re-rendering
   */
  const frames = useRef(0);                  // Frames counted in the current sampling period
  const lastTs = useRef(performance.now());  // Timestamp of the last FPS computation
  const rafId = useRef<number | null>(null); // requestAnimationFrame ID
  const timerId = useRef<number | null>(null); // setTimeout ID

  // FPS value shown on screen (smoothed)
  const [fps, setFps] = useState(0);

  useEffect(() => {
    // Skip measurement when disabled
    if (!enabled) return;

    /**
     * Frame counting loop
     * Uses requestAnimationFrame to align with the browser repaint cycle.
     * Increments the counter every frame and schedules the next frame.
     */
    const loop = () => {
      frames.current++;
      rafId.current = requestAnimationFrame(loop);
    };

    // Start counting frames
    rafId.current = requestAnimationFrame(loop);

    /**
     * Compute and update FPS
     *
     * Steps:
     * 1. Compute elapsed time (dt)
     * 2. current FPS = (frame count * 1000) / dt
     * 3. Apply exponential smoothing
     * 4. Schedule the next tick
     */
    const tick = () => {
      const now = performance.now();
      const dt = now - lastTs.current;

      // Guard against division by zero
      const current = dt > 0 ? (frames.current * 1000) / dt : 0;

      /**
       * Exponential smoothing:
       * - Blend previous value (1 - smooth) with current value (smooth)
       * - Lower smooth = more stable, slower response
       * - For the first sample, use current value as-is
       */
      setFps((prev) => (prev ? prev * (1 - smooth) + current * smooth : current));

      // Reset for the next sampling window
      frames.current = 0;
      lastTs.current = now;

      // Schedule next computation
      timerId.current = window.setTimeout(tick, sampleMs);
    };

    // Schedule the first computation
    timerId.current = window.setTimeout(tick, sampleMs);

    /**
     * Cleanup
     * Clear all timers and animation frames to prevent memory leaks.
     * Runs on unmount or when dependencies change.
     */
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
      if (timerId.current != null) clearTimeout(timerId.current);
    };
  }, [sampleMs, smooth, enabled]); // Restart measurement when options change

  /**
   * Return value
   * - enabled = true: measured FPS (rounded to an integer)
   * - enabled = false: 0 (no overhead)
   */
  return enabled ? Math.round(fps) : 0;
}
