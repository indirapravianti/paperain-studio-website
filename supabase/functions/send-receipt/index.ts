import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://paperainstudio.com";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "orders@paperainstudio.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const payload = await req.json();
    const order = payload.record;

    if (!order || !order.shipping_email) {
      return new Response(JSON.stringify({ error: "No order data" }), { status: 400 });
    }

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    const orderId = order.display_id || `#${order.id.slice(0, 8)}`;
    const orderUrl = `${SITE_URL}/account/order?id=${order.id}`;
    const totalItems = (items || []).reduce((sum: number, i: any) => sum + i.quantity, 0);

    const currencySymbol = order.currency === "IDR" ? "Rp" : "$";
    const fmt = (val: number) => {
      if (order.currency === "IDR") return `Rp${Math.round(val).toLocaleString("id-ID")}`;
      return `$${Number(val).toFixed(2)}`;
    };

    const itemRowsHtml = (items || [])
      .map(
        (item: any) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${
              item.image
                ? `<img src="${item.image.startsWith("http") ? item.image : SITE_URL + item.image}" alt="${item.title}" style="width: 56px; height: 56px; object-fit: cover; border-radius: 8px;" />`
                : ""
            }
            <div>
              <p style="margin: 0; font-size: 14px; color: #43302E; font-weight: 500;">${item.title}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #888;">qty: ${item.quantity}</p>
            </div>
          </div>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right; vertical-align: top; font-size: 14px; color: #43302E; font-weight: 500;">
          ${fmt(item.price * item.quantity)}
        </td>
      </tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin: 0; padding: 0; background-color: #f7f7f5; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

    <!-- Header -->
    <div style="background-color: #C1DBE8; padding: 32px 40px; text-align: center;">
      <h1 style="margin: 0; font-size: 22px; color: #43302E; font-weight: 600; letter-spacing: -0.3px;">paperain studio</h1>
      <p style="margin: 8px 0 0; font-size: 13px; color: #43302E; opacity: 0.7;">order confirmation</p>
    </div>

    <!-- Greeting -->
    <div style="padding: 32px 40px 24px;">
      <p style="margin: 0; font-size: 15px; color: #43302E; line-height: 1.6;">
        hi ${order.shipping_name.split(" ")[0].toLowerCase()},
      </p>
      <p style="margin: 12px 0 0; font-size: 14px; color: #666; line-height: 1.6;">
        thank you for your order! we've received it and will start preparing it soon. here's your receipt:
      </p>
    </div>

    <!-- Order Info Card -->
    <div style="margin: 0 40px; background-color: #FFF1B5; border-radius: 12px; padding: 20px 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="font-size: 12px; color: #43302E; opacity: 0.6; padding-bottom: 4px;">order id</td>
          <td style="font-size: 12px; color: #43302E; opacity: 0.6; padding-bottom: 4px; text-align: right;">date</td>
        </tr>
        <tr>
          <td style="font-size: 14px; color: #43302E; font-weight: 600;">${orderId}</td>
          <td style="font-size: 14px; color: #43302E; font-weight: 500; text-align: right;">${new Date(order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    <div style="padding: 24px 40px;">
      <h2 style="margin: 0 0 16px; font-size: 14px; color: #43302E; font-weight: 600; text-transform: lowercase;">items ordered (${totalItems} item${totalItems > 1 ? "s" : ""})</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemRowsHtml}
      </table>
    </div>

    <!-- Totals -->
    <div style="margin: 0 40px; border-top: 2px solid #f0f0f0; padding: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0; color: #888;">subtotal</td>
          <td style="padding: 4px 0; text-align: right; color: #43302E;">${fmt(order.subtotal)}</td>
        </tr>
        ${
          Number(order.discount) > 0
            ? (() => {
                const promoDiscount = Number(order.promo_discount) || 0;
                const volumeDiscount = Number(order.discount) - promoDiscount;
                let rows = "";
                if (volumeDiscount > 0) {
                  rows += `<tr>
          <td style="padding: 4px 0; color: #16a34a;">discount (20%)</td>
          <td style="padding: 4px 0; text-align: right; color: #16a34a;">-${fmt(volumeDiscount)}</td>
        </tr>`;
                }
                if (promoDiscount > 0 && order.promo_code) {
                  rows += `<tr>
          <td style="padding: 4px 0; color: #16a34a;">promo (${order.promo_code})</td>
          <td style="padding: 4px 0; text-align: right; color: #16a34a;">-${fmt(promoDiscount)}</td>
        </tr>`;
                }
                if (!rows && Number(order.discount) > 0) {
                  rows = `<tr>
          <td style="padding: 4px 0; color: #16a34a;">discount</td>
          <td style="padding: 4px 0; text-align: right; color: #16a34a;">-${fmt(order.discount)}</td>
        </tr>`;
                }
                return rows;
              })()
            : ""
        }
        <tr>
          <td style="padding: 4px 0; color: #888;">shipping</td>
          <td style="padding: 4px 0; text-align: right; color: #43302E;">${Number(order.shipping_fee) === 0 ? "free" : fmt(order.shipping_fee)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0 0; font-weight: 700; font-size: 16px; color: #43302E; border-top: 1px solid #e5e5e5;">total</td>
          <td style="padding: 12px 0 0; font-weight: 700; font-size: 16px; color: #43302E; text-align: right; border-top: 1px solid #e5e5e5;">${fmt(order.total)}</td>
        </tr>
      </table>
    </div>

    <!-- Shipping Info -->
    <div style="margin: 0 40px; background-color: #f9f9f7; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 13px; color: #43302E; font-weight: 600; text-transform: lowercase;">shipping details</h3>
      <p style="margin: 0; font-size: 13px; color: #555; line-height: 1.7;">
        ${order.shipping_name}<br/>
        ${order.shipping_phone}<br/>
        ${order.shipping_address}
      </p>
    </div>

    <!-- CTA Button -->
    <div style="padding: 8px 40px 32px; text-align: center;">
      <a href="${orderUrl}" style="display: inline-block; background-color: #43302E; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 32px; border-radius: 50px; letter-spacing: -0.2px;">
        check your order
      </a>
    </div>

    <!-- Divider -->
    <div style="margin: 0 40px; border-top: 1px solid #e5e5e5;"></div>

    <!-- Footer -->
    <div style="padding: 32px 40px; text-align: center;">
      <p style="margin: 0 0 16px; font-size: 13px; color: #888; line-height: 1.6;">
        if you have any questions regarding your order,<br/>feel free to contact us at
        <a href="mailto:hello@paperainstudio.com" style="color: #43302E; text-decoration: underline;">hello@paperainstudio.com</a>
      </p>
      <div style="margin-top: 20px;">
        <a href="https://instagram.com/paperainstudio" style="display: inline-block; margin: 0 8px; color: #43302E; text-decoration: none; font-size: 12px;">instagram</a>
        <span style="color: #ccc;">·</span>
        <a href="https://shopee.co.id/paperainstudio" style="display: inline-block; margin: 0 8px; color: #43302E; text-decoration: none; font-size: 12px;">shopee</a>
        <span style="color: #ccc;">·</span>
        <a href="https://tokopedia.com/paperainstudio" style="display: inline-block; margin: 0 8px; color: #43302E; text-decoration: none; font-size: 12px;">tokopedia</a>
      </div>
      <p style="margin: 16px 0 0; font-size: 11px; color: #bbb;">&copy; ${new Date().getFullYear()} paperain studio. all rights reserved.</p>
    </div>

  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [order.shipping_email],
        subject: `order confirmed — ${orderId} ✿ paperain studio`,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: result }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
