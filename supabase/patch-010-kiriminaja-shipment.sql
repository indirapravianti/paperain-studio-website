-- ============================================================
-- Patch 010: KiriminAja shipment creation — AWB + tracking state
-- Supabase Dashboard → SQL Editor → paste & run
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_subdistrict text,
  ADD COLUMN IF NOT EXISTS shipping_kelurahan_id int,
  ADD COLUMN IF NOT EXISTS shipping_latitude numeric,
  ADD COLUMN IF NOT EXISTS shipping_longitude numeric,
  ADD COLUMN IF NOT EXISTS kiriminaja_awb text,
  ADD COLUMN IF NOT EXISTS kiriminaja_pickup_number text,
  ADD COLUMN IF NOT EXISTS kiriminaja_status text,
  ADD COLUMN IF NOT EXISTS kiriminaja_error text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

COMMENT ON COLUMN public.orders.shipping_kelurahan_id IS
  'KiriminAja kelurahan (subdistrict) id for the delivery destination — required by request_pickup v6.2.';
COMMENT ON COLUMN public.orders.kiriminaja_awb IS
  'Courier AWB/tracking number assigned by KiriminAja after request_pickup — null until processed_packages webhook or shipment creation response provides it.';
COMMENT ON COLUMN public.orders.kiriminaja_pickup_number IS
  'KiriminAja pickup_number (aka payment ID) returned by request_pickup.';
COMMENT ON COLUMN public.orders.kiriminaja_status IS
  'Last known KiriminAja lifecycle event (processed, shipped, delivered, returned) — separate from our own order.status.';
COMMENT ON COLUMN public.orders.kiriminaja_error IS
  'Error message from the last failed request_pickup attempt, so it can be retried from the admin dashboard.';
