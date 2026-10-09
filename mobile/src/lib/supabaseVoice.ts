import { nutritionSession } from './supabaseNutrition';
import { voiceAudioData } from './voiceFiles';
import { VoiceTransportError } from './voiceWorker';
import { NutritionTransportError } from './nutritionWorker';
import { validateTranscript } from './voice';
import type { VoiceJob } from '../types';

export const voiceEnabled = () => process.env.EXPO_PUBLIC_VOICE_ENABLED === 'true';

export async function requestVoice(job: VoiceJob): Promise<{ state: 'ready'; transcript: string } | { state: 'pending' }> {
  if (!voiceEnabled() || !job.audioUri) throw new VoiceTransportError('backend_not_configured');
  let session;
  try { session = await nutritionSession(); }
  catch (error) { throw new VoiceTransportError(error instanceof NutritionTransportError && error.code === 'network' ? 'network' : 'backend_not_configured'); }
  const { client, token, owner, config } = session;
  let audio;
  try { audio = await voiceAudioData(job.audioUri); } catch { throw new VoiceTransportError('audio_invalid'); }
  const { data: stale } = await client.storage.from('meal-voice').list(owner, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  const old = (stale ?? []).filter((file) => /^[a-f0-9]{32}\.m4a$/.test(file.name) && file.name !== `${job.id}.m4a` && Date.parse(file.created_at ?? '') < Date.now() - 86400000);
  if (old.length) await client.storage.from('meal-voice').remove(old.map((file) => `${owner}/${file.name}`));
  const { error } = await client.storage.from('meal-voice').upload(`${owner}/${job.id}.m4a`, new Uint8Array(audio.bytes).buffer, { contentType: 'audio/mp4', upsert: false });
  if (error && !['409','Duplicate'].includes(String((error as { statusCode?: string; error?: string }).statusCode ?? (error as { error?: string }).error))) throw new VoiceTransportError('network');
  let response;
  try {
    response = await fetch(`${config.url}/functions/v1/voice-transcribe-preview`, {
      method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000), body: JSON.stringify({ clientId: job.id, audioSha256: audio.sha256 }),
    });
  } catch { throw new VoiceTransportError('network'); }
  let body;
  try { body = await response.json(); } catch { throw new VoiceTransportError('network'); }
  if (response.status === 202 && body.state === 'pending') return { state: 'pending' };
  if (!response.ok) {
    if (body.error === 'budget_exceeded') throw new VoiceTransportError('budget_exceeded');
    if (body.error === 'audio_invalid') throw new VoiceTransportError('audio_invalid');
    if (body.error === 'invalid_result' || body.error === 'invalid_input') throw new VoiceTransportError('invalid_result');
    if ([401,403,404,503].includes(response.status)) throw new VoiceTransportError('backend_not_configured');
    throw new VoiceTransportError('network');
  }
  try { return { state: 'ready', transcript: validateTranscript(body.transcript) }; }
  catch { throw new VoiceTransportError('invalid_result'); }
}
