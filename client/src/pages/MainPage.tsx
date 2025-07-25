// 📁 src/pages/MainPage.tsx

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import { fetchCables } from "../api/cableApi";
import { DeviceStatus } from "../types/status";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
import { LayoutMode } from "../utils/layout";
import {
  mapCablesToEdges,
  mapTraceCablesToEdges,
  excludeTraceOverlaps,
} from "../utils/edgeMapper";
import {
  getDagreLayoutedElements,
  getRadialLayoutedElements,
} from "../utils/layout";
import type { Node, Edge } from "react-flow-renderer";

import NetworkDiagram from "../components/NetworkDiagram";
import SidePanel from "../components/SidePanel";
import ControlBar from "../components/ControlBar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import LayoutSwitcher from "../components/LayoutSwitcher";

/**
 * 메인 페이지 컴포넌트
 *
 * 이 페이지는 네트워크 topology 시각화와 장비 관리를 담당하는 핵심 화면입니다.
 *
 * 주요 기능:
 * - 네트워크 장비들의 실시간 상태 모니터링
 * - 인터랙티브한 네트워크 다이어그램으로 topology 시각화
 * - 선택한 장비에서 시작하는 케이블 경로 추적 (trace)
 * - 장비 검색 및 필터링 (문제가 있는 장비만 보기 등)
 * - 장비별 상세 정보 조회
 */
export default function MainPage() {
  // ============================================================================
  // 상태 관리 (State Management)
  // ============================================================================

  /** 전체 네트워크 장비 목록 - API에서 가져온 원본 데이터 */
  const [devices, setDevices] = useState<Device[]>([]);

  /** 전체 케이블 연결 정보 - 네트워크 인프라의 물리적 연결 상태 */
  const [allCables, setAllCables] = useState<CableDto[]>([]);

  /** 현재 선택된 장비 - 사용자가 클릭한 장비, 사이드 패널에 상세 정보 표시 */
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  /** 트레이스 결과 - 선택된 장비에서 출발하는 케이블 경로 추적 결과 */
  const [traceResult, setTraceResult] = useState<TraceResponse | null>(null);

  const [selectedCable, setSelectedCable] = useState<CableDto | null>(null);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>(LayoutMode.Dagre);

  /**
   * 트레이스 전용 엣지 데이터 - 다이어그램에서 하이라이트될 경로
   * 일반 케이블과 구분해서 다른 색상/스타일로 표시됨
   */
  const [traceEdges, setTraceEdges] = useState<Edge[]>([]);

  /** 트레이스 실행 중 발생한 에러 메시지 */
  const [traceError, setTraceError] = useState<string | null>(null);

  /** 장비 검색어 - 장비명이나 IP 주소로 필터링할 때 사용 */
  const [searchQuery, setSearchQuery] = useState("");

  /** 문제 장비만 보기 토글 - true면 오프라인/불안정 장비만 표시 */
  const [showProblemOnly, setShowProblemOnly] = useState(false);

  /** 초기 데이터 로딩 상태 - 페이지 첫 진입 시 스피너 표시 여부 */
  const [loading, setLoading] = useState(true);

  /** 전역 에러 상태 - API 호출 실패 등의 심각한 오류 */
  const [error, setError] = useState("");

  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    setRenderKey((prev) => prev + 1); // layoutMode 변경 시마다 key 증가
  }, [layoutMode]);

  /**
   * 트레이스 타임스탬프 참조값
   *
   * 왜 필요한가?
   * - 같은 장비를 여러 번 트레이스할 때 엣지 ID 중복을 방지
   * - 각 트레이스마다 고유한 ID를 생성해서 React가 올바르게 렌더링할 수 있게 함
   * - useRef를 사용하는 이유: 리렌더링 시에도 값이 유지되어야 하지만 변경 시 리렌더링은 불필요
   */
  const traceTimestampRef = useRef<number>(0);

  // ============================================================================
  // 개발용 디버깅 (Development Debugging)
  // ============================================================================

  /**
   * 트레이스 엣지 변경 추적 (개발용)
   * 트레이스 기능이 복잡해서 디버깅을 위해 엣지 변화를 로그로 남김
   */
  useEffect(() => {
    console.log(
      "🔁 트레이스 엣지가 변경됨:",
      traceEdges.map((e) => e.id)
    );
  }, [traceEdges]);

  /**
   * 장비 선택 해제 시 트레이스 정리
   *
   * 왜 필요한가?
   * - 사용자가 다른 곳을 클릭해서 장비 선택이 해제되면 트레이스도 같이 사라져야 함
   * - UI 일관성 유지 (선택된 장비가 없으면 트레이스도 없어야 함)
   */
  useEffect(() => {
    if (!selectedDevice) {
      setTraceEdges([]);
    }
  }, [selectedDevice]);

  // ============================================================================
  // 계산된 값들 (Computed Values)
  // ============================================================================

  /**
   * 필터링된 장비 목록
   *
   * 필터링 로직:
   * 1. 검색어 필터: 장비명(대소문자 구분 안함) 또는 IP 주소에 검색어가 포함된 것
   * 2. 문제 장비 필터: 토글이 켜져있으면 오프라인이나 불안정 상태인 장비만
   *
   * useMemo를 사용하는 이유:
   * - devices, searchQuery, showProblemOnly가 변경될 때만 재계산
   * - 매 렌더링마다 filter 연산을 하지 않아서 성능 향상
   */
  const filteredDevices = useMemo(() => {
    if (!Array.isArray(devices)) return [];
    return devices.filter((d) => {
      // 검색어 매칭 검사
      const matchSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.ipAddress.includes(searchQuery);

      // 상태 필터 검사 (문제 장비만 보기가 켜져있을 때)
      const matchStatus = showProblemOnly
        ? d.status === DeviceStatus.Offline ||
          d.status === DeviceStatus.Unstable
        : true;

      return matchSearch && matchStatus;
    });
  }, [devices, searchQuery, showProblemOnly]);

  const filteredCables = useMemo(
    () =>
      allCables.filter(
        (c) =>
          c.cableId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.fromDevice.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.toDevice.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [allCables, searchQuery]
  );

  /**
   * 기본 네트워크 엣지 (트레이스와 겹치지 않는 것들)
   *
   * 복잡한 로직이 필요한 이유:
   * - 전체 케이블을 다 그리면 트레이스 경로가 안 보임 (겹쳐서)
   * - 트레이스 중인 케이블은 하이라이트로 표시하고, 기본 케이블에서는 제외해야 함
   * - 이렇게 해야 트레이스 경로가 눈에 띄게 다른 색상으로 보임
   */
  const baseEdges = useMemo(() => {
    const base = mapCablesToEdges(allCables); // 모든 케이블을 엣지로 변환
    return excludeTraceOverlaps(base, traceEdges); // 트레이스와 겹치는 엣지 제거
  }, [allCables, traceEdges]);

  /**
   * 최종 엣지 목록 (기본 엣지 + 트레이스 엣지)
   *
   * 순서가 중요한 이유:
   * - 배열의 뒤쪽 요소가 앞쪽에 그려짐 (z-index 효과)
   * - 트레이스 엣지를 뒤에 넣어야 기본 엣지 위에 그려져서 하이라이트가 보임
   */
  const allEdges = useMemo(
    () => [...baseEdges, ...traceEdges],
    [baseEdges, traceEdges]
  );

  /**
   * 다이어그램용 노드 데이터
   *
   * React Flow 라이브러리 형식에 맞게 장비 데이터를 변환:
   * - id: 문자열이어야 함 (deviceId는 숫자라서 toString() 필요)
   * - data: 노드 렌더링에 필요한 정보 (이름, 타입, 상태)
   * - position: 일단 (0,0)으로 두고 나중에 레이아웃 알고리즘이 계산함
   */
  const allNodes: Node[] = useMemo(() => {
    return filteredDevices.map((device) => ({
      id: device.deviceId.toString(),
      data: {
        label: device.name, // 노드에 표시될 텍스트
        type: device.type.toString().toLowerCase(), // 라우터, 스위치, 서버 등
        status: device.status, // online, offline, unstable 등
      },
      position: { x: 0, y: 0 }, // 레이아웃 알고리즘이 나중에 계산
      type: "default",
    }));
  }, [filteredDevices]);

  /**
   * 레이아웃이 적용된 노드와 엣지
   *
   * Dagre 알고리즘이 하는 일:
   * - 노드들을 겹치지 않게 배치 (자동 위치 계산)
   * - 엣지들을 적절히 라우팅 (선이 노드를 피해서 그려지게)
   * - 전체적으로 보기 좋은 그래프 모양으로 정렬
   *
   * 중복 엣지 체크하는 이유:
   * - React에서 같은 key를 가진 요소가 여러 개 있으면 렌더링 오류 발생
   * - 개발 중에 실수로 중복 엣지가 생기는 경우가 있어서 미리 감지
   */
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    // 개발용: 중복 엣지 ID 검사
    const ids = allEdges.map((e) => e.id);
    const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);

    if (dupes.length > 0) {
      console.warn("⚠️ 중복된 엣지 ID 발견:", dupes);
    } else {
      console.log("✅ 엣지 ID 중복 없음, 총", ids.length, "개");
    }

    const layouted =
      layoutMode === "radial"
        ? getRadialLayoutedElements(allNodes, allEdges)
        : getDagreLayoutedElements(allNodes, allEdges);
    return layouted;
  }, [allNodes, allEdges, layoutMode]);

  /**
   * 장비 상태별 통계
   *
   * 용도:
   * - 상단 컨트롤 바에 "온라인 15대, 오프라인 3대" 이런 식으로 표시
   * - 시스템 전체 건강 상태를 한눈에 파악
   * - 문제 장비가 몇 대인지 빠르게 확인
   */
  const statusCounts = useMemo(() => {
    if (!Array.isArray(devices))
      return {
        [DeviceStatus.Online]: 0,
        [DeviceStatus.Offline]: 0,
        [DeviceStatus.Unstable]: 0,
      };
    return {
      [DeviceStatus.Online]: devices.filter(
        (d) => d.status === DeviceStatus.Online
      ).length,
      [DeviceStatus.Offline]: devices.filter(
        (d) => d.status === DeviceStatus.Offline
      ).length,
      [DeviceStatus.Unstable]: devices.filter(
        (d) => d.status === DeviceStatus.Unstable
      ).length,
    };
  }, [devices]);

  // ============================================================================
  // 이펙트 (Effects)
  // ============================================================================

  /**
   * 초기 데이터 로딩
   *
   * 페이지가 처음 열릴 때 실행:
   * 1. 장비 목록과 케이블 정보를 병렬로 가져옴 (Promise.all로 성능 향상)
   * 2. 로딩이 끝나면 loading 상태를 false로 변경
   * 3. 에러가 발생하면 에러 메시지 설정
   *
   * isMounted 패턴을 사용하는 이유:
   * - 사용자가 페이지를 빠르게 떠날 경우를 대비
   * - API 응답이 와도 컴포넌트가 이미 언마운트되었으면 상태 업데이트 안 함
   * - 이렇게 안 하면 "setState on unmounted component" 경고 발생
   */
  useEffect(() => {
    let isMounted = true; // 컴포넌트 마운트 상태 추적

    const load = async () => {
      try {
        // 두 API를 동시에 호출해서 로딩 시간 단축
        const [deviceData, cableData] = await Promise.all([
          fetchDevices(),
          fetchCables(),
        ]);

        // 컴포넌트가 아직 마운트되어 있을 때만 상태 업데이트
        if (isMounted) {
          setDevices(deviceData);
          console.log("🔌 allCables API 응답:", cableData);
          setAllCables(cableData);
        }
      } catch (err) {
        // 에러 메시지 추출 (Error 객체면 message 사용, 아니면 기본 메시지)
        const msg =
          err instanceof Error ? err.message : "알 수 없는 오류입니다.";
        if (isMounted) setError(msg);
      } finally {
        // 성공/실패 관계없이 로딩 완료 표시
        if (isMounted) setLoading(false);
      }
    };

    load();

    // 클린업: 컴포넌트 언마운트 시 isMounted를 false로 설정
    return () => {
      isMounted = false;
    };
  }, []); // 빈 배열 = 컴포넌트 마운트 시 한 번만 실행

  // ============================================================================
  // 이벤트 핸들러 (Event Handlers)
  // ============================================================================

  /**
   * 장비 클릭 처리 및 트레이스 실행
   *
   * 전체 플로우:
   * 1. 클릭된 장비를 선택 상태로 설정
   * 2. 이전 트레이스 결과들 초기화 (깨끗한 상태에서 시작)
   * 3. 서버 타입 체크 (서버는 트레이스 불가능 - 비즈니스 규칙)
   * 4. 트레이스 API 호출
   * 5. 결과를 시각화용 엣지로 변환
   * 6. 상태 업데이트로 화면에 반영
   *
   * useCallback을 사용하는 이유:
   * - 이 함수를 props로 전달받는 자식 컴포넌트의 불필요한 리렌더링 방지
   * - 의존성이 없으므로 컴포넌트 생명주기 동안 함수 참조가 동일하게 유지
   */
  const handleDeviceClick = useCallback(async (device: Device) => {
    // 1단계: 선택 상태 업데이트 및 초기화
    setSelectedDevice(device);
    setTraceResult(null); // 이전 트레이스 결과 제거
    setTraceError(null); // 이전 에러 메시지 제거
    setTraceEdges([]); // 이전 트레이스 시각화 제거

    // 2단계: 비즈니스 규칙 검증 (서버는 트레이스 불가)
    if (device.type.toLowerCase() === "server") {
      alert("🔒 서버는 트레이스 대상이 아닙니다.");
      return; // 여기서 함수 종료
    }

    try {
      // 3단계: 트레이스 API 호출
      const result = await fetchTrace(device.deviceId);

      // 4단계: 고유 타임스탬프 생성 (엣지 ID 중복 방지용)
      traceTimestampRef.current = Date.now();

      // 5단계: API 결과를 시각화용 엣지 데이터로 변환
      const trace = mapTraceCablesToEdges(
        result.cables,
        traceTimestampRef.current
      );

      // 개발용 로그: 생성된 트레이스 엣지 확인
      console.log(
        "🧪 [트레이스 생성 완료]",
        trace.map((e) => e.id)
      );

      // 6단계: 상태 업데이트로 화면에 반영
      setTraceEdges(trace);
      setTraceResult(result);
    } catch (err) {
      // 에러 처리: 사용자에게 친화적인 메시지 표시
      const msg = err instanceof Error ? err.message : "트레이스 로드 실패";
      setTraceError(msg);
    }
  }, []); // 의존성 없음 = 함수 참조 고정

  /**
   * 케이블/엣지 클릭 처리
   *
   * 현재는 로깅만 하지만, 향후 확장 가능:
   * - 케이블 상세 정보 모달 표시
   * - 케이블 상태 검사 기능
   * - 케이블 연결 변경 기능 등
   *
   * 매개변수 설명:
   * - _: 이벤트 객체 (현재 사용 안 함, 언더스코어로 명시)
   * - edge: 클릭된 엣지(케이블) 정보
   */
  const handleEdgeClick = useCallback(
    (_: unknown, edge: Edge) => {
      const cableId = edge.id.replace("cable-", "");
      const found = allCables.find((c) => c.cableId === cableId);
      if (found) {
        setSelectedCable(found);
        setSelectedDevice(null); // ⛔ Device 선택 해제
        setTraceResult(null);
        setTraceError(null);
        setTraceEdges([]);
      }
    },
    [allCables]
  );

  // ============================================================================
  // 렌더링 가드 (Render Guards)
  // ============================================================================

  // 로딩 중이면 스피너 표시
  if (loading) return <LoadingSpinner />;

  // 에러가 있으면 에러 화면 표시 (새로고침 버튼 포함)
  if (error)
    return (
      <ErrorState message={error} onRetry={() => window.location.reload()} />
    );

  // ============================================================================
  // 메인 렌더링 (Main Render)
  // ============================================================================

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* 상단 헤더: 검색, 필터, 통계 표시 */}
      <div className="border-b border-slate-200 shrink-0">
        <ControlBar
          onRefresh={() => window.location.reload()}
          onToggleProblemOnly={() => setShowProblemOnly((prev) => !prev)}
          showProblemOnly={showProblemOnly}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusCounts={statusCounts}
        />
      </div>

      <LayoutSwitcher layoutMode={layoutMode} onChange={setLayoutMode} />

      {/* 메인 컨텐츠: 네트워크 다이어그램 + 사이드 패널 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 인터랙티브 네트워크 다이어그램 */}
        <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
          <NetworkDiagram
            key={renderKey}
            nodes={layoutedNodes} // 위치가 계산된 장비 노드들
            edges={layoutedEdges} // 라우팅된 케이블 엣지들
            selectedDevice={selectedDevice} // 현재 선택된 장비 (하이라이트용)
            onDeviceClick={handleDeviceClick} // 장비 클릭 시 트레이스 실행
            onCanvasClick={() => {
              // 빈 공간 클릭 시 선택 해제 및 트레이스 정리
              setSelectedDevice(null);
              setSelectedCable(null);
              setTraceResult(null);
              setTraceError(null);
              setTraceEdges([]);
            }}
            devices={filteredDevices} // 필터링된 장비 목록
            onEdgeClick={handleEdgeClick} // 케이블 클릭 처리
          />
          {devices.length === 0 && (
            <div className="mt-6 text-white text-center text-sm bg-black/30 rounded p-2">
              ⚠️ 장비가 없습니다. JSON 파일을 업로드해주세요.
            </div>
          )}
        </div>

        {/* 오른쪽: 장비 상세 정보 및 트레이스 결과 패널 */}
        <SidePanel
          selectedDevice={selectedDevice} // 선택된 장비 정보
          selectedCable={selectedCable}
          traceResult={traceResult} // 트레이스 결과
          traceError={traceError} // 트레이스 에러 메시지
          setSelectedDevice={setSelectedDevice} // 장비 선택 상태 변경
          refetchDevices={async () => {
            // 장비 목록 새로고침 (장비 상태 변경 후 등)
            const devices = await fetchDevices();
            setDevices(devices);
          }}
          refetchCables={async () => {
            // 케이블 정보 새로고침 (케이블 연결 변경 후 등)
            const cables = await fetchCables();
            setAllCables(cables);
          }}
          setSelectedCable={setSelectedCable}
          filteredCables={filteredCables}
        />
      </div>
    </div>
  );
}
