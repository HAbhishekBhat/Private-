/**
 * SessionManager: Master orchestrator of the ingestion pipeline.
 * Coordinates Transport, Framer, EventParser, and Dual-Write Storage.
 * Handles automatic session initiation, disconnect grace retention, and state broadcasting.
 */

import { ConnectionStatus, ITransportService, TransportMetadata } from '../types/transport';
import { AEDEvent, AEDSession, RawSignalChunk } from '../types/events';
import { Framer } from '../parser/Framer';
import { EventParser } from '../parser/EventParser';
import { SessionWriteRepository } from '../../storage/SessionWriteRepository';

export interface SessionManagerConfig {
  disconnectGracePeriodMs?: number; // Grace window to retain session if cable is dislodged (default 60s)
  rawLogsDirectory?: string;
}

export type SessionStateListener = (state: SessionManagerState) => void;
export type EventCapturedListener = (event: AEDEvent, activeSession: AEDSession) => void;

export interface SessionManagerState {
  connectionStatus: ConnectionStatus;
  deviceMetadata: TransportMetadata | null;
  activeSession: AEDSession | null;
  latestEvent: AEDEvent | null;
  eventList: AEDEvent[];
  isDisconnectGraceActive: boolean;
  graceSecondsRemaining: number;
}

export class SessionManager {
  private transport: ITransportService;
  private framer: Framer;
  private parser: EventParser;
  private writeRepo: SessionWriteRepository;
  private config: Required<SessionManagerConfig>;

  private state: SessionManagerState = {
    connectionStatus: 'DISCONNECTED',
    deviceMetadata: null,
    activeSession: null,
    latestEvent: null,
    eventList: [],
    isDisconnectGraceActive: false,
    graceSecondsRemaining: 0,
  };

  private stateListeners: Set<SessionStateListener> = new Set();
  private eventListeners: Set<EventCapturedListener> = new Set();

  private rawChunkCounter = 0;
  private disconnectGraceTimer: NodeJS.Timeout | null = null;
  private graceCountdownInterval: NodeJS.Timeout | null = null;

  constructor(
    transport: ITransportService,
    writeRepo: SessionWriteRepository,
    config: SessionManagerConfig = {}
  ) {
    this.transport = transport;
    this.writeRepo = writeRepo;
    this.framer = new Framer();
    this.parser = new EventParser();
    this.config = {
      disconnectGracePeriodMs: config.disconnectGracePeriodMs || 60000,
      rawLogsDirectory: config.rawLogsDirectory || 'sessions',
    };

    this.bindTransportEvents();
  }

  /**
   * Initializes hardware transport and storage subsystem.
   */
  public async initialize(): Promise<void> {
    await this.writeRepo.initialize();
    await this.transport.initialize();
  }

  /**
   * Starts transport connection.
   */
  public async connect(): Promise<void> {
    await this.transport.connect();
  }

  /**
   * Disconnects transport and finalizes any active session.
   */
  public async disconnect(): Promise<void> {
    if (this.state.activeSession) {
      await this.finalizeActiveSession('COMPLETED');
    }
    await this.transport.disconnect();
  }

  /**
   * Manually terminates and seals the current active session.
   */
  public async stopCurrentSession(): Promise<string | null> {
    if (!this.state.activeSession) return null;
    return this.finalizeActiveSession('COMPLETED');
  }

  /**
   * Returns current snapshot of ingestion state.
   */
  public getState(): Readonly<SessionManagerState> {
    return this.state;
  }

  public onStateChange(listener: SessionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public onEventCaptured(listener: EventCapturedListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Binds to binary streams and hardware status events from the Transport layer.
   */
  private bindTransportEvents(): void {
    this.transport.onStatusChange((status, metadata) => {
      this.handleTransportStatusChange(status, metadata || null);
    });

    this.transport.onData((chunk) => {
      this.handleIncomingRawBytes(chunk);
    });

    this.transport.onError((err) => {
      console.error('Hardware transport error caught in SessionManager:', err);
    });
  }

  private handleTransportStatusChange(status: ConnectionStatus, metadata: TransportMetadata | null): void {
    this.state.connectionStatus = status;
    this.state.deviceMetadata = metadata;

    if (status === 'CONNECTED') {
      // If we were in a disconnect grace period, cancel timer and resume seamlessly
      this.cancelDisconnectGrace();
    } else if (status === 'DETACHED_RETRYING' || status === 'DISCONNECTED') {
      if (this.state.activeSession && !this.state.isDisconnectGraceActive) {
        this.startDisconnectGrace();
      }
    }

    this.broadcastState();
  }

  /**
   * Primary streaming pipeline: Framer -> EventParser -> Dual-Write Storage -> UI State.
   */
  private async handleIncomingRawBytes(chunk: Uint8Array): Promise<void> {
    const timestamp = Date.now();

    // 1. If no session is active, auto-start a new session on first valid incoming byte burst
    if (!this.state.activeSession) {
      await this.startNewSession(timestamp);
    }

    const session = this.state.activeSession!;

    // 2. Dual-Write Target A: Log raw chunk
    const rawChunk: RawSignalChunk = {
      chunkId: this.generateUUID(),
      sessionId: session.sessionId,
      sequenceNumber: this.rawChunkCounter++,
      timestamp,
      byteLength: chunk.length,
      rawBytesHex: this.parser.toHexString(chunk),
    };

    await this.writeRepo.appendRawChunk(rawChunk, session.rawLogPath);

    // 3. Binary Framing & Checksum Verification
    const extractedFrames = this.framer.pushChunk(chunk, timestamp);

    // 4. Decode each frame into structured event and persist
    for (const frame of extractedFrames) {
      const event = this.parser.parseFrame(frame, session.sessionId);

      // Dual-Write Target B: Insert structured event into SQLite
      await this.writeRepo.insertEvent(event);

      // Update in-memory session statistics
      session.eventCount += 1;
      if (event.critical) {
        session.criticalEventCount += 1;
      }

      // Update state
      this.state.latestEvent = event;
      this.state.eventList.push(event);

      // Notify real-time event listeners
      for (const listener of this.eventListeners) {
        try {
          listener(event, session);
        } catch (err) {
          console.error('Error in event listener:', err);
        }
      }
    }

    this.broadcastState();
  }

  private async startNewSession(startTimestamp: number): Promise<void> {
    const sessionId = this.generateUUID();
    const rawLogPath = `${this.config.rawLogsDirectory}/${sessionId}/raw_telemetry.rawlog`;

    const session: AEDSession = {
      sessionId,
      startTimestamp,
      status: 'ACTIVE',
      transportType: this.state.deviceMetadata?.type || 'UNKNOWN_TRANSPORT',
      deviceInfo: this.state.deviceMetadata?.deviceName || 'Standard Optical IR Dongle',
      eventCount: 0,
      criticalEventCount: 0,
      rawLogPath,
    };

    await this.writeRepo.createSession(session);

    this.state.activeSession = session;
    this.state.eventList = [];
    this.state.latestEvent = null;
    this.rawChunkCounter = 0;
    this.framer.reset();
  }

  private async finalizeActiveSession(status: 'COMPLETED' | 'INTERRUPTED'): Promise<string> {
    const session = this.state.activeSession;
    if (!session) return '';

    const endTimestamp = Date.now();
    const sha256 = await this.writeRepo.finalizeSession(
      session.sessionId,
      status,
      endTimestamp,
      session.eventCount,
      session.criticalEventCount,
      session.rawLogPath
    );

    session.status = status;
    session.endTimestamp = endTimestamp;
    session.sha256Checksum = sha256;

    this.cancelDisconnectGrace();
    this.state.activeSession = null;
    this.broadcastState();

    return sha256;
  }

  private startDisconnectGrace(): void {
    this.state.isDisconnectGraceActive = true;
    this.state.graceSecondsRemaining = Math.floor(this.config.disconnectGracePeriodMs / 1000);

    this.graceCountdownInterval = setInterval(() => {
      if (this.state.graceSecondsRemaining > 0) {
        this.state.graceSecondsRemaining -= 1;
        this.broadcastState();
      }
    }, 1000);

    this.disconnectGraceTimer = setTimeout(() => {
      // Grace period expired without reconnect; finalize as interrupted
      this.finalizeActiveSession('INTERRUPTED');
    }, this.config.disconnectGracePeriodMs);
  }

  private cancelDisconnectGrace(): void {
    this.state.isDisconnectGraceActive = false;
    this.state.graceSecondsRemaining = 0;

    if (this.disconnectGraceTimer) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }

    if (this.graceCountdownInterval) {
      clearInterval(this.graceCountdownInterval);
      this.graceCountdownInterval = null;
    }
  }

  private broadcastState(): void {
    const snapshot = Object.freeze({ ...this.state, eventList: [...this.state.eventList] });
    for (const listener of this.stateListeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in session manager state listener:', err);
      }
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
