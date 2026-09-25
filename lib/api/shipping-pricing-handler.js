import { getSupabaseAdmin } from './supabase-admin.js';
import { priceCartItems, resolvePackageWeight, roundMoney } from './pricing.js';
import { getKiriminajaShippingOptions } from './kiriminaja.js';

export async function handleShippingPricing(body) {
  const { items, destination_kecamatan_id, destination_kelurahan_id } = body;

  if (!items?.length) {
    return { status: 400, body: { error: 'cart is empty' } };
  }
  if (!destination_kecamatan_id || !destination_kelurahan_id) {
    return { status: 400, body: { error: 'destination is required' } };
  }

  const supabase = getSupabaseAdmin();
  const priced = await priceCartItems(supabase, items, 'IDR');
  if ('error' in priced) {
    return { status: 400, body: { error: priced.error } };
  }

  const { lines, subtotal } = priced;
  const weightGrams = await resolvePackageWeight(supabase, lines);

  let result;
  try {
    result = await getKiriminajaShippingOptions({
      destinationKecamatanId: Number(destination_kecamatan_id),
      destinationKelurahanId: Number(destination_kelurahan_id),
      weightGrams,
      itemValue: roundMoney(subtotal),
    });
  } catch (err) {
    console.error('kiriminaja config error:', err);
    return { status: 503, body: { error: 'shipping service is not configured yet' } };
  }

  if (!result.ok) {
    console.error('kiriminaja pricing error:', result.data);
    return { status: 502, body: { error: result.data?.text || 'could not fetch shipping options' } };
  }

  const options = (result.data.results || [])
    .filter((r) => r.cost != null)
    .map((r) => ({
      courier_code: r.service,
      service_type: r.service_type,
      service_name: r.service_name,
      cost: Math.round(Number(r.cost)),
      etd: r.etd || null,
    }));

  return { status: 200, body: { options, weight_grams: weightGrams } };
}
