import { getCatalogProduct } from './catalog.js';
import { createShipment, kiriminajaShipmentConfigured, normalizePhone } from './kiriminaja.js';
import {
  getOrderWeightGrams,
  getItemWeightGrams,
  getOrderPackageDimensionsCm,
  getItemDimensionsCm,
} from './shipping-weight.js';

/** Express pickup requests need a YYYY-MM-DD HH:mm:ss local-time (WIB) schedule.
 * Same-day pickup before 14:00 WIB, otherwise next business day morning. */
function getNextPickupSchedule() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  if (wib.getUTCHours() < 14) {
    wib.setUTCHours(16, 0, 0, 0);
  } else {
    wib.setUTCDate(wib.getUTCDate() + 1);
    wib.setUTCHours(10, 0, 0, 0);
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())} ${pad(wib.getUTCHours())}:00:00`;
}

async function resolveItemCategory(supabase, productId) {
  const catalog = getCatalogProduct(productId);
  if (catalog?.category) return catalog.category;
  const { data } = await supabase.from('products').select('category').eq('id', productId).maybeSingle();
  return data?.category || null;
}

/** Creates the KiriminAja shipment (request_pickup) for a paid order and saves the AWB/pickup
 * number back onto the order row. Safe to retry — a prior failure leaves awb and pickup number null. */
export async function createKiriminajaShipmentForOrder(supabase, orderId) {
  if (!kiriminajaShipmentConfigured()) {
    return { ok: false, error: 'kiriminaja sender profile is not configured' };
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError || !order) {
    return { ok: false, error: 'order not found' };
  }

  if (order.kiriminaja_awb) {
    return { ok: true, alreadyCreated: true, awb: order.kiriminaja_awb };
  }

  // Pickup already requested, AWB pending payment — Midtrans sends several "paid" notifications
  // (capture + settlement), and KiriminAja rejects a second request_pickup for the same package.
  if (order.kiriminaja_pickup_number) {
    return { ok: true, alreadyRequested: true, pickupNumber: order.kiriminaja_pickup_number };
  }

  if (!order.shipping_district_id || !order.shipping_kelurahan_id || !order.shipping_courier) {
    return { ok: false, error: 'order has no structured KiriminAja shipping details' };
  }

  const items = order.order_items || [];
  const categories = [];
  for (const item of items) {
    categories.push(await resolveItemCategory(supabase, item.product_id));
  }
  const lines = items.map((item, i) => ({ category: categories[i], qty: item.quantity }));

  const qty = items.reduce((sum, item) => sum + item.quantity, 0) || 1;
  const weightGrams = order.shipping_actual_weight_grams || getOrderWeightGrams(lines);
  const packageDims =
    order.shipping_width_cm && order.shipping_length_cm && order.shipping_height_cm
      ? {
          width: Number(order.shipping_width_cm),
          length: Number(order.shipping_length_cm),
          height: Number(order.shipping_height_cm),
        }
      : getOrderPackageDimensionsCm(qty);
  const itemDims = getItemDimensionsCm();
  const itemValue =
    Number(order.shipping_item_value) ||
    items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const insuranceAmount = Number(order.shipping_insurance_amount) || 0;
  const itemName = items.map((item) => item.title).join(', ').slice(0, 255) || 'paperain studio order';

  let response;
  try {
    response = await createShipment({
      schedule: getNextPickupSchedule(),
      packages: [
        {
          orderId: order.display_id || order.id,
          destinationName: order.shipping_name,
          destinationPhone: normalizePhone(order.shipping_phone),
          destinationAddress: order.shipping_address,
          destinationKecamatanId: order.shipping_district_id,
          destinationKelurahanId: order.shipping_kelurahan_id,
          destinationZipcode: order.shipping_postal_code,
          destinationLatitude: order.shipping_latitude,
          destinationLongitude: order.shipping_longitude,
          weightGrams,
          widthCm: packageDims.width,
          lengthCm: packageDims.length,
          heightCm: packageDims.height,
          qty,
          itemValue,
          shippingCost: order.shipping_fee,
          service: order.shipping_courier,
          serviceType: order.shipping_service_type,
          codAmount: 0,
          insuranceAmount,
          itemName,
          items: items.map((item, i) => ({
            name: item.title.slice(0, 60),
            price: item.price,
            weightGrams: getItemWeightGrams(categories[i]),
            widthCm: itemDims.width,
            lengthCm: itemDims.length,
            heightCm: itemDims.height,
            qty: item.quantity,
          })),
        },
      ],
    });
  } catch (err) {
    console.error('kiriminaja createShipment failed:', order.id, err);
    await supabase
      .from('orders')
      .update({ kiriminaja_error: err.message || 'shipment creation failed' })
      .eq('id', order.id);
    return { ok: false, error: err.message || 'shipment creation failed' };
  }

  const detail = response?.details?.[0];
  const update = {
    kiriminaja_awb: detail?.awb || null,
    kiriminaja_pickup_number: response?.pickup_number || null,
    kiriminaja_status: detail?.awb ? 'processed' : 'requested',
    kiriminaja_error: null,
  };

  const { error: updateError } = await supabase.from('orders').update(update).eq('id', order.id);
  if (updateError) {
    console.error('kiriminaja order update failed:', order.id, updateError);
  }

  return { ok: true, ...update };
}
