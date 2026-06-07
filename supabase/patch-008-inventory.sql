-- ============================================================
-- Patch 008: Inventory / stock management
-- Supabase Dashboard → SQL Editor → paste & run
-- ============================================================

-- Product inventory columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_idr numeric(12,0),
  ADD COLUMN IF NOT EXISTS stock_quantity int,
  ADD COLUMN IF NOT EXISTS track_inventory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'in_stock'
    CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock', 'restocking'));

COMMENT ON COLUMN public.products.stock_quantity IS
  'Available units. NULL = unlimited (not tracked). Decremented on order placement, restored on cancel.';
COMMENT ON COLUMN public.products.track_inventory IS
  'When false, product is always purchasable regardless of stock_quantity.';
COMMENT ON COLUMN public.products.stock_status IS
  'Manual override for display: in_stock, low_stock, out_of_stock, restocking.';
COMMENT ON COLUMN public.products.price_idr IS
  'Indonesia store price in IDR. NULL falls back to placeholder in API.';

-- Default placeholder IDR price for existing products
UPDATE public.products
SET price_idr = 50000
WHERE price_idr IS NULL;

-- Track stock reservations per order line (audit trail)
CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id),
  quantity int NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'confirmed', 'released')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_order ON public.stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product ON public.stock_reservations(product_id);

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

-- Only service role accesses reservations (no public policies)

-- Atomically reserve stock for an order line
CREATE OR REPLACE FUNCTION public.reserve_product_stock(
  p_product_id text,
  p_quantity int,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product record;
  v_new_qty int;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid quantity');
  END IF;

  SELECT id, stock_quantity, track_inventory, stock_status, is_active
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_product.is_active THEN
    RETURN jsonb_build_object('ok', false, 'error', 'product not found or inactive');
  END IF;

  IF v_product.stock_status = 'restocking' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'product is restocking');
  END IF;

  IF NOT v_product.track_inventory OR v_product.stock_quantity IS NULL THEN
    INSERT INTO public.stock_reservations (order_id, product_id, quantity, status)
    VALUES (p_order_id, p_product_id, p_quantity, 'reserved');
    RETURN jsonb_build_object('ok', true, 'unlimited', true);
  END IF;

  IF v_product.stock_status = 'out_of_stock' OR v_product.stock_quantity < p_quantity THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient stock',
      'available', GREATEST(v_product.stock_quantity, 0)
    );
  END IF;

  v_new_qty := v_product.stock_quantity - p_quantity;

  UPDATE public.products
  SET
    stock_quantity = v_new_qty,
    stock_status = CASE
      WHEN v_new_qty <= 0 THEN 'out_of_stock'
      WHEN v_new_qty <= 3 THEN 'low_stock'
      ELSE stock_status
    END
  WHERE id = p_product_id;

  INSERT INTO public.stock_reservations (order_id, product_id, quantity, status)
  VALUES (p_order_id, p_product_id, p_quantity, 'reserved');

  RETURN jsonb_build_object('ok', true, 'remaining', v_new_qty);
END;
$$;

-- Restore stock when order cancelled or payment failed
CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_restored int := 0;
BEGIN
  FOR r IN
    SELECT id, product_id, quantity
    FROM public.stock_reservations
    WHERE order_id = p_order_id AND status = 'reserved'
    FOR UPDATE
  LOOP
    UPDATE public.products
    SET
      stock_quantity = CASE
        WHEN track_inventory AND stock_quantity IS NOT NULL
        THEN stock_quantity + r.quantity
        ELSE stock_quantity
      END,
      stock_status = CASE
        WHEN track_inventory AND stock_quantity IS NOT NULL AND (stock_quantity + r.quantity) > 0
        THEN CASE
          WHEN stock_status = 'restocking' THEN 'restocking'
          WHEN (stock_quantity + r.quantity) <= 3 THEN 'low_stock'
          ELSE 'in_stock'
        END
        ELSE stock_status
      END
    WHERE id = r.product_id;

    UPDATE public.stock_reservations
    SET status = 'released', updated_at = now()
    WHERE id = r.id;

    v_restored := v_restored + r.quantity;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'restored_units', v_restored);
END;
$$;

-- Confirm reservations after successful payment
CREATE OR REPLACE FUNCTION public.confirm_order_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stock_reservations
  SET status = 'confirmed', updated_at = now()
  WHERE order_id = p_order_id AND status = 'reserved';
END;
$$;

-- Auto-restore / confirm stock when order status changes
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    PERFORM public.restore_order_stock(NEW.id);
  END IF;
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    PERFORM public.confirm_order_stock(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_order_status_change();
