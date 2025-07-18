// src/types/cableConnection.ts
import type { Port } from "./port";
import type { Cable } from "./cable";

export interface CableConnection {
  cableConnectionId: number;
  cableId: number;
  fromPortId: number;
  toPortId: number;

  cable?: Cable;
  fromPort?: Port;
  toPort?: Port;
}
