/**
 * SQLite Database Schema and Immutability Triggers.
 */

export const SQLITE_SCHEMA = `
-- Session metadata
CREATE TABLE IF NOT EXISTS aed_sessions (
    session_id TEXT PRIMARY KEY NOT NULL,
    start_timestamp INTEGER NOT NULL,
    end_timestamp INTEGER,
    status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'COMPLETED', 'INTERRUPTED')),
    transport_type TEXT NOT NULL,
    device_info TEXT,
    event_count INTEGER DEFAULT 0,
    critical_event_count INTEGER DEFAULT 0,
    raw_log_path TEXT NOT NULL,
    sha256_checksum TEXT
);

-- Raw binary chunk log metadata
CREATE TABLE IF NOT EXISTS raw_chunks (
    chunk_id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    byte_length INTEGER NOT NULL,
    raw_bytes_hex TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES aed_sessions(session_id)
);

-- Structured immutable events table
CREATE TABLE IF NOT EXISTS aed_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    iso_timestamp TEXT NOT NULL,
    event_code TEXT NOT NULL,
    label TEXT NOT NULL,
    severity TEXT NOT NULL CHECK(severity IN ('CRITICAL', 'WARNING', 'INFO', 'UNKNOWN')),
    critical INTEGER NOT NULL CHECK(critical IN (0, 1)),
    raw_payload_hex TEXT NOT NULL,
    checksum_valid INTEGER NOT NULL CHECK(checksum_valid IN (0, 1)),
    metadata_json TEXT,
    FOREIGN KEY(session_id) REFERENCES aed_sessions(session_id)
);

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS idx_events_session ON aed_events(session_id, sequence_number ASC);
CREATE INDEX IF NOT EXISTS idx_events_critical ON aed_events(session_id, critical);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON aed_sessions(start_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raw_chunks_session ON raw_chunks(session_id, sequence_number ASC);

-- STRUCTURAL DATABASE IMMUTABILITY TRIGGERS:
-- Strictly block UPDATE or DELETE operations on aed_events
CREATE TRIGGER IF NOT EXISTS prevent_event_update
BEFORE UPDATE ON aed_events
BEGIN
    SELECT RAISE(FAIL, 'AUDIT ERROR: AED events are write-once and strictly immutable. Update prohibited.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_event_delete
BEFORE DELETE ON aed_events
BEGIN
    SELECT RAISE(FAIL, 'AUDIT ERROR: AED events are write-once and strictly immutable. Delete prohibited.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_raw_chunk_update
BEFORE UPDATE ON raw_chunks
BEGIN
    SELECT RAISE(FAIL, 'AUDIT ERROR: Raw chunks are strictly immutable.');
END;

CREATE TRIGGER IF NOT EXISTS prevent_raw_chunk_delete
BEFORE DELETE ON raw_chunks
BEGIN
    SELECT RAISE(FAIL, 'AUDIT ERROR: Raw chunks are strictly immutable.');
END;
`;
