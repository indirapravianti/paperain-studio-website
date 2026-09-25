import {
  SHIPPING_FEE_IDR,
  VOLUME_DISCOUNT_RATE,
  VOLUME_DISCOUNT_THRESHOLD_IDR,
  DEFAULT_WEIGHT_GRAMS,
} from '../market.js';
import { getUnitPrice } from './region-pricing.js';
import { getCatalogProduct } from './catalog.js';

export function roundMoney(value) {
  return Math.round(Number(value));
}

export function getShippingFee() {
  return SHIPPING_FEE_IDR;
}

export function getVolumeDiscount(subtotal) {
  return subtotal >= VOLUME_DISCOUNT_THRESHOLD_IDR ? subtotal * VOLUME_DISCOUNT_RATE : 0;
}

export async function resolveCartLineId(supabase, id) {
  const { data: variant } = await supabase
    .from('product_variants')
    .select('id, product_id')
    .eq('id', id)
    .maybeSingle();

  if (variant) {
    return { product_id: variant.product_id, variant_id: variant.id };
  }

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (product) {
    return { product_id: product.id, variant_id: null };
  }

  return { error: `product not found: ${id}` };
}

/** Re-resolves cart lines against the products table server-side — never trusts client-sent prices. */
export async function priceCartItems(supabase, items, currency) {
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
    });
  }

  return { lines, subtotal };
}

/** Sums real per-product weight_grams (falls back to DEFAULT_WEIGHT_GRAMS for products missing it). */
export async function resolvePackageWeight(supabase, lines) {
  const productIds = [...new Set(lines.map((line) => line.product_id))];
  if (!productIds.length) return 0;

  const { data: products } = await supabase
    .from('products')
    .select('id, weight_grams')
    .in('id', productIds);

  const weightMap = new Map((products || []).map((p) => [p.id, p.weight_grams]));

  return lines.reduce((total, line) => {
    const weight = weightMap.get(line.product_id) ?? DEFAULT_WEIGHT_GRAMS;
    return total + weight * line.qty;
  }, 0);
}
