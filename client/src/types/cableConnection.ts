/**
 * cableConnection.ts — type definitions for cable-to-port relationships
 *
 * Purpose:
 * - Model the relationship between a physical cable and logical ports
 * - Express core connectivity in the network topology
 * - Map DB many-to-many relationships into object references
 *
 * Use cases:
 * - Rendering edges in the network diagram
 * - Computing physical paths during cable trace
 * - Analyzing per-port connectivity state
 * - Cable management and connection detail views
 */

import type { Cable } from './cable';
import type { Port } from './port';

/**
 * Cable connection interface
 *
 * Backing table: CableConnections
 *
 * Relationship notes:
 * - A single cable connects exactly two ports
 * - Each connection has a source port (from) and a destination port (to)
 * - The link is bidirectional; “from”/“to” are relative labels
 *
 * Joins:
 * - cable?:    detailed cable info (LEFT JOIN)
 * - fromPort?: detailed source port info (LEFT JOIN)
 * - toPort?:   detailed destination port info (LEFT JOIN)
 */
export interface CableConnection {
  /** Primary key for this connection record */
  cableConnectionId: number;

  /** FK → Cable.cableId */
  cableId: number;

  /** FK → Port.portId (source) */
  fromPortId: number;

  /** FK → Port.portId (destination) */
  toPortId: number;

  /**
   * Joined cable entity (optional)
   *
   * Include when:
   * - API needs to show cable details (type, description, etc.)
   *
   * Omit when:
   * - ID alone is sufficient
   * - You need lean payloads for bulk processing
   */
  cable?: Cable;

  /**
   * Joined source port (optional)
   *
   * Typically contains:
   * - Port name (e.g., "GigabitEthernet0/1")
   * - Port enabled/disabled state
   * - Parent device info
   */
  fromPort?: Port;

  /**
   * Joined destination port (optional)
   *
   * Useful for:
   * - Edge labels in a topology view
   * - Styling edges by port status
   * - Showing hop details during cable trace
   */
  toPort?: Port;
}
