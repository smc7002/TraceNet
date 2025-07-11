import { useMemo } from "react";
import type { Device } from "../types/device";

interface TraceResult {
  path: Device[];
}

interface NetworkDiagramProps {
  devices: Device[];
  selectedDevice: Device | null;
  onDeviceClick: (device: Device) => void;
  traceResult: TraceResult | null;
}

export default function NetworkDiagram({
  devices,
  selectedDevice,
  onDeviceClick,
  traceResult,
}: NetworkDiagramProps) {
  const getStatusDotColor = (status: string) => {
    switch (status) {
      case "Online":
        return "bg-green-500";
      case "Offline":
        return "bg-red-500";
      case "Unstable":
        return "bg-yellow-400";
      default:
        return "bg-gray-400";
    }
  };

  const getIcon = (type: string) => {
    return (
      {
        PC: "💻",
        Switch: "🔀",
        Server: "🖥️",
        NAS: "💾",
        AP: "📡",
        Printer: "🖨️",
        CCTV: "📹",
        Firewall: "🔥",
        Router: "🌐",
      }[type] ?? "❓"
    );
  };

  // 💡 좌표 계산: 장비 중심 좌표를 디바이스 ID별로 저장
  const devicePositionMap = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    devices.forEach((device, index) => {
      const x = 120 + (index % 4) * 160 + 40; // +40은 w-20 중앙
      const y = 100 + Math.floor(index / 4) * 160 + 40;
      map[device.deviceId] = { x, y };
    });
    return map;
  }, [devices]);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 overflow-auto p-4">
      {/* 🟢 Trace 연결 선 (SVG) */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {traceResult?.path && traceResult.path.length > 1 && (
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {traceResult.path.map((_, index) => {
              if (index === traceResult.path.length - 1) return null;

              const from = devicePositionMap[traceResult.path[index].deviceId];
              const to =
                devicePositionMap[traceResult.path[index + 1].deviceId];

              if (!from || !to) return null;

              return (
                <line
                  key={index}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="lime"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              );
            })}
          </svg>
        )}
      </svg>

      {/* 🧱 장비 박스 */}
      {devices.map((device, index) => {
        const isSelected = selectedDevice?.deviceId === device.deviceId;

        const x = 120 + (index % 4) * 160;
        const y = 100 + Math.floor(index / 4) * 160;

        return (
          <div
            key={device.deviceId}
            className={`absolute w-20 h-20 rounded-xl bg-white border-2 
              flex flex-col items-center justify-center text-center text-xs 
              cursor-pointer transition-all duration-200
              ${
                isSelected
                  ? "border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.3)]"
                  : "border-slate-200"
              }
              hover:-translate-y-1 hover:shadow-lg`}
            style={{ left: x, top: y }}
            onClick={() => onDeviceClick(device)}
          >
            {/* 상태 점 */}
            <div
              className={`w-4 h-4 rounded-full border-2 border-white absolute top-[-8px] right-[-8px] ${getStatusDotColor(
                device.status
              )}`}
            ></div>

            {/* 아이콘 */}
            <div className="text-xl mb-1">{getIcon(device.type)}</div>

            {/* 이름 */}
            <div className="text-slate-700 font-medium leading-tight">
              {device.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
