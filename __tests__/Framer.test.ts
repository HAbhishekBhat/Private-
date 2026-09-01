import { Framer } from '../src/core/parser/Framer';

describe('Framer Unit Tests', () => {
  let framer: Framer;

  beforeEach(() => {
    framer = new Framer();
  });

  test('correctly decodes a single complete frame', () => {
    // Encodes: SEQ=1, CMD=0x11 (Pads Connected), Payload=[0x00, 0x48] (72 Ohms)
    const encoded = Framer.encodeFrame(1, 0x11, new Uint8Array([0x00, 0x48]));
    const frames = framer.pushChunk(encoded, 1000);

    expect(frames).toHaveLength(1);
    expect(frames[0].sequenceNumber).toBe(1);
    expect(frames[0].commandCode).toBe(0x11);
    expect(frames[0].payloadBytes).toEqual(new Uint8Array([0x00, 0x48]));
    expect(frames[0].checksumValid).toBe(true);
    expect(frames[0].receivedTimestamp).toBe(1000);
  });

  test('reassembles a frame split across multiple incoming chunks', () => {
    const encoded = Framer.encodeFrame(5, 0x34, new Uint8Array([0x00, 0xc8, 0x20, 0x44])); // Shock Delivered 200J
    const chunk1 = encoded.slice(0, 4);
    const chunk2 = encoded.slice(4, 8);
    const chunk3 = encoded.slice(8);

    expect(framer.pushChunk(chunk1)).toHaveLength(0);
    expect(framer.pushChunk(chunk2)).toHaveLength(0);

    const frames = framer.pushChunk(chunk3);
    expect(frames).toHaveLength(1);
    expect(frames[0].sequenceNumber).toBe(5);
    expect(frames[0].commandCode).toBe(0x34);
    expect(frames[0].checksumValid).toBe(true);
  });

  test('handles noise and junk bytes preceding a valid preamble', () => {
    const junk = new Uint8Array([0x00, 0xff, 0x12, 0xaa]); // Noise with trailing 0xAA
    const encoded = Framer.encodeFrame(2, 0x20); // Analyzing

    framer.pushChunk(junk);
    const frames = framer.pushChunk(encoded);

    expect(frames).toHaveLength(1);
    expect(frames[0].sequenceNumber).toBe(2);
    expect(frames[0].commandCode).toBe(0x20);
    expect(frames[0].checksumValid).toBe(true);
  });

  test('detects corrupt frame checksum', () => {
    const encoded = Framer.encodeFrame(3, 0x30); // Shock Advised
    // Corrupt the checksum byte
    encoded[encoded.length - 3] = encoded[encoded.length - 3] ^ 0xff;

    const frames = framer.pushChunk(encoded);
    expect(frames).toHaveLength(1);
    expect(frames[0].sequenceNumber).toBe(3);
    expect(frames[0].checksumValid).toBe(false);
  });

  test('resets buffer cleanly', () => {
    framer.pushChunk(new Uint8Array([0xaa, 0x55, 0x05]));
    framer.reset();
    expect(framer.pushChunk(new Uint8Array([0x00, 0x01, 0x02]))).toHaveLength(0);
  });
});
