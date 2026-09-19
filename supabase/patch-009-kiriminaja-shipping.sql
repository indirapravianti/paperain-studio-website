-- ============================================================
-- Patch 009: KiriminAja shipping — structured address + courier
-- Supabase Dashboard → SQL Editor → paste & run
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_province text,
  ADD COLUMN IF NOT EXISTS shipping_province_id int,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_city_id int,
  ADD COLUMN IF NOT EXISTS shipping_district text,
  ADD COLUMN IF NOT EXISTS shipping_district_id int,
  ADD COLUMN IF NOT EXISTS shipping_postal_code text,
  ADD COLUMN IF NOT EXISTS shipping_courier text,
  ADD COLUMN IF NOT EXISTS shipping_service_type text,
  ADD COLUMN IF NOT EXISTS shipping_service_name text,
  ADD COLUMN IF NOT EXISTS shipping_weight_grams int;

COMMENT ON COLUMN public.orders.shipping_district_id IS
  'KiriminAja kecamatan id for the delivery destination — used to re-quote/create the shipment.';
COMMENT ON COLUMN public.orders.shipping_courier IS
  'KiriminAja courier/service code (e.g. jne, jnt, sicepat) chosen at checkout.';
COMMENT ON COLUMN public.orders.shipping_service_type IS
  'KiriminAja service type code for the chosen courier (e.g. CTC, EZ, SIUNT).';
COMMENT ON COLUMN public.orders.shipping_weight_grams IS
  'Chargeable weight used for the KiriminAja rate lookup at order placement time.';
