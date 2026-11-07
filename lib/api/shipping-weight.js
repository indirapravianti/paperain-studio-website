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

/** UAT-only package overrides. KiriminAja asked for a re-test with a package of at least 3 kg
 * in at most 10×10×10 cm (row 4) and one of at most 1 kg in at least 30×30×30 cm (row 6).
 * No real cart produces those numbers, so checkout can pick one of these by name with
 * `?uat_package=heavy|bulky`. Ignored unless KIRIMINAJA_UAT_PACKAGE_PROFILES=true. */
export const UAT_PACKAGE_PROFILES = {
  heavy: { actualWeightGrams: 3000, width: 10, length: 10, height: 10 },
  bulky: { actualWeightGrams: 1000, width: 30, length: 30, height: 30 },
};

export function uatPackageProfilesEnabled() {
  const flag = String(process.env.KIRIMINAJA_UAT_PACKAGE_PROFILES || '').toLowerCase();
  return flag === 'true' || flag === '1';
}

/** Returns the profile for `name`, or null when the name is unknown or the flag is off. */
export function resolveUatPackageProfile(name) {
  if (!name || !uatPackageProfilesEnabled()) return null;
  const key = String(name).toLowerCase();
  return Object.hasOwn(UAT_PACKAGE_PROFILES, key) ? UAT_PACKAGE_PROFILES[key] : null;
}

/** lines: [{ category, qty }]. `packageProfile` is a UAT profile name (see above). */
export function describeOrderPackage(lines, { packageProfile } = {}) {
  const safeLines = lines || [];
  const qty = safeLines.reduce((sum, line) => sum + (line.qty || 1), 0) || 1;
  const profile = resolveUatPackageProfile(packageProfile);
  const actualWeightGrams = profile ? profile.actualWeightGrams : getOrderWeightGrams(safeLines);
  const dims = profile || getOrderPackageDimensionsCm(qty);
  const volumetricWeightGrams = getVolumetricWeightGrams(dims);
  return {
    qty,
    width: dims.width,
    length: dims.length,
    height: dims.height,
    actualWeightGrams,
    volumetricWeightGrams,
    chargeableWeightGrams: Math.max(actualWeightGrams, volumetricWeightGrams),
    packageProfile: profile ? String(packageProfile).toLowerCase() : null,
  };
}
