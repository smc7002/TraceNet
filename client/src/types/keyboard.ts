// 📁 src/types/keyboard.ts

export interface KeyboardNavigationConfig {
  stepSize?: number;           // 한 번에 이동할 픽셀 거리 (기본: 100)
  enabled?: boolean;           // 키보드 네비게이션 활성화 여부 (기본: true)
  zoomStep?: number;           // 줌 배율 (기본: 1.2)
  animationDuration?: number;  // 애니메이션 지속시간 ms (기본: 300)
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