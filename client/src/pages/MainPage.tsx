import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchDevices } from "../api/deviceApi";
import type { Device } from "../types/device";

import ControlBar from "../components/ControlBar";
import NetworkDiagram from "../components/NetworkDiagram";
import SidePanel from "../components/SidePanel";

export default function MainPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProblemOnly, setShowProblemOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await fetchDevices();
        if (isMounted) setDevices(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "알 수 없는 오류입니다.";
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

  const handleDeviceClick = useCallback((device: Device) => {
    setSelectedDevice(device);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">
        로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-center text-red-500">
        <div>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
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
          />
        </div>

        {/* 사이드 패널 */}
        <SidePanel selectedDevice={selectedDevice} />
      </div>
    </div>
  );
}
