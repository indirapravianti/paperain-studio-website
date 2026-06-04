-- ============================================================
-- Patch 006: Order confirmation email tracking
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz;

COMMENT ON COLUMN public.orders.receipt_sent_at IS
  'Timestamp when payment confirmation email was sent (via Resend). Prevents duplicate emails.';
