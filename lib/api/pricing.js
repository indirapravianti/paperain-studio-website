import { SHIPPING_FEE_IDR, VOLUME_DISCOUNT_RATE, VOLUME_DISCOUNT_THRESHOLD_IDR } from '../market.js';

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
