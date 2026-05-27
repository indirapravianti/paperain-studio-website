export const SHIPPING_FEE_USD = 3;
export const SHIPPING_FEE_IDR = 48000;
export const VOLUME_DISCOUNT_THRESHOLD_USD = 50;
export const VOLUME_DISCOUNT_THRESHOLD_IDR = 500000;
export const VOLUME_DISCOUNT_RATE = 0.2;

export const IDR_CATEGORY_PRICES: Record<string, number> = {
  "sticker sheet": 13000,
  keychain: 20000,
  griptok: 27000,
  phonestrap: 22000,
  postcard: 10000,
  artprint: 10000,
  "greeting card": 14000,
};

export const IDR_USD_FALLBACK: Record<number, number> = {
  4: 13000,
  6: 20000,
  8: 27000,
  7: 22000,
  3: 10000,
  4.5: 14000,
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
