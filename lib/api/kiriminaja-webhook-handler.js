/** Receives shipment status events from KiriminAja (AWB created, shipped, delivered, returned, etc.).
 * Docs: https://developer.kiriminaja.com/docs/webhook/event
 *
 * Order/AWB tracking isn't wired up yet (shipment creation via request_pickup happens in a
 * later step, after payment). For now this just authenticates and acknowledges the event so
 * the webhook URL required at API-key setup is live; extend this once shipment creation exists.
 */
export async function handleKiriminajaWebhook(authHeader, body) {
  const token = process.env.KIRIMINAJA_TOKEN;
  if (!token) {
    return { status: 503, body: { error: 'not configured' } };
  }

  if (authHeader !== `Bearer ${token}`) {
    console.error('kiriminaja webhook: invalid or missing bearer token');
    return { status: 403, body: { error: 'invalid token' } };
  }

  console.log('kiriminaja webhook event:', body?.method, JSON.stringify(body?.data));

  return { status: 200, body: { message: 'ok' } };
}
