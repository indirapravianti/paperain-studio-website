import { getSupabaseAdmin } from './supabase-admin.js';

const USD_TO_IDR = 16000;

function toIdr(usdAmount) {
  return Math.round(usdAmount * USD_TO_IDR);
}

function getSnapApiUrl() {
  const env = process.env.PUBLIC_MIDTRANS_ENV || process.env.MIDTRANS_ENV || 'sandbox';
  return env === 'production'
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
}

export async function handleCreatePayment(body) {
  const { order_id } = body;

  if (!order_id) {
    return { status: 400, body: { error: 'order_id is required' } };
  }

  const midtransKey = process.env.MIDTRANS_SERVER_KEY;
  if (!midtransKey) {
    return {
      status: 503,
      body: { error: 'payment gateway is not configured yet', pending: true },
    };
  }

  const supabase = getSupabaseAdmin();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', order_id)
    .single();

  if (orderError || !order) {
    return { status: 404, body: { error: 'order not found' } };
  }

  if (order.status !== 'pending') {
    return { status: 400, body: { error: 'order is not in pending status' } };
  }

  const isUsd = order.currency === 'USD';

  const itemDetails = (order.order_items || []).map((item) => ({
    id: item.product_id,
    name: item.title.substring(0, 50),
    price: isUsd ? toIdr(Number(item.price)) : Math.round(Number(item.price)),
    quantity: item.quantity,
  }));

  const volumeDiscount = Number(order.discount) - (Number(order.promo_discount) || 0);
  if (volumeDiscount > 0) {
    itemDetails.push({
      id: 'VOLUME-DISC',
      name: 'Volume Discount (20%)',
      price: isUsd ? -toIdr(volumeDiscount) : -Math.round(volumeDiscount),
      quantity: 1,
    });
  }

  if ((Number(order.promo_discount) || 0) > 0) {
    itemDetails.push({
      id: 'PROMO-DISC',
      name: 'Promo: ' + (order.promo_code || 'discount'),
      price: isUsd ? -toIdr(Number(order.promo_discount)) : -Math.round(Number(order.promo_discount)),
      quantity: 1,
    });
  }

  if (Number(order.shipping_fee) > 0) {
    itemDetails.push({
      id: 'SHIPPING',
      name: 'Shipping Fee',
      price: isUsd ? toIdr(Number(order.shipping_fee)) : Math.round(Number(order.shipping_fee)),
      quantity: 1,
    });
  }

  const grossAmount = itemDetails.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const midtransPayload = {
    transaction_details: {
      order_id: order.display_id || order.id,
      gross_amount: grossAmount,
    },
    item_details: itemDetails,
    credit_card: { secure: true },
    enabled_payments: ['credit_card'],
    customer_details: {
      first_name: order.shipping_name,
      email: order.shipping_email,
      phone: order.shipping_phone,
      shipping_address: {
        first_name: order.shipping_name,
        phone: order.shipping_phone,
        address: order.shipping_address,
        country_code: order.shipping_country || 'ID',
      },
    },
  };

  const auth = Buffer.from(midtransKey + ':').toString('base64');
  const snapRes = await fetch(getSnapApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Basic ' + auth,
    },
    body: JSON.stringify(midtransPayload),
  });

  const snapData = await snapRes.json();

  if (!snapRes.ok || !snapData.token) {
    console.error('Midtrans Snap error:', snapData);
    return {
      status: 502,
      body: { error: 'failed to create payment token', detail: snapData },
    };
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      payment_token: snapData.token,
      payment_url: snapData.redirect_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id);

  if (updateError) {
    console.error('order payment update error:', updateError);
    // Token is still valid for Snap even if payment_* columns are missing (run patch-004)
  }

  return {
    status: 200,
    body: { snap_token: snapData.token, redirect_url: snapData.redirect_url },
  };
}
