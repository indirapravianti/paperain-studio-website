import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { encode as hexEncode } from "https://deno.land/std@0.177.0/encoding/hex.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIDTRANS_SERVER_KEY = Deno.env.get("MIDTRANS_SERVER_KEY") || "";

async function sha512(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-512", data);
  return new TextDecoder().decode(hexEncode(new Uint8Array(hash)));
}

function mapTransactionStatus(
  transactionStatus: string,
  fraudStatus: string,
): string | null {
  if (transactionStatus === "capture") {
    return fraudStatus === "accept" ? "confirmed" : null;
  }
  if (transactionStatus === "settlement") return "confirmed";
  if (transactionStatus === "pending") return "pending";
  if (
    transactionStatus === "deny" ||
    transactionStatus === "expire" ||
    transactionStatus === "cancel"
  ) {
    return "cancelled";
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      transaction_id,
      payment_type,
    } = body;

    if (!order_id || !signature_key) {
      return jsonResponse({ error: "invalid notification" }, 400);
    }

    // Verify signature: SHA512(order_id + status_code + gross_amount + server_key)
    const expectedSig = await sha512(
      order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY,
    );

    if (signature_key !== expectedSig) {
      console.error("Signature mismatch for order:", order_id);
      return jsonResponse({ error: "invalid signature" }, 403);
    }

    const newStatus = mapTransactionStatus(
      transaction_status || "",
      fraud_status || "",
    );

    if (!newStatus) {
      return jsonResponse({ message: "status not mapped, ignored" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: orderById } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", order_id)
      .maybeSingle();

    let order = orderById;
    if (!order) {
      const { data: orderByDisplay } = await supabase
        .from("orders")
        .select("id, status")
        .eq("display_id", order_id)
        .maybeSingle();
      order = orderByDisplay;
    }

    if (!order) {
      console.error("Order not found for Midtrans order_id:", order_id);
      return jsonResponse({ error: "order not found" }, 404);
    }

    // Only update if the new status is a meaningful transition
    const skipUpdate =
      order.status === "delivered" ||
      order.status === "shipped" ||
      (order.status === "confirmed" && newStatus === "pending");

    if (!skipUpdate) {
      await supabase
        .from("orders")
        .update({
          status: newStatus,
          payment_type: payment_type || null,
          midtrans_transaction_id: transaction_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      console.log(
        `Order ${order_id} updated: ${order.status} → ${newStatus}`,
      );
    }

    if (newStatus === "confirmed") {
      const { data: fullOrder } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order.id)
        .single();

      if (fullOrder) {
        fetch(`${SUPABASE_URL}/functions/v1/send-receipt`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ record: fullOrder }),
        }).catch((err) => console.error("send-receipt invoke failed:", err));
      }
    }

    return jsonResponse({ message: "ok" });
  } catch (err) {
    console.error("midtrans-notification error:", err);
    return jsonResponse({ error: "server error" }, 500);
  }
});
