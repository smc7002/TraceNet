import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import { fetchCables } from "../api/cableApi";
import type { Device } from "../types/device";
import type { TraceResponse } from "../types/trace";
import type { CableDto } from "../types/cable";
//import type { Edge } from "react-flow-renderer";
//import { mapCablesToEdges, mapTraceCablesToEdges } from "../utils/edgeMapper";

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
  //const [traceEdges, setTraceEdges] = useState<Edge[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [deviceData, cableData] = await Promise.all([
          fetchDevices(),
          fetchCables(),
        ]);

        if (isMounted) {
          console.log("📦 장비 응답:", deviceData); // ✅ 장비 확인용
          console.log("🧵 케이블 응답:", cableData); // ✅ 케이블 확인용

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

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const matchesSearch =
        device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.ipAddress?.includes(searchQuery);
      const isProblem =
        device.status === "Offline" || device.status === "Unstable";
      return matchesSearch && (!showProblemOnly || isProblem);
    });
  }, [devices, searchQuery, showProblemOnly]);

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
    console.log("선택된 장비 정보:", device);

    setSelectedDevice(device);
    setTraceResult(null);
    setTraceError(null);
    //setTraceEdges([]);

    try {
      const result = await fetchTrace(device.deviceId);
      setTraceResult(result);

      //const edges = mapTraceCablesToEdges(result.cables ?? []);
      //setTraceEdges(edges); // ✅ 반드시 필요: 다이어그램에서 선 렌더링에 사용
      console.log("📦 traceResult.cables:", result.cables);
      console.log("🎯 Trace 결과:", result);
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
            devices={filteredDevices}
            selectedDevice={selectedDevice}
            onDeviceClick={handleDeviceClick}
            traceResult={traceResult}
            allCables={allCables ?? []}
            //traceEdges={traceEdges}
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
