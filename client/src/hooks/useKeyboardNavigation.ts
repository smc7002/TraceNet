/* eslint-disable @typescript-eslint/no-explicit-any */
// src/hooks/useKeyboardNavigation.ts

import { useEffect, useCallback, useMemo } from 'react';
import type { KeyboardNavigationConfig, KeyboardControls } from '../types/keyboard';

export const useKeyboardNavigation = ({
  stepSize = 100,
  enabled = true,
  zoomStep = 1.2,
  animationDuration = 300
}: KeyboardNavigationConfig = {}): KeyboardControls => {

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // 입력창에 포커스가 있으면 키보드 네비게이션 비활성화
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.getAttribute('contenteditable') === 'true'
    )) {
      return;
    }

    // React Flow 인스턴스 가져오기 (window에서)
    const reactFlowInstance = (window as any).reactFlowInstance;
    if (!reactFlowInstance || !reactFlowInstance.getViewport) return;

    const viewport = reactFlowInstance.getViewport();
    let newViewport = { ...viewport };
    let shouldUpdate = false;

    switch (event.code) {
      case 'ArrowUp':
        event.preventDefault();
        newViewport.y += stepSize;
        shouldUpdate = true;
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        newViewport.y -= stepSize;
        shouldUpdate = true;
        break;
        
      case 'ArrowLeft':
        event.preventDefault();
        newViewport.x += stepSize;
        shouldUpdate = true;
        break;
        
      case 'ArrowRight':
        event.preventDefault();
        newViewport.x -= stepSize;
        shouldUpdate = true;
        break;
        
      case 'Equal':
      case 'NumpadAdd':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          newViewport.zoom = Math.min(viewport.zoom * zoomStep, 2.0);
          shouldUpdate = true;
        }
        break;
        
      case 'Minus':
      case 'NumpadSubtract':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          newViewport.zoom = Math.max(viewport.zoom / zoomStep, 0.3);
          shouldUpdate = true;
        }
        break;
        
      case 'Digit0':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          newViewport = { x: 0, y: 0, zoom: 0.8 };
          shouldUpdate = true;
        }
        break;
    }

    if (shouldUpdate && reactFlowInstance.setViewport) {
      reactFlowInstance.setViewport(newViewport, { duration: animationDuration });
    }
  }, [enabled, stepSize, zoomStep, animationDuration]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  // 프로그래밍 방식으로 뷰포트 제어하는 함수들 반환
  const controls = useMemo((): KeyboardControls => ({
    moveUp: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({ ...viewport, y: viewport.y + stepSize }, { duration: animationDuration });
      }
    },
    moveDown: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({ ...viewport, y: viewport.y - stepSize }, { duration: animationDuration });
      }
    },
    moveLeft: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({ ...viewport, x: viewport.x + stepSize }, { duration: animationDuration });
      }
    },
    moveRight: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({ ...viewport, x: viewport.x - stepSize }, { duration: animationDuration });
      }
    },
    zoomIn: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({ ...viewport, zoom: Math.min(viewport.zoom * zoomStep, 2.0) }, { duration: animationDuration });
      }
    },
    zoomOut: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport({ ...viewport, zoom: Math.max(viewport.zoom / zoomStep, 0.3) }, { duration: animationDuration });
      }
    },
    resetView: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.setViewport) {
        reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 0.8 }, { duration: animationDuration * 2 });
      }
    },
    getCurrentViewport: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport) {
        return reactFlowInstance.getViewport();
      }
      return { x: 0, y: 0, zoom: 1 };
    }
  }), [stepSize, zoomStep, animationDuration]);

  return controls;
};