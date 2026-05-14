-- ============================================================
-- PATCH 001: Add shipping fields + cancel order policy
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Add shipping_fee and shipping_country columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee numeric(12,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_country text;

-- Allow users to cancel their own pending orders
CREATE POLICY "Users can cancel own pending orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = customer_id AND status = 'pending');
