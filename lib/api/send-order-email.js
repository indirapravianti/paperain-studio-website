import { buildOrderConfirmationEmail } from './order-email-template.js';

/**
 * Sends branded order confirmation email after payment is confirmed.
 * Uses Resend. Idempotent via receipt_sent_at on the order row.
 */
export async function sendOrderConfirmationEmail(supabase, orderId) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn('RESEND_API_KEY not set — skipping order confirmation email');
    return { ok: false, skipped: true, reason: 'not configured' };
  }

  const { data: claimed, error: claimError } = await supabase
    .from('orders')
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'confirmed')
    .is('receipt_sent_at', null)
    .select('*, order_items(*)')
    .maybeSingle();

  if (claimError) {
    console.error('receipt claim error:', claimError);
    return { ok: false, error: claimError.message };
  }

  if (!claimed) {
    return { ok: true, skipped: true, reason: 'already sent or not confirmed' };
  }

  if (!claimed.shipping_email) {
    console.error('Order has no shipping_email:', orderId);
    await supabase.from('orders').update({ receipt_sent_at: null }).eq('id', orderId);
    return { ok: false, error: 'no shipping email on order' };
  }

  const items = claimed.order_items || [];
  const { html, subject, from, replyTo, to } = buildOrderConfirmationEmail(claimed, items);

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from,
        reply_to: replyTo,
        to: [to],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('Resend fetch error:', err);
    await supabase.from('orders').update({ receipt_sent_at: null }).eq('id', orderId);
    return { ok: false, error: 'could not reach email provider' };
  }

  const result = await res.json();

  if (!res.ok) {
    console.error('Resend error:', result);
    await supabase.from('orders').update({ receipt_sent_at: null }).eq('id', orderId);
    return { ok: false, error: result.message || 'email send failed' };
  }

  return { ok: true, id: result.id };
}
