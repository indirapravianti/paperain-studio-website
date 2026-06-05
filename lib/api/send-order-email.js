import { buildOrderConfirmationEmail } from './order-email-template.js';

function isMissingColumnError(error) {
  return error?.code === 'PGRST204';
}

async function clearReceiptClaim(supabase, orderId) {
  const { error } = await supabase
    .from('orders')
    .update({ receipt_sent_at: null })
    .eq('id', orderId);

  if (error && isMissingColumnError(error)) return;
  if (error) console.warn('Could not clear receipt_sent_at:', error.message);
}

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

  let claimed = null;
  let idempotencyEnabled = true;

  const { data: claimedRow, error: claimError } = await supabase
    .from('orders')
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'confirmed')
    .is('receipt_sent_at', null)
    .select('*, order_items(*)')
    .maybeSingle();

  if (claimError) {
    if (!isMissingColumnError(claimError)) {
      console.error('receipt claim error:', claimError);
      return { ok: false, error: claimError.message };
    }

    console.warn(
      'receipt_sent_at column missing — run supabase/patch-007-run-all-pending.sql. Sending without duplicate guard.',
    );
    idempotencyEnabled = false;

    const { data: orderRow, error: fetchError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (fetchError) {
      console.error('order fetch error:', fetchError);
      return { ok: false, error: fetchError.message };
    }

    claimed = orderRow;
  } else {
    claimed = claimedRow;
  }

  if (!claimed) {
    return { ok: true, skipped: true, reason: 'already sent or not confirmed' };
  }

  if (!claimed.shipping_email) {
    console.error('Order has no shipping_email:', orderId);
    if (idempotencyEnabled) await clearReceiptClaim(supabase, orderId);
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
    if (idempotencyEnabled) await clearReceiptClaim(supabase, orderId);
    return { ok: false, error: 'could not reach email provider' };
  }

  const result = await res.json();

  if (!res.ok) {
    console.error('Resend error:', result);
    if (idempotencyEnabled) await clearReceiptClaim(supabase, orderId);
    return { ok: false, error: result.message || 'email send failed' };
  }

  return { ok: true, id: result.id };
}
