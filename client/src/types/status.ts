/**
 * @fileoverview Network device status definitions
 * @description Enum of device states used in the TraceNet system
 */

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
