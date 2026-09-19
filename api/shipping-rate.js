import { applyCors, parseRequestBody, sendJson } from '../lib/api/cors.js';
import { getShippingQuotes } from '../lib/api/shipping-rate-handler.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, { error: 'method not allowed' }, 405);
  }

  try {
    const body = parseRequestBody(req);
    const result = await getShippingQuotes({
      items: body.items,
      destinationDistrictId: body.district_id,
    });

    if (result.error) {
      return sendJson(res, { error: result.error }, result.notConfigured ? 503 : 400);
    }

    return sendJson(res, { rates: result.rates, weight_grams: result.weightGrams }, 200);
  } catch (err) {
    console.error('api/shipping-rate error:', err);
    const message = err instanceof Error ? err.message : 'server error';
    const status = message === 'invalid JSON body' ? 400 : 500;
    return sendJson(res, { error: message }, status);
  }
}
