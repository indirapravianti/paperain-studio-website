import {
  CURRENCY_IDR,
  IDR_PLACEHOLDER_PRICE,
  SHIPPING_FEE_IDR,
  VOLUME_DISCOUNT_RATE,
  VOLUME_DISCOUNT_THRESHOLD_IDR,
} from '../market.js';

/** Category-based IDR prices — Indonesia store */
export const IDR_CATEGORY_PRICES = {
  'sticker sheet': 13000,
  keychain: 20000,
  griptok: 27000,
  artprint: 10000,
  'greeting card': 14000,
  postcard: 10000,
  phonestrap: 22000,
};

export function getIdrUnitPrice(product, catalog) {
  if (product?.price_idr != null) {
    return Math.round(Number(product.price_idr));
  }
  const category = product?.category || catalog?.category;
  if (category && IDR_CATEGORY_PRICES[category]) {
    return IDR_CATEGORY_PRICES[category];
  }
  return IDR_PLACEHOLDER_PRICE;
}

export function getUnitPrice(product, catalog, currency) {
  if (currency && currency !== CURRENCY_IDR) {
    throw new Error('only IDR orders are accepted');
  }
  return getIdrUnitPrice(product, catalog);
}

export function roundMoney(value) {
  return Math.round(Number(value));
}

export function getShippingFee() {
  return SHIPPING_FEE_IDR;
}

export function getVolumeDiscount(subtotal) {
  return subtotal >= VOLUME_DISCOUNT_THRESHOLD_IDR ? subtotal * VOLUME_DISCOUNT_RATE : 0;
}
