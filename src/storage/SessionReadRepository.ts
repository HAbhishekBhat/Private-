/**
 * Read-Only Repository for UI and Audit Review.
 * Strictly implements query-only operations. Contains ZERO mutation or deletion logic.
 */

import { AEDEvent, AEDSession, RawSignalChunk, SessionExportBundle, Severity, SessionStatus } from '../core/types/events';
import { IDatabaseDriver, IFileSystemDriver } from './DatabaseDriver';

export class SessionReadRepository {
  private db: IDatabaseDriver;
  private fs: IFileSystemDriver;

  constructor(db: IDatabaseDriver, fs: IFileSystemDriver) {
    this.db = db;
    this.fs = fs;
  }

  /**
   * Retrieves all historical AED sessions sorted by start time descending.
   */
  public async listSessions(): Promise<AEDSession[]> {
    const sql = `
      SELECT 
        session_id, start_timestamp, end_timestamp, status,
        transport_type, device_info, event_count, critical_event_count,
        raw_log_path, sha256_checksum
      FROM aed_sessions
      ORDER BY start_timestamp DESC;
    `;

    const result = await this.db.execute(sql);
    return result.rows.map((row) => this.mapSessionRow(row));
  }

  /**
   * Retrieves a single session by its UUID.
   */
  public async getSessionById(sessionId: string): Promise<AEDSession | null> {
    const sql = `
      SELECT 
        session_id, start_timestamp, end_timestamp, status,
        transport_type, device_info, event_count, critical_event_count,
        raw_log_path, sha256_checksum
      FROM aed_sessions
      WHERE session_id = ?;
    `;

    const result = await this.db.execute(sql, [sessionId]);
    if (result.rows.length === 0) return null;
    return this.mapSessionRow(result.rows[0]);
  }

  /**
   * Retrieves all events for a session in ascending chronological sequence.
   */
  public async getEventsForSession(sessionId: string): Promise<AEDEvent[]> {
    const sql = `
      SELECT 
        event_id, session_id, sequence_number, timestamp, iso_timestamp,
        event_code, label, severity, critical, raw_payload_hex,
        checksum_valid, metadata_json
      FROM aed_events
      WHERE session_id = ?
      ORDER BY sequence_number ASC;
    `;

    const result = await this.db.execute(sql, [sessionId]);
    return result.rows.map((row) => this.mapEventRow(row));
  }

  /**
   * Retrieves all raw chunks for a session.
   */
  public async getRawChunksForSession(sessionId: string): Promise<RawSignalChunk[]> {
    const sql = `
      SELECT 
        chunk_id, session_id, sequence_number, timestamp, byte_length, raw_bytes_hex
      FROM raw_chunks
      WHERE session_id = ?
      ORDER BY sequence_number ASC;
    `;

    const result = await this.db.execute(sql, [sessionId]);
    return result.rows.map((row) => ({
      chunkId: String(row.chunk_id),
      sessionId: String(row.session_id),
      sequenceNumber: Number(row.sequence_number),
      timestamp: Number(row.timestamp),
      byteLength: Number(row.byte_length),
      rawBytesHex: String(row.raw_bytes_hex),
    }));
  }

  /**
   * Reads raw unmodified .rawlog file text from disk.
   */
  public async readRawLogFile(rawLogPath: string): Promise<string> {
    const exists = await this.fs.exists(rawLogPath);
    if (!exists) {
      throw new Error(`Raw log file not found at path: ${rawLogPath}`);
    }
    return this.fs.readFile(rawLogPath);
  }

  /**
   * Compiles a comprehensive tamper-evident SessionExportBundle with SHA-256 integrity verification.
   */
  public async exportSessionBundle(sessionId: string): Promise<SessionExportBundle> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Cannot export non-existent session: ${sessionId}`);
    }

    const events = await this.getEventsForSession(sessionId);
    const rawChunks = await this.getRawChunksForSession(sessionId);

    let currentHash = '';
    let integrityVerified = false;

    try {
      if (await this.fs.exists(session.rawLogPath)) {
        currentHash = await this.fs.computeSha256(session.rawLogPath);
        integrityVerified = session.sha256Checksum ? currentHash === session.sha256Checksum : true;
      }
    } catch {
      currentHash = 'HASH_CHECK_FAILED';
    }

    const totalBytes = rawChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);

    return {
      manifest: {
        appVersion: '1.0.0',
        schemaVersion: '1.0.0',
        exportTimestamp: new Date().toISOString(),
        sha256Checksum: currentHash,
        integrityVerified,
      },
      session,
      events,
      rawChunksSummary: {
        totalChunks: rawChunks.length,
        totalBytes,
      },
    };
  }

  /**
   * Exports session events to structured clinical CSV string.
   */
  public async exportSessionCsv(sessionId: string): Promise<string> {
    const events = await this.getEventsForSession(sessionId);
    const headers = [
      'Sequence',
      'Timestamp_ISO',
      'Elapsed_Ms',
      'Event_Code',
      'Label',
      'Severity',
      'Critical',
      'Checksum_Valid',
      'Raw_Payload_Hex',
      'Metadata_JSON',
    ];

    if (events.length === 0) {
      return headers.join(',') + '\n';
    }

    const startTime = events[0].timestamp;
    const lines = [headers.join(',')];

    for (const ev of events) {
      const elapsed = ev.timestamp - startTime;
      const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

      const row = [
        ev.sequenceNumber,
        escape(ev.isoTimestamp),
        elapsed,
        escape(ev.eventCode),
        escape(ev.label),
        escape(ev.severity),
        ev.critical ? 'TRUE' : 'FALSE',
        ev.checksumValid ? 'TRUE' : 'FALSE',
        escape(ev.rawPayloadHex),
        escape(JSON.stringify(ev.metadata)),
      ];

      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  private mapSessionRow(row: Record<string, unknown>): AEDSession {
    return {
      sessionId: String(row.session_id),
      startTimestamp: Number(row.start_timestamp),
      endTimestamp: row.end_timestamp ? Number(row.end_timestamp) : undefined,
      status: String(row.status) as SessionStatus,
      transportType: String(row.transport_type),
      deviceInfo: String(row.device_info || ''),
      eventCount: Number(row.event_count || 0),
      criticalEventCount: Number(row.critical_event_count || 0),
      rawLogPath: String(row.raw_log_path),
      sha256Checksum: row.sha256_checksum ? String(row.sha256_checksum) : undefined,
    };
  }

  private mapEventRow(row: Record<string, unknown>): AEDEvent {
    let metadata: Record<string, unknown> = {};
    if (row.metadata_json && typeof row.metadata_json === 'string') {
      try {
        metadata = JSON.parse(row.metadata_json);
      } catch {
        metadata = {};
      }
    }
    metadata.sequenceNumber = Number(row.sequence_number);

    return Object.freeze({
      eventId: String(row.event_id),
      sessionId: String(row.session_id),
      sequenceNumber: Number(row.sequence_number),
      timestamp: Number(row.timestamp),
      isoTimestamp: String(row.iso_timestamp),
      eventCode: String(row.event_code),
      label: String(row.label),
      severity: String(row.severity) as Severity,
      critical: Number(row.critical) === 1,
      rawPayloadHex: String(row.raw_payload_hex),
      checksumValid: Number(row.checksum_valid) === 1,
      metadata: Object.freeze(metadata as unknown as import('../core/types/events').AEDEventMetadata),
    });
  }
}
