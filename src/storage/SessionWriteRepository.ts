/**
 * Write-Only Repository for AED Event Ingestion.
 * Strictly implements write-once, append-only persistence.
 * Contains ZERO read methods, structural separation enforced.
 */

import { AEDEvent, AEDSession, RawSignalChunk, SessionStatus } from '../core/types/events';
import { IDatabaseDriver, IFileSystemDriver } from './DatabaseDriver';
import { SQLITE_SCHEMA } from './schema';

export class SessionWriteRepository {
  private db: IDatabaseDriver;
  private fs: IFileSystemDriver;
  private initialized = false;

  constructor(db: IDatabaseDriver, fs: IFileSystemDriver) {
    this.db = db;
    this.fs = fs;
  }

  /**
   * Initializes SQLite schema and database immutability triggers.
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    const statements = SQLITE_SCHEMA.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const sql of statements) {
      await this.db.execute(sql);
    }

    this.initialized = true;
  }

  /**
   * Creates a new AED session record in the database and initializes its raw log file.
   */
  public async createSession(session: AEDSession): Promise<void> {
    await this.initialize();

    // Ensure parent directory for raw log exists
    const dir = session.rawLogPath.substring(0, session.rawLogPath.lastIndexOf('/'));
    if (dir) {
      await this.fs.mkdir(dir);
    }

    // Write initial log file header
    const header = `=== AED RAW OPTICAL IR TELEMETRY LOG ===\n` +
      `Session ID: ${session.sessionId}\n` +
      `Start Time: ${new Date(session.startTimestamp).toISOString()}\n` +
      `Transport: ${session.transportType}\n` +
      `Device: ${session.deviceInfo}\n` +
      `=========================================\n\n`;

    await this.fs.appendFile(session.rawLogPath, header);

    const sql = `
      INSERT INTO aed_sessions (
        session_id, start_timestamp, end_timestamp, status, 
        transport_type, device_info, event_count, critical_event_count, raw_log_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await this.db.execute(sql, [
      session.sessionId,
      session.startTimestamp,
      session.endTimestamp || null,
      session.status,
      session.transportType,
      session.deviceInfo,
      session.eventCount,
      session.criticalEventCount,
      session.rawLogPath,
    ]);
  }

  /**
   * Appends a raw binary frame to both the flat .rawlog file and the raw_chunks table.
   */
  public async appendRawChunk(chunk: RawSignalChunk, rawLogPath: string): Promise<void> {
    await this.initialize();

    // 1. Dual-Write Target A: Append to immutable disk file
    const logLine = `[${new Date(chunk.timestamp).toISOString()}][SEQ #${chunk.sequenceNumber.toString().padStart(3, '0')}][LEN:${chunk.byteLength}] ${chunk.rawBytesHex}\n`;
    await this.fs.appendFile(rawLogPath, logLine);

    // 2. Dual-Write Target B: Insert into SQLite raw_chunks table
    const sql = `
      INSERT INTO raw_chunks (
        chunk_id, session_id, sequence_number, timestamp, byte_length, raw_bytes_hex
      ) VALUES (?, ?, ?, ?, ?, ?);
    `;

    await this.db.execute(sql, [
      chunk.chunkId,
      chunk.sessionId,
      chunk.sequenceNumber,
      chunk.timestamp,
      chunk.byteLength,
      chunk.rawBytesHex,
    ]);
  }

  /**
   * Inserts a decoded, immutable AEDEvent into the relational event table.
   */
  public async insertEvent(event: AEDEvent): Promise<void> {
    await this.initialize();

    const sql = `
      INSERT INTO aed_events (
        event_id, session_id, sequence_number, timestamp, iso_timestamp,
        event_code, label, severity, critical, raw_payload_hex,
        checksum_valid, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await this.db.execute(sql, [
      event.eventId,
      event.sessionId,
      event.sequenceNumber,
      event.timestamp,
      event.isoTimestamp,
      event.eventCode,
      event.label,
      event.severity,
      event.critical ? 1 : 0,
      event.rawPayloadHex,
      event.checksumValid ? 1 : 0,
      JSON.stringify(event.metadata),
    ]);
  }

  /**
   * Finalizes the session, generates SHA-256 hash across the raw log, and records total counts.
   */
  public async finalizeSession(
    sessionId: string,
    status: SessionStatus,
    endTimestamp: number,
    eventCount: number,
    criticalCount: number,
    rawLogPath: string
  ): Promise<string> {
    await this.initialize();

    // Append final session closing footer and compute SHA-256 digest of finalized file
    let sha256 = '';
    try {
      const footer = `\n=========================================\n` +
        `Session End: ${new Date(endTimestamp).toISOString()}\n` +
        `Total Events: ${eventCount} (Critical: ${criticalCount})\n` +
        `=========================================\n`;
      await this.fs.appendFile(rawLogPath, footer);
      sha256 = await this.fs.computeSha256(rawLogPath);
    } catch {
      sha256 = 'UNCOMPUTED_HASH';
    }

    const sql = `
      UPDATE aed_sessions SET
        end_timestamp = ?,
        status = ?,
        event_count = ?,
        critical_event_count = ?,
        sha256_checksum = ?
      WHERE session_id = ?;
    `;

    await this.db.execute(sql, [
      endTimestamp,
      status,
      eventCount,
      criticalCount,
      sha256,
      sessionId,
    ]);

    return sha256;
  }
}
