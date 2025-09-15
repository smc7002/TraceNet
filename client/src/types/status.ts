// status.ts: enums for device connectivity states.

/** Connectivity state of a network device */
export enum DeviceStatus {
  /** Healthy (Ping success, latency < 500ms) */
  Online = 'Online',

  /** No response (Ping timeout / failure) */
  Offline = 'Offline',

  /** Unstable (high latency or packet loss) */
  Unstable = 'Unstable',

  /** Unknown (no IP or ping not possible) */
  Unknown = 'Unknown',

  /** Unreachable (routing/path issue) */
  Unreachable = 'Unreachable',
}

/** Stable order for selects/legends/etc. */
export const STATUS_OPTIONS: readonly DeviceStatus[] = [
  DeviceStatus.Online,
  DeviceStatus.Unstable,
  DeviceStatus.Offline,
  DeviceStatus.Unknown,
  DeviceStatus.Unreachable,
] as const;

/**
 * Normalize any incoming string to a DeviceStatus.
 * Case-insensitive; null/undefined/unrecognized → Unknown.
 */
export const normalizeStatus = (s: string | null | undefined): DeviceStatus => {
  switch ((s ?? '').toLowerCase()) {
    case 'online': return DeviceStatus.Online;
    case 'unstable': return DeviceStatus.Unstable;
    case 'offline': return DeviceStatus.Offline;
    case 'unreachable': return DeviceStatus.Unreachable;
    default: return DeviceStatus.Unknown;
  }
};
