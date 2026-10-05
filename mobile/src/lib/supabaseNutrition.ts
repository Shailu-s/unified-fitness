import 'react-native-url-polyfill/auto';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createSecureSessionStorage } from './secureSessionStorage';
import { validateSupabaseConfig } from './supabaseConfig';
import { NutritionTransportError } from './nutritionWorker';
import { validateEstimate } from './nutrition';
import type { NutritionJob } from '../types';
import { photoUploadData } from './photoFiles';

let client: SupabaseClient | null = null;

export function nutritionBackendConfig() {
  return validateSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.EXPO_PUBLIC_NUTRITION_ENABLED ?? 'false');
}

export const photoEstimatesEnabled = () => process.env.EXPO_PUBLIC_PHOTO_ESTIMATES_ENABLED === 'true';

export async function requestNutrition(job: NutritionJob) {
  const config = nutritionBackendConfig();
  if (!config?.enabled) throw new NutritionTransportError('backend_not_configured');
  client ??= createClient(config.url, config.key, {
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, lock: processLock,
      storage: createSecureSessionStorage({
        get: SecureStore.getItemAsync,
        set: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
        remove: SecureStore.deleteItemAsync,
      }, () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`),
    },
  });
  const session = await client.auth.getSession();
  if (session.error) throw new NutritionTransportError('backend_not_configured');
  if (!session.data.session) {
    const signedIn = await client.auth.signInAnonymously();
    if (signedIn.error) throw new NutritionTransportError('backend_not_configured');
  } else if ((session.data.session.expires_at ?? 0) * 1000 <= Date.now() + 30000) {
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error) throw new NutritionTransportError('backend_not_configured');
  }
  const current = await client.auth.getSession();
  const token = current.data.session?.access_token;
  if (!token) throw new NutritionTransportError('backend_not_configured');
  const functionName = process.env.EXPO_PUBLIC_NUTRITION_FUNCTION ?? 'nutrition-estimate';
  if (!/^[a-z0-9-]{1,80}$/.test(functionName)) throw new NutritionTransportError('backend_not_configured');
  const owner = current.data.session!.user.id;
  const { data: stale } = await client.storage.from('meal-photos').list(owner, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } });
  const old = (stale ?? []).filter((file) => /^[a-f0-9]{32}\.jpg$/.test(file.name) && file.name !== `${job.id}.jpg` && Date.parse(file.created_at ?? '') < Date.now()-86400000);
  if (old.length) await client.storage.from('meal-photos').remove(old.map((file) => `${owner}/${file.name}`));
  let photoSha256: string | undefined;
  if (job.input.inputType === 'photo') {
    if (!photoEstimatesEnabled() || !job.input.photoUri) throw new NutritionTransportError('backend_not_configured');
    const path = `${owner}/${job.id}.jpg`;
    try {
      const photo = await photoUploadData(job.input.photoUri);
      photoSha256 = photo.sha256;
      const { error } = await client.storage.from('meal-photos').upload(path, new Uint8Array(photo.bytes).buffer, { contentType: 'image/jpeg', upsert: false });
      if (error && !['409','Duplicate'].includes(String((error as { statusCode?: string; error?: string }).statusCode ?? (error as { error?: string }).error))) {
        throw new NutritionTransportError('network');
      }
    } catch (error) { throw error instanceof NutritionTransportError ? error : new NutritionTransportError('photo_upload'); }
  }
  let response: Response;
  try {
    response = await fetch(`${config.url}/functions/v1/${functionName}`, {
      method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ clientId: job.id, inputType: job.input.inputType ?? 'text', name: job.input.name, portion: job.input.portion,
        ...(photoSha256 ? { photoSha256 } : {}) }),
    });
  } catch { throw new NutritionTransportError('network'); }
  let body;
  try { body = await response.json(); } catch { throw new NutritionTransportError('network'); }
  if (response.status === 202 && body.state === 'pending') return { state: 'pending' as const, retryAfter: 5 };
  if (!response.ok) {
    if (body.error === 'budget_exceeded') throw new NutritionTransportError('budget_exceeded');
    if (body.error === 'not_food') throw new NutritionTransportError('not_food');
    if ([401, 403, 404, 503].includes(response.status)) throw new NutritionTransportError('backend_not_configured');
    if (body.error === 'invalid_input' || body.error === 'invalid_result') throw new NutritionTransportError('invalid_result');
    throw new NutritionTransportError('network');
  }
  try { return { state: 'ready' as const, estimate: validateEstimate(body.estimate) }; }
  catch { throw new NutritionTransportError('invalid_result'); }
}
