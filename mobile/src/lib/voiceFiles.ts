import { File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { MAX_VOICE_BYTES, validateRecordingUri, validateVoiceBytes } from './voice';

export async function voiceAudioData(uri: string) {
  validateRecordingUri(uri, Paths.document.uri);
  const file = new File(uri);
  if (!file.exists || file.size > MAX_VOICE_BYTES) throw new Error('Recording unavailable.');
  const bytes = await file.bytes();
  const durationMs = Math.round(validateVoiceBytes(bytes) * 1000);
  const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
  const sha256 = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { bytes, durationMs, sha256 };
}

export function removeVoiceAudio(uri: string) {
  validateRecordingUri(uri, Paths.document.uri);
  const file = new File(uri);
  if (file.exists) file.delete();
}
