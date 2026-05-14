-- ============================================================
-- Paperain Studio — Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Products table
create table public.products (
  id text primary key,
  title text not null,
  price numeric(10,2) not null,
  category text not null,
  image text not null,
  description text,
  is_new boolean default false,
  is_favorite boolean default false,
  is_active boolean default true,
  images text[], -- additional product images
  created_at timestamptz default now()
);

-- 2. Product variants
create table public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  label text not null,
  image text not null,
  sort_order int default 0
);

-- 3. Customer profiles (linked to Supabase Auth)
create table public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  status text not null default 'pending',
  currency text not null default 'USD',
  subtotal numeric(12,2) not null,
  discount numeric(12,2) default 0,
  shipping_fee numeric(12,2) default 0,
  total numeric(12,2) not null,
  shipping_name text not null,
  shipping_email text not null,
  shipping_phone text not null,
  shipping_address text not null,
  shipping_country text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. Order line items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  variant_id text,
  title text not null,
  price numeric(10,2) not null,
  quantity int not null default 1,
  image text
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Products: anyone can read active products
create policy "Anyone can read active products"
  on public.products for select
  using (is_active = true);

-- Product variants: anyone can read
create policy "Anyone can read product variants"
  on public.product_variants for select
  using (true);

-- Customers: users can read/update their own profile
create policy "Users can view own profile"
  on public.customers for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.customers for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.customers for insert
  with check (auth.uid() = id);

-- Orders: users can read their own orders
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = customer_id);

create policy "Users can create own orders"
  on public.orders for insert
  with check (auth.uid() = customer_id);

-- Users can cancel their own pending orders
create policy "Users can cancel own pending orders"
  on public.orders for update
  using (auth.uid() = customer_id and status = 'pending');

-- Order items: users can read items from their own orders
create policy "Users can view own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.customer_id = auth.uid()
    )
  );

create policy "Users can insert own order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.customer_id = auth.uid()
    )
  );

-- ============================================================
-- Admin policies (admin role set via app_metadata)
-- ============================================================

-- Admin can read all orders
create policy "Admin can read all orders"
  on public.orders for select
  using (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Admin can update order status
create policy "Admin can update orders"
  on public.orders for update
  using (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Admin can read all order items
create policy "Admin can read all order items"
  on public.order_items for select
  using (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Admin can manage products
create policy "Admin can insert products"
  on public.products for insert
  with check (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

create policy "Admin can update products"
  on public.products for update
  using (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

create policy "Admin can delete products"
  on public.products for delete
  using (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
  );

-- Guest order policy: allow unauthenticated inserts (for guest checkout)
create policy "Anyone can create orders as guest"
  on public.orders for insert
  with check (customer_id is null);

create policy "Anyone can insert order items for guest orders"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.customer_id is null
    )
  );

-- ============================================================
-- Indexes
-- ============================================================

create index idx_products_category on public.products(category);
create index idx_products_active on public.products(is_active);
create index idx_product_variants_product on public.product_variants(product_id);
create index idx_orders_customer on public.orders(customer_id);
create index idx_orders_status on public.orders(status);
create index idx_order_items_order on public.order_items(order_id);

-- ============================================================
-- Auto-create customer profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.customers (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
