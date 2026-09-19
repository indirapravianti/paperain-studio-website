/** Per-category package weight (grams) — used for KiriminAja rate lookups. */
export const CATEGORY_WEIGHT_GRAMS = {
  'sticker sheet': 10,
  keychain: 30,
  griptok: 20,
  artprint: 15,
  'greeting card': 15,
  postcard: 10,
  phonestrap: 25,
};

export const DEFAULT_ITEM_WEIGHT_GRAMS = 20;
export const PACKAGING_WEIGHT_GRAMS = 50;
export const MIN_ORDER_WEIGHT_GRAMS = 100;

export function getItemWeightGrams(category) {
  return (category && CATEGORY_WEIGHT_GRAMS[category]) || DEFAULT_ITEM_WEIGHT_GRAMS;
}

/** lines: [{ category, qty }] */
export function getOrderWeightGrams(lines) {
  const itemsWeight = lines.reduce(
    (sum, line) => sum + getItemWeightGrams(line.category) * (line.qty || 1),
    0,
  );
  return Math.max(itemsWeight + PACKAGING_WEIGHT_GRAMS, MIN_ORDER_WEIGHT_GRAMS);
}
