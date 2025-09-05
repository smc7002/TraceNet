// src/types/keyboard.ts

export interface KeyboardNavigationConfig {
  stepSize?: number;        // pixel distance per move (default: 100)
  enabled?: boolean;        // enable/disable keyboard navigation (default: true)
  zoomStep?: number;        // zoom multiplier per step (default: 1.2)
  animationDuration?: number; // viewport animation duration in ms (default: 300)
}

export interface KeyboardControls {
  moveUp: () => void;
  moveDown: () => void;
  moveLeft: () => void;
  moveRight: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  getCurrentViewport: () => { x: number; y: number; zoom: number };
}
