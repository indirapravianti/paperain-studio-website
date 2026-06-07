/**
 * Vercel Edge Middleware — dual-market routing (Indonesia / international)
 * Self-contained: no external imports (Edge runtime compatibility)
 */

export const config = {
  matcher: ['/((?!api|_astro|images|favicon\\.ico|.*\\..*).*)'],
};

const MARKET_COOKIE = 'paperain-market';
const MARKET_ID = 'id';
const MARKET_INTL = 'intl';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function isIndonesiaPath(pathname) {
  return pathname === '/id' || pathname.startsWith('/id/');
}

function stripMarketPrefix(pathname) {
  if (pathname === '/id') return '/';
  if (pathname.startsWith('/id/')) return pathname.slice(3) || '/';
  return pathname;
}

function addMarketPrefix(pathname, market) {
  const base = stripMarketPrefix(pathname);
  if (market === MARKET_ID) {
    return base === '/' ? '/id' : '/id' + base;
  }
  return base;
}

function shouldSkipRedirect(pathname) {
  return (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/account')
  );
}

function continueWithCookie(market) {
  const headers = new Headers({ 'x-middleware-next': '1' });
  headers.set(
    'Set-Cookie',
    MARKET_COOKIE + '=' + market + '; Path=/; Max-Age=' + COOKIE_MAX_AGE + '; SameSite=Lax',
  );
  return new Response(null, { status: 200, headers });
}

function redirectWithCookie(url, market) {
  const response = Response.redirect(url, 302);
  response.headers.set(
    'Set-Cookie',
    MARKET_COOKIE + '=' + market + '; Path=/; Max-Age=' + COOKIE_MAX_AGE + '; SameSite=Lax',
  );
  return response;
}

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const country = request.headers.get('x-vercel-ip-country') || '';
  const existingCookie = getCookie(request, MARKET_COOKIE);

  const marketParam = url.searchParams.get('market');
  if (marketParam === MARKET_ID || marketParam === MARKET_INTL) {
    url.searchParams.delete('market');
    url.pathname = addMarketPrefix(stripMarketPrefix(pathname), marketParam);
    return redirectWithCookie(url, marketParam);
  }

  const pathMarket = isIndonesiaPath(pathname) ? MARKET_ID : MARKET_INTL;

  if (
    !existingCookie &&
    country === 'ID' &&
    pathMarket === MARKET_INTL &&
    !shouldSkipRedirect(pathname)
  ) {
    url.pathname = addMarketPrefix(pathname, MARKET_ID);
    return redirectWithCookie(url, MARKET_ID);
  }

  if (existingCookie !== pathMarket) {
    return continueWithCookie(pathMarket);
  }

  return new Response(null, { status: 200, headers: { 'x-middleware-next': '1' } });
}
