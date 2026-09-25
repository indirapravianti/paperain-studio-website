import { getSupabaseAdmin } from './supabase-admin.js';

/** Receives shipment status events from KiriminAja (AWB created, shipped, delivered, returned, etc.).
 * Docs: https://developer.kiriminaja.com/docs/webhook/event
 *
 * `order_id` in every event payload is the partner-side id we sent at request_pickup time
 * (order.display_id), so events are matched back to orders by that column.
 */
async function findOrderByKiriminajaOrderId(supabase, orderId) {
  const { data } = await supabase
    .from('orders')
    .select('id, status')
    .eq('display_id', orderId)
    .maybeSingle();
  return data;
}

async function handleProcessed(supabase, entry) {
  const order = await findOrderByKiriminajaOrderId(supabase, entry.order_id);
  if (!order) return;
  await supabase
    .from('orders')
    .update({ kiriminaja_awb: entry.awb || null, kiriminaja_status: 'processed' })
    .eq('id', order.id);
}

async function handleShipped(supabase, entry) {
  const order = await findOrderByKiriminajaOrderId(supabase, entry.order_id);
  if (!order) return;
  await supabase
    .from('orders')
    .update({
      status: order.status === 'confirmed' ? 'shipped' : order.status,
      kiriminaja_status: 'shipped',
      shipped_at: entry.shipped_at ? new Date(entry.shipped_at).toISOString() : new Date().toISOString(),
    })
    .eq('id', order.id);
}

async function handleFinished(supabase, entry) {
  const order = await findOrderByKiriminajaOrderId(supabase, entry.order_id);
  if (!order) return;
  await supabase
    .from('orders')
    .update({
      status: 'delivered',
      kiriminaja_status: 'delivered',
      delivered_at: entry.finished_at ? new Date(entry.finished_at).toISOString() : new Date().toISOString(),
    })
    .eq('id', order.id);
}

async function handleReturned(supabase, entry) {
  const order = await findOrderByKiriminajaOrderId(supabase, entry.order_id);
  if (!order) return;
  await supabase
    .from('orders')
    .update({
      kiriminaja_status: 'returned',
      returned_at: entry.returned_at ? new Date(entry.returned_at).toISOString() : new Date().toISOString(),
    })
    .eq('id', order.id);
}

const HANDLERS = {
  processed_packages: handleProcessed,
  shipped_packages: handleShipped,
  finished_packages: handleFinished,
  returned_packages: handleReturned,
};

export async function handleKiriminajaWebhook(authHeader, body) {
  const token = process.env.KIRIMINAJA_TOKEN;
  if (!token) {
    return { status: 503, body: { error: 'not configured' } };
  }

  if (authHeader !== `Bearer ${token}`) {
    console.error('kiriminaja webhook: invalid or missing bearer token');
    return { status: 403, body: { error: 'invalid token' } };
  }

  const method = body?.method;
  const entries = Array.isArray(body?.data) ? body.data : body?.data ? [body.data] : [];
  const handler = HANDLERS[method];

  if (!handler) {
    console.log('kiriminaja webhook: unhandled method', method, JSON.stringify(body?.data));
    return { status: 200, body: { message: 'ok' } };
  }

  const supabase = getSupabaseAdmin();
  for (const entry of entries) {
    try {
      await handler(supabase, entry);
    } catch (err) {
      console.error('kiriminaja webhook handler error:', method, entry?.order_id, err);
    }
  }

  return { status: 200, body: { message: 'ok' } };
}
