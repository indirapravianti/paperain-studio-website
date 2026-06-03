import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      'Server misconfigured: set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Vercel.',
    );
  }

  return createClient(url, key);
}
