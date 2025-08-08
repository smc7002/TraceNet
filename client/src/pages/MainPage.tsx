// 📁 src/pages/MainPage.tsx

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import { fetchCables } from "../api/cableApi";
import { pingAllDevices } from "../api/pingApi";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
import { DeviceStatus } from "../types/status";
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
import CustomNode from "../components/CustomNode";
import CustomEdge from "../utils/CustomEdge";
import { alignNodesToCalculatedCenters } from "../utils/nodeCenterCalculator";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

const ZOOM_HIDE_PC = 0.7; // PC 노드 숨김 임계값

const MainPage = () => {
 // 데이터 상태
 const [devices, setDevices] = useState<Device[]>([]);
 const [allCables, setAllCables] = useState<CableDto[]>([]);
 
 // 선택 상태
 const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
 const [selectedCable, setSelectedCable] = useState<CableDto | null>(null);
 
 // 트레이스 상태
 const [traceResult, setTraceResult] = useState<TraceResponse | null>(null);
 const [traceEdges, setTraceEdges] = useState<Edge[]>([]);
 const [traceError, setTraceError] = useState<string | null>(null);
 
 // UI 상태
 const [layoutMode] = useState<LayoutMode>(LayoutMode.Radial);
 const [searchQuery, setSearchQuery] = useState("");
 const [showProblemOnly, setShowProblemOnly] = useState(false);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [renderKey, setRenderKey] = useState(0);
 
 // Ping 관련
 const [isPinging, setIsPinging] = useState(false);
 const [pingError, setPingError] = useState<string | null>(null);
 
 // 줌 레벨
 const [currentZoomLevel, setCurrentZoomLevel] = useState(1.0);
 
 // 기타 설정
 const [keyboardNavEnabled, setKeyboardNavEnabled] = useState(true);
 const traceTimestampRef = useRef<number>(0);
 const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);

 // 줌 레벨 변경 시 PC 노드 숨김 처리
 const handleZoomChange = useCallback((zoomLevel: number) => {
   setCurrentZoomLevel(zoomLevel);
   if (window.location.hostname === "localhost") {
     console.log(`[ZOOM] ${zoomLevel.toFixed(2)} hidePC=${zoomLevel < ZOOM_HIDE_PC}`);
   }
 }, []);

 // 모든 선택 및 트레이스 초기화
 const resetSelections = useCallback(() => {
   setSelectedDevice(null);
   setSelectedCable(null);
   setTraceResult(null);
   setTraceError(null);
   setTraceEdges([]); // 케이블 애니메이션 해제
   setLayoutedNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
 }, []);

 // 레이아웃 모드 변경 시 리렌더링
 useEffect(() => {
   setRenderKey((prev) => prev + 1);
 }, [layoutMode]);

 useEffect(() => {
   if (!selectedDevice) {
     // 선택 해제 시 트레이스 유지(화면 안정성)
   }
 }, [selectedDevice]);

 // 검색 및 문제 장비 필터링
 const filteredDevices = useMemo(() => {
   return devices.filter((d) => {
     const matchSearch =
       d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       d.ipAddress.includes(searchQuery);
     const matchStatus = showProblemOnly
       ? d.status === "Offline" || d.status === "Unstable"
       : true;
     return matchSearch && matchStatus;
   });
 }, [devices, searchQuery, showProblemOnly]);

 // 케이블 검색 필터링
 const filteredCables = useMemo(() => {
   return allCables.filter((c) => {
     const q = searchQuery.toLowerCase();
     return (
       c.cableId.toLowerCase().includes(q) ||
       c.description?.toLowerCase().includes(q) ||
       c.fromDevice.toLowerCase().includes(q) ||
       c.toDevice.toLowerCase().includes(q)
     );
   });
 }, [allCables, searchQuery]);

 // 장비 데이터를 노드로 변환
 const allNodes: Node[] = useMemo(() => {
   return devices.map((device) => ({
     id: `${device.deviceId}`,
     type: "custom",
     position: { x: 0, y: 0 },
     data: {
       label: device.name,
       type: device.type.toLowerCase(),
       status: device.status,
       showLabel: true,
       mode: layoutMode,
       highlighted: // 검색어 하이라이트
         searchQuery.length > 0 &&
         (device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           device.ipAddress.includes(searchQuery)),
     },
   }));
 }, [devices, searchQuery, layoutMode]);

 // 줌 레벨에 따른 스마트 노드 필터링 (줌 아웃시 PC 숨김)
 const smartFilteredNodes = useMemo(() => {
   if (currentZoomLevel < ZOOM_HIDE_PC) {
     const filtered = allNodes.filter((n) => {
       const t = n.data?.type;
       return t === "server" || t === "switch" || t === "router";
     });
     if (window.location.hostname === "localhost") {
       console.log(`hide PC: ${allNodes.length} -> ${filtered.length}`);
     }
     return filtered;
   }
   return allNodes;
 }, [allNodes, currentZoomLevel]);

 // 케이블을 엣지로 변환 (베이스)
 const pureBaseEdges = useMemo(() => {
   const isRadial = layoutMode === LayoutMode.Radial;
   return mapCablesToEdges(allCables, isRadial);
 }, [allCables, layoutMode]);

 // 렌더링용 엣지 (PC 숨김 + 트레이스 포함)
 const smartFilteredEdges = useMemo(() => {
   const nodeIds = new Set(smartFilteredNodes.map((n) => n.id));
   const filteredBase = pureBaseEdges.filter(
     (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
   );
   const filteredTrace = traceEdges.filter(
     (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
   );
   const finalBase = excludeTraceOverlaps(filteredBase, filteredTrace);
   return [
     ...finalBase,
     ...filteredTrace.map((e) => ({ ...e, id: `trace-${e.id}` })),
   ];
 }, [pureBaseEdges, traceEdges, smartFilteredNodes]);

 // 레이아웃 계산용 엣지 (트레이스 제외로 안정성 확보)
 const baseEdgesForLayout = useMemo(() => {
   const ids = new Set(smartFilteredNodes.map((n) => n.id));
   return pureBaseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
 }, [pureBaseEdges, smartFilteredNodes]);

 // 안정적인 레이아웃 계산 (트레이스 변경에 영향받지 않음)
 const layoutResult = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
   const base =
     layoutMode === LayoutMode.Radial
       ? getNewRadialLayoutedElements(smartFilteredNodes, baseEdgesForLayout)
       : getDagreLayoutedElements(smartFilteredNodes, baseEdgesForLayout);

   const { nodes: alignedNodes } = alignNodesToCalculatedCenters(
     base.nodes,
     base.edges
   );

   return { nodes: alignedNodes, edges: base.edges as Edge[] };
 }, [layoutMode, smartFilteredNodes, baseEdgesForLayout]);

 // 선택 상태만 반영 (노드 위치는 고정)
 useEffect(() => {
   const nodesWithSelection: Node[] = layoutResult.nodes.map((node) => ({
     ...node,
     selected: selectedDevice?.deviceId.toString() === node.id,
   }));
   setLayoutedNodes(nodesWithSelection);
 }, [layoutResult, selectedDevice]);

 // 초기 데이터 로드
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
       const msg = err instanceof Error ? err.message : "알 수 없는 오류입니다.";
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

 // 전체 장비 Ping 실행
 const handlePingAll = useCallback(async () => {
   if (isPinging) return;
   setIsPinging(true);
   setPingError(null);
   try {
     const pingResults = await pingAllDevices();
     setDevices((prev) =>
       prev.map((d) => {
         const pr = pingResults.find((p) => p.deviceId === d.deviceId);
         return pr
           ? {
               ...d,
               status: pr.status as Device["status"],
               lastCheckedAt: pr.checkedAt,
             }
           : d;
       })
     );
   } catch (err) {
     const message =
       err instanceof Error ? err.message : "전체 Ping 중 오류가 발생했습니다.";
     setPingError(message);
   } finally {
     setIsPinging(false);
   }
 }, [isPinging]);

 // 노드 클릭 시 트레이스 실행
 const handleDeviceClick = useCallback(async (device: Device) => {
   setSelectedDevice(device);
   setTraceResult(null);
   setTraceError(null);

   if (device.type.toLowerCase() === "server") {
     alert("🔒 서버는 트레이스 대상이 아닙니다.");
     return;
   }

   try {
     const result = await fetchTrace(device.deviceId);
     traceTimestampRef.current = Date.now();
     const trace = mapTraceCablesToEdges(result.cables, traceTimestampRef.current);
     setTraceEdges(trace); // 새 트레이스로 교체
     setTraceResult(result);
   } catch (err) {
     const msg = err instanceof Error ? err.message : "트레이스 로드 실패";
     setTraceError(msg);
   }
 }, []);

 // 엣지 클릭 시 케이블 선택
 const handleEdgeClick = useCallback(
   (_: unknown, edge: Edge) => {
     const cableId = edge.id.replace("cable-", "");
     const found = allCables.find((c) => c.cableId === cableId);
     if (found) {
       setSelectedCable(found);
       resetSelections();
     }
   },
   [allCables, resetSelections]
 );

 // 페이지 새로고침
 const handleRefresh = useCallback(() => {
   setPingError(null);
   window.location.reload();
 }, []);

 if (loading) return <LoadingSpinner />;
 if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

 return (
   <div className="h-screen flex flex-col bg-slate-100">
     {/* 상단 제어 패널 */}
     <div className="border-b border-slate-200 shrink-0">
       <ControlBar
         onRefresh={handleRefresh}
         onToggleProblemOnly={() => setShowProblemOnly((prev) => !prev)}
         showProblemOnly={showProblemOnly}
         searchQuery={searchQuery}
         onSearchChange={setSearchQuery}
         statusCounts={{
           [DeviceStatus.Online]: devices.filter((d) => d.status === DeviceStatus.Online).length,
           [DeviceStatus.Offline]: devices.filter((d) => d.status === DeviceStatus.Offline).length,
           [DeviceStatus.Unstable]: devices.filter((d) => d.status === DeviceStatus.Unstable).length,
         }}
         onPingAll={handlePingAll}
         isPinging={isPinging}
         keyboardNavEnabled={keyboardNavEnabled}
         onToggleKeyboardNav={() => setKeyboardNavEnabled((prev) => !prev)}
       />
     </div>

     {/* Ping 에러 알림 */}
     {pingError && (
       <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-6 mt-2">
         <div className="text-red-700 text-sm">
           <strong>Ping 오류:</strong> {pingError}
         </div>
       </div>
     )}

     <div className="flex flex-1 overflow-hidden">
       {/* 메인 네트워크 다이어그램 */}
       <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-1">
         <NetworkDiagram
           key={renderKey}
           nodes={layoutedNodes}
           edges={smartFilteredEdges} // 트레이스 포함된 최종 엣지
           selectedDevice={selectedDevice}
           onDeviceClick={handleDeviceClick}
           onCanvasClick={resetSelections}
           devices={devices}
           onEdgeClick={handleEdgeClick}
           nodeTypes={nodeTypes}
           edgeTypes={edgeTypes}
           keyboardNavigationEnabled={keyboardNavEnabled}
           isPinging={isPinging}
           viewMode="full"
           showOnlyProblems={showProblemOnly}
           zoomLevel={currentZoomLevel}
           onZoomChange={handleZoomChange}
         />
         {/* 빈 상태 메시지 */}
         {devices.length === 0 && (
           <div className="mt-6 text-white text-center text-sm bg-black/30 rounded p-2">
             ⚠️ 장비가 없습니다. JSON 파일을 업로드해주세요.
           </div>
         )}
       </div>

       {/* 우측 정보 패널 */}
       <SidePanel
         selectedDevice={selectedDevice}
         selectedCable={selectedCable}
         traceResult={traceResult}
         traceError={traceError}
         setSelectedDevice={setSelectedDevice}
         setSelectedCable={setSelectedCable}
         filteredCables={filteredCables}
         refetchDevices={async () => setDevices(await fetchDevices())}
         refetchCables={async () => setAllCables(await fetchCables())}
         devices={devices}
       />
     </div>
   </div>
 );
};

export default MainPage;