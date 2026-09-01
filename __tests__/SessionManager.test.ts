import { SessionManager } from '../src/core/session/SessionManager';
import { MockSimulatorTransport } from '../src/transport/MockSimulatorTransport';
import { MemoryDatabaseDriver } from '../src/storage/drivers/MemoryDatabaseDriver';
import { MemoryFileSystemDriver } from '../src/storage/drivers/FileSystemDrivers';
import { SessionWriteRepository } from '../src/storage/SessionWriteRepository';
import { Framer } from '../src/core/parser/Framer';

describe('SessionManager Pipeline & Reconnect Tolerance Tests', () => {
  let simulator: MockSimulatorTransport;
  let dbDriver: MemoryDatabaseDriver;
  let fsDriver: MemoryFileSystemDriver;
  let writeRepo: SessionWriteRepository;
  let manager: SessionManager;

  beforeEach(async () => {
    simulator = new MockSimulatorTransport();
    dbDriver = new MemoryDatabaseDriver();
    fsDriver = new MemoryFileSystemDriver();
    writeRepo = new SessionWriteRepository(dbDriver, fsDriver);

    manager = new SessionManager(simulator, writeRepo, {
      disconnectGracePeriodMs: 500, // Short grace period for fast tests
      rawLogsDirectory: 'test_sessions',
    });

    await manager.initialize();
    await manager.connect();
  });

  afterEach(async () => {
    await manager.disconnect();
  });

  test('auto-starts session upon first valid incoming frame and captures decoded event', async () => {
    expect(manager.getState().activeSession).toBeNull();

    // Emit Power On frame
    const frame = Framer.encodeFrame(0, 0x01, new Uint8Array([99])); // 99% battery
    simulator.emitEvent(0x01, new Uint8Array([99]));

    // Small tick to allow event processing
    await new Promise((resolve) => setTimeout(resolve, 50));

    const state = manager.getState();
    expect(state.activeSession).not.toBeNull();
    expect(state.eventList).toHaveLength(1);
    expect(state.eventList[0].eventCode).toBe('0X01');
    expect(state.eventList[0].label).toBe('AED Powered On');
    expect(state.eventList[0].metadata.batteryPercent).toBe(99);
  });

  test('retains active session seamlessly across brief dongle disconnections', async () => {
    // 1. Emit first event to start session
    simulator.emitEvent(0x01);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const initialSessionId = manager.getState().activeSession?.sessionId;
    expect(initialSessionId).toBeDefined();

    // 2. Simulate cable disconnect
    simulator.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(manager.getState().isDisconnectGraceActive).toBe(true);
    expect(manager.getState().activeSession?.sessionId).toBe(initialSessionId);

    // 3. Reconnect before grace period expires (within 500ms)
    await simulator.connect();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(manager.getState().isDisconnectGraceActive).toBe(false);
    expect(manager.getState().activeSession?.sessionId).toBe(initialSessionId);

    // 4. Ingest next event on the same session
    simulator.emitEvent(0x34, new Uint8Array([0x00, 0xc8, 0x20, 0x44])); // 200J shock
    await new Promise((resolve) => setTimeout(resolve, 50));

    const state = manager.getState();
    expect(state.activeSession?.sessionId).toBe(initialSessionId);
    expect(state.eventList).toHaveLength(2);
    expect(state.activeSession?.criticalEventCount).toBe(1);
  });

  test('finalizes session as INTERRUPTED when disconnect grace period expires', async () => {
    simulator.emitEvent(0x01);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(manager.getState().activeSession).not.toBeNull();

    // Disconnect and wait past grace period (500ms)
    simulator.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 650));

    // Active session should be closed and sealed
    expect(manager.getState().activeSession).toBeNull();
    expect(manager.getState().isDisconnectGraceActive).toBe(false);
  });
});
