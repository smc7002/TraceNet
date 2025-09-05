/**
 * trace.ts
 *
 * Purpose: core project feature — trace cable paths between devices
 * Data source: GET /api/trace/{deviceId}
 */

/**
 * Single hop in the traced path
 *
 * Used to render a readable path like "PC-01 → Switch-01 → Server-01" in the SidePanel.
 */
export interface TraceDto {
  cableId: number;        // cable used for this hop
  fromDeviceId: number;   // source device ID
  fromDevice: string;     // source device name (display)
  fromPort: string;       // source port name (e.g., "GigabitEthernet0/1")
  toDeviceId: number;     // destination device ID
  toDevice: string;       // destination device name (display)
  toPort: string;         // destination port name
}

/**
 * Cable edge for diagram rendering
 *
 * Used by NetworkDiagram to highlight the traced path as edges.
 * Diff vs TraceDto: includes port IDs for precise connection endpoints.
 */
export interface CableEdge {
  cableId: number;        // unique cable ID
  fromPortId: number;     // source port ID (precise endpoint)
  fromDeviceId: number;   // source device ID
  toPortId: number;       // destination port ID
  toDeviceId: number;     // destination device ID
}

/**
 * Full trace response
 *
 * Duplication rationale:
 * - path: human-readable hops for textual UI
 * - cables: structured edges for diagram highlighting
 */
export interface TraceResponse {
  startDeviceName: string;  // starting device name
  endDeviceName?: string;   // ending device name (if path reaches a target)
  success: boolean;         // whether trace succeeded
  path: TraceDto[];         // hop-by-hop details for text display
  cables: CableEdge[];      // cable connections for diagram overlay
}
