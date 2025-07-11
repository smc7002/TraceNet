import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchDevices } from "../api/deviceApi";
import { fetchTrace } from "../api/traceApi";
import type { Device } from "../types/device";
import type { TraceResponse } from "../api/traceApi";
import type { TraceResponse } from "../types/trace";


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

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await fetchDevices();
        if (isMounted) setDevices(data);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "알 수 없는 오류입니다.";
        if (isMounted) setError(msg);
        console.error("❌ Device fetch error:", err);
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
    setSelectedDevice(device);
    setTraceResult(null);
    setTraceError(null);

    try {
      const result = await fetchTrace(device.deviceId);
      setTraceResult(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Trace 로드 실패";
      setTraceError(msg);
    }
  }, []);

  // ✅ 로딩 UI
  if (loading) {
    return <LoadingSpinner />;
  }

  // ✅ 에러 UI
  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* 🔍 상단 컨트롤 바 */}
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

      {/* 🖼 다이어그램 + 사이드패널 */}
      <div className="flex flex-1 overflow-hidden">
        {/* Network Diagram */}
        <div className="flex-1 bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-6">
          <NetworkDiagram
            devices={filteredDevices}
            selectedDevice={selectedDevice}
            onDeviceClick={handleDeviceClick}
            traceResult={traceResult}
          />
        </div>

        {/* 사이드 패널 */}
        <SidePanel
          selectedDevice={selectedDevice}
          traceResult={traceResult}
          traceError={traceError}
        />
      </div>
    </div>
  );
}
