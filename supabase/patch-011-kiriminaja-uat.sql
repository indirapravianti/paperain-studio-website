-- ============================================================
-- Patch 011: KiriminAja UAT — chargeable weight, dimensions, insurance
-- Supabase Dashboard → SQL Editor → paste & run
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_actual_weight_grams int,
  ADD COLUMN IF NOT EXISTS shipping_volumetric_weight_grams int,
  ADD COLUMN IF NOT EXISTS shipping_width_cm int,
  ADD COLUMN IF NOT EXISTS shipping_length_cm int,
  ADD COLUMN IF NOT EXISTS shipping_height_cm int,
  ADD COLUMN IF NOT EXISTS shipping_item_value int,
  ADD COLUMN IF NOT EXISTS shipping_insurance_amount int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kiriminaja_sorting_code text;

COMMENT ON COLUMN public.orders.shipping_weight_grams IS
  'Chargeable grams quoted to KiriminAja (greater of actual weight and volumetric weight).';
COMMENT ON COLUMN public.orders.shipping_actual_weight_grams IS
  'Actual packed weight in grams sent as request_pickup weight.';
COMMENT ON COLUMN public.orders.shipping_volumetric_weight_grams IS
  'width × length × height ÷ 6, in grams.';
COMMENT ON COLUMN public.orders.shipping_insurance_amount IS
  'Insurance rupiah sent as insurance_amount. 0 when insurance is not used. Not included in shipping_fee.';
COMMENT ON COLUMN public.orders.kiriminaja_sorting_code IS
  'Courier sorting code from tracking, printed on the member shipping label.';
