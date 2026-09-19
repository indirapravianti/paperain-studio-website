import { getSupabaseAdmin } from './supabase-admin.js';
import {
  getShippingFee,
  getVolumeDiscount,
  resolveCartLineId,
  roundMoney,
} from './pricing.js';
import { getUnitPrice } from './region-pricing.js';
import { getCatalogProduct } from './catalog.js';
import { getOrderWeightGrams } from './shipping-weight.js';
import { getShippingRates, kiriminajaConfigured } from './kiriminaja.js';

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

async function priceCartItems(supabase, items, currency) {
  const lines = [];
  let subtotal = 0;

  for (const item of items) {
    if (!item.id || !item.qty || item.qty < 1) {
      return { error: 'invalid cart item' };
    }

    const resolved = await resolveCartLineId(supabase, item.id);
    const catalog = getCatalogProduct(item.id) || getCatalogProduct(resolved?.product_id);

    if ('error' in resolved) {
      if (!catalog) {
        return { error: resolved.error };
      }
      const unitPrice = getUnitPrice(null, catalog, currency);
      const lineTotal = unitPrice * item.qty;
      subtotal += lineTotal;
      lines.push({
        id: item.id,
        product_id: catalog.id,
        variant_id: null,
        title: item.title || catalog.title,
        price: unitPrice,
        qty: item.qty,
        image: item.image || catalog.image,
        category: catalog.category,
      });
      continue;
    }

    const { product_id, variant_id } = resolved;

    const { data: product, error } = await supabase
      .from('products')
      .select('id, title, price, price_idr, category, image, is_active, stock_quantity, track_inventory, stock_status')
      .eq('id', product_id)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !product) {
      if (!catalog) {
        return { error: `product not found: ${product_id}` };
      }
      const unitPrice = getUnitPrice(null, catalog, currency);
      const lineTotal = unitPrice * item.qty;
      subtotal += lineTotal;
      lines.push({
        id: item.id,
        product_id: catalog.id,
        variant_id,
        title: item.title || catalog.title,
        price: unitPrice,
        qty: item.qty,
        image: item.image || catalog.image,
        category: catalog.category,
      });
      continue;
    }

    if (product.stock_status === 'restocking') {
      return { error: `${product.title} is currently restocking` };
    }

    if (product.track_inventory && product.stock_status === 'out_of_stock') {
      return { error: `${product.title} is out of stock` };
    }

    if (
      product.track_inventory &&
      product.stock_quantity != null &&
      product.stock_quantity < item.qty
    ) {
      return {
        error: `only ${Math.max(product.stock_quantity, 0)} left for ${product.title}`,
      };
    }

    const unitPrice = getUnitPrice(product, catalog, currency);
    const lineTotal = unitPrice * item.qty;
    subtotal += lineTotal;

    lines.push({
      id: item.id,
      product_id,
      variant_id,
      title: item.title || product.title,
      price: unitPrice,
      qty: item.qty,
      image: item.image || product.image,
      category: product.category || catalog?.category,
    });
  }

  return { lines, subtotal };
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
    shipping_province,
    shipping_province_id,
    shipping_city,
    shipping_city_id,
    shipping_district,
    shipping_district_id,
    shipping_postal_code,
    shipping_courier,
    shipping_service_type,
    notes,
    customer_id,
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
  const volumeDiscount = getVolumeDiscount(subtotal, currency);

  let shippingFee = getShippingFee(currency);
  let shippingMeta = {};

  if (kiriminajaConfigured()) {
    if (!shipping_district_id || !shipping_courier || !shipping_service_type) {
      return { status: 400, body: { error: 'please select a shipping courier' } };
    }

    const weightGrams = getOrderWeightGrams(lines);
    let rates;
    try {
      rates = await getShippingRates({
        destinationDistrictId: shipping_district_id,
        weightGrams,
        itemValue: 0,
      });
    } catch (err) {
      console.error('kiriminaja rate lookup failed:', err);
      return { status: 502, body: { error: 'could not verify shipping rate, please try again' } };
    }

    const matched = rates.find(
      (r) => r.service === shipping_courier && r.service_type === shipping_service_type,
    );

    if (!matched) {
      return {
        status: 400,
        body: { error: 'selected shipping option is no longer available, please re-select' },
      };
    }

    shippingFee = Math.round(Number(matched.cost));
    shippingMeta = {
      shipping_courier: matched.service,
      shipping_service_type: matched.service_type,
      shipping_service_name: matched.service_name,
      shipping_district_id: Number(shipping_district_id),
      shipping_weight_grams: weightGrams,
    };
  }

  const totalDiscount = volumeDiscount;
  const total = subtotal - totalDiscount + shippingFee;

  const orderData = {
    customer_id: resolvedCustomerId,
    status: 'pending',
    currency,
    subtotal: roundMoney(subtotal, currency),
    discount: roundMoney(totalDiscount, currency),
    shipping_fee: roundMoney(shippingFee, currency),
    total: roundMoney(total, currency),
    shipping_name,
    shipping_email,
    shipping_phone,
    shipping_address,
    shipping_country,
    shipping_province: shipping_province || null,
    shipping_province_id: shipping_province_id ? Number(shipping_province_id) : null,
    shipping_city: shipping_city || null,
    shipping_city_id: shipping_city_id ? Number(shipping_city_id) : null,
    shipping_district: shipping_district || null,
    shipping_postal_code: shipping_postal_code || null,
    notes: notes || null,
    ...shippingMeta,
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
