/**
 * High-Fidelity AED Hardware Simulation & Playback Transport.
 * Emulates optical IR receiver stream with realistic pacing, chunk fragmentation, and emergency clinical scenarios.
 */

import {
  ConnectionStatus,
  DataListener,
  ErrorListener,
  ITransportService,
  StatusListener,
  TransportMetadata,
} from '../core/types/transport';
import { Framer } from '../core/parser/Framer';

export type SimulationScenario =
  | 'ADULT_CARDIAC_ARREST_SHOCKABLE'
  | 'NON_SHOCKABLE_RHYTHM'
  | 'DISCONNECT_RECOVERY_TEST'
  | 'CORRUPT_FRAME_BURST_TEST';

export class MockSimulatorTransport implements ITransportService {
  private status: ConnectionStatus = 'DISCONNECTED';
  private metadata: TransportMetadata | null = null;
  private isSimulating = false;
  private simulationTimers: NodeJS.Timeout[] = [];
  private sequenceCounter = 0;

  private dataListeners: Set<DataListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();

  public async initialize(): Promise<void> {
    this.setStatus('SEARCHING');
  }

  public async connect(): Promise<void> {
    this.setStatus('CONNECTING');
    this.metadata = {
      type: 'MOCK_SIMULATOR',
      deviceName: 'AED Optical IR Hardware Simulator',
      vendorId: 0x9999,
      productId: 0x0001,
      serialNumber: 'SIM-AED-RESCUE-2026',
      protocolString: 'sim.medical.aed.ir',
      baudRate: 9600,
      isMFiCertified: true,
    };
    this.setStatus('CONNECTED');
  }

  public async disconnect(): Promise<void> {
    this.stopSimulation();
    this.metadata = null;
    this.setStatus('DISCONNECTED');
  }

  public async send(_data: Uint8Array): Promise<void> {
    // Simulator receives ping or command
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getMetadata(): TransportMetadata | null {
    return this.metadata;
  }

  public onData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.metadata || undefined);
    return () => this.statusListeners.delete(listener);
  }

  public onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Starts an automated clinical cardiac arrest telemetry stream.
   */
  public playScenario(scenario: SimulationScenario = 'ADULT_CARDIAC_ARREST_SHOCKABLE', speedMultiplier = 1): void {
    this.stopSimulation();
    this.isSimulating = true;
    this.sequenceCounter = 0;

    const schedule = this.getScenarioTimeline(scenario);

    for (const step of schedule) {
      const delay = Math.round(step.delayMs / speedMultiplier);
      const timer = setTimeout(() => {
        if (!this.isSimulating) return;

        if (step.action === 'EVENT') {
          this.emitEncodedFrame(step.code!, step.payload);
        } else if (step.action === 'DISCONNECT') {
          this.setStatus('DETACHED_RETRYING');
        } else if (step.action === 'RECONNECT') {
          this.setStatus('CONNECTED');
        } else if (step.action === 'CORRUPT_BYTES') {
          this.emitCorruptBytes();
        }
      }, delay);

      this.simulationTimers.push(timer);
    }
  }

  /**
   * Stops any currently running playback sequence.
   */
  public stopSimulation(): void {
    this.isSimulating = false;
    for (const t of this.simulationTimers) {
      clearTimeout(t);
    }
    this.simulationTimers = [];
  }

  /**
   * Manually emits a single protocol event frame (useful for UI button triggers and test harness).
   */
  public emitEvent(code: number, payload: Uint8Array = new Uint8Array(0)): void {
    this.emitEncodedFrame(code, payload);
  }

  private emitEncodedFrame(code: number, payload: Uint8Array = new Uint8Array(0)): void {
    const seq = this.sequenceCounter++;
    const frame = Framer.encodeFrame(seq, code, payload);

    // Simulate natural optical IR packet fragmentation (send in 2 chunks)
    if (frame.length > 8 && Math.random() > 0.5) {
      const splitPoint = Math.floor(frame.length / 2);
      const chunk1 = frame.slice(0, splitPoint);
      const chunk2 = frame.slice(splitPoint);

      this.broadcastBytes(chunk1);
      setTimeout(() => this.broadcastBytes(chunk2), 20);
    } else {
      this.broadcastBytes(frame);
    }
  }

  private emitCorruptBytes(): void {
    // Deliberate malformed packet with bad checksum for parser resilience test
    const junk = new Uint8Array([0xaa, 0x55, 0x05, 0x99, 0x30, 0x00, 0x00, 0xff, 0x0d, 0x0a]);
    this.broadcastBytes(junk);
  }

  private broadcastBytes(bytes: Uint8Array): void {
    if (this.status !== 'CONNECTED') return;
    for (const listener of this.dataListeners) {
      try {
        listener(bytes);
      } catch (err) {
        console.error('Error in mock data listener:', err);
      }
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(this.status, this.metadata || undefined);
      } catch (err) {
        console.error('Error in mock status listener:', err);
      }
    }
  }

  private getScenarioTimeline(scenario: SimulationScenario): Array<{
    delayMs: number;
    action: 'EVENT' | 'DISCONNECT' | 'RECONNECT' | 'CORRUPT_BYTES';
    code?: number;
    payload?: Uint8Array;
  }> {
    if (scenario === 'ADULT_CARDIAC_ARREST_SHOCKABLE') {
      return [
        { delayMs: 200, action: 'EVENT', code: 0x01, payload: new Uint8Array([98]) }, // Power On (98% Bat)
        { delayMs: 1200, action: 'EVENT', code: 0x02 }, // Self-Test Passed
        { delayMs: 2200, action: 'EVENT', code: 0x10 }, // Pads Disconnected
        { delayMs: 4000, action: 'EVENT', code: 0x11, payload: new Uint8Array([0x00, 0x48]) }, // Pads Connected (72 Ohms)
        { delayMs: 5500, action: 'EVENT', code: 0x20 }, // Analyzing Rhythm
        { delayMs: 8000, action: 'EVENT', code: 0x30, payload: new Uint8Array([0x00, 0xb4]) }, // Shock Advised (180 BPM VF)
        { delayMs: 9500, action: 'EVENT', code: 0x32, payload: new Uint8Array([0x00, 0xc8]) }, // Charging (200 Joules)
        { delayMs: 12000, action: 'EVENT', code: 0x33, payload: new Uint8Array([0x00, 0xc8]) }, // Shock Armed Ready!
        { delayMs: 14500, action: 'EVENT', code: 0x34, payload: new Uint8Array([0x00, 0xc8, 0x20, 0x44]) }, // Shock Delivered (200J, 32A, 68 Ohms)
        { delayMs: 16000, action: 'EVENT', code: 0x40 }, // Start CPR
        { delayMs: 17500, action: 'EVENT', code: 0x41, payload: new Uint8Array([110]) }, // CPR Metronome Active (110 BPM)
        { delayMs: 22000, action: 'EVENT', code: 0x42 }, // Pause CPR Re-evaluating
        { delayMs: 24000, action: 'EVENT', code: 0x20 }, // Analyzing Rhythm
        { delayMs: 26000, action: 'EVENT', code: 0x31 }, // No Shock Advised (ROSC achieved)
      ];
    }

    if (scenario === 'DISCONNECT_RECOVERY_TEST') {
      return [
        { delayMs: 300, action: 'EVENT', code: 0x01 },
        { delayMs: 1200, action: 'EVENT', code: 0x11 },
        { delayMs: 2000, action: 'DISCONNECT' }, // Dongle unplugged mid-rescue
        { delayMs: 3500, action: 'RECONNECT' }, // Dongle plugged back in within grace window
        { delayMs: 4500, action: 'EVENT', code: 0x20 }, // Resumed on same session
        { delayMs: 6000, action: 'EVENT', code: 0x30 },
      ];
    }

    if (scenario === 'CORRUPT_FRAME_BURST_TEST') {
      return [
        { delayMs: 300, action: 'EVENT', code: 0x01 },
        { delayMs: 1000, action: 'CORRUPT_BYTES' },
        { delayMs: 1800, action: 'EVENT', code: 0x77 }, // Unknown opcode 0x77
        { delayMs: 2500, action: 'EVENT', code: 0x34, payload: new Uint8Array([0x00, 0x96, 0x1e, 0x40]) }, // Valid 150J shock
      ];
    }

    // Default Non-Shockable
    return [
      { delayMs: 300, action: 'EVENT', code: 0x01 },
      { delayMs: 1500, action: 'EVENT', code: 0x11 },
      { delayMs: 3000, action: 'EVENT', code: 0x20 },
      { delayMs: 5000, action: 'EVENT', code: 0x31 },
      { delayMs: 6500, action: 'EVENT', code: 0x40 },
    ];
  }
}
