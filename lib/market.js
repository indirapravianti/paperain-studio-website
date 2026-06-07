/** Shared market constants — safe for Edge middleware and Node APIs */

export const MARKET_COOKIE = 'paperain-market';
export const MARKET_INTL = 'intl';
export const MARKET_ID = 'id';

export const CURRENCY_USD = 'USD';
export const CURRENCY_IDR = 'IDR';

export const IDR_PLACEHOLDER_PRICE = 50000;
export const USD_TO_IDR = 16000;

export const SHIPPING_FEE_USD = 3;
export const SHIPPING_FEE_IDR = 48000;
export const VOLUME_DISCOUNT_THRESHOLD_USD = 50;
export const VOLUME_DISCOUNT_THRESHOLD_IDR = 500000;
export const VOLUME_DISCOUNT_RATE = 0.2;

export function marketToCurrency(market) {
  return market === MARKET_ID ? CURRENCY_IDR : CURRENCY_USD;
}

export function currencyToMarket(currency) {
  return currency === CURRENCY_IDR ? MARKET_ID : MARKET_INTL;
}

export function isIndonesiaPath(pathname) {
  return pathname === '/id' || pathname.startsWith('/id/');
}

export function stripMarketPrefix(pathname) {
  if (pathname === '/id') return '/';
  if (pathname.startsWith('/id/')) return pathname.slice(3) || '/';
  return pathname;
}

export function addMarketPrefix(pathname, market) {
  const base = stripMarketPrefix(pathname);
  if (market === MARKET_ID) {
    return base === '/' ? '/id' : `/id${base}`;
  }
  return base;
}
