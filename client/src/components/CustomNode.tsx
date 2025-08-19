// 📁 client/src/components/CustomNode.tsx

import { memo, useMemo } from "react";
import {
  Monitor,
  Server,
  Router,
  Activity,
  AlertTriangle,
  Wifi,
  WifiOff,
  Ban,
} from "lucide-react";
import { Handle, Position } from "react-flow-renderer";
import type { NodeProps } from "react-flow-renderer";

/**
 * Network Device Custom Node Component
 *
 * 핵심 기능:
 * - 다양한 네트워크 디바이스 타입 지원 (서버, 스위치, PC, 라우터)
 * - 실시간 Ping 상태 모니터링 및 시각적 피드백
 * - 다중 레이아웃 모드 지원 (Dagre, Radial)
 * - 동적 Handle 위치 계산을 통한 최적화된 연결점 배치
 * - 접근성 및 사용자 경험 최적화
 *
 * 설계 목표:
 * - 직관적인 네트워크 구조 파악
 * - 장애 상황 즉시 식별 가능
 * - 실시간 Ping 모니터링
 * - 확장 가능한 컴포넌트 아키텍처
 * - 고성능 렌더링 (React.memo 최적화)
 * - 일관된 디자인 언어 적용 (Tailwind CSS)
 */

// ==========================================
// 타입 정의 및 인터페이스
// ==========================================

/**
 * 네트워크 디바이스 상태 열거형 (Ping 상태 포함)
 *
 * 실시간 Ping 모니터링 시스템과 연동하여 각 디바이스의 현재 상태를 표현
 *
 * @enum {string}
 */
export type DeviceStatus =
  | "Online"
  | "Offline"
  | "Unstable"
  | "Unknown"
  | "Unreachable";

/**
 * 지원되는 네트워크 디바이스 타입
 *
 * 제조업 환경에서 일반적으로 사용되는 네트워크 장비 분류
 *
 * @enum {string}
 */
export type DeviceType = "server" | "switch" | "pc" | "router";

/**
 * 레이아웃 모드 타입
 *
 * 네트워크 토폴로지 시각화 방식을 정의
 *
 * @enum {string}
 */
export type LayoutMode = "radial" | "dagre" | "hierarchical";

/**
 * 커스텀 노드 데이터 인터페이스 (Ping 정보 추가)
 *
 * React Flow 노드에 전달되는 모든 필수 및 선택적 데이터를 정의
 * 실제 네트워크 디바이스의 속성과 시각화 설정을 포함
 *
 * @interface CustomNodeData
 */
export interface CustomNodeData {
  /** 디바이스 타입 - 아이콘 및 스타일 결정 */
  type: DeviceType;

  /** 실시간 디바이스 상태 - 색상 및 알림 표시 (Ping 결과 반영) */
  status: DeviceStatus;

  /** 디바이스 표시명 - 사용자 식별용 */
  label: string;

  /** 현재 적용된 레이아웃 모드 - Handle 위치 계산용 */
  mode?: LayoutMode;

  /** 라벨 표시 여부 - UI 밀도 조절용 */
  showLabel?: boolean;

  /** IP 주소 - 네트워크 식별 및 진단용 */
  ipAddress?: string;

  /**  Ping 결과 - 레이턴시 정보 (밀리초) */
  latencyMs?: number | null;

  /**  Ping 마지막 체크 시간 */
  lastCheckedAt?: string;

  /** 확장 메타데이터 - 추후 기능 확장용 */
  metadata?: Record<string, unknown>;

  /** 방사형 레이아웃에서의 각도 정보 - Handle 위치 최적화용 */
  angleInDegrees?: number;
  highlighted?: boolean;
}

/**
 * 커스텀 노드 컴포넌트 Props 인터페이스
 *
 * React Flow NodeProps를 확장하여 커스텀 기능 지원
 *
 * @interface CustomNodeProps
 * @extends {NodeProps}
 */
interface CustomNodeProps extends NodeProps {
  /** 노드 데이터 객체 */
  data: CustomNodeData;

  /** 레이아웃 엔진에서 계산된 출력 Handle 위치 */
  sourcePosition?: Position;

  /** 레이아웃 엔진에서 계산된 입력 Handle 위치 */
  targetPosition?: Position;
}

// ==========================================
//  스타일 및 시각적 설정 상수 (Ping 상태 추가)
// ==========================================

/**
 * 디바이스 상태별 텍스트 색상 매핑 (Ping 상태 포함)
 *
 * Tailwind CSS 클래스를 사용한 일관된 색상 체계
 * 접근성을 고려한 충분한 대비율 확보
 *
 * @constant
 */
const DEVICE_COLORS = {
  Online: "text-green-500", // 정상: 초록색 (성공)
  Offline: "text-red-500", // 오프라인: 빨간색 (위험)
  Unstable: "text-yellow-500", // 불안정: 노란색 (경고)
  Unknown: "text-gray-400", // 알 수 없음: 회색 (중립)
  Unreachable: "text-red-600", // 도달불가: 진한 빨강 (심각)
} as const;

/**
 * 디바이스 상태별 배경 색상 매핑
 *
 * 노드 전체의 배경색을 상태에 따라 구분
 * 미묘한 색조로 과도한 시각적 자극 방지
 *
 * @constant
 */
const DEVICE_BG_COLORS = {
  Online: "bg-green-50", // 연한 초록 배경
  Offline: "bg-red-50", // 연한 빨강 배경
  Unstable: "bg-yellow-50", // 연한 노랑 배경
  Unknown: "bg-gray-50", // 연한 회색 배경
  Unreachable: "bg-red-100", // 진한 빨강 배경
} as const;

/**
 * 디바이스 타입별 아이콘 크기 설정
 *
 * 디바이스의 중요도와 계층에 따른 시각적 위계 구성
 * 서버 > 스위치/라우터 > PC 순으로 크기 차등 적용
 *
 * @constant
 */
const ICON_SIZES = {
  server: 28, // 서버: 가장 큰 아이콘 (네트워크 중심)
  switch: 24, // 스위치: 중간 크기 (중계 장비)
  router: 24, // 라우터: 중간 크기 (중계 장비)
  pc: 20, // PC: 작은 아이콘 (엔드포인트)
} as const;

/**
 * 디바이스 타입별 노드 컨테이너 크기
 *
 * Tailwind CSS 클래스를 사용한 반응형 크기 설정
 * 아이콘 크기와 비례하여 일관된 시각적 균형 유지
 *
 * @constant
 */
const NODE_SIZES = {
  server: "w-14 h-14", // 56px × 56px
  switch: "w-12 h-12", // 48px × 48px
  router: "w-12 h-12", // 48px × 48px
  pc: "w-10 h-10", // 40px × 40px
} as const;

/**
 * Handle 위치 계산용 노드 반지름 값
 *
 * 방사형 레이아웃에서 Handle이 노드 경계선에 정확히 위치하도록
 * 각 디바이스 타입별 반지름을 픽셀 단위로 정의
 *
 * @constant
 */
const NODE_RADIUS = {
  server: 28, // NODE_SIZES의 절반값 (w-14 = 56px / 2)
  switch: 24, // NODE_SIZES의 절반값 (w-12 = 48px / 2)
  router: 24, // NODE_SIZES의 절반값 (w-12 = 48px / 2)
  pc: 20, // NODE_SIZES의 절반값 (w-10 = 40px / 2)
} as const;

/**
 * Dagre 레이아웃용 Handle 스타일
 *
 * 계층형 레이아웃에서 사용되는 명확한 연결점 표시
 * 시각적 구분을 위한 배경색과 테두리 적용
 *
 * @constant
 */
const HANDLE_STYLE = {
  background: "#6b7280", // 회색 배경 (neutral-500)
  border: "2px solid #ffffff", // 흰색 테두리 (명확한 구분)
  width: 8, // 8px 원형
  height: 8,
  borderRadius: "50%", // 완전한 원형
};

/**
 * 방사형 레이아웃용 투명 Handle 스타일
 *
 * 방사형 레이아웃에서는 시각적 간소화를 위해 Handle을 숨김
 * 하지만 기능적으로는 연결 가능하도록 유지
 *
 * @constant
 */
const RADIAL_HANDLE_STYLE = {
  background: "transparent", // 투명 배경
  border: "none", // 테두리 없음
  width: 8,
  height: 8,
  pointerEvents: "auto" as const, // 마우스 이벤트는 활성 유지
};

// ==========================================
// 스타일링 유틸리티 함수들 (Ping 상태 대응)
// ==========================================

/**
 * 디바이스 상태에 따른 텍스트 색상 클래스 반환
 *
 * @param status - 디바이스 상태 (Ping 결과 포함)
 * @returns Tailwind CSS 텍스트 색상 클래스
 */
const getStatusColor = (status: DeviceStatus): string =>
  DEVICE_COLORS[status] || "text-gray-400";

/**
 * 디바이스 상태에 따른 배경 색상 클래스 반환
 *
 * @param status - 디바이스 상태 (Ping 결과 포함)
 * @returns Tailwind CSS 배경 색상 클래스
 */
const getStatusBgColor = (status: DeviceStatus): string =>
  DEVICE_BG_COLORS[status] || "bg-gray-50";

/**
 * 디바이스 타입별 아이콘 컴포넌트 생성 함수
 *
 * 기능:
 * - 디바이스 타입에 따른 적절한 Lucide 아이콘 선택
 * - 상태별 색상 자동 적용
 * - 접근성을 위한 aria-hidden 속성 설정
 * - 타입별 최적화된 아이콘 크기 적용
 *
 * @param type - 디바이스 타입
 * @param status - 디바이스 상태 (Ping 결과 포함)
 * @returns 스타일이 적용된 React 아이콘 컴포넌트
 */
const getDeviceIcon = (type: DeviceType, status: DeviceStatus) => {
  const colorClass = getStatusColor(status);
  const size = ICON_SIZES[type] || ICON_SIZES.pc;

  // 모든 아이콘에 공통 적용될 props
  const iconProps = {
    size,
    className: colorClass,
    "aria-hidden": true, // 스크린 리더에서 숨김 (장식용)
  };

  // 디바이스 타입별 아이콘 매핑
  switch (type) {
    case "server":
      return <Server {...iconProps} />;

    case "switch":
      return <Router {...iconProps} />;

    case "router":
      return <Wifi {...iconProps} />;

    case "pc":
    default:
      return <Monitor {...iconProps} />;
  }
};

/**
 * 디바이스 상태별 상태 표시 아이콘 생성 함수 (Ping 상태 포함)
 *
 *  기능:
 * - Ping 결과에 따른 직관적인 시각적 피드백 제공
 * - 소형 아이콘으로 공간 효율성 확보
 * - 일관된 디자인 시스템 적용
 *
 * @param status - 디바이스 상태 (Ping 결과)
 * @returns 상태를 나타내는 React 컴포넌트
 */
const getStatusIcon = (status: DeviceStatus) => {
  const props = { size: 12, className: getStatusColor(status) };

  switch (status) {
    case "Online":
      // 온라인 상태: Activity 아이콘 (파형 모양)
      return <Activity {...props} />;

    case "Unstable":
      // 불안정 상태: 경고 삼각형
      return <AlertTriangle {...props} />;

    case "Offline":
      // 오프라인 상태: WiFi 끊김 아이콘
      return <WifiOff {...props} />;

    case "Unreachable":
      // 도달불가 상태: 금지 아이콘
      return <Ban {...props} />;

    case "Unknown":
    default:
      // 알 수 없음: 단순한 회색 점
      return <div className="w-3 h-3 rounded-full bg-gray-400" />;
  }
};

/**
 *  레이턴시 값에 따른 색상 클래스 반환
 *
 * @param latencyMs - 레이턴시 (밀리초)
 * @returns Tailwind CSS 텍스트 색상 클래스
 */
const getLatencyColor = (latencyMs: number | null): string => {
  if (latencyMs === null) return "text-gray-500";
  if (latencyMs < 100) return "text-green-600"; // 빠름
  if (latencyMs < 500) return "text-yellow-600"; // 보통
  return "text-red-600"; // 느림
};

/**
 *  레이턴시 표시 텍스트 생성
 *
 * @param latencyMs - 레이턴시 (밀리초)
 * @returns 표시할 텍스트 문자열
 */
const getLatencyText = (latencyMs: number | null): string => {
  if (latencyMs === null) return "timeout";
  return `${latencyMs}ms`;
};

/**
 * 노드 컨테이너의 동적 스타일 클래스 생성 함수
 *
 *  기능:
 * - 선택 상태에 따른 시각적 피드백
 * - 상태별 배경색 및 테두리 설정
 * - 호버 효과 및 트랜지션 애니메이션
 * - 그림자 및 크기 조절 효과
 *
 * 🎨 시각적 효과:
 * - 선택 시: 황금색 링 + 그림자 강화
 * - 호버 시: 파란색 링 + 약간 확대
 * - 부드러운 트랜지션으로 자연스러운 UX
 *
 * @param selected - 노드 선택 상태
 * @param status - 디바이스 상태
 * @param type - 디바이스 타입
 * @returns 스타일 클래스 객체
 */

// 🎨 노드 타입별 라벨 스타일 상수 정의
const LABEL_STYLES = {
  server:
    "mt-2 text-xs font-black text-white bg-blue-900/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-center max-w-24 truncate shadow-lg border border-white/20",
  switch:
    "mt-2 text-xs font-bold text-white bg-purple-900/90 backdrop-blur-sm px-2 py-1 rounded-md text-center max-w-20 truncate shadow-md border border-white/20",
  router:
    "mt-2 text-xs font-bold text-white bg-green-900/90 backdrop-blur-sm px-2 py-1 rounded-md text-center max-w-20 truncate shadow-md border border-white/20",
  pc: "mt-2 text-xs text-gray-700 font-medium text-center max-w-20 truncate",
} as const;

const getNodeStyles = (
  selected: boolean,
  highlighted: boolean,
  status: DeviceStatus,
  type: DeviceType
) => {
  // 링 스타일 결정: 선택됨 > 하이라이트됨 > 기본
  const ring = selected
    ? "ring-2 ring-amber-400 ring-offset-2" // 선택된 노드: 노란색 링
    : highlighted
    ? "ring-8 ring-red-400 ring-offset-2 animate-pulse" // 검색 결과: 
    : "ring-1 ring-slate-200"; // 기본: 회색 얇은 링

  // 하이라이트 시 펄스 애니메이션 추가
  const pulse = highlighted ? "animate-pulse" : "";

  // 마우스 호버 시 파란색 링과 확대 효과
  const hoverEffect = "hover:ring-2 hover:ring-blue-300 hover:scale-105";

  // 부드러운 전환 애니메이션 (200ms)
  const transition = "transition-all duration-200 ease-in-out";

  // 그림자 효과: 선택/하이라이트 상태에 따라 다른 색상
  const shadow = selected
    ? "drop-shadow-[0_0_3px_white]" // 선택: 흰색 글로우
    : highlighted
    ? "drop-shadow-[0_0_6px_pink]" // 하이라이트: 핑크 글로우
    : "drop-shadow-[0_0_2px_gray]"; // 기본: 회색 그림자

  // 상태에 따른 배경색 (Online=녹색, Offline=빨강 등)
  const bgColor = getStatusBgColor(status);

  // 장비 타입별 노드 크기 (server > switch > pc)
  const nodeSize = NODE_SIZES[type] || NODE_SIZES.pc;

  return {
    // 메인 노드 컨테이너: 원형 + 상태색 + 링 + 애니메이션
    container: `${nodeSize} rounded-full ${bgColor} border-2 border-white ${ring} ${pulse} ${shadow} ${hoverEffect} ${transition} flex items-center justify-center cursor-pointer relative`,

    // 노드 라벨 스타일 (장비 타입별로 다름)
    label: LABEL_STYLES[type] || LABEL_STYLES.pc,

    // 상태 배지: 우상단 작은 원 (상태 아이콘 표시용)
    statusBadge:
      "absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm",
  };
};

/**
 * 방사형 레이아웃에서 Handle의 정확한 위치 계산 함수
 *
 * 🧮 수학적 계산:
 * - 노드의 원형 경계선에 Handle을 정확히 위치시킴
 * - 각 방향별로 적절한 오프셋 값 계산
 * - CSS transform을 활용한 중심점 정렬
 *
 * @param position - Handle의 방향 (Top, Bottom, Left, Right)
 * @param nodeType - 노드 타입 (크기 계산용)
 * @returns CSS 스타일 객체 (위치 및 변환 속성)
 */
function getRadialHandleOffset(
  position: Position,
  nodeType: DeviceType
): {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
} {
  // 노드 타입별 반지름 조회
  const radius = NODE_RADIUS[nodeType] || NODE_RADIUS.pc;

  switch (position) {
    case Position.Top:
      // 🔝 상단 Handle: 노드 위쪽 경계에 중앙 정렬
      return {
        top: `-${radius}px`,
        left: "50%",
        transform: "translateX(-50%)",
      };

    case Position.Bottom:
      // 하단 Handle: 노드 아래쪽 경계에 중앙 정렬
      return {
        bottom: `-${radius}px`,
        left: "50%",
        transform: "translateX(-50%)",
      };

    case Position.Left:
      // 좌측 Handle: 노드 왼쪽 경계에 중앙 정렬
      return {
        left: `-${radius}px`,
        top: "50%",
        transform: "translateY(-50%)",
      };

    case Position.Right:
      // 우측 Handle: 노드 오른쪽 경계에 중앙 정렬
      return {
        right: `-${radius}px`,
        top: "50%",
        transform: "translateY(-50%)",
      };

    default:
      // 기본값: 위치 지정 없음
      return {};
  }
}

// ==========================================
// 메인 컴포넌트 구현부 (Ping 정보 표시 추가)
// ==========================================

/**
 * 커스텀 네트워크 노드 컴포넌트 (Ping 모니터링 기능 포함)
 *
 *  아키텍처 특징:
 * - React.memo를 통한 렌더링 최적화
 * - useMemo를 활용한 계산 결과 캐싱
 * - 접근성 표준 준수 (ARIA 속성)
 * - 반응형 디자인 지원
 *
 *  핵심 기능:
 * - 다중 레이아웃 모드 지원 (Dagre/Radial)
 * - 동적 Handle 위치 계산
 * - 실시간 Ping 상태 반영
 * - 레이턴시 정보 표시
 * - 키보드 네비게이션 지원
 *
 *  시각적 특징:
 * - Ping 상태별 색상 구분
 * - 부드러운 애니메이션 효과
 * - 직관적인 아이콘 시스템
 * - 일관된 디자인 언어
 */
function CustomNode({
  data,
  selected = false,
  targetPosition = Position.Top,
}: CustomNodeProps) {
  // ⚙️ 컴포넌트 설정 추출
  const showLabel = data.showLabel ?? true;
  const mode = data.mode || "dagre";
  const type = data.type;
  const status = data.status;

  // 🎨 스타일 객체 메모이제이션 (리렌더링 최적화)
  const styles = useMemo(
    () => getNodeStyles(selected, data.highlighted === true, status, type),
    [selected, data.highlighted, status, type]
  );

  // 🖼️ 아이콘 컴포넌트 메모이제이션
  const deviceIcon = useMemo(() => getDeviceIcon(type, status), [type, status]);
  const statusIcon = useMemo(() => getStatusIcon(status), [status]);

  // 🔌 레이아웃 모드별 Handle 스타일 결정
  const dagreHandleStyle =
    mode === "dagre" ? HANDLE_STYLE : RADIAL_HANDLE_STYLE;

  // 📍 방사형 레이아웃용 Handle 위치 계산
  const targetOffset =
    mode === "radial" ? getRadialHandleOffset(targetPosition, type) : {};

  return (
    <div
      className="flex flex-col items-center relative z-10"
      role="button"
      tabIndex={0}
      aria-label={`${type} ${data.label} - ${status} ${
        data.latencyMs ? `(${data.latencyMs}ms)` : ""
      }`}
      aria-selected={selected}
    >
      {/* 🎯 Target Handle - 입력 연결점 */}
      <Handle
        type="target"
        position={targetPosition}
        id="target"
        style={{
          ...dagreHandleStyle,
          ...(mode === "radial" && targetOffset),
        }}
      />

      {/* 🎯 Central Handle - 중앙 연결점 (방사형 전용) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="center-handle"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          ...RADIAL_HANDLE_STYLE,
        }}
      />

      {/* 🌟 Server Node Special Handles (방사형 모드 전용) */}
      {mode === "radial" && type === "server" && (
        <>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const offset = 28;
            const isSource = angle < 180;

            return (
              <Handle
                key={`server-${angle}`}
                type={isSource ? "source" : "target"}
                position={Position.Bottom}
                id={`${isSource ? "source" : "target"}-${angle}`}
                style={{
                  position: "absolute",
                  left: `${50 + Math.cos(rad) * offset}px`,
                  top: `${50 + Math.sin(rad) * offset}px`,
                  transform: "translate(-50%, -50%)",
                  ...RADIAL_HANDLE_STYLE,
                }}
              />
            );
          })}
        </>
      )}

      {/* 노드 메인 컨테이너 */}
      <div className={styles.container}>
        {/* 디바이스 타입 아이콘 */}
        {deviceIcon}

        {/* 상태 표시 배지 (우상단) - Ping 상태 반영 */}
        <div className={styles.statusBadge}>{statusIcon}</div>
      </div>

      {/* 노드 라벨 표시 */}
      {showLabel && (
        <div className={styles.label} title={data.label}>
          {data.label}
        </div>
      )}

      {/* IP 주소 표시 (옵션) */}
      {showLabel && data.ipAddress && (
        <div className="text-xs text-gray-500 font-mono mt-1">
          {data.ipAddress}
        </div>
      )}

      {/* Ping 레이턴시 표시 */}
      {showLabel && data.latencyMs !== undefined && (
        <div
          className={`text-xs font-semibold mt-1 ${getLatencyColor(
            data.latencyMs
          )}`}
          title={`Ping: ${getLatencyText(data.latencyMs)} ${
            data.lastCheckedAt
              ? `(${new Date(data.lastCheckedAt).toLocaleTimeString()})`
              : ""
          }`}
        >
          📡 {getLatencyText(data.latencyMs)}
        </div>
      )}
    </div>
  );
}

// 🚀 성능 최적화: React.memo로 불필요한 리렌더링 방지
export default memo(CustomNode);
