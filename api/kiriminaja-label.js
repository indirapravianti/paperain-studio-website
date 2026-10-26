import { applyCors, sendJson } from '../lib/api/cors.js';
import { requireAdmin } from '../lib/api/admin-auth.js';
import { getSupabaseAdmin } from '../lib/api/supabase-admin.js';
import { getOriginProfile, printShippingLabel, trackShipment } from '../lib/api/kiriminaja.js';

function labelPayload(order, origin, sortingCode, pdfUrl, trackedOriginCity) {
  const items = (order.order_items || []).map((item) => ({
    name: item.title,
    qty: item.quantity,
    price: Number(item.price) || 0,
  }));
  const qty = items.reduce((sum, item) => sum + item.qty, 0);
  const insuranceAmount = Number(order.shipping_insurance_amount) || 0;

  return {
    pdf_url: pdfUrl,
    sorting_code: sortingCode,
    label: {
      courier: order.shipping_courier || '',
      service_type: order.shipping_service_type || '',
      service_name: order.shipping_service_name || '',
      shipping_type: 'NON-COD',
      cashless: false,
      sorting_code: sortingCode,
      awb: order.kiriminaja_awb || '',
      order_ref: order.display_id || order.id,
      weight_grams: order.shipping_weight_grams || order.shipping_actual_weight_grams || null,
      actual_weight_grams: order.shipping_actual_weight_grams || null,
      volumetric_weight_grams: order.shipping_volumetric_weight_grams || null,
      qty,
      insurance_amount: insuranceAmount,
      item_value: Number(order.shipping_item_value) || items.reduce((sum, item) => sum + item.price * item.qty, 0),
      origin_city: origin.city || trackedOriginCity || '',
      destination_city: order.shipping_city || '',
      destination_district: order.shipping_district || '',
      order_date: order.created_at || null,
      notes: order.notes || '',
      sender: {
        name: origin.name || '',
        phone: origin.phone || '',
        address: origin.address || '',
        zipcode: origin.zipcode || '',
      },
      recipient: {
        name: order.shipping_name || '',
        phone: order.shipping_phone || '',
        address: order.shipping_address || '',
        zipcode: order.shipping_postal_code || '',
      },
      items,
    },
  };
}

/** Admin label data: official KiriminAja PDF when an AWB exists, plus the fields our own label prints. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return sendJson(res, { error: 'method not allowed' }, 405);
  }

  const admin = await requireAdmin(req.headers?.authorization);
  if (!admin.ok) {
    return sendJson(res, { error: admin.error }, admin.status);
  }

  const orderId = req.query?.order_id;
  if (!orderId) {
    return sendJson(res, { error: 'order_id is required' }, 400);
  }

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return sendJson(res, { error: 'order not found' }, 404);
  }

  const origin = getOriginProfile();
  let sortingCode = order.kiriminaja_sorting_code || null;
  let pdfUrl = null;
  let trackedOriginCity = null;

  if (order.kiriminaja_awb) {
    try {
      const printed = await printShippingLabel(order.kiriminaja_awb);
      pdfUrl = printed.url;
    } catch (err) {
      console.error('kiriminaja label print failed:', order.id, err);
    }

    // Tracking also gives the origin city, for when KIRIMINAJA_ORIGIN_CITY isn't set.
    if (!sortingCode || !origin.city) {
      try {
        const tracked = await trackShipment(order.kiriminaja_awb);
        trackedOriginCity = tracked?.details?.origin?.city || null;
        const trackedSortingCode = tracked?.details?.sorting_code || null;
        if (!sortingCode && trackedSortingCode) {
          sortingCode = trackedSortingCode;
          const { error: sortingError } = await supabase
            .from('orders')
            .update({ kiriminaja_sorting_code: sortingCode })
            .eq('id', order.id);
          if (sortingError) console.error('could not store sorting code:', order.id, sortingError.message);
        }
      } catch (err) {
        console.error('kiriminaja label tracking lookup failed:', order.id, err);
      }
    }
  }

  return sendJson(res, labelPayload(order, origin, sortingCode, pdfUrl, trackedOriginCity), 200);
}
