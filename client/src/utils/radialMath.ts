// 📁 src/utils/radialMath.ts

import type { Device } from "../types/device";
import type { CableDto } from "../types/cable";

/**
 * 💫 중심점과 반지름, 각도로부터 (x, y) 좌표 계산
 */
export function getPolarPosition(
  center: { x: number; y: number },
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: center.x + radius * Math.cos(angleRad),
    y: center.y + radius * Math.sin(angleRad),
  };
}

/**
 * 🔌 각 스위치에 연결된 PC를 그룹핑
 */
export function groupDevicesBySwitch(
  devices: Device[],
  cables: CableDto[]
): Record<string, Device[]> {
  const switchToPCs: Record<string, Set<string>> = {};

  for (const cable of cables) {
    const from = cable.fromDevice ?? "";
    const to = cable.toDevice ?? "";

    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();

    let switchName: string;
    let deviceName: string;

    if (fromLower.startsWith("sw-")) {
      switchName = from;
      deviceName = to;
    } else if (toLower.startsWith("sw-")) {
      switchName = to;
      deviceName = from;
    } else {
      continue; // 스위치가 없는 케이블은 제외
    }

    if (!switchToPCs[switchName]) {
      switchToPCs[switchName] = new Set();
    }

    switchToPCs[switchName].add(deviceName);
  }

  const result: Record<string, Device[]> = {};
  for (const [switchName, deviceNames] of Object.entries(switchToPCs)) {
    result[switchName] = Array.from(deviceNames)
      .map((name) =>
        devices.find((d) => d.name.toLowerCase() === name.toLowerCase())
      )
      .filter((device): device is Device => device !== undefined);
  }

  return result;
}
