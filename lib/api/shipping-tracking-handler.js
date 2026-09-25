import { getSupabaseAdmin } from './supabase-admin.js';
import { getKiriminajaTracking } from './kiriminaja.js';

export async function handleShippingTracking(body) {
  const orderId = body?.order_id;
  if (!orderId) {
    return { status: 400, body: { error: 'order_id is required' } };
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, shipment_awb')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !order) {
    return { status: 404, body: { error: 'order not found' } };
  }

  if (!order.shipment_awb) {
    return { status: 400, body: { error: 'this order has no shipment yet' } };
  }

  let result;
  try {
    result = await getKiriminajaTracking(order.shipment_awb);
  } catch (err) {
    console.error('kiriminaja tracking config error:', err);
    return { status: 503, body: { error: 'shipping service is not configured yet' } };
  }

  if (!result.ok) {
    console.error('kiriminaja tracking error:', result.data);
    return { status: 502, body: { error: result.data?.text || 'could not fetch tracking' } };
  }

  const details = result.data.details || {};
  const histories = (result.data.histories || []).map((h) => ({
    created_at: h.created_at,
    status: h.status,
  }));

  return {
    status: 200,
    body: {
      text: result.data.text || null,
      delivered: !!details.delivered,
      service_name: details.service_name || null,
      histories,
    },
  };
}
