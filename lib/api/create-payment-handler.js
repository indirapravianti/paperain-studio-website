import { getSupabaseAdmin } from './supabase-admin.js';
import { getSnapApiUrl, midtransBasicAuth, parseSnapResponse } from './midtrans.js';

const USD_TO_IDR = 16000;

function toIdr(usdAmount) {
  return Math.round(Number(usdAmount) * USD_TO_IDR);
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
  const items = order.order_items || [];

  const itemDetails = items.map((item) => ({
    id: String(item.product_id).slice(0, 50),
    name: String(item.title || 'item').substring(0, 50),
    price: isUsd ? toIdr(item.price) : Math.round(Number(item.price)),
    quantity: Number(item.quantity) || 1,
  }));

  const volumeDiscount = Number(order.discount) || 0;
  if (volumeDiscount > 0) {
    itemDetails.push({
      id: 'VOLUME-DISC',
      name: 'Volume Discount (20%)',
      price: isUsd ? -toIdr(volumeDiscount) : -Math.round(volumeDiscount),
      quantity: 1,
    });
  }

  if (Number(order.shipping_fee) > 0) {
    itemDetails.push({
      id: 'SHIPPING',
      name: 'Shipping Fee',
      price: isUsd ? toIdr(order.shipping_fee) : Math.round(Number(order.shipping_fee)),
      quantity: 1,
    });
  }

  const grossAmount = itemDetails.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  if (grossAmount <= 0) {
    return { status: 400, body: { error: 'invalid order amount' } };
  }

  // Midtrans order_id: use UUID (display_id contains "/" which breaks some gateways)
  const midtransOrderId = order.id;

  const midtransPayload = {
    transaction_details: {
      order_id: midtransOrderId,
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

  let snapRes;
  try {
    snapRes = await fetch(getSnapApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Basic ' + midtransBasicAuth(midtransKey),
      },
      body: JSON.stringify(midtransPayload),
    });
  } catch (err) {
    console.error('Midtrans fetch error:', err);
    return { status: 502, body: { error: 'could not reach midtrans' } };
  }

  const snapData = await parseSnapResponse(snapRes);

  if (!snapRes.ok || !snapData.token) {
    console.error('Midtrans Snap error:', snapData);
    return {
      status: 502,
      body: {
        error: snapData.error_messages?.join(', ') || snapData.status_message || 'failed to create payment token',
        detail: snapData,
      },
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
  }

  return {
    status: 200,
    body: { snap_token: snapData.token, redirect_url: snapData.redirect_url },
  };
}
