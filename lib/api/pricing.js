export const SHIPPING_FEE_USD = 3;
export const VOLUME_DISCOUNT_THRESHOLD_USD = 50;
export const VOLUME_DISCOUNT_RATE = 0.2;

export function roundMoney(value, currency) {
  return currency === 'IDR' ? Math.round(value) : parseFloat(value.toFixed(2));
}

export function getShippingFee(currency) {
  return currency === 'IDR' ? 48000 : SHIPPING_FEE_USD;
}

export function getVolumeDiscount(subtotal, currency) {
  const threshold = currency === 'IDR' ? 80000 : VOLUME_DISCOUNT_THRESHOLD_USD;
  return subtotal >= threshold ? subtotal * VOLUME_DISCOUNT_RATE : 0;
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
