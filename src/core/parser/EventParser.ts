/**
 * Pure TypeScript EventParser Engine.
 * Decodes raw binary frames into deterministic, immutable AEDEvent records against externalized protocol configuration.
 */

import { AEDEvent, AEDEventMetadata, Severity } from '../types/events';
import { RawFrame } from './Framer';
import protocolConfig from '../protocol/aed_protocol_v1.json';

export interface ProtocolEventDefinition {
  code: string;
  label: string;
  severity: Severity;
  critical: boolean;
  description: string;
  payloadSchema?: Record<string, string>;
}

export class EventParser {
  private eventCatalog: Map<string, ProtocolEventDefinition>;
  private defaultUnknown: { label: string; severity: Severity; critical: boolean; description: string };

  constructor(customConfig?: typeof protocolConfig) {
    const config = customConfig || protocolConfig;
    this.eventCatalog = new Map();
    this.defaultUnknown = config.defaultUnknownEvent as {
      label: string;
      severity: Severity;
      critical: boolean;
      description: string;
    };

    for (const [codeKey, def] of Object.entries(config.eventCodes)) {
      this.eventCatalog.set(codeKey.toLowerCase(), def as ProtocolEventDefinition);
      // Also index standard decimal/hex string formats
      const hexNum = parseInt(codeKey, 16);
      if (!isNaN(hexNum)) {
        this.eventCatalog.set(`0x${hexNum.toString(16).padStart(2, '0').toLowerCase()}`, def as ProtocolEventDefinition);
      }
    }
  }

  /**
   * Decodes a raw frame into a fully validated, immutable AEDEvent.
   */
  public parseFrame(frame: RawFrame, sessionId: string, customEventId?: string): AEDEvent {
    const hexCode = `0x${frame.commandCode.toString(16).padStart(2, '0').toLowerCase()}`;
    const rawPayloadHex = this.toHexString(frame.rawBytes);
    const def = this.eventCatalog.get(hexCode);

    const eventId = customEventId || this.generateUUID();
    const timestamp = frame.receivedTimestamp;
    const isoTimestamp = new Date(timestamp).toISOString();

    const metadata: AEDEventMetadata = {
      sequenceNumber: frame.sequenceNumber,
    };

    // Extract structured telemetry fields from payload if present
    this.extractPayloadFields(frame.payloadBytes, def, metadata);

    let label: string;
    let severity: Severity;
    let critical: boolean;

    if (!frame.checksumValid) {
      label = `Corrupted Frame Checksum (Code: ${hexCode.toUpperCase()})`;
      severity = 'WARNING';
      critical = false;
      metadata.checksumError = true;
      metadata.expectedChecksum = frame.checksum;
    } else if (def) {
      label = def.label;
      severity = def.severity;
      critical = def.critical;
    } else {
      label = `${this.defaultUnknown.label} (${hexCode.toUpperCase()})`;
      severity = this.defaultUnknown.severity;
      critical = this.defaultUnknown.critical;
      metadata.unrecognizedCode = hexCode;
    }

    // Return frozen immutable object
    return Object.freeze({
      eventId,
      sessionId,
      sequenceNumber: frame.sequenceNumber,
      timestamp,
      isoTimestamp,
      eventCode: hexCode.toUpperCase(),
      label,
      severity,
      critical,
      rawPayloadHex,
      checksumValid: frame.checksumValid,
      metadata: Object.freeze(metadata),
    });
  }

  /**
   * Parses specific telemetry payload values according to the protocol schema.
   */
  private extractPayloadFields(
    payload: Uint8Array,
    def: ProtocolEventDefinition | undefined,
    metadata: AEDEventMetadata
  ): void {
    if (!def || !def.payloadSchema || payload.length === 0) {
      return;
    }

    let offset = 0;
    for (const [fieldName, fieldType] of Object.entries(def.payloadSchema)) {
      if (offset >= payload.length) break;

      if (fieldType === 'uint8') {
        metadata[fieldName] = payload[offset];
        offset += 1;
      } else if (fieldType === 'uint16be') {
        if (offset + 1 < payload.length) {
          metadata[fieldName] = (payload[offset] << 8) | payload[offset + 1];
          offset += 2;
        }
      } else if (fieldType === 'uint16le') {
        if (offset + 1 < payload.length) {
          metadata[fieldName] = payload[offset] | (payload[offset + 1] << 8);
          offset += 2;
        }
      }
    }

    // Clinical helper properties
    if (metadata.energyJoules !== undefined) {
      metadata.energyJoules = Number(metadata.energyJoules);
    }
  }

  /**
   * Converts Uint8Array to uppercase hex string.
   */
  public toHexString(bytes: Uint8Array): string {
    const hex: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      hex.push(bytes[i].toString(16).padStart(2, '0').toUpperCase());
    }
    return hex.join(' ');
  }

  /**
   * Generates a unique UUID v4 string.
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
