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

/** Documented v6.2 example package type. Id 1 is not in the current Create Express Package spec. */
export const EXPRESS_PACKAGE_TYPE_ID = 7;

/** JNE requires insurance when declared goods value is above this (UAT / Create Express Package). */
export const JNE_INSURANCE_ITEM_VALUE_IDR = 500_000;

/** Sender profile used as the pickup point for every shipment — one warehouse, set once via env. */
export function getOriginProfile() {
  const kelurahanId = process.env.KIRIMINAJA_ORIGIN_KELURAHAN_ID;
  const lat = process.env.KIRIMINAJA_ORIGIN_LATITUDE;
  const lng = process.env.KIRIMINAJA_ORIGIN_LONGITUDE;
  return {
    name: process.env.KIRIMINAJA_ORIGIN_NAME || null,
    phone: process.env.KIRIMINAJA_ORIGIN_PHONE || null,
    address: process.env.KIRIMINAJA_ORIGIN_ADDRESS || null,
    city: process.env.KIRIMINAJA_ORIGIN_CITY || null,
    zipcode: process.env.KIRIMINAJA_ORIGIN_ZIPCODE || null,
    kecamatanId: getOriginDistrictId(),
    kelurahanId: kelurahanId ? Number(kelurahanId) : null,
    latitude: lat ? Number(lat) : 0,
    longitude: lng ? Number(lng) : 0,
  };
}

/** KiriminAja accepts 08 / 02 / 628 / +628. Normalize to 08... for local mobiles. */
export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+62')) return '0' + digits.slice(3);
  if (digits.startsWith('62')) return '0' + digits.slice(2);
  return digits;
}

/** Indonesian mobile number KiriminAja will accept for the recipient: 08, then 8–11 more digits.
 * Checked at order time so a bad number fails before payment, not at request_pickup.
 * Keep in sync with PHONE_PATTERN in src/pages/checkout.astro. */
export function isValidRecipientPhone(raw) {
  return /^08[1-9]\d{7,10}$/.test(normalizePhone(raw));
}

export function kiriminajaConfigured() {
  return Boolean(getToken() && getOriginDistrictId());
}

/** Shipment creation needs the full sender profile, not just the origin district used for pricing. */
export function kiriminajaShipmentConfigured() {
  const origin = getOriginProfile();
  return Boolean(
    kiriminajaConfigured() &&
      origin.name &&
      origin.phone &&
      origin.address &&
      origin.zipcode &&
      origin.kelurahanId,
  );
}

// --- OAuth (X-OAUTH-TOKEN) -------------------------------------------------
// KiriminAja's OAuth lets calls from non-static IPs (Vercel) through. Flow:
//   grant client (api_key + api_secret) -> member login (account username/password)
//   -> member token sent as X-OAUTH-TOKEN next to the normal Bearer token;
//   when it expires: retoken, falling back to a fresh member login.
// Tokens are cached per serverless instance; a cold start just logs in again.
const SANDBOX_AUTH_BASE_URL = 'https://auth-tdev.kiriminaja.com';
const OAUTH_REFRESH_MARGIN_SECONDS = 60;

let oauthCache = { token: '', retoken: '', expiresAt: 0 };
let oauthInflight = null;

function getAuthBaseUrl() {
  return process.env.KIRIMINAJA_AUTH_BASE_URL || SANDBOX_AUTH_BASE_URL;
}

export function kiriminajaOAuthConfigured() {
  return Boolean(
    process.env.KIRIMINAJA_API_KEY &&
      process.env.KIRIMINAJA_API_SECRET &&
      process.env.KIRIMINAJA_USERNAME &&
      process.env.KIRIMINAJA_PASSWORD,
  );
}

async function authRequest(path, body, bearer) {
  let res;
  try {
    res = await fetch(`${getAuthBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('kiriminaja auth fetch error:', err);
    throw new Error('could not reach kiriminaja auth');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.name !== 'SUCCESS') {
    // never log request bodies — they carry the api secret / account password
    console.error('kiriminaja auth failed:', path, res.status, data.name, data.message);
    throw new Error(`kiriminaja auth failed (${data.message || res.status})`);
  }
  return data.data;
}

async function grantClient() {
  const hours = Number(process.env.KIRIMINAJA_GRANT_EXPIRED_HOURS) || 24;
  const data = await authRequest('/ex/v1/grant/client', {
    api_key: process.env.KIRIMINAJA_API_KEY,
    api_secret: process.env.KIRIMINAJA_API_SECRET,
    expired_at: hours,
  });
  return data.access_token;
}

async function refreshOAuthToken() {
  const grant = await grantClient();

  let member = null;
  if (oauthCache.retoken) {
    try {
      member = await authRequest('/ex/v1/grant/member/retoken', { retoken: oauthCache.retoken }, grant);
    } catch {
      member = null; // expired retoken — fall through to a full login
    }
  }
  if (!member) {
    member = await authRequest(
      '/ex/v1/grant/member/password',
      { username: process.env.KIRIMINAJA_USERNAME, password: process.env.KIRIMINAJA_PASSWORD },
      grant,
    );
  }

  oauthCache = { token: member.token, retoken: member.retoken || '', expiresAt: Number(member.expires_at) || 0 };
  return oauthCache.token;
}

async function getOAuthToken({ force = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  if (!force && oauthCache.token && oauthCache.expiresAt - OAUTH_REFRESH_MARGIN_SECONDS > now) {
    return oauthCache.token;
  }
  // share one refresh between concurrent requests
  if (!oauthInflight) {
    oauthInflight = refreshOAuthToken().finally(() => {
      oauthInflight = null;
    });
  }
  return oauthInflight;
}

async function sendRequest(path, body, token, oauthToken, method = 'POST') {
  try {
    return await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(oauthToken ? { 'X-OAUTH-TOKEN': oauthToken } : {}),
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }),
    });
  } catch (err) {
    console.error('kiriminaja fetch error:', err);
    throw new Error('could not reach kiriminaja');
  }
}

const OOPS_MAX_ATTEMPTS = 3;
const OOPS_RETRY_DELAY_MS = 400;
const WRITE_PATH_PATTERN = /request_pickup|cancel_shipment/;

async function kiriminajaRequest(path, body, method = 'POST') {
  const token = getToken();
  if (!token) {
    throw new Error('kiriminaja is not configured');
  }

  const useOAuth = kiriminajaOAuthConfigured();
  // Sandbox intermittently answers 200 {status:false, text:"Oops, terjadi kesalahan..."}.
  // Retry only lookups — never request_pickup / cancel_shipment, which must not run twice.
  const maxAttempts = WRITE_PATH_PATTERN.test(path) ? 1 : OOPS_MAX_ATTEMPTS;

  for (let attempt = 1; ; attempt++) {
    // refresh the OAuth token on retries in case the cached one is the problem
    const oauthToken = useOAuth ? await getOAuthToken({ force: attempt > 1 }) : '';
    let res = await sendRequest(path, body, token, oauthToken, method);
    if (useOAuth && (res.status === 401 || res.status === 403)) {
      // token may have been revoked or expired early — refresh once and retry
      res = await sendRequest(path, body, token, await getOAuthToken({ force: true }), method);
    }

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('invalid response from kiriminaja');
    }

    if (!res.ok || data.status === false) {
      if (attempt < maxAttempts && /oops/i.test(data.text || '')) {
        console.warn(`kiriminaja oops on ${path}, retrying (${attempt}/${maxAttempts})`);
        await new Promise((resolve) => setTimeout(resolve, OOPS_RETRY_DELAY_MS * attempt));
        continue;
      }
      throw new Error(data.text || `kiriminaja request failed (${res.status})`);
    }

    return data;
  }
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

/** Subdistrict (kelurahan) — required for request_pickup v6.2's destination_kelurahan_id. */
export async function getSubdistricts(kecamatanId) {
  const data = await kiriminajaRequest('/api/mitra/kelurahan', { kecamatan_id: Number(kecamatanId) });
  return data.results || [];
}

/** Returns the raw list of courier rate results from KiriminAja's shipping_price endpoint.
 * `weightGrams` must already be the chargeable weight (the greater of actual and volumetric).
 * `insurance` is the pricing flag: 1 to price insurance, 0 to skip it. */
export async function getShippingRates({
  destinationDistrictId,
  weightGrams,
  itemValue,
  insurance = 0,
  widthCm,
  lengthCm,
  heightCm,
}) {
  const originId = getOriginDistrictId();
  if (!originId) {
    throw new Error('shipping origin is not configured');
  }
  if (!destinationDistrictId) {
    throw new Error('destination is required');
  }

  const data = await kiriminajaRequest('/api/mitra/v6.1/shipping_price', {
    origin: originId,
    destination: Number(destinationDistrictId),
    weight: Math.round(weightGrams) || 1,
    width: Math.round(widthCm) || 1,
    length: Math.round(lengthCm) || 1,
    height: Math.round(heightCm) || 1,
    insurance: insurance ? 1 : 0,
    item_value: Math.round(itemValue) || 0,
  });

  return data.results || [];
}

/** Creates the shipment and requests courier pickup in one call (express has no separate "create order" step).
 * packages: [{ orderId, destinationName, destinationPhone, destinationAddress, destinationKecamatanId,
 *   destinationKelurahanId, destinationZipcode, destinationLatitude, destinationLongitude,
 *   weightGrams, widthCm, lengthCm, heightCm, qty, itemValue, shippingCost, service, serviceType,
 *   codAmount, insuranceAmount, itemName, items: [{ name, price, weightGrams, widthCm, lengthCm, heightCm, qty }] }]
 */
/** KIRIMINAJA_PAYMENT_METHOD=credit pays each pickup from KA Credit so the AWB comes back immediately.
 * Unset, KiriminAja creates a QRIS bill and holds the AWB until it is paid. The PIN is optional and
 * must be omitted (never an empty string) when the account has none. */
function getPickupPaymentFields() {
  const method = (process.env.KIRIMINAJA_PAYMENT_METHOD || '').trim().toLowerCase();
  if (method !== 'credit' && method !== 'cash') return {};
  const pin = (process.env.KIRIMINAJA_PIN || '').trim();
  return { payment_method: method, ...(method === 'credit' && /^\d{6}$/.test(pin) ? { pin } : {}) };
}

export async function createShipment({ schedule, packages }) {
  const origin = getOriginProfile();
  if (!origin.kecamatanId || !origin.kelurahanId) {
    throw new Error('kiriminaja sender profile is not configured');
  }
  if (!packages?.length) {
    throw new Error('at least one package is required');
  }

  const body = {
    address: origin.address,
    phone: normalizePhone(origin.phone),
    name: origin.name,
    zipcode: origin.zipcode,
    kecamatan_id: origin.kecamatanId,
    kelurahan_id: origin.kelurahanId,
    latitude: origin.latitude,
    longitude: origin.longitude,
    platform_name: 'paperainstudio',
    schedule,
    ...getPickupPaymentFields(),
    packages: packages.map((p) => ({
      order_id: p.orderId,
      destination_name: p.destinationName,
      destination_phone: p.destinationPhone,
      destination_address: p.destinationAddress,
      destination_kecamatan_id: Number(p.destinationKecamatanId),
      destination_kelurahan_id: Number(p.destinationKelurahanId),
      destination_zipcode: p.destinationZipcode,
      destination_latitude: p.destinationLatitude || 0,
      destination_longitude: p.destinationLongitude || 0,
      weight: Math.round(p.weightGrams),
      width: Math.round(p.widthCm),
      length: Math.round(p.lengthCm),
      height: Math.round(p.heightCm),
      qty: p.qty || 1,
      item_value: Math.round(p.itemValue) || 0,
      shipping_cost: Math.round(p.shippingCost),
      service: p.service,
      service_type: p.serviceType,
      cod: Math.round(p.codAmount) || 0,
      insurance_amount: Math.round(p.insuranceAmount) || 0,
      package_type_id: EXPRESS_PACKAGE_TYPE_ID,
      item_name: p.itemName,
      drop: false,
      items: (p.items || []).map((item) => ({
        name: item.name,
        price: Math.round(item.price) || 0,
        weight: Math.round(item.weightGrams) || 1,
        width: Math.round(item.widthCm) || 1,
        length: Math.round(item.lengthCm) || 1,
        height: Math.round(item.heightCm) || 1,
        qty: item.qty || 1,
      })),
    })),
  };

  return kiriminajaRequest('/api/mitra/v6.2/request_pickup', body);
}

export async function trackShipment(orderIdOrAwb) {
  const data = await kiriminajaRequest('/api/mitra/tracking', { order_id: orderIdOrAwb });
  return data;
}

export async function cancelShipment(awb, reason) {
  const data = await kiriminajaRequest('/api/mitra/v3/cancel_shipment', { awb, reason });
  return data;
}

/** Payment status for a pickup number. Express status_code "9" = unpaid, "0" = paid. */
export async function getPayment(pickupNumber) {
  return kiriminajaRequest('/api/mitra/v2/get_payment', { payment_id: pickupNumber });
}

/** KA Credit balance (beta endpoint). Not available to Term of Payment members. */
export async function getCreditBalance() {
  return kiriminajaRequest('/api/mitra/v6.2/credit/balance', null, 'GET');
}

/** Checks the KA Credit PIN (beta endpoint). Max 3 attempts before KiriminAja locks it. */
export async function validatePin(pin) {
  return kiriminajaRequest('/api/mitra/v6.2/pin/validate', { pin });
}

/** Registers the account's single webhook URL. A new URL replaces the old one — notify KiriminAja first. */
export async function setCallback(url) {
  return kiriminajaRequest('/api/mitra/set_callback', { url });
}

/** Official shipping label PDF. Response url is the KiriminAja-rendered label (logos, sorting code, Code 128A). */
export async function printShippingLabel(awb) {
  const awbs = (Array.isArray(awb) ? awb : [awb]).filter(Boolean);
  if (!awbs.length) {
    throw new Error('awb is required');
  }
  const data = await kiriminajaRequest('/api/mitra/v6.1/awb/print', { awb: awbs });
  const url = data?.data?.data?.url || data?.data?.url || data?.url || null;
  return { url, raw: data };
}
