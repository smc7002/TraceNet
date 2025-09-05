/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useKeyboardNavigation.ts — Keyboard navigation hook for React Flow
 *
 * Purpose:
 * - Provide intuitive keyboard navigation in complex network diagrams
 * - Efficient viewport control without a mouse (pan, zoom, reset)
 * - Improve accessibility and offer handy shortcuts
 *
 * Supported keyboard controls:
 * - Arrow keys: pan the viewport (up/down/left/right)
 * - Ctrl/Cmd + Plus/Minus: zoom in/out
 * - Ctrl/Cmd + 0: reset viewport
 *
 * Notes:
 * - Automatically disabled while an input (input, textarea, contenteditable) has focus
 * - Accesses the React Flow instance globally via the window object
 * - Enforces zoom limits (0.3 ~ 2.0)
 */

import { useCallback, useEffect, useMemo } from 'react';

import type { KeyboardControls, KeyboardNavigationConfig } from '../types/keyboard';

/**
 * React Flow keyboard navigation hook
 *
 * @param config Keyboard navigation options
 * @param config.stepSize Pan step size in pixels (default: 100)
 * @param config.enabled Whether the keyboard nav is enabled (default: true)
 * @param config.zoomStep Zoom factor per step (default: 1.2)
 * @param config.animationDuration Duration for viewport animations in ms (default: 300)
 * @returns Programmatic viewport control functions
 *
 * @example
 * ```tsx
 * // Basic usage
 * const controls = useKeyboardNavigation();
 *
 * // Custom settings
 * const controls = useKeyboardNavigation({
 *   stepSize: 50,           // finer panning
 *   zoomStep: 1.1,          // smoother zoom
 *   animationDuration: 200, // quicker animations
 *   enabled: !isModalOpen   // disable while a modal is open
 * });
 *
 * // Programmatic control
 * <button onClick={controls.zoomIn}>Zoom In</button>
 * <button onClick={controls.resetView}>Reset View</button>
 * ```
 */
export const useKeyboardNavigation = ({
  stepSize = 100,
  enabled = true,
  zoomStep = 1.2,
  animationDuration = 300,
}: KeyboardNavigationConfig = {}): KeyboardControls => {
  /**
   * Keyboard event handler
   *
   * Responsibilities:
   * 1. Disable when an input has focus (avoid interfering with typing)
   * 2. Access and validate the global React Flow instance
   * 3. Perform viewport actions per key combo
   * 4. Prevent default browser behaviors (scroll/zoom, etc.)
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      /**
       * Detect focused editable elements and disable keyboard navigation
       *
       * Prevent arrow keys/shortcuts from navigating while the user is typing.
       */
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      /**
       * Access the React Flow instance globally
       *
       * Note: Using the window object isn't generally recommended, but is used here
       * for imperative API access. In real projects consider passing via Context or refs.
       */
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (!reactFlowInstance || !reactFlowInstance.getViewport) return;

      // Get the current viewport
      const viewport = reactFlowInstance.getViewport();
      let newViewport = { ...viewport };
      let shouldUpdate = false;

      /**
       * Viewport manipulation per key input
       *
       * Coordinate note:
       * - React Flow uses an SVG coordinate system (Y increases downward)
       * - We invert Y movements to match user intuition
       */
      switch (event.code) {
        case 'ArrowUp':
          event.preventDefault();
          newViewport.y += stepSize; // move viewport up (content moves down)
          shouldUpdate = true;
          break;

        case 'ArrowDown':
          event.preventDefault();
          newViewport.y -= stepSize; // move viewport down (content moves up)
          shouldUpdate = true;
          break;

        case 'ArrowLeft':
          event.preventDefault();
          newViewport.x += stepSize; // move viewport left (content moves right)
          shouldUpdate = true;
          break;

        case 'ArrowRight':
          event.preventDefault();
          newViewport.x -= stepSize; // move viewport right (content moves left)
          shouldUpdate = true;
          break;

        /**
         * Zoom in
         * Ctrl/Cmd + Plus or Ctrl/Cmd + Numpad Plus
         * Max zoom 2.0
         */
        case 'Equal': // '=' key (often used as Ctrl+'=' for zoom-in)
        case 'NumpadAdd': // numpad '+'
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            newViewport.zoom = Math.min(viewport.zoom * zoomStep, 2.0);
            shouldUpdate = true;
          }
          break;

        /**
         * Zoom out
         * Ctrl/Cmd + Minus or Ctrl/Cmd + Numpad Minus
         * Min zoom 0.3
         */
        case 'Minus':
        case 'NumpadSubtract':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            newViewport.zoom = Math.max(viewport.zoom / zoomStep, 0.3);
            shouldUpdate = true;
          }
          break;

        /**
         * Reset viewport
         * Ctrl/Cmd + 0: move to origin (0,0) and set a comfortable zoom (0.8)
         */
        case 'Digit0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            newViewport = { x: 0, y: 0, zoom: 0.8 };
            shouldUpdate = true;
          }
          break;
      }

      /**
       * Apply viewport update
       * Uses duration for a smooth animation.
       */
      if (shouldUpdate && reactFlowInstance.setViewport) {
        reactFlowInstance.setViewport(newViewport, { duration: animationDuration });
      }
    },
    [enabled, stepSize, zoomStep, animationDuration],
  );

  /**
   * Register/unregister the keyboard event listener
   *
   * Listen at the document level so it works even when the React Flow
   * component itself doesn't have focus.
   */
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup to prevent memory leaks
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  /**
   * Programmatic viewport controls
   *
   * Use these from buttons or other events.
   * All functions apply the same logic/animation as the keyboard controls.
   */
  const controls = useMemo(
    (): KeyboardControls => ({
      /**
       * Pan up
       * Equivalent to ArrowUp
       */
      moveUp: () => {
        const reactFlowInstance = (window as any).reactFlowInstance;
        if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
          const viewport = reactFlowInstance.getViewport();
          reactFlowInstance.setViewport(
            { ...viewport, y: viewport.y + stepSize },
            { duration: animationDuration },
          );
        }
      },

      /**
       * Pan down
       * Equivalent to ArrowDown
       */
      moveDown: () => {
        const reactFlowInstance = (window as any).reactFlowInstance;
        if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
          const viewport = reactFlowInstance.getViewport();
          reactFlowInstance.setViewport(
            { ...viewport, y: viewport.y - stepSize },
            { duration: animationDuration },
          );
        }
      },

      /**
       * Pan left
       * Equivalent to ArrowLeft
       */
      moveLeft: () => {
        const reactFlowInstance = (window as any).reactFlowInstance;
        if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
          const viewport = reactFlowInstance.getViewport();
          reactFlowInstance.setViewport(
            { ...viewport, x: viewport.x + stepSize },
            { duration: animationDuration },
          );
        }
      },

      /**
       * Pan right
       * Equivalent to ArrowRight
       */
      moveRight: () => {
        const reactFlowInstance = (window as any).reactFlowInstance;
        if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
          const viewport = reactFlowInstance.getViewport();
          reactFlowInstance.setViewport(
            { ...viewport, x: viewport.x - stepSize },
            { duration: animationDuration },
          );
        }
      },

      /**
       * Zoom in
       * Enforces max zoom 2.0
       */
      zoomIn: () => {
        const reactFlowInstance = (window as any).reactFlowInstance;
        if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
          const viewport = reactFlowInstance.getViewport();
          reactFlowInstance.setViewport(
            { ...viewport, zoom: Math.min(viewport.zoom * zoomStep, 2.0) },
            { duration: animationDuration },
          );
        }
      },

      /**
       * Zoom out
       * Enforces min zoom 0.3
       */
      zoomOut: () => {
        const reactFlowInstance = (window as any).reactFlowInstance;
        if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
          const viewport = reactFlowInstance.getViewport();
          reactFlowInstance.setViewport(
            { ...viewport, zoom: Math.max(viewport.zoom / zoomStep, 0.3) },
            { duration: animationDuration },
          );
        }
      },

      /**
       * Reset viewport
       * Move to origin and apply default zoom (0.8).
       * Uses a longer animation for reset.
       */
      resetView: () => {
        const reactFlowInstance = (window as any).reactFlowInstance;
        if (reactFlowInstance?.setViewport) {
          reactFlowInstance.setViewport(
            { x: 0, y: 0, zoom: 0.8 },
            { duration: animationDuration * 2 },
          );
        }
      },

      /**
       * Get current viewport
       * Useful for debugging or persisting/restoring state.
       *
       * @returns Current viewport { x, y, zoom }
       */
      getCurrentViewport: () => {
        const reactFlowInstance = (window as any).reactFlowInstance;
        if (reactFlowInstance?.getViewport) {
          return reactFlowInstance.getViewport();
        }
        // Fallback when the instance is missing
        return { x: 0, y: 0, zoom: 1 };
      },
    }),
    [stepSize, zoomStep, animationDuration],
  );

  return controls;
};
