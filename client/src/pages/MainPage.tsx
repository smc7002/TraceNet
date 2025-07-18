import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import { fetchCables } from "../api/cableApi";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
import { mapCablesToEdges, mapTraceCablesToEdges } from "../utils/edgeMapper";
import { getDagreLayoutedElements } from "../utils/layout";
import type { Node, Edge } from "react-flow-renderer";

import ControlBar from "../components/ControlBar";
import NetworkDiagram from "../components/NetworkDiagram";
import SidePanel from "../components/SidePanel";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorState from "../components/ErrorState";

export default function MainPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProblemOnly, setShowProblemOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [traceResult, setTraceResult] = useState<TraceResponse | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [allCables, setAllCables] = useState<CableDto[]>([]);

  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);
  const [layoutedEdges, setLayoutedEdges] = useState<Edge[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [deviceData, cableData] = await Promise.all([
          fetchDevices(),
          fetchCables(),
        ]);

        if (isMounted) {
          console.log("📦 장비 응답:", deviceData);
          console.log("🧵 케이블 응답:", cableData);

          setDevices(deviceData);
          setAllCables(cableData);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "알 수 없는 오류입니다.";
        if (isMounted) setError(msg);
        console.error("❌ 데이터 로딩 오류:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (devices.length === 0 || allCables.length === 0) {
      console.warn("⚠️ devices 또는 allCables가 아직 준비되지 않았습니다.");
      return;
    }

    const baseEdges = mapCablesToEdges(allCables);
    const traceEdges = mapTraceCablesToEdges(traceResult?.cables ?? []);
    const allEdges = [...baseEdges, ...traceEdges];

    const nodes: Node[] = devices.map((device) => ({
      id: device.deviceId.toString(),
      data: {
        label: `${device.name}`,
        type: device.type,
      },
      position: { x: 0, y: 0 }, // dagre가 덮어씌움
    }));

    const { nodes: layoutedN, edges: layoutedE } = getDagreLayoutedElements(
      nodes,
      allEdges
    );

    // 🔍 Edge source/target이 실제 노드와 매칭되는지 확인
    console.groupCollapsed("🧪 baseEdges → 노드 ID 매핑 확인");
    baseEdges.forEach((edge) => {
      const sourceExists = devices.some(
        (d) => d.deviceId.toString() === edge.source
      );
      const targetExists = devices.some(
        (d) => d.deviceId.toString() === edge.target
      );
      console.log(
        `Edge ${edge.id}: ${edge.source} → ${edge.target} | Source OK: ${sourceExists}, Target OK: ${targetExists}`
      );
    });
    console.groupEnd();

    // 🔍 layoutedEdges가 올바른 노드 위치를 참조하는지 확인
    console.groupCollapsed("🧪 layoutedEdges 위치 확인");
    layoutedE.forEach((edge) => {
      const src = layoutedN.find((n) => n.id === edge.source);
      const tgt = layoutedN.find((n) => n.id === edge.target);
      console.log(`Edge ${edge.id}: ${edge.source} → ${edge.target}`);
      console.log("  Source Pos:", src?.position);
      console.log("  Target Pos:", tgt?.position);
    });
    console.groupEnd();

    // 📊 종합 로그
    console.groupCollapsed("🧠 Layout 계산 디버그");
    console.log("🟡 devices.length:", devices.length);
    console.log("🔵 allCables.length:", allCables.length);
    console.log("🧵 baseEdges:", baseEdges);
    console.log("🟢 traceResult.cables:", traceResult?.cables ?? []);
    console.log("🟢 traceEdges:", traceEdges);
    console.log("🧩 allEdges.length:", allEdges.length);
    console.log("📦 Node ID 목록:", nodes.map((n) => n.id));
    console.log(
      "📐 layoutedNodes:",
      layoutedN.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
      }))
    );
    console.log(
      "📐 layoutedEdges:",
      layoutedE.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        style: e.style,
      }))
    );
    console.groupEnd();

    setLayoutedNodes(layoutedN);
    setLayoutedEdges(layoutedE);
  }, [devices, allCables, traceResult]);

  const statusCounts = useMemo(() => {
    const counts = { Online: 0, Offline: 0, Unstable: 0 };
    devices.forEach((d) => {
      if (d.status in counts) {
        counts[d.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [devices]);

  const handleDeviceClick = useCallback(async (device: Device) => {
    console.log("👆 선택된 장비:", device);

    setSelectedDevice(device);
    setTraceResult(null);
    setTraceError(null);

    try {
      const result = await fetchTrace(device.deviceId);
      setTraceResult(result);

      console.log("📦 traceResult.cables:", result.cables);
      console.log("🎯 Trace 결과 전체:", result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Trace 로드 실패";
      setTraceError(msg);
    }
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <ErrorState message={error} onRetry={() => window.location.reload()} />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
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

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-6">
          <NetworkDiagram
            nodes={layoutedNodes}
            edges={layoutedEdges}
            selectedDevice={selectedDevice}
            onDeviceClick={handleDeviceClick}
            devices={devices}
          />
        </div>

        <SidePanel
          selectedDevice={selectedDevice}
          traceResult={traceResult}
          traceError={traceError}
        />
      </div>
    </div>
  );
}
