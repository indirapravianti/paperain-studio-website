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

function getKiriminajaOrigin() {
  const origin = {
    address: process.env.KIRIMINAJA_ORIGIN_ADDRESS,
    phone: process.env.KIRIMINAJA_ORIGIN_PHONE,
    name: process.env.KIRIMINAJA_ORIGIN_NAME,
    zipcode: process.env.KIRIMINAJA_ORIGIN_ZIPCODE,
    kecamatanId: Number(process.env.KIRIMINAJA_ORIGIN_KECAMATAN_ID),
    kelurahanId: Number(process.env.KIRIMINAJA_ORIGIN_KELURAHAN_ID),
    latitude: Number(process.env.KIRIMINAJA_ORIGIN_LAT),
    longitude: Number(process.env.KIRIMINAJA_ORIGIN_LNG),
  };

  if (
    !origin.address ||
    !origin.phone ||
    !origin.name ||
    !origin.zipcode ||
    !origin.kecamatanId ||
    !origin.kelurahanId ||
    !Number.isFinite(origin.latitude) ||
    !Number.isFinite(origin.longitude)
  ) {
    throw new Error('KIRIMINAJA_ORIGIN_* env vars not fully configured');
  }

  return origin;
}

/** Tomorrow at 10:00 local time, formatted for KiriminAja's `schedule` field. No pickup-time picker exists yet. */
function getNextPickupSchedule() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 10:00:00`;
}

/** Probes a few likely paths for the AWB in an undocumented create-order response — adjust once a real response is seen. */
export function extractAwbFromShipmentResponse(data) {
  return (
    data?.awb ||
    data?.data?.awb ||
    data?.data?.[0]?.awb ||
    data?.results?.[0]?.awb ||
    null
  );
}

/**
 * Creates the actual shipment (AWB) with KiriminAja. Non-COD only — cod/insurance are always 0 in this integration.
 * Destination geolocation is best-effort (geocoded address); origin comes from KIRIMINAJA_ORIGIN_* env vars.
 */
export async function createKiriminajaShipment({
  orderId,
  courierCode,
  serviceType,
  shippingCost,
  weightGrams,
  dims,
  itemValue,
  itemName,
  destination,
  items,
}) {
  const origin = getKiriminajaOrigin();

  const payload = {
    address: origin.address,
    phone: origin.phone,
    kecamatan_id: origin.kecamatanId,
    kelurahan_id: origin.kelurahanId,
    latitude: origin.latitude,
    longitude: origin.longitude,
    platform_name: 'paperain-studio-website',
    name: origin.name,
    zipcode: origin.zipcode,
    schedule: getNextPickupSchedule(),
    packages: [
      {
        order_id: orderId,
        destination_name: destination.name,
        destination_phone: destination.phone,
        destination_address: destination.address,
        destination_kecamatan_id: destination.kecamatanId,
        destination_kelurahan_id: destination.kelurahanId,
        destination_zipcode: destination.zipcode,
        destination_latitude: destination.latitude,
        destination_longitude: destination.longitude,
        weight: weightGrams,
        width: dims.width,
        height: dims.height,
        length: dims.length,
        qty: 1,
        item_value: itemValue,
        shipping_cost: shippingCost,
        service: courierCode,
        insurance_amount: 0,
        service_type: serviceType,
        cod: 0,
        package_type_id: 7,
        item_name: itemName,
        drop: false,
        note: '',
        items: items.map((item) => ({
          name: item.name,
          price: item.price,
          weight: item.weight,
          width: dims.width,
          height: dims.height,
          length: dims.length,
          qty: item.qty,
        })),
      },
    ],
  };

  const res = await fetch(`${getKiriminajaBaseUrl()}/api/mitra/v6.2/request_pickup`, {
    method: 'POST',
    headers: kiriminajaHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseKiriminajaResponse(res);
  return { ok: res.ok && data.status === true, data };
}

/** Live tracking lookup — accepts our order id or a real AWB, per KiriminAja's tracking endpoint. */
export async function getKiriminajaTracking(orderIdOrAwb) {
  const res = await fetch(`${getKiriminajaBaseUrl()}/api/mitra/tracking`, {
    method: 'POST',
    headers: kiriminajaHeaders(),
    body: JSON.stringify({ order_id: orderIdOrAwb }),
  });
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
