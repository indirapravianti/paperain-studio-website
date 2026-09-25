import { applyCors, parseRequestBody, sendJson } from '../lib/api/cors.js';
import { handleShippingPricing } from '../lib/api/shipping-pricing-handler.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, { error: 'method not allowed' }, 405);
  }

  try {
    const result = await handleShippingPricing(parseRequestBody(req));
    return sendJson(res, result.body, result.status);
  } catch (err) {
    console.error('api/shipping-pricing error:', err);
    const message = err instanceof Error ? err.message : 'server error';
    const status = message === 'invalid JSON body' ? 400 : 500;
    return sendJson(res, { error: message }, status);
  }
}
