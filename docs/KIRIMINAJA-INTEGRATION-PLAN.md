# KiriminAja integration — goal, problem, plan

Working notes so the context isn't lost between sessions. Never put API keys, secrets or passwords in this file.

## Goal

1. E-commerce site selling products (paperain studio).
2. Payments: Midtrans — working.
3. Shipping: KiriminAja — rates, shipment creation, tracking and labels are built (see `lib/api/kiriminaja*.js`); access from production is blocked, see below.
4. Hosting: Vercel with our own domain.

## The problem

KiriminAja rejected a call from Vercel:

```
{"error":"Your IP address 52.55.194.163 were not allowed to access this API. #1"}
```

Vercel serverless functions have no fixed outbound IP (that address is an AWS one Vercel happened to use). KiriminAja's support confirmed the cause: API access currently only works from **IP addresses registered (whitelisted) with them**.

## What the official docs say (checked 2026-10-10)

- developer.kiriminaja.com and the `kiriminaja/docs` repo document only `Authorization: Bearer {api_key}`. The key comes from the Sandbox Dashboard → **Integrasi** menu.
- The public docs do **not** mention OAuth, secret keys, or IP whitelisting.
- The OAuth document (auth-tdev.kiriminaja.com) was sent by KiriminAja support separately. It is not in the public docs.

## KiriminAja's answer (2026-10-10)

KiriminAja support said OAuth can be provided for serverless hosting ("Jika hosting menggunakan serverless IP kami bisa sediakan oauth namun perlu persetujuan dari tim KA"), but it needs approval from their team. So OAuth is their intended answer to the dynamic-IP problem. They have not yet said explicitly that the IP whitelist is dropped.

**Waiting on KiriminAja (requested 2026-10-10):**
1. Approval to use OAuth for our account.
2. Sandbox OAuth `api_key` + `api_secret`. These are a separate pair from the Bearer API key in Dashboard → Integrasi (that one is already in `KIRIMINAJA_TOKEN`). The "IT Support" in their doc is KiriminAja's IT support, not ours.
3. Confirmation that OAuth removes the IP whitelist requirement.
4. Which token goes in `X-OAUTH-TOKEN` (member `token` vs grant `access_token`).
5. Why every sandbox endpoint returns the "Oops" error (next section).

## Test findings (2026-10-10)

Run from a dev machine with the existing `KIRIMINAJA_TOKEN` against `https://tdev.kiriminaja.com`:

- A fake token returns `401 Unauthorized`. The real token is **not** rejected, so the token is valid and was not changed by editing the IP whitelist.
- Over IPv6 the call is blocked: `Your IP address <ipv6> were not allowed to access this API. #1`. Over IPv4, after whitelisting that address, the IP check passes. (If whitelisting a machine, give KiriminAja the address from the error message; IPv4 and IPv6 are different entries.)
- Once past the IP check, **every** endpoint (province, city, kecamatan, get_address_by_name, addresses) returns HTTP 200 with `{"status":false,"text":"Oops, terjadi kesalahan. Coba beberapa saat lagi."}`. The Vercel preview returns the same message. It is KiriminAja's own error, not from our code. Cause unknown: sandbox outage, account not fully activated, or whitelist change not propagated. Reported to KiriminAja.
- Until sandbox returns real data, nothing can be tested end to end, from Vercel or locally.

## Options

| Option | What it takes | Status |
| --- | --- | --- |
| A. OAuth (`X-OAUTH-TOKEN`) | Key + secret from KiriminAja, 4 env vars | **Chosen.** Code already in `lib/api/kiriminaja.js`, off until env vars are set. Awaiting KiriminAja approval + credentials. |
| B. Static outbound IP, then whitelist it | Vercel Static IPs (Pro/Enterprise plans only, $100/month per project plus data transfer, per Vercel docs), or a fixed-IP proxy service, or a small VPS acting as a proxy, then send that IP to KiriminAja | Not started. Fallback if A doesn't work. |
| C. Move the KiriminAja calls off Vercel to a fixed-IP server | Small VPS running only the KiriminAja calls | Not started. Most work. |

Decision order: test A once KiriminAja confirms; fall back to B.

## How to test on Vercel

Env vars must be set in Vercel for the environment you test (Preview or Production), then the deployment redeployed. Env vars only apply to deployments created after they were set.

Test URL (read-only, no side effects, calls KiriminAja once):

```
https://<deployment-url>/api/kiriminaja-regions?type=province
```

| Result | Meaning |
| --- | --- |
| `{"data":[...provinces...]}` | Auth and IP are fine. |
| `... IP address x.x.x.x were not allowed ...` | Still blocked by the whitelist. The IP shown is the Vercel egress IP for that call. |
| 401 / auth error | Wrong or missing token (or OAuth credentials). |
| 503 `kiriminaja is not configured` | `KIRIMINAJA_TOKEN` or `KIRIMINAJA_ORIGIN_DISTRICT_ID` missing in that Vercel environment. |

Run it a few times: a changing blocked IP confirms Vercel's egress is not stable.

## Env vars

See `.env.example`. OAuth vars (`KIRIMINAJA_API_KEY`, `KIRIMINAJA_API_SECRET`, `KIRIMINAJA_USERNAME`, `KIRIMINAJA_PASSWORD`, `KIRIMINAJA_AUTH_BASE_URL`) are all-or-nothing and optional.

## Unverified details in the OAuth code

- Which token KiriminAja expects in `X-OAUTH-TOKEN`: implemented as the member `token` from login; the doc only says "NEW_TOKEN_FROM_OAUTH".
- `expired_at` for grant client: doc example is 26298 with the note "on a hour"; we send 24 (`KIRIMINAJA_GRANT_EXPIRED_HOURS`).
