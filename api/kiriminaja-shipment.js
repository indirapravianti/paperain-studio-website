import { applyCors, parseRequestBody, sendJson } from '../lib/api/cors.js';
import { requireAdmin } from '../lib/api/admin-auth.js';
import { getSupabaseAdmin } from '../lib/api/supabase-admin.js';
import { createKiriminajaShipmentForOrder } from '../lib/api/kiriminaja-shipment-handler.js';

/** Admin-triggered (re)creation of a KiriminAja shipment for an already-paid order — used when
 * the automatic creation at payment confirmation failed and needs a retry from the dashboard. */
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

  const { order_id } = parseRequestBody(req);
  if (!order_id) {
    return sendJson(res, { error: 'order_id is required' }, 400);
  }

  try {
    const result = await createKiriminajaShipmentForOrder(getSupabaseAdmin(), order_id);
    return sendJson(res, result, result.ok ? 200 : 502);
  } catch (err) {
    console.error('api/kiriminaja-shipment error:', err);
    return sendJson(res, { error: err instanceof Error ? err.message : 'server error' }, 500);
  }
}
