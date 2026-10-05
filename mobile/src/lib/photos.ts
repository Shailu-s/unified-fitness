export const MAX_PHOTO_BYTES = 2100000;
export interface PickedPhoto { uri: string; width: number; height: number }
interface CapturePorts {
  permission: () => Promise<boolean>;
  pick: (source: 'camera' | 'gallery') => Promise<PickedPhoto | null>;
  prepare: (asset: PickedPhoto) => Promise<Uint8Array>;
  persist: (bytes: Uint8Array) => Promise<string>;
}

export function validatePhotoBytes(bytes: Uint8Array) {
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('Photo is too large. Choose a smaller image.');
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length-2] !== 255 || bytes[bytes.length-1] !== 217) {
    throw new Error('Use a valid JPEG photo.');
  }
}

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  validatePhotoBytes(bytes);
  const segments: Uint8Array[] = [bytes.slice(0, 2)];
  let offset = 2;
  while (offset < bytes.length) {
    const start = offset;
    if (bytes[offset++] !== 255) throw new Error('Invalid JPEG header.');
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 218 || marker === 217) { segments.push(bytes.slice(start)); break; }
    if (offset + 2 > bytes.length) throw new Error('Invalid JPEG header.');
    const size = bytes[offset] * 256 + bytes[offset+1];
    if (size < 2 || offset + size > bytes.length) throw new Error('Invalid JPEG segment.');
    offset += size;
    if (!((marker >= 225 && marker <= 237) || marker === 239 || marker === 254)) segments.push(bytes.slice(start, offset));
  }
  const result = new Uint8Array(segments.reduce((sum, segment) => sum + segment.length, 0));
  let position = 0;
  for (const segment of segments) { result.set(segment, position); position += segment.length; }
  validatePhotoBytes(result);
  return result;
}

export function validateOwnedPhotoUri(uri: string, root: string) {
  const prefix = `${root.replace(/\/+$/, '')}/`;
  if (!uri.startsWith(prefix) || !/^[a-f0-9-]+\.jpg$/.test(uri.slice(prefix.length))) throw new Error('Photo is not an owned meal asset.');
}

export async function capturePhoto(source: 'camera' | 'gallery', ports: CapturePorts): Promise<string | null> {
  if (source === 'camera' && !await ports.permission()) throw new Error('Camera permission is required. Enable it in device settings.');
  const asset = await ports.pick(source);
  if (!asset) return null;
  return ports.persist(stripJpegMetadata(await ports.prepare(asset)));
}
