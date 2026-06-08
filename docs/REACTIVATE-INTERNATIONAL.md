# Reactivating International (USD) Market Features

> **Status:** International market is **disabled** (June 2026). The store currently operates Indonesia-only with IDR pricing.  
> **Purpose:** Step-by-step guide to restore dual-market (USD + IDR) when ready.

---

## What Was Disabled

| Feature | Active file | Archived / stash location |
|---------|-------------|---------------------------|
| Region switcher (navbar) | Removed from `src/components/Navbar.astro` | Original: `src/components/RegionSwitcher.astro` |
| Dual-market middleware | `middleware.js` (Indonesia-only) | `src/components/archived/middleware-dual-market.js` |
| International payment disclosure | Removed from `src/pages/payment.astro` | `src/components/archived/IntlCurrencyNotice.astro` |
| USD pricing display | Client forced to IDR in `src/layouts/Layout.astro` | Restore `getMarket()` / `getCurrency()` logic |
| USD volume discount ($50) | Still in server code, unused on client | `lib/market.js` → `VOLUME_DISCOUNT_THRESHOLD_USD` |

---

## Current Indonesia-Only Settings

| Setting | Value | File(s) |
|---------|-------|---------|
| Currency | IDR only | `Layout.astro`, `checkout.astro`, `payment.astro` |
| Volume discount threshold | Rp 80.000 (20% off) | `lib/market.js`, `lib/api/pricing.js`, `src/lib/idr-prices.js` |
| Category IDR prices | sticker Rp13k, keychain Rp20k, griptok Rp27k, art print Rp10k, greeting card Rp14k, postcard Rp10k, phonestrap Rp22k | `lib/api/region-pricing.js`, `src/lib/idr-prices.js` |
| Shipping | Indonesia only at checkout | `src/pages/checkout.astro` |
| URL prefix | All visitors redirected to `/id/...` | `middleware.js` |

---

## Reactivation Checklist

### 1. Restore dual-market middleware

Replace the contents of `middleware.js` with the archived version:

```bash
cp src/components/archived/middleware-dual-market.js middleware.js
```

This re-enables:
- Geo-based redirect (Indonesia IP → `/id/`)
- `?market=id` / `?market=intl` manual override
- Cookie sync (`paperain-market` = `intl` | `id`)

### 2. Restore region switcher in navbar

In `src/components/Navbar.astro`, re-add:

```astro
import RegionSwitcher from './RegionSwitcher.astro';
```

And place `<RegionSwitcher />` in the right-side nav (before the cart button).

### 3. Restore client market detection

In `src/layouts/Layout.astro`, revert `getMarket()` and `getCurrency()` to read the cookie / URL path:

```javascript
function getMarket() {
  var match = document.cookie.match(/(?:^|;\s*)paperain-market=([^;]+)/);
  if (match) return match[1];
  return window.location.pathname === '/id' || window.location.pathname.startsWith('/id/') ? 'id' : 'intl';
}

function getCurrency() {
  return getMarket() === 'id' ? 'IDR' : 'USD';
}
```

### 4. Restore international payment notice

In `src/pages/payment.astro`:

1. Import or paste the markup from `src/components/archived/IntlCurrencyNotice.astro` before the pay button.
2. Restore the `currency-ack` checkbox validation and `pay-btn` disabled state for USD orders.
3. Restore `isIdrStore` logic and IDR estimate display for international buyers.

### 5. Re-enable international shipping

In `src/pages/checkout.astro`:

- Remove or soften the "Indonesia only" banner and validation (`countryCode !== 'ID'` block).
- Remove the `intl-shipping-warning` element if air mail is live.

### 6. Update promo banners (optional)

If international returns, update:
- `src/components/AnnouncementBar.astro` — dual messages or market-aware text
- `src/pages/index.astro` CTA banner — USD $50 threshold for international visitors

### 7. Redeploy

After any env or routing change, redeploy on Vercel. Test both paths:

- `https://www.paperainstudio.com/products` → USD
- `https://www.paperainstudio.com/id/products` → IDR

---

## Server-Side Pricing (unchanged)

The API layer still supports both currencies:

- `lib/api/region-pricing.js` — `getUnitPrice()` for USD and IDR
- `lib/api/place-order-handler.js` — recalculates from DB/catalog
- `lib/api/create-payment-handler.js` — USD → IDR conversion for Midtrans (`USD_TO_IDR = 16000`)

No API changes are required to reactivate international checkout — only frontend + middleware.

---

## SEO / hreflang

`Layout.astro` already includes hreflang alternates for `en` and `id`. These remain valid when dual-market is restored.

---

*Last updated: June 2026*
