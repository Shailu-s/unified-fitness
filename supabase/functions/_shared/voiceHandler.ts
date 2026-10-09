import { MAX_VOICE_BYTES, VOICE_MODEL, VOICE_PROMPT, validateTranscript, validateVoiceBytes } from '../../../mobile/src/lib/voice.ts';

interface VoiceInput { clientId: string; audioSha256: string }
interface Ports {
  authenticate: (token: string) => Promise<string | null>;
  claim: (owner: string, input: VoiceInput) => Promise<{ state: string; transcript?: unknown; leaseToken?: string }>;
  load: (owner: string, id: string) => Promise<Uint8Array>;
  finish: (owner: string, id: string, token: string, text: string) => Promise<boolean>;
  fail: (owner: string, id: string, token: string) => Promise<void>;
  remove: (owner: string, id: string) => Promise<void>;
  transcribe: (bytes: Uint8Array) => Promise<string>;
}
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function createVoiceHandler(ports: Ports) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return reply({ error: 'unauthorized' }, 401);
    let owner: string | null;
    try { owner = await ports.authenticate(token); } catch { owner = null; }
    if (!owner) return reply({ error: 'unauthorized' }, 401);
    let input: VoiceInput;
    try {
      if (Number(request.headers.get('content-length') ?? 0) > 2048) return reply({ error: 'invalid_input' }, 413);
      const reader = request.body?.getReader();
      if (!reader) return reply({ error: 'invalid_input' }, 422);
      const decoder = new TextDecoder(); let body = ''; let size = 0;
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 2048) { await reader.cancel(); return reply({ error: 'invalid_input' }, 413); }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
      const value = JSON.parse(body);
      if (!value || typeof value !== 'object' || Object.keys(value).some((key) => !['clientId','audioSha256'].includes(key)) ||
        typeof value.clientId !== 'string' || !/^[a-f0-9]{32}$/.test(value.clientId) || typeof value.audioSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.audioSha256)) return reply({ error: 'invalid_input' }, 422);
      input = { clientId: value.clientId, audioSha256: value.audioSha256 };
    } catch { return reply({ error: 'invalid_input' }, 422); }
    const cleanup = async () => { try { await ports.remove(owner!, input.clientId); } catch {} };
    let claim;
    try { claim = await ports.claim(owner, input); } catch { return reply({ error: 'backend_not_configured' }, 503); }
    if (claim.state === 'ready') {
      try { const transcript = validateTranscript(claim.transcript); await cleanup(); return reply({ state: 'ready', transcript }); }
      catch { return reply({ error: 'invalid_result' }, 502); }
    }
    if (claim.state === 'pending') return reply({ state: 'pending' }, 202);
    if (claim.state === 'budget_exceeded') { await cleanup(); return reply({ error: 'budget_exceeded' }, 429); }
    if (claim.state === 'rate_limited') { await cleanup(); return reply({ error: 'rate_limited' }, 429); }
    if (claim.state === 'conflict') return reply({ error: 'invalid_input' }, 409);
    if (claim.state !== 'claimed' || !claim.leaseToken) { await cleanup(); return reply({ error: 'backend_not_configured' }, 503); }
    try {
      const bytes = await ports.load(owner, input.clientId);
      try {
        validateVoiceBytes(bytes);
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)), (byte) => byte.toString(16).padStart(2, '0')).join('');
        if (digest !== input.audioSha256) throw new Error('audio_invalid');
      } catch { throw new Error('audio_invalid'); }
      const raw = await ports.transcribe(bytes);
      let transcript;
      try { transcript = validateTranscript(raw); } catch { throw new Error('invalid_result'); }
      if (!await ports.finish(owner, input.clientId, claim.leaseToken, transcript)) return reply({ state: 'pending' }, 202);
      return reply({ state: 'ready', transcript });
    } catch (error) {
      try { await ports.fail(owner, input.clientId, claim.leaseToken); } catch {}
      return reply({ error: error instanceof Error && ['audio_invalid','invalid_result'].includes(error.message) ? error.message : 'transcription_failed' }, 502);
    } finally { await cleanup(); }
  };
}

export function createVoiceTranscriber(apiKey: string, fetcher: typeof fetch = fetch) {
  return async (bytes: Uint8Array): Promise<string> => {
    if (!apiKey || bytes.length > MAX_VOICE_BYTES) throw new Error('Transcription unavailable.');
    validateVoiceBytes(bytes);
    const body = new FormData();
    body.append('model', VOICE_MODEL);
    body.append('file', new Blob([new Uint8Array(bytes).buffer], { type: 'audio/mp4' }), 'meal.m4a');
    body.append('response_format', 'json');
    body.append('temperature', '0');
    body.append('prompt', VOICE_PROMPT);
    const response = await fetcher('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body, signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error('Transcription unavailable.');
    const value = await response.json();
    try { return validateTranscript(value.text); } catch { throw new Error('invalid_result'); }
  };
}
