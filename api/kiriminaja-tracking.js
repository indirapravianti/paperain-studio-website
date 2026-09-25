import { applyCors, sendJson } from '../lib/api/cors.js';
import { requireAdmin } from '../lib/api/admin-auth.js';
import { getSupabaseAdmin } from '../lib/api/supabase-admin.js';
import { trackShipment } from '../lib/api/kiriminaja.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return sendJson(res, { error: 'method not allowed' }, 405);
  }

  const admin = await requireAdmin(req.headers?.authorization);
  if (!admin.ok) {
    return sendJson(res, { error: admin.error }, admin.status);
  }

  const orderId = req.query?.order_id;
  if (!orderId) {
    return sendJson(res, { error: 'order_id is required' }, 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('id, display_id, kiriminaja_awb')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return sendJson(res, { error: 'order not found' }, 404);
  }

  const trackingRef = order.kiriminaja_awb || order.display_id;
  if (!trackingRef) {
    return sendJson(res, { error: 'order has no KiriminAja shipment yet' }, 400);
  }

  try {
    const data = await trackShipment(trackingRef);
    return sendJson(res, data, 200);
  } catch (err) {
    console.error('api/kiriminaja-tracking error:', err);
    return sendJson(res, { error: err instanceof Error ? err.message : 'server error' }, 502);
  }
}
