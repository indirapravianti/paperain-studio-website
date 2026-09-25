import { resolvePackageDimensions, resolvePackageWeight, roundMoney } from './pricing.js';
import { geocodeAddress } from './geocoding.js';
import { createKiriminajaShipment, extractAwbFromShipmentResponse } from './kiriminaja.js';

function isMissingColumnError(error) {
  return error?.code === 'PGRST204';
}

async function clearShipmentClaim(supabase, orderId, errorMessage) {
  const { error } = await supabase
    .from('orders')
    .update({ shipment_created_at: null, shipment_error: errorMessage || null })
    .eq('id', orderId);

  if (error && !isMissingColumnError(error)) {
    console.warn('Could not clear shipment claim:', error.message);
  }
}

/**
 * Creates the KiriminAja shipment for a confirmed order. Idempotent via shipment_created_at
 * on the order row (same pattern as receipt_sent_at in send-order-email.js) — a failure clears
 * the claim so a retry (webhook redelivery or the admin "retry" button) can attempt again.
 */
export async function createShipmentForOrder(supabase, orderId) {
  const { data: claimed, error: claimError } = await supabase
    .from('orders')
    .update({ shipment_created_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'confirmed')
    .is('shipment_created_at', null)
    .select('*, order_items(*)')
    .maybeSingle();

  if (claimError) {
    console.error('shipment claim error:', claimError);
    return { ok: false, error: claimError.message };
  }

  if (!claimed) {
    return { ok: true, skipped: true, reason: 'already created or not confirmed' };
  }

  if (
    !claimed.courier_code ||
    !claimed.courier_service_type ||
    !claimed.destination_kecamatan_id ||
    !claimed.destination_kelurahan_id ||
    !claimed.destination_zipcode
  ) {
    const message = 'order is missing courier/destination data';
    await clearShipmentClaim(supabase, orderId, message);
    return { ok: false, error: message };
  }

  const items = claimed.order_items || [];
  const lines = items.map((item) => ({ product_id: item.product_id, qty: item.quantity }));

  const [weightGrams, dims] = await Promise.all([
    resolvePackageWeight(supabase, lines),
    resolvePackageDimensions(supabase, lines),
  ]);

  const geocoded = await geocodeAddress(`${claimed.shipping_address}, Indonesia`);

  let shipmentResult;
  try {
    shipmentResult = await createKiriminajaShipment({
      orderId: claimed.id,
      courierCode: claimed.courier_code,
      serviceType: claimed.courier_service_type,
      shippingCost: roundMoney(claimed.shipping_fee),
      weightGrams,
      dims,
      itemValue: roundMoney(claimed.subtotal),
      itemName: items[0]?.title || 'order items',
      destination: {
        name: claimed.shipping_name,
        phone: claimed.shipping_phone,
        address: claimed.shipping_address,
        kecamatanId: claimed.destination_kecamatan_id,
        kelurahanId: claimed.destination_kelurahan_id,
        zipcode: claimed.destination_zipcode,
        // Best-effort: falls back to origin coordinates if geocoding fails — most couriers
        // don't strictly require precise geolocation (see `use_geolocation` in pricing results).
        latitude: geocoded?.lat ?? Number(process.env.KIRIMINAJA_ORIGIN_LAT),
        longitude: geocoded?.lon ?? Number(process.env.KIRIMINAJA_ORIGIN_LNG),
      },
      items: items.map((item) => ({
        name: item.title,
        price: roundMoney(item.price),
        weight: weightGrams,
        qty: item.quantity,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'shipment creation failed';
    console.error('kiriminaja shipment config error:', err);
    await clearShipmentClaim(supabase, orderId, message);
    return { ok: false, error: message };
  }

  if (!shipmentResult.ok) {
    const message = shipmentResult.data?.text || 'shipment creation failed';
    console.error('kiriminaja shipment error:', shipmentResult.data);
    await supabase
      .from('orders')
      .update({ shipment_response: shipmentResult.data })
      .eq('id', orderId);
    await clearShipmentClaim(supabase, orderId, message);
    return { ok: false, error: message };
  }

  const awb = extractAwbFromShipmentResponse(shipmentResult.data);
  if (!awb) {
    console.warn('kiriminaja shipment created but no AWB found in response shape:', JSON.stringify(shipmentResult.data));
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      shipment_awb: awb,
      shipment_response: shipmentResult.data,
      shipment_error: null,
      shipment_weight_grams: weightGrams,
    })
    .eq('id', orderId);

  if (updateError) {
    console.error('shipment result save error:', updateError);
    return { ok: false, error: updateError.message };
  }

  return { ok: true, awb };
}
