// KiriminAja account helper: register the webhook URL, plus read-only checks (tracking, payment, KA Credit).
// Usage (from repo root, reads .env for the KiriminAja token + OAuth credentials):
//   node --env-file=.env scripts/kiriminaja-set-callback.mjs check [order_id]   # read-only auth test via tracking
//   node --env-file=.env scripts/kiriminaja-set-callback.mjs register [url]
//   node --env-file=.env scripts/kiriminaja-set-callback.mjs payment <pickup_number>   # read-only payment status
//   node --env-file=.env scripts/kiriminaja-set-callback.mjs balance   # read-only KA Credit balance
//   node --env-file=.env scripts/kiriminaja-set-callback.mjs pin       # validate KIRIMINAJA_PIN from .env (counts as an attempt)
import { getCreditBalance, getPayment, setCallback, trackShipment, validatePin } from '../lib/api/kiriminaja.js';

const DEFAULT_CALLBACK_URL = 'https://www.paperainstudio.com/api/kiriminaja-webhook';

const [mode, arg] = process.argv.slice(2);

if (mode === 'check') {
  const orderId = arg || 'PPRS-261017-971234';
  console.log(JSON.stringify(await trackShipment(orderId), null, 2));
} else if (mode === 'register') {
  const url = arg || DEFAULT_CALLBACK_URL;
  console.log(`registering ${url} on ${process.env.KIRIMINAJA_BASE_URL}`);
  console.log(JSON.stringify(await setCallback(url), null, 2));
} else if (mode === 'pin') {
  // reads KIRIMINAJA_PIN from .env so the PIN never appears on the command line
  const pin = (process.env.KIRIMINAJA_PIN || '').trim();
  if (!/^\d{6}$/.test(pin)) {
    console.error('KIRIMINAJA_PIN in .env must be six digits');
    process.exit(1);
  }
  console.log(JSON.stringify(await validatePin(pin), null, 2));
} else if (mode === 'balance') {
  console.log(JSON.stringify(await getCreditBalance(), null, 2));
} else if (mode === 'payment' && arg) {
  console.log(JSON.stringify(await getPayment(arg), null, 2));
} else {
  console.error('usage: kiriminaja-set-callback.mjs check [order_id] | register [url] | payment <pickup_number> | balance | pin');
  process.exit(1);
}
