import { applyCors, sendJson } from '../lib/api/cors.js';
import { handleStockQuery } from '../lib/api/stock-handler.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return sendJson(res, { error: 'method not allowed' }, 405);
  }

  const idsParam = req.query?.ids || '';
  const ids = String(idsParam)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);

  const result = await handleStockQuery(ids);
  return sendJson(res, result.body, result.status);
}
