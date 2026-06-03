import { applyCors, sendJson } from '../lib/api/cors.js';
import { handleCreatePayment } from '../lib/api/create-payment-handler.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, { error: 'method not allowed' }, 405);
  }

  try {
    const result = await handleCreatePayment(req.body);
    return sendJson(res, result.body, result.status);
  } catch (err) {
    console.error('api/create-payment error:', err);
    const message = err instanceof Error ? err.message : 'server error';
    return sendJson(res, { error: message }, 500);
  }
}
