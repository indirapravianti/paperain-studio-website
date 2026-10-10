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

/** Flat goods. We don't measure each SKU, so item and mailer sizes are fixed estimates.
 * KiriminAja volumetric weight (grams) is width × length × height ÷ 6 for regular services
 * (divisor 6,000 when the result is kept in kilograms). */
export const DEFAULT_ITEM_DIMENSIONS_CM = { width: 10, length: 10, height: 1 };
export const DEFAULT_PACKAGE_DIMENSIONS_CM = { width: 15, length: 20, height: 3 };
export const VOLUMETRIC_DIVISOR = 6;

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

/** KiriminAja: width × length × height ÷ 6, result in grams, rounded up. */
export function getVolumetricWeightGrams({ width, length, height }) {
  const raw = (Number(width) * Number(length) * Number(height)) / VOLUMETRIC_DIVISOR;
  return Math.max(1, Math.ceil(raw));
}

/** Outer carton for `itemCount` units. A single light order stays in the mailer so volumetric
 * weight exceeds actual weight. A taller stack uses the stacked box, which is dense enough
 * that actual weight exceeds volumetric weight. Those are the two Non-COD cases UAT requires. */
export function getOrderPackageDimensionsCm(itemCount = 1) {
  const qty = Math.max(Number(itemCount) || 1, 1);
  const stacked = {
    width: DEFAULT_ITEM_DIMENSIONS_CM.width,
    length: DEFAULT_ITEM_DIMENSIONS_CM.length,
    height: DEFAULT_ITEM_DIMENSIONS_CM.height * qty,
  };
  const mailer = DEFAULT_PACKAGE_DIMENSIONS_CM;
  return getVolumetricWeightGrams(stacked) > getVolumetricWeightGrams(mailer)
    ? stacked
    : { width: mailer.width, length: mailer.length, height: mailer.height };
}

export function getItemDimensionsCm() {
  return DEFAULT_ITEM_DIMENSIONS_CM;
}

/** lines: [{ category, qty }] */
export function describeOrderPackage(lines) {
  const safeLines = lines || [];
  const actualWeightGrams = getOrderWeightGrams(safeLines);
  const qty = safeLines.reduce((sum, line) => sum + (line.qty || 1), 0) || 1;
  const dims = getOrderPackageDimensionsCm(qty);
  const volumetricWeightGrams = getVolumetricWeightGrams(dims);
  return {
    qty,
    width: dims.width,
    length: dims.length,
    height: dims.height,
    actualWeightGrams,
    volumetricWeightGrams,
    chargeableWeightGrams: Math.max(actualWeightGrams, volumetricWeightGrams),
  };
}
