-- Add payment-related columns to orders table for Midtrans integration

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_token text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_type text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS midtrans_transaction_id text;
