import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  getIdrPrice,
  getShippingFee,
  getVolumeDiscount,
  resolveCartLineId,
  roundMoney,
  type PricedLine,
} from "../_shared/pricing.ts";
import { incrementPromoUsage, validatePromoCode } from "../_shared/promo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type PlaceOrderBody = {
  items: Array<{
    id: string;
    title: string;
    qty: number;
    image?: string;
  }>;
  currency: string;
  promo_code?: string | null;
  shipping_name: string;
  shipping_email: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_country: string;
  notes?: string | null;
  customer_id?: string | null;
};

async function priceCartItems(
  supabase: ReturnType<typeof createClient>,
  items: PlaceOrderBody["items"],
  currency: string,
): Promise<{ lines: PricedLine[]; subtotal: number } | { error: string }> {
  const lines: PricedLine[] = [];
  let subtotal = 0;

  for (const item of items) {
    if (!item.id || !item.qty || item.qty < 1) {
      return { error: "invalid cart item" };
    }

    const resolved = await resolveCartLineId(supabase, item.id);
    if ("error" in resolved) {
      return { error: resolved.error };
    }
    const { product_id, variant_id } = resolved;

    const { data: product, error } = await supabase
      .from("products")
      .select("id, title, price, category, image, is_active")
      .eq("id", product_id)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !product) {
      return { error: `product not found: ${product_id}` };
    }

    const unitPrice =
      currency === "IDR"
        ? getIdrPrice(Number(product.price), product.category)
        : Number(product.price);

    const lineTotal = unitPrice * item.qty;
    subtotal += lineTotal;

    lines.push({
      id: item.id,
      product_id,
      variant_id,
      title: item.title || product.title,
      price: unitPrice,
      qty: item.qty,
      image: item.image || product.image,
    });
  }

  return { lines, subtotal };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: PlaceOrderBody = await req.json();
    const {
      items,
      currency,
      promo_code,
      shipping_name,
      shipping_email,
      shipping_phone,
      shipping_address,
      shipping_country,
      notes,
      customer_id,
    } = body;

    if (!items?.length) {
      return jsonResponse({ error: "cart is empty" }, 400);
    }
    if (!currency || !["USD", "IDR"].includes(currency)) {
      return jsonResponse({ error: "invalid currency" }, 400);
    }
    if (!shipping_name || !shipping_email || !shipping_phone || !shipping_address || !shipping_country) {
      return jsonResponse({ error: "missing shipping details" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let resolvedCustomerId: string | null = customer_id || null;
    if (resolvedCustomerId) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("id", resolvedCustomerId)
        .maybeSingle();
      if (!customer) {
        resolvedCustomerId = null;
      }
    }

    const priced = await priceCartItems(supabase, items, currency);
    if ("error" in priced) {
      return jsonResponse({ error: priced.error }, 400);
    }

    const { lines, subtotal } = priced;
    const volumeDiscount = getVolumeDiscount(subtotal, currency);
    const subtotalAfterVolume = subtotal - volumeDiscount;

    let promoDiscount = 0;
    let appliedPromoCode: string | null = null;

    if (promo_code?.trim()) {
      const promo = await validatePromoCode(
        supabase,
        promo_code,
        currency,
        subtotalAfterVolume,
      );
      if (!promo.valid) {
        return jsonResponse({ error: promo.message || "invalid promo code" }, 400);
      }
      promoDiscount = promo.discount_amount!;
      appliedPromoCode = promo.code!;
    }

    const shippingFee = getShippingFee(currency);
    const totalDiscount = volumeDiscount + promoDiscount;
    const total = subtotal - totalDiscount + shippingFee;

    const orderData = {
      customer_id: resolvedCustomerId,
      status: "pending",
      currency,
      subtotal: roundMoney(subtotal, currency),
      discount: roundMoney(totalDiscount, currency),
      promo_code: appliedPromoCode,
      promo_discount: roundMoney(promoDiscount, currency),
      shipping_fee: roundMoney(shippingFee, currency),
      total: roundMoney(total, currency),
      shipping_name,
      shipping_email,
      shipping_phone,
      shipping_address,
      shipping_country,
      notes: notes || null,
    };

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (orderError || !order) {
      console.error("order insert error:", orderError);
      return jsonResponse({ error: "could not create order" }, 500);
    }

    const itemRows = lines.map((line) => ({
      order_id: order.id,
      product_id: line.product_id,
      variant_id: line.variant_id,
      title: line.title,
      price: line.price,
      quantity: line.qty,
      image: line.image,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(itemRows);

    if (itemsError) {
      console.error("order items insert error:", itemsError);
      return jsonResponse({ error: "order created but items failed to save" }, 500);
    }

    if (appliedPromoCode) {
      await incrementPromoUsage(supabase, appliedPromoCode);
    }

    return jsonResponse({ order });
  } catch (err) {
    console.error("place-order error:", err);
    return jsonResponse({ error: "server error" }, 500);
  }
});
