/**
 * Vercel Edge Middleware — Indonesia market cookie (minimal, crash-safe)
 *
 * IMPORTANT: Keep this file self-contained. No imports. No redirects.
 * Redirect logic caused MIDDLEWARE_INVOCATION_FAILED on production (June 2026).
 * See docs/MIDDLEWARE-SAFETY.md
 *
 * Indonesia-only pricing is enforced client-side in Layout.astro (getCurrency → IDR).
 * To re-enable dual-market URL redirects, see docs/REACTIVATE-INTERNATIONAL.md
 */

export const config = {
  matcher: ['/((?!api|_astro|images|favicon\\.ico|.*\\..*).*)'],
};

const MARKET_COOKIE = 'paperain-market';
const MARKET_ID = 'id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookie(request, name) {
  try {
    const header = request.headers.get('cookie') || '';
    const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
    if (!match) return undefined;
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

function passThrough() {
  return new Response(null, { status: 200, headers: { 'x-middleware-next': '1' } });
}

function setMarketCookie() {
  const headers = new Headers({ 'x-middleware-next': '1' });
  headers.set(
    'Set-Cookie',
    MARKET_COOKIE + '=' + MARKET_ID + '; Path=/; Max-Age=' + COOKIE_MAX_AGE + '; SameSite=Lax',
  );
  return new Response(null, { status: 200, headers });
}

export default function middleware(request) {
  try {
    const existingCookie = getCookie(request, MARKET_COOKIE);
    if (existingCookie === MARKET_ID) {
      return passThrough();
    }
    return setMarketCookie();
  } catch {
    return passThrough();
  }
}
