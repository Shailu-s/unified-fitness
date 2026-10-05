import type { NutritionEstimate } from '../../../mobile/src/types.ts';
import { NUTRITION_CACHE_VERSION, nutritionCacheKey, validateEstimate } from '../../../mobile/src/lib/nutrition.ts';

export interface EstimateRequest {
  clientId: string;
  inputType: 'text';
  name: string;
  portion: string;
}

interface Ports {
  authenticate: (token: string) => Promise<string | null>;
  claim: (owner: string, request: EstimateRequest, key: string, version: string) => Promise<{ state: string; estimate?: unknown; leaseToken?: string }>;
  finish: (key: string, token: string, result: NutritionEstimate) => Promise<boolean>;
  fail: (key: string, token: string) => Promise<void>;
  estimate: (request: EstimateRequest) => Promise<unknown>;
  model: string;
}

const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function createNutritionHandler(ports: Ports) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return response({ error: 'unauthorized' }, 401);
    let owner: string | null;
    try { owner = await ports.authenticate(token); }
    catch { return response({ error: 'unauthorized' }, 401); }
    if (!owner) return response({ error: 'unauthorized' }, 401);
    let input: EstimateRequest;
    try {
      if (Number(request.headers.get('content-length') ?? 0) > 8192) return response({ error: 'invalid_input' }, 413);
      const reader = request.body?.getReader();
      if (!reader) return response({ error: 'invalid_input' }, 422);
      const decoder = new TextDecoder();
      let content = ''; let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 8192) { await reader.cancel(); return response({ error: 'invalid_input' }, 413); }
        content += decoder.decode(chunk.value, { stream: true });
      }
      content += decoder.decode();
      if (content.length > 4096) return response({ error: 'invalid_input' }, 413);
      const body = JSON.parse(content);
      if (!body || typeof body !== 'object' || Object.keys(body).some((key) => !['clientId', 'inputType', 'name', 'portion'].includes(key)) ||
        typeof body.clientId !== 'string' || !/^[a-f0-9]{32}$/.test(body.clientId) || body.inputType !== 'text' || typeof body.name !== 'string' || typeof body.portion !== 'string' ||
        !body.name.trim() || body.name.length > 500 || body.portion.length > 500) return response({ error: 'invalid_input' }, 422);
      input = { clientId: body.clientId, inputType: 'text', name: body.name.trim(), portion: body.portion.trim() || 'Portion not specified' };
    } catch { return response({ error: 'invalid_input' }, 422); }
    const version = `${NUTRITION_CACHE_VERSION}:${ports.model}`;
    const normalized = nutritionCacheKey({ ...input, kcal: null, protein: null, fibre: null });
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([version, normalized])));
    const key = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    let claim;
    try { claim = await ports.claim(owner, input, key, version); }
    catch { return response({ error: 'backend_not_configured' }, 503); }
    if (claim.state === 'ready') {
      try { return response({ state: 'ready', estimate: validateEstimate(claim.estimate) }); }
      catch { return response({ error: 'invalid_result' }, 502); }
    }
    if (claim.state === 'pending') return response({ state: 'pending', retryAfter: 5 }, 202);
    if (claim.state === 'budget_exceeded') return response({ error: 'budget_exceeded' }, 429);
    if (claim.state === 'rate_limited') return response({ error: 'rate_limited' }, 429);
    if (claim.state === 'conflict') return response({ error: 'invalid_input' }, 409);
    if (claim.state !== 'claimed' || !claim.leaseToken) return response({ error: 'backend_not_configured' }, 503);
    try {
      const estimate = validateEstimate(await ports.estimate(input));
      if (!await ports.finish(key, claim.leaseToken, estimate)) return response({ state: 'pending', retryAfter: 5 }, 202);
      return response({ state: 'ready', estimate });
    } catch {
      try { await ports.fail(key, claim.leaseToken); } catch {}
      return response({ error: 'model_failed' }, 502);
    }
  };
}
