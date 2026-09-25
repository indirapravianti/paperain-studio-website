/** Free geocoding via OpenStreetMap Nominatim — best-effort, no API key required. */
export async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&q=${encodeURIComponent(query)}`;

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'paperain-studio-website (orders@paperainstudio.com)' },
    });
  } catch (err) {
    console.error('geocoding fetch error:', err);
    return null;
  }

  if (!res.ok) return null;

  const results = await res.json();
  if (!results?.length) return null;

  return { lat: Number(results[0].lat), lon: Number(results[0].lon) };
}
