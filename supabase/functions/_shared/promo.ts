import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PromoValidation = {
  valid: boolean;
  message?: string;
  code?: string;
  discount_amount?: number;
  description?: string | null;
};

export async function validatePromoCode(
  supabase: SupabaseClient,
  rawCode: string,
  currency: string,
  subtotalAfterVolume: number,
): Promise<PromoValidation> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { valid: false, message: "enter a promo code" };
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, message: "invalid promo code" };
  }

  const now = new Date();
  if (data.valid_from && new Date(data.valid_from) > now) {
    return { valid: false, message: "this promo code is not active yet" };
  }
  if (data.valid_until && new Date(data.valid_until) < now) {
    return { valid: false, message: "this promo code has expired" };
  }
  if (data.max_uses != null && data.used_count >= data.max_uses) {
    return { valid: false, message: "this promo code has reached its usage limit" };
  }
  if (data.currency && data.currency !== currency) {
    return { valid: false, message: "this promo code is not valid for your currency" };
  }
  if (subtotalAfterVolume < Number(data.min_subtotal)) {
    return {
      valid: false,
      message: `minimum order of ${data.min_subtotal} required for this code`,
    };
  }

  let discountAmount = 0;
  if (data.discount_type === "percent") {
    discountAmount = subtotalAfterVolume * (Number(data.discount_value) / 100);
  } else {
    discountAmount = Number(data.discount_value);
  }
  discountAmount = Math.min(discountAmount, subtotalAfterVolume);

  if (discountAmount <= 0) {
    return { valid: false, message: "this promo code does not apply to your order" };
  }

  return {
    valid: true,
    code,
    discount_amount: discountAmount,
    description: data.description,
  };
}

export async function incrementPromoUsage(
  supabase: SupabaseClient,
  code: string,
) {
  const { data } = await supabase
    .from("promo_codes")
    .select("used_count")
    .eq("code", code)
    .single();

  if (!data) return;

  await supabase
    .from("promo_codes")
    .update({ used_count: (data.used_count || 0) + 1 })
    .eq("code", code);
}
