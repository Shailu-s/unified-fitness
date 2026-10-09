export const VOICE_MODEL = 'gpt-4o-mini-transcribe-2025-12-15';
export const VOICE_PIPELINE_VERSION = 'indian-meal-v1';
export const VOICE_PROMPT = 'Indian meal logging: roti, dal, chawal, paneer, sabzi, rice. Speech may be Hindi, English or mixed. Transcribe only what is spoken.';
export const MAX_VOICE_SECONDS = 30;
export const MAX_VOICE_BYTES = 1000000;
export const VOICE_RESERVATION_USD = 0.04;

export function validateTranscript(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 500) throw new Error('No clear short transcript. Try again or type.');
  return value.trim();
}

export function validateRecordingUri(uri: string, root: string) {
  const prefix = `${root.replace(/\/+$/, '')}/`;
  if (!uri.startsWith(prefix) || !/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.m4a$/.test(uri.slice(prefix.length))) throw new Error('Recording is not an owned audio file.');
}

export function voiceObjectPath(owner: string, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(owner) || !/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid recording identifiers.');
  return `${owner}/${id}.m4a`;
}

export function validateVoiceBytes(bytes: Uint8Array): number {
  if (bytes.length < 24 || bytes.length > MAX_VOICE_BYTES) throw new Error('Recording size is invalid.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));
  if (tag(4) !== 'ftyp') throw new Error('Use an M4A recording.');
  const durations: number[] = [];
  let media = false;
  const walk = (start: number, end: number, depth = 0) => {
    if (depth > 4) throw new Error('Invalid recording container.');
    let offset = start;
    while (offset < end) {
      if (offset + 8 > end) throw new Error('Incomplete recording.');
      let size = view.getUint32(offset);
      let header = 8;
      if (size === 1) { if (offset + 16 > end) throw new Error('Incomplete recording.'); size = Number(view.getBigUint64(offset + 8)); header = 16; }
      if (size === 0) size = end - offset;
      if (!Number.isSafeInteger(size) || size < header || offset + size > end) throw new Error('Invalid recording container.');
      const type = tag(offset + 4);
      const body = offset + header;
      if (type === 'moov' || type === 'trak' || type === 'mdia') walk(body, offset + size, depth + 1);
      if (type === 'mdat' && size > header) media = true;
      if (type === 'mvhd' || type === 'mdhd') {
        const version = bytes[body];
        const scaleOffset = body + (version === 1 ? 20 : 12);
        const durationOffset = scaleOffset + 4;
        if ((version !== 0 && version !== 1) || durationOffset + (version === 1 ? 8 : 4) > offset + size) throw new Error('Invalid recording duration.');
        const scale = view.getUint32(scaleOffset);
        const duration = version === 1 ? Number(view.getBigUint64(durationOffset)) : view.getUint32(durationOffset);
        const seconds = duration / scale;
        if (!scale || !Number.isFinite(seconds) || seconds < 0.25 || seconds > MAX_VOICE_SECONDS + 2) throw new Error('Record for up to 30 seconds.');
        durations.push(seconds);
      }
      offset += size;
    }
  };
  walk(0, bytes.length);
  if (!media || !durations.length) throw new Error('Incomplete recording.');
  return Math.max(...durations);
}
