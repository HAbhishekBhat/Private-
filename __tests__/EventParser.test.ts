import { EventParser } from '../src/core/parser/EventParser';
import { Framer } from '../src/core/parser/Framer';

describe('EventParser Unit Tests', () => {
  let parser: EventParser;

  beforeEach(() => {
    parser = new EventParser();
  });

  test('decodes critical shock delivered event with energy payload', () => {
    const raw = Framer.encodeFrame(12, 0x34, new Uint8Array([0x00, 0xc8, 0x20, 0x44])); // 200J, 32A, 68 Ohms
    const frame = {
      rawBytes: raw,
      sequenceNumber: 12,
      commandCode: 0x34,
      payloadBytes: new Uint8Array([0x00, 0xc8, 0x20, 0x44]),
      checksum: 0x00,
      checksumValid: true,
      receivedTimestamp: 1700000000000,
    };

    const event = parser.parseFrame(frame, 'sess-123');

    expect(event.sessionId).toBe('sess-123');
    expect(event.sequenceNumber).toBe(12);
    expect(event.eventCode).toBe('0X34');
    expect(event.label).toBe('Shock Delivered');
    expect(event.severity).toBe('CRITICAL');
    expect(event.critical).toBe(true);
    expect(event.checksumValid).toBe(true);
    expect(event.metadata.energyJoules).toBe(200);
    expect(event.metadata.currentAmps).toBe(32);
    expect(event.metadata.impedanceOhms).toBe(68);
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.metadata)).toBe(true);
  });

  test('decodes shock advised and analyzes severity correctly', () => {
    const raw = Framer.encodeFrame(8, 0x30, new Uint8Array([0x00, 0xb4])); // 180 BPM
    const frame = {
      rawBytes: raw,
      sequenceNumber: 8,
      commandCode: 0x30,
      payloadBytes: new Uint8Array([0x00, 0xb4]),
      checksum: 0x00,
      checksumValid: true,
      receivedTimestamp: 1700000000000,
    };

    const event = parser.parseFrame(frame, 'sess-123');

    expect(event.label).toBe('Shock Advised - Stand Clear');
    expect(event.critical).toBe(true);
    expect(event.severity).toBe('CRITICAL');
    expect(event.metadata.heartRateBpm).toBe(180);
  });

  test('unrecognized opcode is safely routed to UNKNOWN_EVENT without losing raw bytes', () => {
    const raw = Framer.encodeFrame(99, 0x88, new Uint8Array([0x11, 0x22]));
    const frame = {
      rawBytes: raw,
      sequenceNumber: 99,
      commandCode: 0x88,
      payloadBytes: new Uint8Array([0x11, 0x22]),
      checksum: 0x00,
      checksumValid: true,
      receivedTimestamp: 1700000000000,
    };

    const event = parser.parseFrame(frame, 'sess-123');

    expect(event.eventCode).toBe('0X88');
    expect(event.label).toContain('Unknown AED Telemetry Frame');
    expect(event.severity).toBe('UNKNOWN');
    expect(event.critical).toBe(false);
    expect(event.rawPayloadHex).toBe(parser.toHexString(raw));
    expect(event.metadata.unrecognizedCode).toBe('0x88');
  });

  test('corrupt checksum produces explicit warning event with payload intact', () => {
    const raw = Framer.encodeFrame(1, 0x11);
    const frame = {
      rawBytes: raw,
      sequenceNumber: 1,
      commandCode: 0x11,
      payloadBytes: new Uint8Array(0),
      checksum: 0xfe,
      checksumValid: false,
      receivedTimestamp: 1700000000000,
    };

    const event = parser.parseFrame(frame, 'sess-123');

    expect(event.checksumValid).toBe(false);
    expect(event.label).toContain('Corrupted Frame Checksum');
    expect(event.severity).toBe('WARNING');
    expect(event.metadata.checksumError).toBe(true);
  });
});
