import type { NutritionJob, NutritionEstimate } from '../types';
import { validateEstimate } from './nutrition.ts';

type Reply = { state: 'ready'; estimate: NutritionEstimate } | { state: 'pending'; retryAfter: number };
interface Store {
  claimNutritionJob: (date: Date, inputTypes: ('text' | 'photo')[]) => NutritionJob | null;
  completeNutritionJob: (id: string, lease: string | null, result: unknown, date: Date) => boolean;
  failNutritionJob: (id: string, lease: string | null, error: string, date: Date) => boolean;
  deferNutritionJob: (id: string, lease: string | null, seconds: number, date: Date) => void;
}

export class NutritionTransportError extends Error {
  code: 'network' | 'invalid_result' | 'backend_not_configured' | 'budget_exceeded';
  constructor(code: NutritionTransportError['code']) { super(code); this.code = code; }
}

export async function processNutritionJobs(store: Store, estimate: (job: NutritionJob) => Promise<Reply>, onChange: () => void,
  shouldContinue: () => boolean, now: () => Date = () => new Date()) {
  for (let count = 0; count < 10 && shouldContinue(); count++) {
    const job = store.claimNutritionJob(now(), ['text']);
    onChange();
    if (!job) return;
    try {
      const result = await estimate(job);
      if (result.state === 'pending') store.deferNutritionJob(job.id, job.leaseToken, result.retryAfter, now());
      else store.completeNutritionJob(job.id, job.leaseToken, validateEstimate(result.estimate), now());
    } catch (error) {
      store.failNutritionJob(job.id, job.leaseToken, error instanceof NutritionTransportError ? error.code : 'network', now());
    }
    onChange();
  }
}
