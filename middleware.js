import { next } from '@vercel/functions';
import {
  MARKET_COOKIE,
  MARKET_ID,
  MARKET_INTL,
  addMarketPrefix,
  isIndonesiaPath,
  stripMarketPrefix,
} from './lib/market.js';

export const config = {
  matcher: ['/((?!api|_astro|images|favicon\\.ico|.*\\..*).*)'],
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function shouldSkipRedirect(pathname) {
  return (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/account')
  );
}

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const country = request.headers.get('x-vercel-ip-country') || '';
  const existingCookie = request.cookies.get(MARKET_COOKIE)?.value;

  const marketParam = url.searchParams.get('market');
  if (marketParam === MARKET_ID || marketParam === MARKET_INTL) {
    url.searchParams.delete('market');
    url.pathname = addMarketPrefix(stripMarketPrefix(pathname), marketParam);
    const response = Response.redirect(url, 302);
    response.headers.set(
      'Set-Cookie',
      `${MARKET_COOKIE}=${marketParam}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`,
    );
    return response;
  }

  const pathMarket = isIndonesiaPath(pathname) ? MARKET_ID : MARKET_INTL;

  if (
    !existingCookie &&
    country === 'ID' &&
    pathMarket === MARKET_INTL &&
    !shouldSkipRedirect(pathname)
  ) {
    url.pathname = addMarketPrefix(pathname, MARKET_ID);
    const response = Response.redirect(url, 302);
    response.headers.set(
      'Set-Cookie',
      `${MARKET_COOKIE}=${MARKET_ID}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`,
    );
    return response;
  }

  const market = pathMarket;
  const response = next({
    headers: {
      'x-paperain-market': market,
    },
  });

  if (existingCookie !== market) {
    response.cookies.set(MARKET_COOKIE, market, {
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
  }

  return response;
}
