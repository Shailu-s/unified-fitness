import { validateSupabaseConfig } from '../src/lib/supabaseConfig.ts';

try {
  validateSupabaseConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.EXPO_PUBLIC_NUTRITION_ENABLED ?? 'false');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid public backend config.');
  process.exitCode = 1;
}
