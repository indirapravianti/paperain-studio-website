-- ============================================================
-- Patch 007: Run ALL pending DB updates in one go
-- Supabase Dashboard → SQL Editor → paste & run
-- ============================================================
-- Fixes Vercel errors like:
--   "Could not find the 'midtrans_transaction_id' column"
--   "Could not find the 'payment_token' column"
--   "Could not find the 'receipt_sent_at' column"

-- Promo columns (patch 003/005)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_discount numeric(12,2) DEFAULT 0;

-- Midtrans payment columns (patch 004/005)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_token text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_type text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS midtrans_transaction_id text;

-- Order confirmation email tracking (patch 006)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz;

COMMENT ON COLUMN public.orders.receipt_sent_at IS
  'Timestamp when payment confirmation email was sent (via Resend). Prevents duplicate emails.';
