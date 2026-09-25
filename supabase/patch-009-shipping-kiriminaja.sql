-- ============================================================
-- Patch 009: KiriminAja shipping — package attributes + selected courier
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- Product physical attributes, needed for KiriminAja weight-based pricing.
-- Defaults are rough placeholders for paper goods — edit real values per product afterward.
alter table public.products
  add column if not exists weight_grams integer not null default 200,
  add column if not exists width_cm integer not null default 10,
  add column if not exists height_cm integer not null default 5,
  add column if not exists length_cm integer not null default 15;

-- Selected courier + destination data, captured on the payment page.
-- shipping_fee (existing column) now holds the real KiriminAja cost instead of a flat constant.
alter table public.orders
  add column if not exists courier_code text,
  add column if not exists courier_service_name text,
  add column if not exists courier_service_type text,
  add column if not exists courier_etd text,
  add column if not exists destination_kecamatan_id integer,
  add column if not exists destination_kelurahan_id integer,
  add column if not exists destination_zipcode text;
