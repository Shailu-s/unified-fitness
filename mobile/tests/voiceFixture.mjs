export function audioFixture(seconds = 2) {
  const box = (type, payload) => {
    const bytes = new Uint8Array(8 + payload.length);
    new DataView(bytes.buffer).setUint32(0, bytes.length);
    bytes.set(new TextEncoder().encode(type), 4); bytes.set(payload, 8); return bytes;
  };
  const header = new Uint8Array(20);
  new DataView(header.buffer).setUint32(12, 1000);
  new DataView(header.buffer).setUint32(16, Math.round(seconds * 1000));
  const chunks = [box('ftyp', new TextEncoder().encode('M4A     ')), box('moov', box('mvhd', header)), box('mdat', new Uint8Array([1,2,3,4]))];
  const result = new Uint8Array(chunks.reduce((n, chunk) => n + chunk.length, 0));
  let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
