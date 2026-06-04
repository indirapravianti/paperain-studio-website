const SITE_URL = process.env.SITE_URL || 'https://www.paperainstudio.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'orders@paperainstudio.com';

const COLORS = {
  primary: '#43302E',
  pastelBlue: '#C1DBE8',
  buttermilk: '#FFF1B5',
  bg: '#f7f7f5',
  muted: '#666666',
  green: '#16a34a',
};

const USD_TO_IDR = 16000;

function fmt(val, currency) {
  if (currency === 'IDR') return `Rp${Math.round(val).toLocaleString('id-ID')}`;
  return `$${Number(val).toFixed(2)}`;
}

function fmtIdrFromUsd(usd) {
  return `Rp${Math.round(Number(usd) * USD_TO_IDR).toLocaleString('id-ID')}`;
}

function buildDiscountRows(order) {
  if (Number(order.discount) <= 0) return '';

  const promoDiscount = Number(order.promo_discount) || 0;
  const volumeDiscount = Number(order.discount) - promoDiscount;
  let rows = '';

  if (volumeDiscount > 0) {
    rows += `<tr>
      <td style="padding: 4px 0; color: ${COLORS.green};">discount (20%)</td>
      <td style="padding: 4px 0; text-align: right; color: ${COLORS.green};">-${fmt(volumeDiscount, order.currency)}</td>
    </tr>`;
  }
  if (promoDiscount > 0 && order.promo_code) {
    rows += `<tr>
      <td style="padding: 4px 0; color: ${COLORS.green};">promo (${order.promo_code})</td>
      <td style="padding: 4px 0; text-align: right; color: ${COLORS.green};">-${fmt(promoDiscount, order.currency)}</td>
    </tr>`;
  }
  if (!rows && Number(order.discount) > 0) {
    rows = `<tr>
      <td style="padding: 4px 0; color: ${COLORS.green};">discount</td>
      <td style="padding: 4px 0; text-align: right; color: ${COLORS.green};">-${fmt(order.discount, order.currency)}</td>
    </tr>`;
  }
  return rows;
}

function imageUrl(image) {
  if (!image) return '';
  return image.startsWith('http') ? image : `${SITE_URL}${image}`;
}

export function buildOrderConfirmationEmail(order, items) {
  const orderId = order.display_id || `#${order.id.slice(0, 8)}`;
  const orderUrl = `${SITE_URL}/account/order?id=${order.id}`;
  const firstName = (order.shipping_name || 'there').split(' ')[0].toLowerCase();
  const totalItems = (items || []).reduce((sum, item) => sum + item.quantity, 0);
  const isUsd = order.currency === 'USD';

  const itemRowsHtml = (items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${
              item.image
                ? `<img src="${imageUrl(item.image)}" alt="${item.title}" width="56" height="56" style="width: 56px; height: 56px; object-fit: cover; border-radius: 8px; display: block;" />`
                : ''
            }
            <div>
              <p style="margin: 0; font-size: 14px; color: ${COLORS.primary}; font-weight: 500;">${item.title}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #888;">qty: ${item.quantity}</p>
            </div>
          </div>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right; vertical-align: top; font-size: 14px; color: ${COLORS.primary}; font-weight: 500;">
          ${fmt(item.price * item.quantity, order.currency)}
        </td>
      </tr>`,
    )
    .join('');

  const currencyNote = isUsd
    ? `<div style="margin: 0 40px 24px; background-color: ${COLORS.pastelBlue}33; border: 1px solid ${COLORS.pastelBlue}; border-radius: 12px; padding: 16px 20px;">
        <p style="margin: 0; font-size: 12px; color: ${COLORS.primary}; line-height: 1.6;">
          <strong>payment note:</strong> your card was charged in Indonesian Rupiah (IDR) at approximately
          <strong>${fmtIdrFromUsd(order.total)}</strong>.
          Prices above are shown in USD for reference. Your bank may display the final amount in your local currency using their exchange rate.
        </p>
      </div>`
    : '';

  const paymentBadge = order.payment_type
    ? `<span style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; text-transform: lowercase;">paid · ${order.payment_type.replace(/_/g, ' ')}</span>`
    : `<span style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; text-transform: lowercase;">payment received</span>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

    <div style="background-color: ${COLORS.pastelBlue}; padding: 32px 40px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 28px; line-height: 1;">✿</p>
      <h1 style="margin: 0; font-size: 22px; color: ${COLORS.primary}; font-weight: 600; letter-spacing: -0.3px;">paperain studio</h1>
      <p style="margin: 8px 0 0; font-size: 13px; color: ${COLORS.primary}; opacity: 0.7;">payment confirmed</p>
    </div>

    <div style="padding: 32px 40px 24px;">
      <p style="margin: 0; font-size: 15px; color: ${COLORS.primary}; line-height: 1.6;">
        hi ${firstName},
      </p>
      <p style="margin: 12px 0 0; font-size: 14px; color: ${COLORS.muted}; line-height: 1.6;">
        thank you for your order! we've received your payment and will start preparing your pieces with care. here's your receipt:
      </p>
      <p style="margin: 16px 0 0;">${paymentBadge}</p>
    </div>

    <div style="margin: 0 40px; background-color: ${COLORS.buttermilk}; border-radius: 12px; padding: 20px 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="font-size: 12px; color: ${COLORS.primary}; opacity: 0.6; padding-bottom: 4px;">order id</td>
          <td style="font-size: 12px; color: ${COLORS.primary}; opacity: 0.6; padding-bottom: 4px; text-align: right;">date</td>
        </tr>
        <tr>
          <td style="font-size: 14px; color: ${COLORS.primary}; font-weight: 600;">${orderId}</td>
          <td style="font-size: 14px; color: ${COLORS.primary}; font-weight: 500; text-align: right;">${new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        </tr>
      </table>
    </div>

    <div style="padding: 24px 40px;">
      <h2 style="margin: 0 0 16px; font-size: 14px; color: ${COLORS.primary}; font-weight: 600; text-transform: lowercase;">items ordered (${totalItems} item${totalItems > 1 ? 's' : ''})</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemRowsHtml}
      </table>
    </div>

    <div style="margin: 0 40px; border-top: 2px solid #f0f0f0; padding: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0; color: #888;">subtotal</td>
          <td style="padding: 4px 0; text-align: right; color: ${COLORS.primary};">${fmt(order.subtotal, order.currency)}</td>
        </tr>
        ${buildDiscountRows(order)}
        <tr>
          <td style="padding: 4px 0; color: #888;">shipping</td>
          <td style="padding: 4px 0; text-align: right; color: ${COLORS.primary};">${Number(order.shipping_fee) === 0 ? 'free' : fmt(order.shipping_fee, order.currency)}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0 0; font-weight: 700; font-size: 16px; color: ${COLORS.primary}; border-top: 1px solid #e5e5e5;">total</td>
          <td style="padding: 12px 0 0; font-weight: 700; font-size: 16px; color: ${COLORS.primary}; text-align: right; border-top: 1px solid #e5e5e5;">${fmt(order.total, order.currency)}</td>
        </tr>
        ${
          isUsd
            ? `<tr>
          <td colspan="2" style="padding: 8px 0 0; font-size: 12px; color: #888; text-align: right;">≈ ${fmtIdrFromUsd(order.total)} charged via midtrans</td>
        </tr>`
            : ''
        }
      </table>
    </div>

    ${currencyNote}

    <div style="margin: 0 40px; background-color: #f9f9f7; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 13px; color: ${COLORS.primary}; font-weight: 600; text-transform: lowercase;">shipping details</h3>
      <p style="margin: 0; font-size: 13px; color: #555; line-height: 1.7;">
        ${order.shipping_name}<br/>
        ${order.shipping_phone}<br/>
        ${order.shipping_address}
      </p>
    </div>

    <div style="padding: 8px 40px 32px; text-align: center;">
      <a href="${orderUrl}" style="display: inline-block; background-color: ${COLORS.primary}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 32px; border-radius: 50px; letter-spacing: -0.2px;">
        track your order
      </a>
    </div>

    <div style="margin: 0 40px; border-top: 1px solid #e5e5e5;"></div>

    <div style="padding: 32px 40px; text-align: center;">
      <p style="margin: 0 0 16px; font-size: 13px; color: #888; line-height: 1.6;">
        questions about your order?<br/>reach us at
        <a href="mailto:hello@paperainstudio.com" style="color: ${COLORS.primary}; text-decoration: underline;">hello@paperainstudio.com</a>
      </p>
      <div style="margin-top: 20px;">
        <a href="https://instagram.com/paperainstudio" style="display: inline-block; margin: 0 8px; color: ${COLORS.primary}; text-decoration: none; font-size: 12px;">instagram</a>
        <span style="color: #ccc;">·</span>
        <a href="https://shopee.co.id/paperainstudio" style="display: inline-block; margin: 0 8px; color: ${COLORS.primary}; text-decoration: none; font-size: 12px;">shopee</a>
        <span style="color: #ccc;">·</span>
        <a href="https://tokopedia.com/paperainstudio" style="display: inline-block; margin: 0 8px; color: ${COLORS.primary}; text-decoration: none; font-size: 12px;">tokopedia</a>
      </div>
      <p style="margin: 16px 0 0; font-size: 11px; color: #bbb;">&copy; ${new Date().getFullYear()} paperain studio. all rights reserved.</p>
    </div>

  </div>
</body>
</html>`;

  const subject = `payment confirmed — ${orderId} ✿ paperain studio`;

  return { html, subject, from: FROM_EMAIL, to: order.shipping_email };
}

export { SITE_URL, FROM_EMAIL, USD_TO_IDR, fmtIdrFromUsd };
