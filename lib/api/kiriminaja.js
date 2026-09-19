/** KiriminAja Mitra API client — coverage area + shipping rate lookups.
 * Docs: https://developer.kiriminaja.com/docs
 */
const SANDBOX_BASE_URL = 'https://tdev.kiriminaja.com';

function getBaseUrl() {
  return process.env.KIRIMINAJA_BASE_URL || SANDBOX_BASE_URL;
}

function getToken() {
  return process.env.KIRIMINAJA_TOKEN || '';
}

export function getOriginDistrictId() {
  const id = process.env.KIRIMINAJA_ORIGIN_DISTRICT_ID;
  return id ? Number(id) : null;
}

export function kiriminajaConfigured() {
  return Boolean(getToken() && getOriginDistrictId());
}

async function kiriminajaRequest(path, body) {
  const token = getToken();
  if (!token) {
    throw new Error('kiriminaja is not configured');
  }

  let res;
  try {
    res = await fetch(`${getBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });
  } catch (err) {
    console.error('kiriminaja fetch error:', err);
    throw new Error('could not reach kiriminaja');
  }

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('invalid response from kiriminaja');
  }

  if (!res.ok || data.status === false) {
    throw new Error(data.text || `kiriminaja request failed (${res.status})`);
  }

  return data;
}

export async function getProvinces() {
  const data = await kiriminajaRequest('/api/mitra/province', {});
  return data.datas || [];
}

export async function getCities(provinsiId) {
  const data = await kiriminajaRequest('/api/mitra/city', { provinsi_id: Number(provinsiId) });
  return data.datas || [];
}

export async function getDistricts(kabupatenId) {
  const data = await kiriminajaRequest('/api/mitra/kecamatan', { kabupaten_id: Number(kabupatenId) });
  return data.datas || [];
}

/** Returns the raw list of courier rate results from KiriminAja's shipping_price endpoint. */
export async function getShippingRates({ destinationDistrictId, weightGrams, itemValue }) {
  const originId = getOriginDistrictId();
  if (!originId) {
    throw new Error('shipping origin is not configured');
  }
  if (!destinationDistrictId) {
    throw new Error('destination is required');
  }

  const data = await kiriminajaRequest('/api/mitra/v5/shipping_price', {
    origin: originId,
    destination: Number(destinationDistrictId),
    weight: Math.round(weightGrams) || 1,
    insurance: 0,
    item_value: Math.round(itemValue) || 0,
  });

  return data.results || [];
}
