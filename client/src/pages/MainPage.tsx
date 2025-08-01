/* eslint-disable @typescript-eslint/no-explicit-any */
// 📁 src/pages/MainPage.tsx

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import { fetchCables } from "../api/cableApi";
import { DeviceStatus } from "../types/status";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
import {
  LayoutMode,
  getNewRadialLayoutedElements,
  getDagreLayoutedElements,
} from "../utils/layout";
import {
  mapCablesToEdges,
  mapTraceCablesToEdges,
  excludeTraceOverlaps,
} from "../utils/edgeMapper";
import type { Node, Edge } from "react-flow-renderer";

import NetworkDiagram from "../components/NetworkDiagram";
import SidePanel from "../components/SidePanel";
import ControlBar from "../components/ControlBar";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";
import LayoutSwitcher from "../components/LayoutSwitcher";
import CustomNode from "../components/CustomNode";
import CustomEdge from "../utils/CustomEdge";
import { alignNodesToCalculatedCenters } from "../utils/nodeCenterCalculator";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

export default function MainPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [allCables, setAllCables] = useState<CableDto[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [traceResult, setTraceResult] = useState<TraceResponse | null>(null);
  const [selectedCable, setSelectedCable] = useState<CableDto | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(LayoutMode.Radial);
  const [traceEdges, setTraceEdges] = useState<Edge[]>([]);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProblemOnly, setShowProblemOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renderKey, setRenderKey] = useState(0);
  const traceTimestampRef = useRef<number>(0);

  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);
  const [layoutedEdges, setLayoutedEdges] = useState<Edge[]>([]);

  useEffect(() => {
    setRenderKey((prev) => prev + 1);
  }, [layoutMode]);

  useEffect(() => {
    if (!selectedDevice) setTraceEdges([]);
  }, [selectedDevice]);

  const filteredDevices = useMemo(() => {
    if (!Array.isArray(devices)) return [];
    return devices.filter((d) => {
      const matchSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.ipAddress.includes(searchQuery);
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

  // const baseEdges = useMemo(() => {
  //   const isRadial = layoutMode === LayoutMode.Radial;
  //   const base = mapCablesToEdges(allCables, isRadial);
  //   return excludeTraceOverlaps(base, traceEdges);
  // }, [allCables, traceEdges, layoutMode]);

  // const allEdges = useMemo(() => {
  //   const combined = [...baseEdges, ...traceEdges];
  //   console.log("🧪 [All Edges Combined]", combined);
  //   return combined;
  // }, [baseEdges, traceEdges]);

  // 🎯 allNodes 생성 로직 수정
  const allNodes: Node[] = useMemo(() => {
    return filteredDevices.map((device) => ({
      id: `${device.deviceId}`,
      type: "custom",
      // ❌ 기존: position: { x: 0, y: 0 },
      // ✅ 수정: 초기 위치를 제거하고 layout에서만 결정
      position: { x: 0, y: 0 }, // 임시 위치, layout에서 덮어씀
      data: {
        label: device.name,
        type: device.type.toLowerCase(),
        status: device.status,
        showLabel: true,
        mode: layoutMode, // 🎯 레이아웃 모드 정보 추가
      },
    }));
  }, [filteredDevices, layoutMode]); // layoutMode도 의존성에 추가

  // 🎯 레이아웃 적용 useEffect

  // 🎯 baseEdges에서 traceEdges 의존성 제거
  const pureBaseEdges = useMemo(() => {
    const isRadial = layoutMode === LayoutMode.Radial;
    return mapCablesToEdges(allCables, isRadial); // excludeTraceOverlaps 제거
  }, [allCables, layoutMode]); // traceEdges 의존성 제거

  // 🎯 렌더링용 엣지는 별도로 계산
  const renderEdges = useMemo(() => {
    const filteredBase = excludeTraceOverlaps(pureBaseEdges, traceEdges);
    return [
      ...filteredBase,
      ...traceEdges.map((edge) => ({
        ...edge,
        id: `trace-${edge.id}`,
      })),
    ];
  }, [pureBaseEdges, traceEdges]);

  useEffect(() => {
    console.log("🎯 === 레이아웃 적용 시작 ===");
    console.log("📊 입력 데이터:", {
      layoutMode,
      nodeCount: allNodes.length,
      edgeCount: pureBaseEdges.length, // 🔧 수정: pureBaseEdges 사용
    });

    // 🔍 입력 데이터 검증
    console.log("🔍 노드 데이터 샘플:", allNodes.slice(0, 3));
    console.log("🔍 엣지 데이터 샘플:", pureBaseEdges.slice(0, 3)); // 🔧 수정

    // 1️⃣ 기본 레이아웃 계산
    const basicLayout =
      layoutMode === LayoutMode.Radial
        ? getNewRadialLayoutedElements(allNodes, pureBaseEdges)
        : getDagreLayoutedElements(allNodes, pureBaseEdges);

    console.log("📐 기본 레이아웃 계산 완료");

    // 🔍 기본 레이아웃 결과 검증
    const serverNode = basicLayout.nodes.find((n) => n.data?.type === "server");
    const switchNodes = basicLayout.nodes.filter(
      (n) => n.data?.type === "switch"
    );

    console.log("🔍 기본 레이아웃 결과:");
    console.log("  서버:", serverNode?.data?.label, serverNode?.position);
    console.log(
      "  스위치들:",
      switchNodes.map((n) => ({
        label: n.data?.label,
        id: n.id,
        position: n.position,
      }))
    );

    // 2️⃣ 🎯 노드 중심점으로 정렬
    console.log("🎯 === 중심점 정렬 시작 ===");

    const finalLayout = alignNodesToCalculatedCenters(
      basicLayout.nodes,
      basicLayout.edges
    );

    console.log("🎯 === 중심점 정렬 완료 ===");

    // 🔍 최종 결과 검증
    const finalServerNode = finalLayout.nodes.find(
      (n) => n.data?.type === "server"
    );
    const finalSwitchNodes = finalLayout.nodes.filter(
      (n) => n.data?.type === "switch"
    );

    console.log("🔍 최종 레이아웃 결과:");
    console.log(
      "  서버:",
      finalServerNode?.data?.label,
      finalServerNode?.position
    );
    console.log(
      "  스위치들:",
      finalSwitchNodes.map((n) => ({
        label: n.data?.label,
        id: n.id,
        position: n.position,
        moved: n.data?.centerAligned,
      }))
    );

    // 3️⃣ 상태 업데이트
    setLayoutedNodes(finalLayout.nodes);
    setLayoutedEdges(finalLayout.edges);

    // 🔍 검증: 5초 후 실제 렌더링된 위치 확인 (개발용)
    setTimeout(() => {
      console.log("🔍 === 5초 후 React Flow 내부 좌표 확인 ===");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reactFlowInstance = (window as any).reactFlowInstance;

      if (reactFlowInstance) {
        // React Flow에서 직접 노드 정보 가져오기
        const serverFlowNode = reactFlowInstance.getNode("83");
        const sw01FlowNode = reactFlowInstance.getNode("80");

        console.log("📍 서버 Flow 노드 전체:", serverFlowNode);
        console.log("📍 SW-01 Flow 노드 전체:", sw01FlowNode);

        // 노드 ID 목록 확인
        const allFlowNodes = reactFlowInstance.getNodes();
        console.log(
          "📍 모든 Flow 노드 ID들:",
          allFlowNodes.map((n) => n.id)
        );

        // 노드 타입별 실제 크기 확인
        const serverNode = allFlowNodes.find((n: any) => n.data?.type === "server");
        const switchNode = allFlowNodes.find((n: any) => n.data?.type === "switch");
        const pcNode = allFlowNodes.find((n: any) => n.data?.type === "pc");

        console.log("📏 실제 노드 크기들:");
        console.log("서버:", serverNode?.width, "x", serverNode?.height);
        console.log("스위치:", switchNode?.width, "x", switchNode?.height);
        console.log("PC:", pcNode?.width, "x", pcNode?.height);

        // 실제 DOM 위치도 함께 확인
        const serverElement = document.querySelector('[data-id="83"]');
        const sw01Element = document.querySelector('[data-id="80"]');

        if (serverElement && sw01Element) {
          const containerElement = document.querySelector(".react-flow");
          const containerRect = containerElement?.getBoundingClientRect();

          const serverRect = serverElement.getBoundingClientRect();
          const sw01Rect = sw01Element.getBoundingClientRect();

          // 컨테이너 기준 상대 좌표 계산
          if (containerRect) {
            console.log("📍 서버 컨테이너 기준 위치:", {
              x: serverRect.x - containerRect.x,
              y: serverRect.y - containerRect.y,
            });
            console.log("📍 SW-01 컨테이너 기준 위치:", {
              x: sw01Rect.x - containerRect.x,
              y: sw01Rect.y - containerRect.y,
            });
          }
        }
      }
    }, 5000);

    console.log("✅ === 전체 레이아웃 처리 완료 ===");
  }, [layoutMode, allNodes, pureBaseEdges]); // 🔧 수정: pureBaseEdges 의존성

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [deviceData, cableData] = await Promise.all([
          fetchDevices(),
          fetchCables(),
        ]);
        if (isMounted) {
          setDevices(deviceData);
          setAllCables(cableData);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "알 수 없는 오류입니다.";
        if (isMounted) setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDeviceClick = useCallback(async (device: Device) => {
    setSelectedDevice(device);
    setTraceResult(null);
    setTraceError(null);
    setTraceEdges([]);

    if (device.type.toLowerCase() === "server") {
      alert("🔒 서버는 트레이스 대상이 아닙니다.");
      return;
    }

    try {
      const result = await fetchTrace(device.deviceId);
      traceTimestampRef.current = Date.now();
      const trace = mapTraceCablesToEdges(
        result.cables,
        traceTimestampRef.current
      );
      setTraceEdges(trace);
      setTraceResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "트레이스 로드 실패";
      setTraceError(msg);
    }
  }, []);

  const handleEdgeClick = useCallback(
    (_: unknown, edge: Edge) => {
      const cableId = edge.id.replace("cable-", "");
      const found = allCables.find((c) => c.cableId === cableId);
      if (found) {
        setSelectedCable(found);
        setSelectedDevice(null);
        setTraceResult(null);
        setTraceError(null);
        setTraceEdges([]);
      }
    },
    [allCables]
  );

  if (loading) return <LoadingSpinner />;
  if (error)
    return (
      <ErrorState message={error} onRetry={() => window.location.reload()} />
    );

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <div className="border-b border-slate-200 shrink-0">
        <ControlBar
          onRefresh={() => window.location.reload()}
          onToggleProblemOnly={() => setShowProblemOnly((prev) => !prev)}
          showProblemOnly={showProblemOnly}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusCounts={{
            [DeviceStatus.Online]: devices.filter(
              (d) => d.status === DeviceStatus.Online
            ).length,
            [DeviceStatus.Offline]: devices.filter(
              (d) => d.status === DeviceStatus.Offline
            ).length,
            [DeviceStatus.Unstable]: devices.filter(
              (d) => d.status === DeviceStatus.Unstable
            ).length,
          }}
        />
      </div>

      <LayoutSwitcher layoutMode={layoutMode} onChange={setLayoutMode} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
          <NetworkDiagram
            key={renderKey}
            nodes={layoutedNodes}
            edges={renderEdges}
            selectedDevice={selectedDevice}
            onDeviceClick={handleDeviceClick}
            onCanvasClick={() => {
              setSelectedDevice(null);
              setSelectedCable(null);
              setTraceResult(null);
              setTraceError(null);
              setTraceEdges([]);
            }}
            devices={filteredDevices}
            onEdgeClick={handleEdgeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
          />
          {devices.length === 0 && (
            <div className="mt-6 text-white text-center text-sm bg-black/30 rounded p-2">
              ⚠️ 장비가 없습니다. JSON 파일을 업로드해주세요.
            </div>
          )}
        </div>

        <SidePanel
          selectedDevice={selectedDevice}
          selectedCable={selectedCable}
          traceResult={traceResult}
          traceError={traceError}
          setSelectedDevice={setSelectedDevice}
          refetchDevices={async () => {
            const devices = await fetchDevices();
            setDevices(devices);
          }}
          refetchCables={async () => {
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
