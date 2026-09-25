import { getSupabaseAdmin } from './supabase-admin.js';
import { createShipmentForOrder } from './kiriminaja-shipment.js';

export async function handleShippingCreateShipment(body) {
  const orderId = body?.order_id;
  if (!orderId) {
    return { status: 400, body: { error: 'order_id is required' } };
  }

  const supabase = getSupabaseAdmin();
  const result = await createShipmentForOrder(supabase, orderId);

  if (!result.ok) {
    return { status: 400, body: { error: result.error || 'shipment creation failed' } };
  }

  if (result.skipped) {
    return { status: 200, body: { skipped: true, reason: result.reason } };
  }

  return { status: 200, body: { awb: result.awb } };
}
