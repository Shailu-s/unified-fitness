import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createVoiceHandler, createVoiceTranscriber } from '../_shared/voiceHandler.ts';
import { MAX_VOICE_BYTES, voiceObjectPath } from '../../../mobile/src/lib/voice.ts';

const apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
const enabled = Deno.env.get('MODEL_API_ENABLED') === 'true' && Deno.env.get('VOICE_PREVIEW_API_ENABLED') === 'true' && Boolean(apiKey);
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(createVoiceHandler({
  authenticate: async (token) => { const { data, error } = await admin.auth.getUser(token); return error ? null : data.user?.id ?? null; },
  claim: async (owner, input) => {
    const { data, error } = await admin.rpc('claim_voice_request', { p_owner: owner, p_client_id: input.clientId, p_digest: input.audioSha256, p_allow_model: enabled });
    if (error) throw new Error('Voice backend unavailable.');
    return data;
  },
  load: async (owner, id) => {
    const { data, error } = await admin.storage.from('meal-voice').download(voiceObjectPath(owner, id));
    if (error || !data || data.size > MAX_VOICE_BYTES) throw new Error('audio_invalid');
    return new Uint8Array(await data.arrayBuffer());
  },
  finish: async (owner, id, token, text) => {
    const { data, error } = await admin.rpc('finish_voice_request', { p_owner: owner, p_client_id: id, p_lease_token: token, p_transcript: text });
    if (error) throw new Error('Could not save transcript.');
    return data === true;
  },
  fail: async (owner, id, token) => {
    const { error } = await admin.rpc('fail_voice_request', { p_owner: owner, p_client_id: id, p_lease_token: token });
    if (error) throw new Error('Could not save failure.');
  },
  remove: async (owner, id) => {
    const { error } = await admin.storage.from('meal-voice').remove([voiceObjectPath(owner, id)]);
    if (error) throw new Error('Could not remove recording.');
  },
  transcribe: createVoiceTranscriber(apiKey),
}));
