import { searchKiriminajaAddress } from './kiriminaja.js';

function parsePostalCode(fullAddress) {
  const parts = String(fullAddress || '').split(',').map((p) => p.trim());
  const last = parts[parts.length - 1];
  return /^\d{4,6}$/.test(last) ? last : null;
}

export async function handleShippingCoverage(body) {
  const search = String(body?.search || '').trim();
  if (search.length < 3) {
    return { status: 400, body: { error: 'search must be at least 3 characters' } };
  }

  let result;
  try {
    result = await searchKiriminajaAddress(search);
  } catch (err) {
    console.error('kiriminaja config error:', err);
    return { status: 503, body: { error: 'shipping service is not configured yet' } };
  }

  if (!result.ok) {
    console.error('kiriminaja address search error:', result.data);
    return { status: 502, body: { error: result.data?.text || 'could not search address' } };
  }

  const results = (result.data.data || []).map((row) => ({
    district_id: row.district_id,
    kelurahan_id: row.subdistrict_id,
    full_address: row.full_address,
    postal_code: parsePostalCode(row.full_address),
  }));

  return { status: 200, body: { results } };
}
