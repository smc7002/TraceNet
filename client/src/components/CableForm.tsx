import { useState, useEffect } from "react";
import axios, { AxiosError } from "axios";
import type { Device } from "../types/device";
import type { Port } from "../types/port";

interface CableFormProps {
  onSuccess: () => void;
}

export default function CableForm({ onSuccess }: CableFormProps) {
  const [cableId, setCableId] = useState("");
  const [description, setDescription] = useState("");

  const [devices, setDevices] = useState<Device[]>([]);
  const [portsByDeviceId, setPortsByDeviceId] = useState<Record<number, Port[]>>({});

  const [fromDeviceId, setFromDeviceId] = useState<number | null>(null);
  const [toDeviceId, setToDeviceId] = useState<number | null>(null);

  const [fromPortId, setFromPortId] = useState<number | null>(null);
  const [toPortId, setToPortId] = useState<number | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const loadDevicesAndPorts = async () => {
      const [deviceRes, portRes] = await Promise.all([
        axios.get("/api/device"),
        axios.get("/api/ports/all"),
      ]);

      const devices: Device[] = deviceRes.data;
      setDevices(devices);

      const portMap: Record<number, Port[]> = {};
      for (const p of portRes.data as {
        portId: number;
        name: string;
        device: { deviceId: number };
      }[]) {
        const devId = p.device.deviceId;
        const port: Port = {
          portId: p.portId,
          name: p.name,
          deviceId: devId,
        };
        if (!portMap[devId]) portMap[devId] = [];
        portMap[devId].push(port);
      }

      setPortsByDeviceId(portMap);
    };

    loadDevicesAndPorts();
  }, []);

  useEffect(() => {
    if (!showAdvanced) {
      if (fromDeviceId && portsByDeviceId[fromDeviceId]?.length > 0) {
        setFromPortId(portsByDeviceId[fromDeviceId][0].portId);
      }
      if (toDeviceId && portsByDeviceId[toDeviceId]?.length > 0) {
        setToPortId(portsByDeviceId[toDeviceId][0].portId);
      }
    }
  }, [fromDeviceId, toDeviceId, portsByDeviceId, showAdvanced]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cableId || !fromPortId || !toPortId) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    try {
      await axios.post("/api/cable", {
        cableId,
        description,
        fromPortId,
        toPortId,
      });

      alert("케이블이 성공적으로 연결되었습니다.");
      setCableId("");
      setDescription("");
      setFromDeviceId(null);
      setToDeviceId(null);
      setFromPortId(null);
      setToPortId(null);
      onSuccess();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      const message = error.response?.data?.message ?? error.message;
      alert(`등록 실패: ${message}`);
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-slate-700 font-semibold mb-2">📍 케이블 추가</h3>

      <div>
        <label className="block text-sm mb-1">케이블 ID</label>
        <input
          type="text"
          className="input"
          placeholder="예: CABLE-001"
          value={cableId}
          onChange={(e) => setCableId(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">설명</label>
        <input
          type="text"
          className="input"
          placeholder="예: PC-01 to SW-01"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">From 장비</label>
        <select
          className="input"
          value={fromDeviceId ?? ""}
          onChange={(e) => setFromDeviceId(Number(e.target.value))}
        >
          <option value="">-- 선택 --</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">To 장비</label>
        <select
          className="input"
          value={toDeviceId ?? ""}
          onChange={(e) => setToDeviceId(Number(e.target.value))}
        >
          <option value="">-- 선택 --</option>
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((prev) => !prev)}
        className="text-blue-500 text-sm underline"
      >
        {showAdvanced ? "기본 포트로 숨기기" : "고급 포트 선택"}
      </button>

      {showAdvanced && (
        <>
          <div>
            <label className="block text-sm mb-1">From 포트</label>
            <select
              className="input"
              value={fromPortId ?? ""}
              onChange={(e) => setFromPortId(Number(e.target.value))}
            >
              <option value="">-- 선택 --</option>
              {fromDeviceId &&
                portsByDeviceId[fromDeviceId]?.map((p) => (
                  <option key={p.portId} value={p.portId}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">To 포트</label>
            <select
              className="input"
              value={toPortId ?? ""}
              onChange={(e) => setToPortId(Number(e.target.value))}
            >
              <option value="">-- 선택 --</option>
              {toDeviceId &&
                portsByDeviceId[toDeviceId]?.map((p) => (
                  <option key={p.portId} value={p.portId}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </>
      )}

      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        케이블 연결
      </button>
    </form>
  );
}
