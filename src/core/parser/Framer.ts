/**
 * Low-level binary framing and packetization engine.
 * Handles fragmented stream chunking, preamble synchronization, length checks, and checksum validation.
 */

export interface RawFrame {
  rawBytes: Uint8Array;
  sequenceNumber: number;
  commandCode: number;
  payloadBytes: Uint8Array;
  checksum: number;
  checksumValid: boolean;
  receivedTimestamp: number;
}

export class Framer {
  private buffer: number[] = [];
  private static readonly PREAMBLE_0 = 0xaa;
  private static readonly PREAMBLE_1 = 0x55;
  private static readonly TERMINATOR_0 = 0x0d; // \r
  private static readonly TERMINATOR_1 = 0x0a; // \n
  private static readonly MIN_FRAME_LENGTH = 7; // AA 55 LEN SEQ CMD CHK 0D 0A
  private static readonly MAX_FRAME_LENGTH = 256;

  /**
   * Pushes incoming raw byte chunk into the ring accumulator and returns any complete extracted frames.
   */
  public pushChunk(chunk: Uint8Array, timestamp: number = Date.now()): RawFrame[] {
    for (let i = 0; i < chunk.length; i++) {
      this.buffer.push(chunk[i]);
    }

    const frames: RawFrame[] = [];

    while (this.buffer.length >= Framer.MIN_FRAME_LENGTH) {
      // 1. Scan for Preamble: 0xAA 0x55
      const preambleIndex = this.findPreambleIndex();
      if (preambleIndex === -1) {
        // Keep at most 1 byte in case 0xAA was the last byte received
        if (this.buffer.length > 0 && this.buffer[this.buffer.length - 1] === Framer.PREAMBLE_0) {
          this.buffer = [Framer.PREAMBLE_0];
        } else {
          this.buffer = [];
        }
        break;
      }

      // Discard garbage preceding preamble
      if (preambleIndex > 0) {
        this.buffer.splice(0, preambleIndex);
      }

      // Need at least 4 bytes to read length: AA 55 LEN ...
      if (this.buffer.length < 3) {
        break;
      }

      const lengthField = this.buffer[2]; // Length of SEQ + CMD + PAYLOAD
      const expectedTotalLength = 2 + 1 + lengthField + 1 + 2; // Preamble(2) + Len(1) + Body(L) + Chk(1) + Term(2)

      if (expectedTotalLength > Framer.MAX_FRAME_LENGTH || lengthField < 2) {
        // Invalid length field; discard false preamble byte and continue
        this.buffer.shift();
        continue;
      }

      if (this.buffer.length < expectedTotalLength) {
        // Incomplete frame, wait for more data
        break;
      }

      // Verify Terminator: 0x0D 0x0A
      const term0 = this.buffer[expectedTotalLength - 2];
      const term1 = this.buffer[expectedTotalLength - 1];

      if (term0 !== Framer.TERMINATOR_0 || term1 !== Framer.TERMINATOR_1) {
        // Terminator mismatch; discard false preamble
        this.buffer.shift();
        continue;
      }

      // Extract raw frame slice
      const frameBytes = this.buffer.splice(0, expectedTotalLength);
      const rawUint8 = new Uint8Array(frameBytes);

      const sequenceNumber = frameBytes[3];
      const commandCode = frameBytes[4];
      const payloadLength = lengthField - 2; // Subtract SEQ and CMD
      const payloadBytes = rawUint8.slice(5, 5 + payloadLength);
      const receivedChecksum = frameBytes[5 + payloadLength];

      // Calculate XOR checksum over: LEN, SEQ, CMD, and PAYLOAD bytes
      let calculatedChecksum = lengthField ^ sequenceNumber ^ commandCode;
      for (let i = 0; i < payloadBytes.length; i++) {
        calculatedChecksum ^= payloadBytes[i];
      }

      const checksumValid = calculatedChecksum === receivedChecksum;

      frames.push({
        rawBytes: rawUint8,
        sequenceNumber,
        commandCode,
        payloadBytes,
        checksum: receivedChecksum,
        checksumValid,
        receivedTimestamp: timestamp,
      });
    }

    return frames;
  }

  /**
   * Resets the internal accumulator buffer.
   */
  public reset(): void {
    this.buffer = [];
  }

  /**
   * Utility helper to encode a frame for transmission or testing.
   */
  public static encodeFrame(sequenceNumber: number, commandCode: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
    const lengthField = 2 + payload.length; // SEQ + CMD + Payload
    const totalLength = 2 + 1 + lengthField + 1 + 2;
    const buffer = new Uint8Array(totalLength);

    buffer[0] = Framer.PREAMBLE_0;
    buffer[1] = Framer.PREAMBLE_1;
    buffer[2] = lengthField;
    buffer[3] = sequenceNumber & 0xff;
    buffer[4] = commandCode & 0xff;

    let chk = lengthField ^ (sequenceNumber & 0xff) ^ (commandCode & 0xff);
    for (let i = 0; i < payload.length; i++) {
      buffer[5 + i] = payload[i];
      chk ^= payload[i];
    }

    buffer[5 + payload.length] = chk & 0xff;
    buffer[totalLength - 2] = Framer.TERMINATOR_0;
    buffer[totalLength - 1] = Framer.TERMINATOR_1;

    return buffer;
  }

  private findPreambleIndex(): number {
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i] === Framer.PREAMBLE_0 && this.buffer[i + 1] === Framer.PREAMBLE_1) {
        return i;
      }
    }
    return -1;
  }
}
