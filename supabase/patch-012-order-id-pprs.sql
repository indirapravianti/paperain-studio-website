-- ============================================================
-- PATCH 012: Order IDs compatible with KiriminAja (PPRS prefix)
-- Run this in Supabase Dashboard > SQL Editor
--
-- KiriminAja's request_pickup requires order_id to be max 20 characters
-- and start with the prefix registered for our account (PPRS).
-- The old INV/YYYYMMDD/PS/XXXXXXXX format was 24 characters with no
-- registered prefix, so shipment creation was rejected.
--
-- New format: PPRS-YYMMDD-NNNNNN (18 characters, date in WIB)
-- Only affects NEW orders. Existing orders keep their old display_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_display_id()
RETURNS trigger AS $$
DECLARE
  date_part text;
  rand_part text;
  candidate text;
  attempts int := 0;
BEGIN
  date_part := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYMMDD');
  LOOP
    rand_part := lpad(floor(random() * 1000000)::text, 6, '0');
    candidate := 'PPRS-' || date_part || '-' || rand_part;
    -- display_id is UNIQUE; retry on the rare collision instead of failing the insert
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE display_id = candidate)
      OR attempts >= 10;
    attempts := attempts + 1;
  END LOOP;
  NEW.display_id := candidate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists from patch-001 and keeps pointing at this function.
