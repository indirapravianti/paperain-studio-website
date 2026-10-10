import { getSupabaseAdmin } from './supabase-admin.js';
import { resolveCartLineId } from './pricing.js';
import { getCatalogProduct } from './catalog.js';
import { getUnitPrice } from './region-pricing.js';
import { describeOrderPackage } from './shipping-weight.js';
import { getShippingRates, JNE_INSURANCE_ITEM_VALUE_IDR, kiriminajaConfigured } from './kiriminaja.js';

/** Insurance fee from KiriminAja is item_value × 3PL percent, rounded up to the nearest 100. */
function roundInsuranceAmount(amount) {
  const n = Math.round(Number(amount) || 0);
  if (n <= 0) return 0;
  return Math.ceil(n / 100) * 100;
}

function rateNeedsInsurance(rate, itemValue) {
  if (rate?.force_insurance === true || rate?.force_insurance === 'true') return true;
  return String(rate?.service || '').toLowerCase() === 'jne' && itemValue > JNE_INSURANCE_ITEM_VALUE_IDR;
}

function rateKey(rate) {
  return `${rate.service}:${rate.service_type}`;
}

/** Resolves cart items to category, qty, and server-side unit price. Unknown items are skipped. */
async function resolveCartLines(supabase, items) {
  const lines = [];
  for (const item of items) {
    if (!item?.id || !item.qty || item.qty < 1) continue;

    const resolved = await resolveCartLineId(supabase, item.id);
    const catalog = getCatalogProduct(item.id) || getCatalogProduct(resolved?.product_id);
    let category = catalog?.category || null;
    let product = null;

    if (!('error' in resolved)) {
      const { data } = await supabase
        .from('products')
        .select('category, price, price_idr')
        .eq('id', resolved.product_id)
        .maybeSingle();
      product = data;
      if (product?.category) category = product.category;
    }

    let price = 0;
    try {
      price = getUnitPrice(product, catalog, 'IDR');
    } catch {
      price = 0;
    }

    lines.push({ category, qty: item.qty, price });
  }
  return lines;
}

/** Quotes every courier. Re-prices with insurance=1 only for services that require it
 * (force_insurance, or JNE above Rp500.000). `cost` is the courier shipping_cost sent back
 * to KiriminAja. `customer_cost` is what we charge (shipping + insurance). */
export async function quoteKiriminajaRates({ lines, destinationDistrictId }) {
  const pack = describeOrderPackage(lines);
  const itemValue = (lines || []).reduce(
    (sum, line) => sum + Number(line.price || 0) * (line.qty || 1),
    0,
  );

  const rateArgs = {
    destinationDistrictId,
    weightGrams: pack.chargeableWeightGrams,
    itemValue,
    widthCm: pack.width,
    lengthCm: pack.length,
    heightCm: pack.height,
  };

  const baseResults = await getShippingRates({ ...rateArgs, insurance: 0 });
  let insuredByKey = null;
  if (baseResults.some((rate) => rateNeedsInsurance(rate, itemValue))) {
    const insuredResults = await getShippingRates({ ...rateArgs, insurance: 1 });
    insuredByKey = new Map(insuredResults.map((rate) => [rateKey(rate), rate]));
  }

  const rates = [];
  for (const base of baseResults) {
    const insure = rateNeedsInsurance(base, itemValue);
    const source = insure ? insuredByKey?.get(rateKey(base)) : base;
    if (!source) continue;

    const cost = Math.round(Number(source.cost));
    const insuranceAmount = insure ? roundInsuranceAmount(source.insurance) : 0;
    rates.push({
      courier: source.service,
      service_type: source.service_type,
      service_name: source.service_name,
      cost,
      insurance_amount: insuranceAmount,
      customer_cost: cost + insuranceAmount,
      etd: source.etd,
      group: source.group,
    });
  }

  rates.sort((a, b) => a.customer_cost - b.customer_cost);

  return {
    ...pack,
    itemValue: Math.round(itemValue),
    rates,
  };
}

/** Shared by the live checkout quote endpoint and the server-side recompute at order placement. */
export async function getShippingQuotes({ items, destinationDistrictId }) {
  if (!kiriminajaConfigured()) {
    return { error: 'shipping rates are not configured yet', notConfigured: true };
  }
  if (!destinationDistrictId) {
    return { error: 'destination is required' };
  }
  if (!items?.length) {
    return { error: 'cart is empty' };
  }

  const supabase = getSupabaseAdmin();
  const lines = await resolveCartLines(supabase, items);
  if (!lines.length) {
    return { error: 'cart is empty' };
  }

  try {
    return await quoteKiriminajaRates({ lines, destinationDistrictId });
  } catch (err) {
    return { error: err.message || 'could not fetch shipping rates' };
  }
}
