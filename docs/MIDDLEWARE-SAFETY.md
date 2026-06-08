# Vercel Middleware Safety Guide

> **Why this exists:** Production returned `500 MIDDLEWARE_INVOCATION_FAILED` after adding Indonesia-only URL redirects (June 2026). This document explains the root cause and rules to prevent recurrence.

---

## What `MIDDLEWARE_INVOCATION_FAILED` Means

Vercel Edge Middleware crashed before it could return a valid response. **Every page request fails** — the entire site goes down until middleware is fixed and redeployed.

---

## Root Cause (June 2026 Incident)

| What broke | Why |
|------------|-----|
| Aggressive `/` → `/id/` redirects | Added in Indonesia-only rollout; increased redirect edge cases beyond what the stable dual-market version handled |
| `Response.redirect()` + header mutation | Redirect responses combined with cookie headers can fail in Edge runtime under certain URL/query combinations |
| `decodeURIComponent()` on cookies | Malformed cookie values throw uncaught exceptions → instant middleware crash |
| External imports (historical) | `@vercel/functions` and `./lib/market.js` imports caused crashes on Astro static deploys (fixed in `fb68466`) |

The **working** pattern (commit `fb68466`) was: self-contained file, manual cookie parsing, cookie sync only — **no blanket redirects**.

The **broken** pattern (commit `c6e3aac`) added: redirect every non-`/id/` path, redirect on any `?market=` query param — middleware became fragile.

---

## Current Safe Middleware Design

`middleware.js` is intentionally **minimal**:

1. **No `import` statements** — Edge runtime on Astro static output cannot reliably bundle Node modules.
2. **No `request.cookies` API** — parse `Cookie` header manually with try/catch.
3. **No `Response.redirect()`** — redirects are the highest-risk operation; client-side code already forces IDR.
4. **Top-level try/catch** — any unexpected error falls through to `passThrough()` so the site stays up.
5. **Only sets `paperain-market=id` cookie** when missing — keeps cookie in sync without routing side effects.

Indonesia-only pricing is enforced in `src/layouts/Layout.astro` via `getCurrency() → 'IDR'`. Middleware is **not required** for IDR display.

---

## Rules — Never Break These

### Must do

- [ ] Keep `middleware.js` **fully self-contained** (all logic inline).
- [ ] Wrap `decodeURIComponent` and the main handler in **try/catch**.
- [ ] Use `new Response(null, { status: 200, headers: { 'x-middleware-next': '1' } })` to pass through — never `@vercel/functions` `next()`.
- [ ] Run `npm run build` locally before pushing middleware changes.
- [ ] After deploy, smoke-test `https://www.paperainstudio.com/` and `/products` immediately.

### Must not do

- [ ] **No imports** from `lib/`, `@vercel/functions`, or npm packages in `middleware.js`.
- [ ] **No `request.cookies.get()`** — use manual header parsing.
- [ ] **No blanket redirects** without extensive loop testing on Vercel preview.
- [ ] **No middleware changes** bundled with unrelated features without a dedicated deploy check.

---

## Before Adding Redirects Again

If dual-market `/` ↔ `/id/` redirects are needed (see `docs/REACTIVATE-INTERNATIONAL.md`):

1. Restore from `src/components/archived/middleware-dual-market.js` — **not** the aggressive Indonesia-only redirect version.
2. Add try/catch around the entire `middleware()` function.
3. Add safe `getCookie()` with try/catch on `decodeURIComponent`.
4. Use `Response.redirect(url.toString(), 302)` (string, not URL object).
5. Test on **Vercel Preview** with these URLs before merging to `main`:
   - `/`
   - `/products`
   - `/id/products`
   - `/auth/signin`
   - `/account`
   - `/?market=intl`
   - `/id/products?market=id`
6. Confirm no redirect loops (browser network tab should show ≤ 1 redirect per page).

---

## Emergency Rollback

If middleware breaks production again:

```bash
# Option A: minimal safe middleware (current default)
git checkout main -- middleware.js   # after fix is merged

# Option B: disable middleware entirely (site works, no cookie sync)
# Rename or delete middleware.js, commit, push — Vercel skips middleware
```

Client-side IDR pricing in `Layout.astro` keeps the store functional even with middleware disabled.

---

## File Reference

| File | Purpose |
|------|---------|
| `middleware.js` | Production — minimal cookie sync only |
| `src/components/archived/middleware-dual-market.js` | Archived dual-market with geo redirect |
| `docs/REACTIVATE-INTERNATIONAL.md` | Full international market restore guide |
| `.cursor/rules/vercel-middleware.mdc` | AI agent guardrails |

---

## Incident Timeline

| Date | Commit | Result |
|------|--------|--------|
| Jun 7 2026 | `fb68466` | Fixed crash — removed imports, inline cookie parse |
| Jun 8 2026 | `c6e3aac` | **Broke production** — added aggressive `/id/` redirects |
| Jun 8 2026 | (this fix) | Restored minimal crash-safe middleware |

---

*Last updated: June 2026*
