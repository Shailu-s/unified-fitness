import { MAX_PHOTO_BYTES, stripJpegMetadata, validatePhotoBytes } from '../../../mobile/src/lib/photos.ts';

export function photoObjectPath(owner: string, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(owner) || !/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid photo owner or job.');
  return `${owner}/${id}.jpg`;
}

export async function verifiedPhoto(blob: Blob, expected: string) {
  if (blob.size > MAX_PHOTO_BYTES || !['image/jpeg','application/octet-stream'].includes(blob.type)) throw new Error('Invalid photo.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  validatePhotoBytes(bytes);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2,'0')).join('');
  if (digest !== expected) throw new Error('Photo digest mismatch.');
  const safe = stripJpegMetadata(bytes);
  let binary = '';
  for (let offset = 0; offset < safe.length; offset += 8192) binary += String.fromCharCode(...safe.subarray(offset, offset+8192));
  return { mimeType: 'image/jpeg' as const, base64: btoa(binary) };
}
