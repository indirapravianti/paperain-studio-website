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

/** Sender profile used as the pickup point for every shipment — one warehouse, set once via env. */
export function getOriginProfile() {
  const kelurahanId = process.env.KIRIMINAJA_ORIGIN_KELURAHAN_ID;
  const lat = process.env.KIRIMINAJA_ORIGIN_LATITUDE;
  const lng = process.env.KIRIMINAJA_ORIGIN_LONGITUDE;
  return {
    name: process.env.KIRIMINAJA_ORIGIN_NAME || null,
    phone: process.env.KIRIMINAJA_ORIGIN_PHONE || null,
    address: process.env.KIRIMINAJA_ORIGIN_ADDRESS || null,
    zipcode: process.env.KIRIMINAJA_ORIGIN_ZIPCODE || null,
    kecamatanId: getOriginDistrictId(),
    kelurahanId: kelurahanId ? Number(kelurahanId) : null,
    latitude: lat ? Number(lat) : 0,
    longitude: lng ? Number(lng) : 0,
  };
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

/** Subdistrict (kelurahan) — required for request_pickup v6.2's destination_kelurahan_id. */
export async function getSubdistricts(kecamatanId) {
  const data = await kiriminajaRequest('/api/mitra/kelurahan', { kecamatan_id: Number(kecamatanId) });
  return data.results || [];
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

  const data = await kiriminajaRequest('/api/mitra/v6.1/shipping_price', {
    origin: originId,
    destination: Number(destinationDistrictId),
    weight: Math.round(weightGrams) || 1,
    insurance: 0,
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
    phone: origin.phone,
    name: origin.name,
    zipcode: origin.zipcode,
    kecamatan_id: origin.kecamatanId,
    kelurahan_id: origin.kelurahanId,
    latitude: origin.latitude,
    longitude: origin.longitude,
    platform_name: 'paperainstudio',
    schedule,
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
      package_type_id: 1,
      item_name: p.itemName,
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
