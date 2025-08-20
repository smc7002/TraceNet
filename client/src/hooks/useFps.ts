/**
 * useFps.ts - 실시간 FPS(Frame Per Second) 측정 커스텀 훅
 * 
 * 목적:
 * - React 애플리케이션의 렌더링 성능을 실시간으로 모니터링
 * - 복잡한 네트워크 다이어그램 등에서 성능 병목 지점 파악
 * - 개발 환경에서 성능 최적화 가이드 제공
 * 
 * 측정 원리:
 * - requestAnimationFrame을 통한 프레임 카운팅
 * - 지정된 샘플링 주기마다 FPS 계산 및 업데이트
 * - 지수 평활법을 사용한 FPS 값 스무딩
 * 
 * 성능 고려사항:
 * - 프로덕션에서는 enabled=false로 비활성화 권장
 * - 메모리 누수 방지를 위한 정확한 클린업 구현
 */

import { useEffect, useRef, useState } from "react";

/**
 * FPS 측정 훅 옵션 인터페이스
 */
interface UseFpsOptions {
  sampleMs?: number;    // FPS 계산 주기 (밀리초)
  smooth?: number;      // 스무딩 계수 (0-1, 높을수록 민감)
  enabled?: boolean;    // 측정 활성화 여부
}

/**
 * 실시간 FPS 측정 커스텀 훅
 * 
 * @param opts 측정 옵션
 * @param opts.sampleMs FPS 계산 주기 (기본값: 500ms)
 * @param opts.smooth 스무딩 계수 (기본값: 0.2, 낮을수록 안정적)
 * @param opts.enabled 측정 활성화 여부 (기본값: true)
 * @returns 현재 FPS 값 (정수)
 * 
 * @example
 * ```tsx
 * // 기본 사용
 * const fps = useFps();
 * 
 * // 커스텀 설정
 * const fps = useFps({
 *   sampleMs: 1000,  // 1초마다 측정
 *   smooth: 0.1,     // 더 안정적인 값
 *   enabled: process.env.NODE_ENV === 'development'
 * });
 * 
 * return <div>FPS: {fps}</div>;
 * ```
 */
export function useFps(opts: UseFpsOptions = {}) {
  // 옵션 기본값 설정
  const { sampleMs = 500, smooth = 0.2, enabled = true } = opts;
  
  /**
   * 성능 측정을 위한 ref 변수들
   * useState 대신 useRef 사용 이유: 리렌더링 없이 값 업데이트 필요
   */
  const frames = useRef(0);                    // 현재 샘플링 주기 동안의 프레임 수
  const lastTs = useRef(performance.now());    // 마지막 FPS 계산 시점
  const rafId = useRef<number | null>(null);   // requestAnimationFrame ID
  const timerId = useRef<number | null>(null); // setTimeout ID
  
  // 화면에 표시할 FPS 값 (스무딩 적용됨)
  const [fps, setFps] = useState(0);

  useEffect(() => {
    // 비활성화 상태에서는 측정하지 않음
    if (!enabled) return;

    /**
     * 프레임 카운팅 루프
     * requestAnimationFrame을 사용하여 브라우저의 리페인트 주기에 맞춰 실행
     * 각 프레임마다 카운터를 증가시키고 다음 프레임을 예약
     */
    const loop = () => {
      frames.current++;
      rafId.current = requestAnimationFrame(loop);
    };
    
    // 프레임 카운팅 시작
    rafId.current = requestAnimationFrame(loop);

    /**
     * FPS 계산 및 업데이트 함수
     * 
     * 계산 방식:
     * 1. 경과 시간(dt) 계산
     * 2. 현재 FPS = (프레임 수 * 1000) / 경과 시간
     * 3. 지수 평활법으로 스무딩 적용
     * 4. 다음 측정 주기 스케줄링
     */
    const tick = () => {
      const now = performance.now();
      const dt = now - lastTs.current;
      
      // 현재 FPS 계산 (0으로 나누기 방지)
      const current = dt > 0 ? (frames.current * 1000) / dt : 0;
      
      /**
       * 지수 평활법을 사용한 FPS 스무딩
       * - 이전 값의 (1-smooth) 비율과 현재 값의 smooth 비율을 혼합
       * - smooth가 낮을수록 안정적이지만 반응이 느림
       * - 첫 번째 측정 시에는 현재 값을 그대로 사용
       */
      setFps(prev => (prev ? prev * (1 - smooth) + current * smooth : current));
      
      // 다음 측정을 위한 초기화
      frames.current = 0;
      lastTs.current = now;
      
      // 다음 측정 주기 스케줄링
      timerId.current = window.setTimeout(tick, sampleMs);
    };
    
    // 첫 번째 측정 스케줄링
    timerId.current = window.setTimeout(tick, sampleMs);

    /**
     * 클린업 함수
     * 메모리 누수 방지를 위해 모든 타이머와 애니메이션 프레임을 정리
     * 컴포넌트 언마운트 또는 의존성 변경 시 실행
     */
    return () => {
      if (rafId.current != null) {
        cancelAnimationFrame(rafId.current);
      }
      if (timerId.current != null) {
        clearTimeout(timerId.current);
      }
    };
  }, [sampleMs, smooth, enabled]); // 옵션이 변경되면 측정 재시작

  /**
   * 반환값
   * - enabled=true: 측정된 FPS 값 (정수로 반올림)
   * - enabled=false: 0 (성능 오버헤드 없음)
   */
  return enabled ? Math.round(fps) : 0;
}