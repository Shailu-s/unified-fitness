import type { VoiceJob } from '../types';
import { validateTranscript } from './voice.ts';

export class VoiceTransportError extends Error {
  code: 'network' | 'invalid_result' | 'backend_not_configured' | 'budget_exceeded' | 'audio_invalid';
  constructor(code: VoiceTransportError['code']) { super(code); this.code = code; }
}
interface Store {
  claimVoiceJob: (date: Date) => VoiceJob | null;
  completeVoiceJob: (id: string, lease: string | null, text: string, date: Date) => boolean;
  failVoiceJob: (id: string, lease: string | null, code: string, date: Date) => boolean;
  deferVoiceJob: (id: string, lease: string | null, date: Date) => void;
}
export async function processVoiceJobs(store: Store, transcribe: (job: VoiceJob) => Promise<{ state: 'ready'; transcript: string } | { state: 'pending' }>,
  onChange: () => void, shouldContinue: () => boolean, now: () => Date = () => new Date()) {
  for (let count = 0; count < 5 && shouldContinue(); count++) {
    const job = store.claimVoiceJob(now());
    onChange();
    if (!job) return;
    try {
      const result = await transcribe(job);
      if (result.state === 'pending') store.deferVoiceJob(job.id, job.leaseToken, now());
      else {
        let text: string;
        try { text = validateTranscript(result.transcript); } catch { throw new VoiceTransportError('invalid_result'); }
        store.completeVoiceJob(job.id, job.leaseToken, text, now());
      }
    } catch (error) { store.failVoiceJob(job.id, job.leaseToken, error instanceof VoiceTransportError ? error.code : 'network', now()); }
    onChange();
  }
}
