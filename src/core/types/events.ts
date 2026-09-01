/**
 * Medical & audit event models for the AED Event Capture system.
 * All event records are designed to be strictly immutable once instantiated.
 */

export type Severity = 'CRITICAL' | 'WARNING' | 'INFO' | 'UNKNOWN';

export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'INTERRUPTED';

export interface RawSignalChunk {
  chunkId: string;
  sessionId: string;
  sequenceNumber: number;
  timestamp: number; // Monotonic epoch ms
  byteLength: number;
  rawBytesHex: string; // Exact hex representation
}

export interface AEDEventMetadata {
  sequenceNumber: number;
  energyJoules?: number;
  currentAmps?: number;
  impedanceOhms?: number;
  heartRateBpm?: number;
  batteryPercent?: number;
  rhythmClassification?: 'VF_VT' | 'NSR' | 'ASYSTOLE' | 'PEA' | 'ARTIFACT' | 'UNKNOWN';
  [key: string]: unknown;
}

export interface AEDEvent {
  eventId: string; // UUID v4
  sessionId: string; // UUID v4
  sequenceNumber: number; // Monotonic frame counter
  timestamp: number; // Monotonic epoch milliseconds
  isoTimestamp: string; // ISO 8601 UTC
  eventCode: string; // Normalized 2-digit Hex string, e.g. "0x34"
  label: string; // Semantic human-readable label
  severity: Severity;
  critical: boolean; // Flag for high-consequence events (Shock Advised, Shock Delivered, etc.)
  rawPayloadHex: string; // Unmodified full frame in uppercase hex
  checksumValid: boolean;
  metadata: AEDEventMetadata;
}

export interface AEDSession {
  sessionId: string;
  startTimestamp: number;
  endTimestamp?: number;
  status: SessionStatus;
  transportType: string;
  deviceInfo: string;
  eventCount: number;
  criticalEventCount: number;
  rawLogPath: string;
  sha256Checksum?: string;
}

export interface SessionExportBundle {
  manifest: {
    appVersion: string;
    schemaVersion: string;
    exportTimestamp: string;
    sha256Checksum: string;
    integrityVerified: boolean;
  };
  session: AEDSession;
  events: AEDEvent[];
  rawChunksSummary: {
    totalChunks: number;
    totalBytes: number;
  };
}
