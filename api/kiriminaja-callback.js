import { applyCors, parseRequestBody, sendJson } from '../lib/api/cors.js';
import { requireAdmin } from '../lib/api/admin-auth.js';
import { setCallbackUrl } from '../lib/api/kiriminaja.js';

/** Admin-triggered registration of our webhook URL with KiriminAja (set_callback). Without it
 * KiriminAja never pushes processed_packages, so the AWB never reaches the order row.
 * Defaults to PUBLIC_SITE_URL + /api/kiriminaja-webhook; an explicit https url can be passed instead. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, { error: 'method not allowed' }, 405);
  }

  const admin = await requireAdmin(req.headers?.authorization);
  if (!admin.ok) {
    return sendJson(res, { error: admin.error }, admin.status);
  }

  const { url: requestedUrl } = parseRequestBody(req);
  const siteUrl = (process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  const url = requestedUrl || (siteUrl ? `${siteUrl}/api/kiriminaja-webhook` : '');

  if (!url || !/^https:\/\//.test(url)) {
    return sendJson(res, { error: 'an https callback url is required (set PUBLIC_SITE_URL or pass url)' }, 400);
  }

  try {
    const data = await setCallbackUrl(url);
    return sendJson(res, { ok: true, url, text: data.text || null }, 200);
  } catch (err) {
    console.error('api/kiriminaja-callback error:', err);
    return sendJson(res, { error: err instanceof Error ? err.message : 'server error' }, 500);
  }
}
