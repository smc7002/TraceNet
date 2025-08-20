/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useKeyboardNavigation.ts - React Flow 키보드 네비게이션 커스텀 훅
 * 
 * 목적:
 * - 복잡한 네트워크 다이어그램에서 키보드를 통한 직관적인 네비게이션 제공
 * - 마우스 없이도 효율적인 뷰포트 조작 (이동, 줌, 리셋)
 * - 접근성 향상 및 유저를 위한 단축키 기능
 * 
 * 지원 키보드 조작:
 * - 방향키: 뷰포트 이동 (상하좌우)
 * - Ctrl/Cmd + Plus/Minus: 줌 인/아웃
 * - Ctrl/Cmd + 0: 뷰포트 리셋
 * 
 * 주의사항:
 * - 입력창(input, textarea) 포커스 시 자동 비활성화
 * - React Flow 인스턴스에 전역 접근 (window 객체 사용)
 * - 줌 레벨 제한 (0.3 ~ 2.0) 적용
 */

import { useEffect, useCallback, useMemo } from 'react';
import type { KeyboardNavigationConfig, KeyboardControls } from '../types/keyboard';

/**
 * React Flow 키보드 네비게이션 훅
 * 
 * @param config 키보드 네비게이션 설정 옵션
 * @param config.stepSize 이동 스텝 크기 (픽셀, 기본값: 100)
 * @param config.enabled 키보드 네비게이션 활성화 여부 (기본값: true)
 * @param config.zoomStep 줌 배율 (기본값: 1.2)
 * @param config.animationDuration 뷰포트 변경 애니메이션 지속시간 (밀리초, 기본값: 300)
 * @returns 프로그래밍 방식 뷰포트 제어 함수들
 * 
 * @example
 * ```tsx
 * // 기본 사용법
 * const controls = useKeyboardNavigation();
 * 
 * // 커스텀 설정
 * const controls = useKeyboardNavigation({
 *   stepSize: 50,        // 더 세밀한 이동
 *   zoomStep: 1.1,       // 더 부드러운 줌
 *   animationDuration: 200, // 더 빠른 애니메이션
 *   enabled: !isModalOpen   // 모달 열린 상태에서 비활성화
 * });
 * 
 * // 프로그래밍 방식 제어
 * <button onClick={controls.zoomIn}>줌 인</button>
 * <button onClick={controls.resetView}>뷰 리셋</button>
 * ```
 */
export const useKeyboardNavigation = ({
  stepSize = 100,
  enabled = true,
  zoomStep = 1.2,
  animationDuration = 300
}: KeyboardNavigationConfig = {}): KeyboardControls => {

  /**
   * 키보드 이벤트 핸들러
   * 
   * 주요 기능:
   * 1. 입력창 포커스 시 자동 비활성화 (사용자 타이핑 간섭 방지)
   * 2. React Flow 인스턴스 전역 접근 및 유효성 검증
   * 3. 키 조합별 뷰포트 조작 수행
   * 4. 브라우저 기본 동작 방지 (스크롤, 줌 등)
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    /**
     * 입력창 포커스 감지 및 키보드 네비게이션 비활성화
     * 
     * 사용자가 텍스트를 입력 중일 때 방향키나 단축키가 
     * 네비게이션으로 작동하지 않도록 보호
     */
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.getAttribute('contenteditable') === 'true'
    )) {
      return;
    }

    /**
     * React Flow 인스턴스 전역 접근
     * 
     * 주의: window 객체 사용은 일반적으로 권장되지 않지만,
     * React Flow의 명령형 API 접근을 위해 불가피하게 사용
     * 실제 프로젝트에서는 Context나 ref를 통한 전달 방식 고려 필요
     */
    const reactFlowInstance = (window as any).reactFlowInstance;
    if (!reactFlowInstance || !reactFlowInstance.getViewport) return;

    // 현재 뷰포트 상태 가져오기
    const viewport = reactFlowInstance.getViewport();
    let newViewport = { ...viewport };
    let shouldUpdate = false;

    /**
     * 키보드 입력별 뷰포트 조작 로직
     * 
     * 좌표계 주의사항:
     * - React Flow는 SVG 좌표계를 사용 (Y축이 아래쪽으로 증가)
     * - 사용자 직관과 맞추기 위해 Y축 이동 방향을 반전
     */
    switch (event.code) {
      case 'ArrowUp':
        event.preventDefault();
        newViewport.y += stepSize;  // 뷰포트 위로 이동 (컨텐츠는 아래로)
        shouldUpdate = true;
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        newViewport.y -= stepSize;  // 뷰포트 아래로 이동 (컨텐츠는 위로)
        shouldUpdate = true;
        break;
        
      case 'ArrowLeft':
        event.preventDefault();
        newViewport.x += stepSize;  // 뷰포트 왼쪽으로 이동 (컨텐츠는 오른쪽으로)
        shouldUpdate = true;
        break;
        
      case 'ArrowRight':
        event.preventDefault();
        newViewport.x -= stepSize;  // 뷰포트 오른쪽으로 이동 (컨텐츠는 왼쪽으로)
        shouldUpdate = true;
        break;
        
      /**
       * 줌 인 (확대)
       * Ctrl/Cmd + Plus 또는 Ctrl/Cmd + Numpad Plus
       * 최대 줌 레벨 2.0 제한
       */
      case 'Equal':       // + 키 (Shift 없이)
      case 'NumpadAdd':   // 숫자패드 + 키
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          newViewport.zoom = Math.min(viewport.zoom * zoomStep, 2.0);
          shouldUpdate = true;
        }
        break;
        
      /**
       * 줌 아웃 (축소)
       * Ctrl/Cmd + Minus 또는 Ctrl/Cmd + Numpad Minus
       * 최소 줌 레벨 0.3 제한
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
       * 뷰포트 리셋
       * Ctrl/Cmd + 0: 원점(0,0)으로 이동하고 적정 줌 레벨(0.8) 설정
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
     * 뷰포트 업데이트 실행
     * duration 옵션을 통해 부드러운 애니메이션 적용
     */
    if (shouldUpdate && reactFlowInstance.setViewport) {
      reactFlowInstance.setViewport(newViewport, { duration: animationDuration });
    }
  }, [enabled, stepSize, zoomStep, animationDuration]);

  /**
   * 키보드 이벤트 리스너 등록/해제
   * 
   * document 레벨에서 이벤트를 캐치하여 
   * React Flow 컴포넌트에 포커스가 없어도 동작하도록 구현
   */
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);

    // 클린업: 메모리 누수 방지
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  /**
   * 프로그래밍 방식 뷰포트 제어 함수들
   * 
   * 버튼 클릭이나 다른 이벤트를 통해 뷰포트를 조작할 때 사용
   * 모든 함수는 키보드 조작과 동일한 로직과 애니메이션을 적용
   */
  const controls = useMemo((): KeyboardControls => ({
    /**
     * 뷰포트를 위로 이동
     * 키보드의 ArrowUp과 동일한 동작
     */
    moveUp: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport(
          { ...viewport, y: viewport.y + stepSize }, 
          { duration: animationDuration }
        );
      }
    },

    /**
     * 뷰포트를 아래로 이동
     * 키보드의 ArrowDown과 동일한 동작
     */
    moveDown: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport(
          { ...viewport, y: viewport.y - stepSize }, 
          { duration: animationDuration }
        );
      }
    },

    /**
     * 뷰포트를 왼쪽으로 이동
     * 키보드의 ArrowLeft와 동일한 동작
     */
    moveLeft: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport(
          { ...viewport, x: viewport.x + stepSize }, 
          { duration: animationDuration }
        );
      }
    },

    /**
     * 뷰포트를 오른쪽으로 이동
     * 키보드의 ArrowRight와 동일한 동작
     */
    moveRight: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport(
          { ...viewport, x: viewport.x - stepSize }, 
          { duration: animationDuration }
        );
      }
    },

    /**
     * 줌 인 (확대)
     * 최대 줌 레벨 2.0 제한 적용
     */
    zoomIn: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport(
          { ...viewport, zoom: Math.min(viewport.zoom * zoomStep, 2.0) }, 
          { duration: animationDuration }
        );
      }
    },

    /**
     * 줌 아웃 (축소)
     * 최소 줌 레벨 0.3 제한 적용
     */
    zoomOut: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport && reactFlowInstance?.setViewport) {
        const viewport = reactFlowInstance.getViewport();
        reactFlowInstance.setViewport(
          { ...viewport, zoom: Math.max(viewport.zoom / zoomStep, 0.3) }, 
          { duration: animationDuration }
        );
      }
    },

    /**
     * 뷰포트 리셋
     * 원점으로 이동하고 기본 줌 레벨(0.8) 적용
     * 리셋 동작은 더 긴 애니메이션 시간 사용
     */
    resetView: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.setViewport) {
        reactFlowInstance.setViewport(
          { x: 0, y: 0, zoom: 0.8 }, 
          { duration: animationDuration * 2 }
        );
      }
    },

    /**
     * 현재 뷰포트 상태 조회
     * 디버깅이나 상태 저장/복원 시 유용
     * 
     * @returns 현재 뷰포트 상태 { x, y, zoom }
     */
    getCurrentViewport: () => {
      const reactFlowInstance = (window as any).reactFlowInstance;
      if (reactFlowInstance?.getViewport) {
        return reactFlowInstance.getViewport();
      }
      // React Flow 인스턴스가 없을 때 기본값 반환
      return { x: 0, y: 0, zoom: 1 };
    }
  }), [stepSize, zoomStep, animationDuration]);

  return controls;
};