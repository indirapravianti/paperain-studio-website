import { getSupabaseAdmin } from './supabase-admin.js';
import { resolveCartLineId } from './pricing.js';
import { getCatalogProduct } from './catalog.js';
import { getOrderWeightGrams } from './shipping-weight.js';
import { getShippingRates, kiriminajaConfigured } from './kiriminaja.js';

/** Resolves cart items down to just the category (for weight), tolerating unknown items. */
async function resolveCartCategories(supabase, items) {
  const lines = [];
  for (const item of items) {
    if (!item?.id || !item.qty || item.qty < 1) continue;

    const resolved = await resolveCartLineId(supabase, item.id);
    const catalog = getCatalogProduct(item.id) || getCatalogProduct(resolved?.product_id);
    let category = catalog?.category || null;

    if (!('error' in resolved)) {
      const { data: product } = await supabase
        .from('products')
        .select('category')
        .eq('id', resolved.product_id)
        .maybeSingle();
      if (product?.category) category = product.category;
    }

    lines.push({ category, qty: item.qty });
  }
  return lines;
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
  const lines = await resolveCartCategories(supabase, items);
  const weightGrams = getOrderWeightGrams(lines);

  let results;
  try {
    results = await getShippingRates({ destinationDistrictId, weightGrams, itemValue: 0 });
  } catch (err) {
    return { error: err.message || 'could not fetch shipping rates' };
  }

  const rates = results
    .map((r) => ({
      courier: r.service,
      service_type: r.service_type,
      service_name: r.service_name,
      cost: Math.round(Number(r.cost)),
      etd: r.etd,
      group: r.group,
    }))
    .sort((a, b) => a.cost - b.cost);

  return { weightGrams, rates };
}
