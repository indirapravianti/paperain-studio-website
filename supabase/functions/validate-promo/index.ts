import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getVolumeDiscount, roundMoney } from "../_shared/pricing.ts";
import { validatePromoCode } from "../_shared/promo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, currency, subtotal } = await req.json();

    if (!code || typeof code !== "string") {
      return jsonResponse({ valid: false, message: "enter a promo code" }, 400);
    }
    if (!currency || !["USD", "IDR"].includes(currency)) {
      return jsonResponse({ valid: false, message: "invalid currency" }, 400);
    }
    if (typeof subtotal !== "number" || subtotal < 0) {
      return jsonResponse({ valid: false, message: "invalid subtotal" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const volumeDiscount = getVolumeDiscount(subtotal, currency);
    const subtotalAfterVolume = subtotal - volumeDiscount;

    const result = await validatePromoCode(
      supabase,
      code,
      currency,
      subtotalAfterVolume,
    );

    if (!result.valid) {
      return jsonResponse(result);
    }

    return jsonResponse({
      valid: true,
      code: result.code,
      discount_amount: roundMoney(result.discount_amount!, currency),
      description: result.description,
    });
  } catch (err) {
    console.error("validate-promo error:", err);
    return jsonResponse({ valid: false, message: "server error" }, 500);
  }
});
