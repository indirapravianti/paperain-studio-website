import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase-admin.js';
import { sendOrderConfirmationEmail } from './send-order-email.js';

function sha512(input) {
  return crypto.createHash('sha512').update(input).digest('hex');
}

function mapTransactionStatus(transactionStatus, fraudStatus) {
  if (transactionStatus === 'capture') {
    return fraudStatus === 'accept' ? 'confirmed' : null;
  }
  if (transactionStatus === 'settlement') return 'confirmed';
  if (transactionStatus === 'pending') return 'pending';
  if (['deny', 'expire', 'cancel'].includes(transactionStatus)) return 'cancelled';
  return null;
}

export async function handleMidtransNotification(body) {
  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    fraud_status,
    transaction_id,
    payment_type,
  } = body;

  if (!order_id || !signature_key) {
    return { status: 400, body: { error: 'invalid notification' } };
  }

  const midtransKey = process.env.MIDTRANS_SERVER_KEY;
  if (!midtransKey) {
    return { status: 503, body: { error: 'not configured' } };
  }

  const expectedSig = sha512(
    String(order_id) + String(status_code) + String(gross_amount) + midtransKey,
  );

  if (signature_key !== expectedSig) {
    console.error('Midtrans signature mismatch for order:', order_id);
    return { status: 403, body: { error: 'invalid signature' } };
  }

  const newStatus = mapTransactionStatus(transaction_status || '', fraud_status || '');
  if (!newStatus) {
    return { status: 200, body: { message: 'status not mapped, ignored' } };
  }

  const supabase = getSupabaseAdmin();

  const { data: orderById } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', order_id)
    .maybeSingle();

  let order = orderById;
  if (!order) {
    const { data: orderByDisplay } = await supabase
      .from('orders')
      .select('id, status')
      .eq('display_id', order_id)
      .maybeSingle();
    order = orderByDisplay;
  }

  if (!order) {
    console.error('Order not found for Midtrans order_id:', order_id);
    return { status: 404, body: { error: 'order not found' } };
  }

  const skipUpdate =
    order.status === 'delivered' ||
    order.status === 'shipped' ||
    (order.status === 'confirmed' && newStatus === 'pending');

  if (!skipUpdate) {
    const update = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (payment_type) update.payment_type = payment_type;
    if (transaction_id) update.midtrans_transaction_id = transaction_id;

    await supabase.from('orders').update(update).eq('id', order.id);
  }

  if (newStatus === 'confirmed') {
    sendOrderConfirmationEmail(supabase, order.id).catch((err) => {
      console.error('order confirmation email failed:', err);
    });
  }

  return { status: 200, body: { message: 'ok' } };
}
