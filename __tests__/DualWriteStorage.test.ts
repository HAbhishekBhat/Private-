import { MemoryDatabaseDriver } from '../src/storage/drivers/MemoryDatabaseDriver';
import { MemoryFileSystemDriver } from '../src/storage/drivers/FileSystemDrivers';
import { SessionWriteRepository } from '../src/storage/SessionWriteRepository';
import { SessionReadRepository } from '../src/storage/SessionReadRepository';
import { AEDEvent, AEDSession, RawSignalChunk } from '../src/core/types/events';

describe('Dual-Write Storage & Immutability Tests', () => {
  let dbDriver: MemoryDatabaseDriver;
  let fsDriver: MemoryFileSystemDriver;
  let writeRepo: SessionWriteRepository;
  let readRepo: SessionReadRepository;

  beforeEach(async () => {
    dbDriver = new MemoryDatabaseDriver();
    fsDriver = new MemoryFileSystemDriver();
    writeRepo = new SessionWriteRepository(dbDriver, fsDriver);
    readRepo = new SessionReadRepository(dbDriver, fsDriver);
    await writeRepo.initialize();
  });

  test('performs dual-write to both raw file and SQLite event tables', async () => {
    const session: AEDSession = {
      sessionId: 'test-session-001',
      startTimestamp: 1700000000000,
      status: 'ACTIVE',
      transportType: 'ANDROID_USB_SERIAL',
      deviceInfo: 'USB-C IR Receiver',
      eventCount: 0,
      criticalEventCount: 0,
      rawLogPath: 'sessions/test-session-001/raw.log',
    };

    await writeRepo.createSession(session);

    // Append Raw Chunk
    const chunk: RawSignalChunk = {
      chunkId: 'chunk-1',
      sessionId: session.sessionId,
      sequenceNumber: 1,
      timestamp: 1700000001000,
      byteLength: 9,
      rawBytesHex: 'AA 55 05 01 11 00 48 1E 0D 0A',
    };
    await writeRepo.appendRawChunk(chunk, session.rawLogPath);

    // Insert Structured Event
    const event: AEDEvent = {
      eventId: 'evt-1',
      sessionId: session.sessionId,
      sequenceNumber: 1,
      timestamp: 1700000001000,
      isoTimestamp: new Date(1700000001000).toISOString(),
      eventCode: '0X11',
      label: 'Electrode Pads Connected',
      severity: 'INFO',
      critical: false,
      rawPayloadHex: 'AA 55 05 01 11 00 48 1E 0D 0A',
      checksumValid: true,
      metadata: { sequenceNumber: 1, impedanceOhms: 72 },
    };
    await writeRepo.insertEvent(event);

    // Finalize session
    const sha256 = await writeRepo.finalizeSession(
      session.sessionId,
      'COMPLETED',
      1700000010000,
      1,
      0,
      session.rawLogPath
    );

    expect(sha256).toBeDefined();
    expect(sha256.length).toBe(64); // Valid hex SHA-256 string

    // 1. Verify Raw File target on FileSystem
    const rawFileContent = await fsDriver.readFile(session.rawLogPath);
    expect(rawFileContent).toContain('=== AED RAW OPTICAL IR TELEMETRY LOG ===');
    expect(rawFileContent).toContain(chunk.rawBytesHex);
    expect(rawFileContent).toContain('Session End:');

    // 2. Verify Query from Read-Only Repository
    const savedSession = await readRepo.getSessionById(session.sessionId);
    expect(savedSession).not.toBeNull();
    expect(savedSession?.status).toBe('COMPLETED');
    expect(savedSession?.eventCount).toBe(1);
    expect(savedSession?.sha256Checksum).toBe(sha256);

    const savedEvents = await readRepo.getEventsForSession(session.sessionId);
    expect(savedEvents).toHaveLength(1);
    expect(savedEvents[0].label).toBe('Electrode Pads Connected');

    // 3. Verify Export Bundle Integrity
    const exportBundle = await readRepo.exportSessionBundle(session.sessionId);
    expect(exportBundle.manifest.integrityVerified).toBe(true);
    expect(exportBundle.manifest.sha256Checksum).toBe(sha256);
    expect(exportBundle.events).toHaveLength(1);

    // 4. Verify CSV Export
    const csv = await readRepo.exportSessionCsv(session.sessionId);
    expect(csv).toContain('Sequence,Timestamp_ISO,Elapsed_Ms,Event_Code,Label');
    expect(csv).toContain('Electrode Pads Connected');
  });

  test('enforces immutability triggers on events table', async () => {
    // Attempt unauthorized direct UPDATE on aed_events table
    await expect(
      dbDriver.execute("UPDATE aed_events SET label = 'MODIFIED' WHERE event_id = 'any'")
    ).rejects.toThrow(/AUDIT VIOLATION: aed_events records are strictly immutable/);

    // Attempt unauthorized direct DELETE on aed_events table
    await expect(
      dbDriver.execute("DELETE FROM aed_events WHERE event_id = 'any'")
    ).rejects.toThrow(/AUDIT VIOLATION: aed_events records are strictly immutable/);
  });
});
