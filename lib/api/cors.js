export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function applyCors(res) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

export function sendJson(res, body, status = 200) {
  applyCors(res);
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
}

/** Parse JSON body from Vercel serverless requests (string, Buffer, or object). */
export function parseRequestBody(req) {
  const raw = req.body;
  if (raw == null || raw === '') return {};
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('invalid JSON body');
  }
}
