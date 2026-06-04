/** Midtrans helpers safe on Vercel Node serverless (no Buffer required). */

export function getSnapApiUrl() {
  const env = process.env.PUBLIC_MIDTRANS_ENV || process.env.MIDTRANS_ENV || 'sandbox';
  return env === 'production'
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
}

export function midtransBasicAuth(serverKey) {
  const token = `${serverKey}:`;
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(token);
  }
  // eslint-disable-next-line n/no-deprecated-api
  return Buffer.from(token).toString('base64');
}

export async function parseSnapResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error_message: text.slice(0, 300) };
  }
}
