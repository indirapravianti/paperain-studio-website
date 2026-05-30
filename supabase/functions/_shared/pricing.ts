export const SHIPPING_FEE_USD = 3;
export const SHIPPING_FEE_IDR = 48000;
export const VOLUME_DISCOUNT_THRESHOLD_USD = 50;
export const VOLUME_DISCOUNT_THRESHOLD_IDR = 500000;
export const VOLUME_DISCOUNT_RATE = 0.2;

export const IDR_CATEGORY_PRICES: Record<string, number> = {
  "sticker sheet": 75000,
  keychain: 110000,
  griptok: 145000,
  phonestrap: 125000,
  postcard: 55000,
  artprint: 55000,
  "greeting card": 85000,
};

export const IDR_USD_FALLBACK: Record<number, number> = {
  3: 55000,
  3.5: 65000,
  4: 75000,
  4.5: 85000,
  6: 110000,
  7: 125000,
  8: 145000,
};

export type CartLine = {
  id: string;
  qty: number;
};

export type PricedLine = {
  id: string;
  product_id: string;
  variant_id: string | null;
  title: string;
  price: number;
  qty: number;
  image: string | null;
};

/** @deprecated Use resolveCartLineId() in place-order for DB-backed resolution. */
export function parseCartLineId(id: string) {
  const parts = id.split("-");
  if (parts.length > 2) {
    return {
      product_id: parts.slice(0, 2).join("-"),
      variant_id: id,
    };
  }
  return { product_id: id, variant_id: null };
}

export async function resolveCartLineId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  id: string,
): Promise<
  { product_id: string; variant_id: string | null } | { error: string }
> {
  const { data: variant } = await supabase
    .from("product_variants")
    .select("id, product_id")
    .eq("id", id)
    .maybeSingle();

  if (variant) {
    return { product_id: variant.product_id, variant_id: variant.id };
  }

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (product) {
    return { product_id: product.id, variant_id: null };
  }

  return { error: `product not found: ${id}` };
}

export function getIdrPrice(usdPrice: number, category?: string | null) {
  if (category && IDR_CATEGORY_PRICES[category]) {
    return IDR_CATEGORY_PRICES[category];
  }
  return IDR_USD_FALLBACK[usdPrice] ?? Math.round(usdPrice * 16000);
}

export function roundMoney(value: number, currency: string) {
  return currency === "IDR" ? Math.round(value) : parseFloat(value.toFixed(2));
}

export function getShippingFee(currency: string) {
  return currency === "IDR" ? SHIPPING_FEE_IDR : SHIPPING_FEE_USD;
}

export function getVolumeDiscount(subtotal: number, currency: string) {
  const threshold =
    currency === "IDR"
      ? VOLUME_DISCOUNT_THRESHOLD_IDR
      : VOLUME_DISCOUNT_THRESHOLD_USD;
  return subtotal >= threshold ? subtotal * VOLUME_DISCOUNT_RATE : 0;
}
