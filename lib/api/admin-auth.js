import { getSupabaseAdmin } from './supabase-admin.js';

/** Verifies the bearer token belongs to a signed-in admin, for server routes that trigger
 * paid third-party side effects (KiriminAja shipment creation/tracking/cancel) and so can't
 * rely on client-side role checks alone. */
export async function requireAdmin(authHeader) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { ok: false, status: 401, error: 'missing authorization' };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: 'invalid session' };
  }

  const isAdmin =
    data.user.app_metadata?.role === 'admin' || data.user.user_metadata?.role === 'admin';
  if (!isAdmin) {
    return { ok: false, status: 403, error: 'admin access required' };
  }

  return { ok: true, user: data.user };
}
