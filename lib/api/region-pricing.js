import {
  CURRENCY_IDR,
  IDR_PLACEHOLDER_PRICE,
  SHIPPING_FEE_IDR,
  SHIPPING_FEE_USD,
  USD_TO_IDR,
  VOLUME_DISCOUNT_RATE,
  VOLUME_DISCOUNT_THRESHOLD_IDR,
  VOLUME_DISCOUNT_THRESHOLD_USD,
} from '../market.js';

/** Category-based IDR prices (future — override placeholder) */
export const IDR_CATEGORY_PRICES = {
  'sticker sheet': 75000,
  keychain: 110000,
  griptok: 145000,
  phonestrap: 125000,
  postcard: 55000,
  artprint: 55000,
  'greeting card': 85000,
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
  if (currency === CURRENCY_IDR) {
    return getIdrUnitPrice(product, catalog);
  }
  if (product?.price != null) {
    return Number(product.price);
  }
  if (catalog?.price != null) {
    return Number(catalog.price);
  }
  return 0;
}

export function roundMoney(value, currency) {
  return currency === CURRENCY_IDR ? Math.round(value) : parseFloat(Number(value).toFixed(2));
}

export function getShippingFee(currency) {
  return currency === CURRENCY_IDR ? SHIPPING_FEE_IDR : SHIPPING_FEE_USD;
}

export function getVolumeDiscount(subtotal, currency) {
  const threshold =
    currency === CURRENCY_IDR ? VOLUME_DISCOUNT_THRESHOLD_IDR : VOLUME_DISCOUNT_THRESHOLD_USD;
  return subtotal >= threshold ? subtotal * VOLUME_DISCOUNT_RATE : 0;
}

export function usdToIdr(usdAmount) {
  return Math.round(Number(usdAmount) * USD_TO_IDR);
}
