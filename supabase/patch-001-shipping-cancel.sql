-- ============================================================
-- PATCH 001: Shipping fields, cancel policy, readable order IDs
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Add shipping columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee numeric(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_country text;

-- Add readable display_id column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS display_id text UNIQUE;

-- Auto-generate readable order ID on insert: INV/YYYYMMDD/PS/XXXXXXXX
CREATE OR REPLACE FUNCTION public.generate_display_id()
RETURNS trigger AS $$
DECLARE
  date_part text;
  rand_part text;
BEGIN
  date_part := to_char(now(), 'YYYYMMDD');
  rand_part := lpad(floor(random() * 100000000)::text, 8, '0');
  NEW.display_id := 'INV/' || date_part || '/PS/' || rand_part;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (safe re-run)
DROP TRIGGER IF EXISTS set_display_id ON public.orders;

CREATE TRIGGER set_display_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_display_id();

-- Backfill existing orders that have no display_id
UPDATE public.orders
SET display_id = 'INV/' || to_char(created_at, 'YYYYMMDD') || '/PS/' || lpad(floor(random() * 100000000)::text, 8, '0')
WHERE display_id IS NULL;

-- Allow users to cancel their own pending orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can cancel own pending orders'
  ) THEN
    CREATE POLICY "Users can cancel own pending orders"
      ON public.orders FOR UPDATE
      USING (auth.uid() = customer_id AND status = 'pending');
  END IF;
END $$;
