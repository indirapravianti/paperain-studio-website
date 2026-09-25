import { getSupabaseAdmin } from './supabase-admin.js';
import {
  getVolumeDiscount,
  priceCartItems,
  resolvePackageWeight,
  roundMoney,
} from './pricing.js';
import { getKiriminajaShippingOptions } from './kiriminaja.js';

async function reserveStock(supabase, orderId, productId, quantity) {
  const { data, error } = await supabase.rpc('reserve_product_stock', {
    p_product_id: productId,
    p_quantity: quantity,
    p_order_id: orderId,
  });

  if (error) {
    console.error('stock reserve rpc error:', error);
    return { ok: false, error: 'could not reserve stock' };
  }

  if (!data?.ok) {
    return {
      ok: false,
      error: data?.error || 'insufficient stock',
      available: data?.available,
    };
  }

  return { ok: true };
}

export async function handlePlaceOrder(body) {
  const {
    items,
    currency,
    shipping_name,
    shipping_email,
    shipping_phone,
    shipping_address,
    shipping_country,
    notes,
    customer_id,
    courier_code,
    courier_service_type,
    courier_service_name,
    courier_etd,
    shipping_cost,
    destination_kecamatan_id,
    destination_kelurahan_id,
    destination_zipcode,
  } = body;

  if (!items?.length) {
    return { status: 400, body: { error: 'cart is empty' } };
  }
  if (currency !== 'IDR') {
    return { status: 400, body: { error: 'only IDR orders are accepted' } };
  }
  if (
    !shipping_name ||
    !shipping_email ||
    !shipping_phone ||
    !shipping_address ||
    !shipping_country
  ) {
    return { status: 400, body: { error: 'missing shipping details' } };
  }
  if (
    !courier_code ||
    !courier_service_type ||
    shipping_cost == null ||
    !destination_kecamatan_id ||
    !destination_kelurahan_id ||
    !destination_zipcode
  ) {
    return { status: 400, body: { error: 'shipping courier not selected' } };
  }

  const supabase = getSupabaseAdmin();

  let resolvedCustomerId = customer_id || null;
  if (resolvedCustomerId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', resolvedCustomerId)
      .maybeSingle();
    if (!customer) resolvedCustomerId = null;
  }

  const priced = await priceCartItems(supabase, items, currency);
  if ('error' in priced) {
    return { status: 400, body: { error: priced.error } };
  }

  const { lines, subtotal } = priced;
  const weightGrams = await resolvePackageWeight(supabase, lines);

  let shippingOptions;
  try {
    shippingOptions = await getKiriminajaShippingOptions({
      destinationKecamatanId: Number(destination_kecamatan_id),
      destinationKelurahanId: Number(destination_kelurahan_id),
      weightGrams,
      itemValue: roundMoney(subtotal),
    });
  } catch (err) {
    console.error('kiriminaja config error:', err);
    return { status: 503, body: { error: 'shipping service is not configured yet' } };
  }

  if (!shippingOptions.ok) {
    console.error('kiriminaja pricing error:', shippingOptions.data);
    return { status: 502, body: { error: 'could not verify shipping cost' } };
  }

  const matchedOption = (shippingOptions.data.results || []).find(
    (r) => r.service === courier_code && r.service_type === courier_service_type,
  );

  if (!matchedOption || Math.round(Number(matchedOption.cost)) !== Math.round(Number(shipping_cost))) {
    return { status: 400, body: { error: 'shipping cost could not be verified, please reselect a courier' } };
  }

  const verifiedShippingFee = Math.round(Number(matchedOption.cost));
  const volumeDiscount = getVolumeDiscount(subtotal, currency);
  const totalDiscount = volumeDiscount;
  const total = subtotal - totalDiscount + verifiedShippingFee;

  const orderData = {
    customer_id: resolvedCustomerId,
    status: 'pending',
    currency,
    subtotal: roundMoney(subtotal, currency),
    discount: roundMoney(totalDiscount, currency),
    shipping_fee: roundMoney(verifiedShippingFee, currency),
    total: roundMoney(total, currency),
    shipping_name,
    shipping_email,
    shipping_phone,
    shipping_address,
    shipping_country,
    notes: notes || null,
    courier_code,
    courier_service_name: courier_service_name || null,
    courier_service_type,
    courier_etd: courier_etd || null,
    destination_kecamatan_id: Number(destination_kecamatan_id),
    destination_kelurahan_id: Number(destination_kelurahan_id),
    destination_zipcode,
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (orderError || !order) {
    console.error('order insert error:', orderError);
    return { status: 500, body: { error: 'could not create order', detail: orderError?.message } };
  }

  // Reserve stock per line (rolls back order if any line fails)
  for (const line of lines) {
    const reserve = await reserveStock(supabase, order.id, line.product_id, line.qty);
    if (!reserve.ok) {
      await supabase.from('orders').delete().eq('id', order.id);
      return {
        status: 400,
        body: {
          error: reserve.error || 'insufficient stock',
          available: reserve.available,
        },
      };
    }
  }

  const itemRows = lines.map((line) => ({
    order_id: order.id,
    product_id: line.product_id,
    variant_id: line.variant_id,
    title: line.title,
    price: line.price,
    quantity: line.qty,
    image: line.image,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(itemRows);

  if (itemsError) {
    console.error('order items insert error:', itemsError);
    await supabase.rpc('restore_order_stock', { p_order_id: order.id });
    await supabase.from('orders').delete().eq('id', order.id);
    return { status: 500, body: { error: 'order created but items failed to save' } };
  }

  return { status: 200, body: { order } };
}

export async function restoreStockForOrder(supabase, orderId) {
  const { error } = await supabase.rpc('restore_order_stock', { p_order_id: orderId });
  if (error) {
    console.error('restore stock error:', orderId, error);
    return false;
  }
  return true;
}

export async function confirmStockForOrder(supabase, orderId) {
  const { error } = await supabase.rpc('confirm_order_stock', { p_order_id: orderId });
  if (error) {
    console.warn('confirm stock error (patch-008 may not be applied):', error.message);
  }
}
