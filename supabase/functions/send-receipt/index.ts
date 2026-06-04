import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.paperainstudio.com";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "orders@paperainstudio.com";
const USD_TO_IDR = 16000;

const COLORS = {
  primary: "#43302E",
  pastelBlue: "#C1DBE8",
  buttermilk: "#FFF1B5",
  bg: "#f7f7f5",
  muted: "#666666",
  green: "#16a34a",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function fmt(val: number, currency: string) {
  if (currency === "IDR") return `Rp${Math.round(val).toLocaleString("id-ID")}`;
  return `$${Number(val).toFixed(2)}`;
}

function fmtIdrFromUsd(usd: number) {
  return `Rp${Math.round(Number(usd) * USD_TO_IDR).toLocaleString("id-ID")}`;
}

function imageUrl(image: string) {
  if (!image) return "";
  return image.startsWith("http") ? image : `${SITE_URL}${image}`;
}

function buildEmailHtml(order: Record<string, unknown>, items: Array<Record<string, unknown>>) {
  const orderId = (order.display_id as string) || `#${String(order.id).slice(0, 8)}`;
  const orderUrl = `${SITE_URL}/account/order?id=${order.id}`;
  const firstName = String(order.shipping_name || "there").split(" ")[0].toLowerCase();
  const totalItems = items.reduce((sum, i) => sum + Number(i.quantity), 0);
  const currency = String(order.currency || "USD");
  const isUsd = currency === "USD";

  const itemRowsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${
              item.image
                ? `<img src="${imageUrl(String(item.image))}" alt="${item.title}" width="56" height="56" style="width: 56px; height: 56px; object-fit: cover; border-radius: 8px;" />`
                : ""
            }
            <div>
              <p style="margin: 0; font-size: 14px; color: ${COLORS.primary}; font-weight: 500;">${item.title}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #888;">qty: ${item.quantity}</p>
            </div>
          </div>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right; vertical-align: top; font-size: 14px; color: ${COLORS.primary}; font-weight: 500;">
          ${fmt(Number(item.price) * Number(item.quantity), currency)}
        </td>
      </tr>`,
    )
    .join("");

  const currencyNote = isUsd
    ? `<div style="margin: 0 40px 24px; background-color: ${COLORS.pastelBlue}33; border: 1px solid ${COLORS.pastelBlue}; border-radius: 12px; padding: 16px 20px;">
        <p style="margin: 0; font-size: 12px; color: ${COLORS.primary}; line-height: 1.6;">
          <strong>payment note:</strong> your card was charged in Indonesian Rupiah (IDR) at approximately
          <strong>${fmtIdrFromUsd(Number(order.total))}</strong>.
          Prices above are shown in USD for reference. Your bank may display the final amount in your local currency using their exchange rate.
        </p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: ${COLORS.pastelBlue}; padding: 32px 40px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 28px;">✿</p>
      <h1 style="margin: 0; font-size: 22px; color: ${COLORS.primary}; font-weight: 600;">paperain studio</h1>
      <p style="margin: 8px 0 0; font-size: 13px; color: ${COLORS.primary}; opacity: 0.7;">payment confirmed</p>
    </div>
    <div style="padding: 32px 40px 24px;">
      <p style="margin: 0; font-size: 15px; color: ${COLORS.primary};">hi ${firstName},</p>
      <p style="margin: 12px 0 0; font-size: 14px; color: ${COLORS.muted}; line-height: 1.6;">
        thank you for your order! we've received your payment and will start preparing your pieces with care. here's your receipt:
      </p>
    </div>
    <div style="margin: 0 40px; background-color: ${COLORS.buttermilk}; border-radius: 12px; padding: 20px 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="font-size: 12px; color: ${COLORS.primary}; opacity: 0.6;">order id</td>
          <td style="font-size: 12px; color: ${COLORS.primary}; opacity: 0.6; text-align: right;">date</td>
        </tr>
        <tr>
          <td style="font-size: 14px; color: ${COLORS.primary}; font-weight: 600;">${orderId}</td>
          <td style="font-size: 14px; color: ${COLORS.primary}; font-weight: 500; text-align: right;">${new Date(String(order.created_at)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
        </tr>
      </table>
    </div>
    <div style="padding: 24px 40px;">
      <h2 style="margin: 0 0 16px; font-size: 14px; color: ${COLORS.primary}; font-weight: 600;">items ordered (${totalItems})</h2>
      <table style="width: 100%; border-collapse: collapse;">${itemRowsHtml}</table>
    </div>
    <div style="margin: 0 40px; border-top: 2px solid #f0f0f0; padding: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="color: #888;">subtotal</td><td style="text-align: right; color: ${COLORS.primary};">${fmt(Number(order.subtotal), currency)}</td></tr>
        <tr><td style="color: #888;">shipping</td><td style="text-align: right; color: ${COLORS.primary};">${Number(order.shipping_fee) === 0 ? "free" : fmt(Number(order.shipping_fee), currency)}</td></tr>
        <tr><td style="padding-top: 12px; font-weight: 700; font-size: 16px; color: ${COLORS.primary}; border-top: 1px solid #e5e5e5;">total</td><td style="padding-top: 12px; font-weight: 700; font-size: 16px; color: ${COLORS.primary}; text-align: right; border-top: 1px solid #e5e5e5;">${fmt(Number(order.total), currency)}</td></tr>
        ${isUsd ? `<tr><td colspan="2" style="padding-top: 8px; font-size: 12px; color: #888; text-align: right;">≈ ${fmtIdrFromUsd(Number(order.total))} charged via midtrans</td></tr>` : ""}
      </table>
    </div>
    ${currencyNote}
    <div style="margin: 0 40px; background-color: #f9f9f7; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 13px; color: ${COLORS.primary}; font-weight: 600;">shipping details</h3>
      <p style="margin: 0; font-size: 13px; color: #555; line-height: 1.7;">${order.shipping_name}<br/>${order.shipping_phone}<br/>${order.shipping_address}</p>
    </div>
    <div style="padding: 8px 40px 32px; text-align: center;">
      <a href="${orderUrl}" style="display: inline-block; background-color: ${COLORS.primary}; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 32px; border-radius: 50px;">track your order</a>
    </div>
    <div style="padding: 32px 40px; text-align: center; border-top: 1px solid #e5e5e5;">
      <p style="margin: 0; font-size: 13px; color: #888;">questions? <a href="mailto:hello@paperainstudio.com" style="color: ${COLORS.primary};">hello@paperainstudio.com</a></p>
      <p style="margin: 16px 0 0; font-size: 11px; color: #bbb;">&copy; ${new Date().getFullYear()} paperain studio</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const order = payload.record;

    if (!order?.shipping_email) {
      return new Response(JSON.stringify({ error: "No order data" }), { status: 400 });
    }

    if (order.status !== "confirmed") {
      return new Response(JSON.stringify({ skipped: true, reason: "not confirmed" }), { status: 200 });
    }

    if (order.receipt_sent_at) {
      return new Response(JSON.stringify({ skipped: true, reason: "already sent" }), { status: 200 });
    }

    const { data: claimed, error: claimError } = await supabase
      .from("orders")
      .update({ receipt_sent_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "confirmed")
      .is("receipt_sent_at", null)
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) {
      return new Response(JSON.stringify({ skipped: true, reason: "already claimed" }), { status: 200 });
    }

    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", order.id);

    const orderId = order.display_id || `#${String(order.id).slice(0, 8)}`;
    const html = buildEmailHtml(order, items || []);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [order.shipping_email],
        subject: `payment confirmed — ${orderId} ✿ paperain studio`,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      await supabase.from("orders").update({ receipt_sent_at: null }).eq("id", order.id);
      return new Response(JSON.stringify({ error: result }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
