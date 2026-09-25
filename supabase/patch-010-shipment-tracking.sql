-- ============================================================
-- Patch 010: KiriminAja shipment creation, label + tracking data
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- shipment_created_at is an idempotency guard (same role as receipt_sent_at),
-- not a display timestamp — it's cleared back to null if shipment creation fails,
-- so a retry (webhook redelivery or the admin "retry" button) can attempt again.
alter table public.orders
  add column if not exists shipment_awb text,
  add column if not exists shipment_created_at timestamptz,
  add column if not exists shipment_error text,
  add column if not exists shipment_response jsonb,
  add column if not exists shipment_weight_grams integer;
