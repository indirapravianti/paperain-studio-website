import { applyCors, sendJson } from '../lib/api/cors.js';
import { getProvinces, getCities, getDistricts, getSubdistricts } from '../lib/api/kiriminaja.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(res);
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return sendJson(res, { error: 'method not allowed' }, 405);
  }

  const type = req.query?.type;

  try {
    if (type === 'province') {
      const data = await getProvinces();
      return sendJson(res, { data }, 200);
    }

    if (type === 'city') {
      const provinceId = req.query?.province_id;
      if (!provinceId) return sendJson(res, { error: 'province_id is required' }, 400);
      const data = await getCities(provinceId);
      return sendJson(res, { data }, 200);
    }

    if (type === 'district') {
      const cityId = req.query?.city_id;
      if (!cityId) return sendJson(res, { error: 'city_id is required' }, 400);
      const data = await getDistricts(cityId);
      return sendJson(res, { data }, 200);
    }

    if (type === 'subdistrict') {
      const districtId = req.query?.district_id;
      if (!districtId) return sendJson(res, { error: 'district_id is required' }, 400);
      const data = await getSubdistricts(districtId);
      return sendJson(res, { data }, 200);
    }

    return sendJson(res, { error: 'invalid type' }, 400);
  } catch (err) {
    console.error('api/kiriminaja-regions error:', err);
    const message = err instanceof Error ? err.message : 'server error';
    const status = message === 'kiriminaja is not configured' ? 503 : 502;
    return sendJson(res, { error: message }, status);
  }
}
