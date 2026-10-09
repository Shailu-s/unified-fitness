import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validateSupabaseConfig } from '../src/lib/supabaseConfig.ts';
import { validateVoiceBytes, validateTranscript } from '../src/lib/voice.ts';

if (process.env.VOICE_SMOKE_APPROVED !== 'true') throw new Error('Explicit voice testing/spend approval is required.');
const path = process.argv[2];
if (!path) throw new Error('Supply an explicitly approved synthetic audio fixture.');
const bytes = new Uint8Array(readFileSync(path));
const seconds = validateVoiceBytes(bytes);
const digest = createHash('sha256').update(bytes).digest('hex');
const config = validateSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'true');
const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const { data, error } = await client.auth.signInAnonymously();
if (error || !data.session) throw new Error('Guest authentication failed.');
const owner = data.session.user.id;
const first = randomUUID().replaceAll('-', '');
const second = randomUUID().replaceAll('-', '');
const transcripts = [];
for (const id of [first, first, second]) {
  const upload = await client.storage.from('meal-voice').upload(`${owner}/${id}.m4a`, bytes.buffer, { contentType: 'audio/mp4', upsert: false });
  if (upload.error) throw new Error('Synthetic recording upload failed.');
  const response = await fetch(`${config.url}/functions/v1/voice-transcribe-preview`, {
    method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60000), body: JSON.stringify({ clientId: id, audioSha256: digest }),
  });
  const result = await response.json();
  if (!response.ok || result.state !== 'ready') throw new Error(`Voice smoke failed: HTTP ${response.status}; ${['budget_exceeded','backend_not_configured','audio_invalid','invalid_result','transcription_failed'].includes(result.error) ? result.error : 'unavailable'}.`);
  transcripts.push(validateTranscript(result.transcript));
}
if (transcripts.some((text) => text !== transcripts[0])) throw new Error('Voice cache/idempotency returned inconsistent transcripts.');
const remaining = await client.storage.from('meal-voice').list(owner);
if (remaining.error || remaining.data.length) throw new Error('Synthetic audio cleanup did not finish.');
console.log(JSON.stringify({ seconds, transcript: transcripts[0], identicalRetryAndDigestCache: true, privateAudioCleanup: true, expectedNewReservationUsd: 0.04 }));
