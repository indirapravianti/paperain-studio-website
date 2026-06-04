import { applyCors, parseRequestBody, sendJson } from '../lib/api/cors.js';
import { handleMidtransNotification } from '../lib/api/midtrans-notification-handler.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, { error: 'method not allowed' }, 405);
  }

  try {
    const result = await handleMidtransNotification(parseRequestBody(req));
    return sendJson(res, result.body, result.status);
  } catch (err) {
    console.error('api/midtrans-notification error:', err);
    const message = err instanceof Error ? err.message : 'server error';
    return sendJson(res, { error: message }, 500);
  }
}
