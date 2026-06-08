/** Category-based IDR prices — Indonesia store (active) */
export const IDR_CATEGORY_PRICES = {
  'sticker sheet': 13000,
  keychain: 20000,
  griptok: 27000,
  artprint: 10000,
  'greeting card': 14000,
  postcard: 10000,
  phonestrap: 22000,
};

export const IDR_PLACEHOLDER_PRICE = 13000;
export const VOLUME_DISCOUNT_THRESHOLD_IDR = 80000;

export function getIdrPriceForCategory(category) {
  if (category && IDR_CATEGORY_PRICES[category]) {
    return IDR_CATEGORY_PRICES[category];
  }
  return IDR_PLACEHOLDER_PRICE;
}
