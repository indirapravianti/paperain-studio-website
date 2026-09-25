/** KiriminAja MitraAPI helpers. Sandbox by default — set KIRIMINAJA_ENV=production to go live. */

export function getKiriminajaBaseUrl() {
  return process.env.KIRIMINAJA_ENV === 'production'
    ? 'https://client.kiriminaja.com'
    : 'https://tdev.kiriminaja.com';
}

function kiriminajaHeaders() {
  const apiKey = process.env.KIRIMINAJA_API_KEY;
  if (!apiKey) {
    throw new Error('KIRIMINAJA_API_KEY not configured');
  }
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

async function parseKiriminajaResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text: text.slice(0, 300) };
  }
}

/** Search provinces/cities/districts/subdistricts/postal codes by keyword. */
export async function searchKiriminajaAddress(search) {
  const url = `${getKiriminajaBaseUrl()}/api/mitra/v6.1/addresses?search=${encodeURIComponent(search)}`;
  const res = await fetch(url, { method: 'GET', headers: kiriminajaHeaders() });
  const data = await parseKiriminajaResponse(res);
  return { ok: res.ok && data.status === true, data };
}

/** Get available courier services + pricing for a destination. Origin comes from KIRIMINAJA_ORIGIN_* env vars. */
export async function getKiriminajaShippingOptions({
  destinationKecamatanId,
  destinationKelurahanId,
  weightGrams,
  itemValue,
}) {
  const origin = Number(process.env.KIRIMINAJA_ORIGIN_KECAMATAN_ID);
  if (!origin) {
    throw new Error('KIRIMINAJA_ORIGIN_KECAMATAN_ID not configured');
  }
  const subdistrictOrigin = Number(process.env.KIRIMINAJA_ORIGIN_KELURAHAN_ID) || undefined;

  const res = await fetch(`${getKiriminajaBaseUrl()}/api/mitra/v6.1/shipping_price`, {
    method: 'POST',
    headers: kiriminajaHeaders(),
    body: JSON.stringify({
      origin,
      subdistrict_origin: subdistrictOrigin,
      destination: destinationKecamatanId,
      subdistrict_destination: destinationKelurahanId,
      weight: weightGrams,
      item_value: itemValue,
    }),
  });
  const data = await parseKiriminajaResponse(res);
  return { ok: res.ok && data.status === true, data };
}
