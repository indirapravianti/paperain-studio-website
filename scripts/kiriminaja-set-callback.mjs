// One-off: register the KiriminAja webhook URL for this account.
// Usage (from repo root, reads .env for the KiriminAja token + OAuth credentials):
//   node --env-file=.env scripts/kiriminaja-set-callback.mjs check [order_id]   # read-only auth test via tracking
//   node --env-file=.env scripts/kiriminaja-set-callback.mjs register [url]
import { setCallback, trackShipment } from '../lib/api/kiriminaja.js';

const DEFAULT_CALLBACK_URL = 'https://www.paperainstudio.com/api/kiriminaja-webhook';

const [mode, arg] = process.argv.slice(2);

if (mode === 'check') {
  const orderId = arg || 'PPRS-261017-971234';
  console.log(JSON.stringify(await trackShipment(orderId), null, 2));
} else if (mode === 'register') {
  const url = arg || DEFAULT_CALLBACK_URL;
  console.log(`registering ${url} on ${process.env.KIRIMINAJA_BASE_URL}`);
  console.log(JSON.stringify(await setCallback(url), null, 2));
} else {
  console.error('usage: kiriminaja-set-callback.mjs check [order_id] | register [url]');
  process.exit(1);
}
