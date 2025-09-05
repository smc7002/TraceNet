/**
 * Cable-related type definitions
 *
 * Cable:    database entity (basic cable info)
 * CableDto: API/UI model that includes endpoint details
 */

/** Base cable entity (database model) */
export interface Cable {
  cableId: number;
  type?: string;
  description?: string;
}

/**
 * Cable connection DTO (API response / UI display)
 * Includes detailed connection info for both endpoints.
 */
export interface CableDto {
  cableId: string;      // returned as a string by the API
  description?: string;
  fromDevice: string;   // source device name
  fromDeviceId: string; // source device ID
  fromPort: string;     // source port name
  toDevice: string;     // destination device name
  toDeviceId: string;   // destination device ID
  toPort: string;       // destination port name
}
