import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { MAX_VOICE_BYTES, validateNativeRecordingUri, validateVoiceBytes } from './voice';

export async function voiceAudioData(uri: string) {
  validateNativeRecordingUri(uri, Paths.document.uri);
  const file = new File(uri);
  if (!file.exists || file.size > MAX_VOICE_BYTES) throw new Error('Recording unavailable.');
  const bytes = await file.bytes();
  const durationMs = Math.round(validateVoiceBytes(bytes) * 1000);
  const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
  const sha256 = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { bytes, durationMs, sha256 };
}

export async function persistVoiceAudio(id: string, uri: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid recording ID.');
  const audio = await voiceAudioData(uri);
  const folder = new Directory(Paths.document, 'voice-recordings');
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, `${id}.m4a`);
  if (!file.exists) file.create();
  file.write(audio.bytes);
  return { ...audio, uri: file.uri, cleanupNative: uri.includes('/ExpoAudio/') && uri !== file.uri };
}

export function removeVoiceAudio(uri: string) {
  validateNativeRecordingUri(uri, Paths.document.uri);
  const file = new File(uri);
  if (file.exists) file.delete();
}
