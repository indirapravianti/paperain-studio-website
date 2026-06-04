-- ============================================================
-- PATCH 005: Run once in Supabase Dashboard > SQL Editor
-- Applies promo + Midtrans payment columns (patches 003 + 004)
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_discount numeric(12,2) DEFAULT 0;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_token text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_type text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS midtrans_transaction_id text;
