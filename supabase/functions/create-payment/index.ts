import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY") || "";
const MIDTRANS_ENV = Deno.env.get("MIDTRANS_ENV") || "sandbox";

const SNAP_API_URL =
  MIDTRANS_ENV === "production"
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";

// Midtrans processes in IDR; convert USD prices for the API call
const USD_TO_IDR = 16000;

type CreatePaymentBody = {
  order_id: string;
};

function toIdr(usdAmount: number): number {
  return Math.round(usdAmount * USD_TO_IDR);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: CreatePaymentBody = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return jsonResponse({ error: "order_id is required" }, 400);
    }

    if (!MIDTRANS_SERVER_KEY) {
      return jsonResponse(
        { error: "payment gateway is not configured yet", pending: true },
        503,
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return jsonResponse({ error: "order not found" }, 404);
    }

    if (order.status !== "pending") {
      return jsonResponse({ error: "order is not in pending status" }, 400);
    }

    const isUsd = order.currency === "USD";

    const itemDetails = (order.order_items || []).map(
      (item: { title: string; price: number; quantity: number; product_id: string }) => ({
        id: item.product_id,
        name: item.title.substring(0, 50),
        price: isUsd ? toIdr(Number(item.price)) : Math.round(Number(item.price)),
        quantity: item.quantity,
      }),
    );

    const volumeDiscount = Number(order.discount) - (Number(order.promo_discount) || 0);
    if (volumeDiscount > 0) {
      itemDetails.push({
        id: "VOLUME-DISC",
        name: "Volume Discount (20%)",
        price: isUsd ? -toIdr(volumeDiscount) : -Math.round(volumeDiscount),
        quantity: 1,
      });
    }

    if ((Number(order.promo_discount) || 0) > 0) {
      itemDetails.push({
        id: "PROMO-DISC",
        name: "Promo: " + (order.promo_code || "discount"),
        price: isUsd ? -toIdr(Number(order.promo_discount)) : -Math.round(Number(order.promo_discount)),
        quantity: 1,
      });
    }

    if (Number(order.shipping_fee) > 0) {
      itemDetails.push({
        id: "SHIPPING",
        name: "Shipping Fee",
        price: isUsd ? toIdr(Number(order.shipping_fee)) : Math.round(Number(order.shipping_fee)),
        quantity: 1,
      });
    }

    const grossAmount = itemDetails.reduce(
      (sum: number, item: { price: number; quantity: number }) =>
        sum + item.price * item.quantity,
      0,
    );

    const midtransPayload = {
      transaction_details: {
        order_id: order.display_id || order.id,
        gross_amount: grossAmount,
      },
      item_details: itemDetails,
      credit_card: {
        secure: true,
      },
      enabled_payments: ["credit_card"],
      customer_details: {
        first_name: order.shipping_name,
        email: order.shipping_email,
        phone: order.shipping_phone,
        shipping_address: {
          first_name: order.shipping_name,
          phone: order.shipping_phone,
          address: order.shipping_address,
          country_code: order.shipping_country || "ID",
        },
      },
    };

    const auth = btoa(MIDTRANS_SERVER_KEY + ":");
    const snapRes = await fetch(SNAP_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Basic " + auth,
      },
      body: JSON.stringify(midtransPayload),
    });

    const snapData = await snapRes.json();

    if (!snapRes.ok || !snapData.token) {
      console.error("Midtrans Snap error:", snapData);
      return jsonResponse(
        { error: "failed to create payment token", detail: snapData },
        502,
      );
    }

    await supabase
      .from("orders")
      .update({
        payment_token: snapData.token,
        payment_url: snapData.redirect_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    return jsonResponse({
      snap_token: snapData.token,
      redirect_url: snapData.redirect_url,
    });
  } catch (err) {
    console.error("create-payment error:", err);
    return jsonResponse({ error: "server error" }, 500);
  }
});
