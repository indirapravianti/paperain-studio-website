import { applyCors, parseRequestBody, sendJson } from '../lib/api/cors.js';
import { requireAdmin } from '../lib/api/admin-auth.js';
import { getSupabaseAdmin } from '../lib/api/supabase-admin.js';
import { cancelShipment } from '../lib/api/kiriminaja.js';

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

  const { order_id, reason } = parseRequestBody(req);
  if (!order_id || !reason || reason.length < 5) {
    return sendJson(res, { error: 'order_id and a reason (min 5 chars) are required' }, 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('id, kiriminaja_awb')
    .eq('id', order_id)
    .maybeSingle();

  if (!order?.kiriminaja_awb) {
    return sendJson(res, { error: 'order has no AWB to cancel' }, 400);
  }

  try {
    const data = await cancelShipment(order.kiriminaja_awb, reason);
    await supabase.from('orders').update({ kiriminaja_status: 'cancel_pending' }).eq('id', order.id);
    return sendJson(res, data, 200);
  } catch (err) {
    console.error('api/kiriminaja-cancel error:', err);
    return sendJson(res, { error: err instanceof Error ? err.message : 'server error' }, 502);
  }
}
