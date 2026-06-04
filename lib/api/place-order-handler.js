import { getSupabaseAdmin } from './supabase-admin.js';
import {
  getShippingFee,
  getVolumeDiscount,
  resolveCartLineId,
  roundMoney,
} from './pricing.js';
import { getCatalogProduct } from './catalog.js';

async function priceCartItems(supabase, items, currency) {
  const lines = [];
  let subtotal = 0;

  for (const item of items) {
    if (!item.id || !item.qty || item.qty < 1) {
      return { error: 'invalid cart item' };
    }

    const resolved = await resolveCartLineId(supabase, item.id);
    if ('error' in resolved) {
      const catalog = getCatalogProduct(item.id);
      if (!catalog) {
        return { error: resolved.error };
      }
      const unitPrice = Number(catalog.price);
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
      });
      continue;
    }

    const { product_id, variant_id } = resolved;

    const { data: product, error } = await supabase
      .from('products')
      .select('id, title, price, category, image, is_active')
      .eq('id', product_id)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !product) {
      const catalog = getCatalogProduct(product_id);
      if (!catalog) {
        return { error: `product not found: ${product_id}` };
      }
      const unitPrice = Number(catalog.price);
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
      });
      continue;
    }

    const unitPrice = Number(product.price);
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
    });
  }

  return { lines, subtotal };
}

export async function handlePlaceOrder(body) {
  const {
    items,
    currency,
    promo_code,
    shipping_name,
    shipping_email,
    shipping_phone,
    shipping_address,
    shipping_country,
    notes,
    customer_id,
  } = body;

  if (!items?.length) {
    return { status: 400, body: { error: 'cart is empty' } };
  }
  if (!currency || !['USD', 'IDR'].includes(currency)) {
    return { status: 400, body: { error: 'invalid currency' } };
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
  let promoDiscount = 0;
  let appliedPromoCode = null;

  if (promo_code?.trim()) {
    return { status: 400, body: { error: 'promo codes are not available yet' } };
  }

  const shippingFee = getShippingFee(currency);
  const totalDiscount = volumeDiscount + promoDiscount;
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
    notes: notes || null,
  };

  // Only set when promo patch (003) is applied — avoids insert failures on older DBs
  if (appliedPromoCode) {
    orderData.promo_code = appliedPromoCode;
    orderData.promo_discount = roundMoney(promoDiscount, currency);
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (orderError || !order) {
    console.error('order insert error:', orderError);
    return { status: 500, body: { error: 'could not create order', detail: orderError?.message } };
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
    return { status: 500, body: { error: 'order created but items failed to save' } };
  }

  return { status: 200, body: { order } };
}
