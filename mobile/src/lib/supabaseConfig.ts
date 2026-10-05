export interface SupabaseConfig {
  url: string;
  key: string;
  enabled: boolean;
}

function legacyRole(key: string): string | null {
  try {
    const part = key.split('.')[1];
    if (!part) return null;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bits = 0; let buffer = 0; let output = '';
    for (const char of part.replace(/-/g, '+').replace(/_/g, '/').replace(/=/g, '')) {
      const number = alphabet.indexOf(char);
      if (number < 0) return null;
      buffer = (buffer << 6) | number; bits += 6;
      if (bits >= 8) { bits -= 8; output += String.fromCharCode((buffer >> bits) & 255); }
    }
    return JSON.parse(output).role ?? null;
  } catch { return null; }
}

export function validateSupabaseConfig(url: string | undefined, key: string | undefined, enabled = 'false'): SupabaseConfig | null {
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Supabase public URL/key missing.');
  if (key.startsWith('sb_secret_') || legacyRole(key) === 'service_role') throw new Error('Privileged key is not allowed in mobile config.');
  if (!key.startsWith('sb_publishable_') && legacyRole(key) !== 'anon') throw new Error('Use a publishable or legacy anon key.');
  const parsed = new URL(url);
  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password ||
    (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))) {
    throw new Error('Use the Supabase base project URL.');
  }
  if (!['true', 'false'].includes(enabled)) throw new Error('Nutrition enabled flag must be true or false.');
  return { url: url.replace(/\/$/, ''), key, enabled: enabled === 'true' };
}
