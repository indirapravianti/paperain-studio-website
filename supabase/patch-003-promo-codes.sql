-- ============================================================
-- PATCH 003: Promo codes (server-validated at checkout)
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Promo codes are managed via SQL / Supabase dashboard only (no public API).
-- Checkout validates codes through the place-order Edge Function.

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code text PRIMARY KEY,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  min_subtotal numeric(12,2) NOT NULL DEFAULT 0,
  max_uses int,
  used_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  valid_from timestamptz,
  valid_until timestamptz,
  currency text CHECK (currency IS NULL OR currency IN ('USD', 'IDR')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (Edge Functions) can read/write promo codes.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_discount numeric(12,2) DEFAULT 0;

-- Example (do NOT run until you want an active code):
-- INSERT INTO public.promo_codes (code, description, discount_type, discount_value, min_subtotal, max_uses, active)
-- VALUES ('WELCOME10', '10% off first order', 'percent', 10, 0, 100, true);
