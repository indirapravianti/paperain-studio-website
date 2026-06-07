import { getSupabaseAdmin } from './supabase-admin.js';

export async function handleStockQuery(ids) {
  if (!ids?.length) {
    return { status: 400, body: { error: 'ids query parameter required' } };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('products')
    .select('id, stock_quantity, track_inventory, stock_status, is_active')
    .in('id', ids)
    .eq('is_active', true);

  if (error) {
    console.error('stock query error:', error);
    return { status: 500, body: { error: 'could not fetch stock' } };
  }

  const stock = {};
  for (const row of data || []) {
    const unlimited = !row.track_inventory || row.stock_quantity == null;
    stock[row.id] = {
      available: unlimited ? null : Math.max(row.stock_quantity, 0),
      status: row.stock_status,
      purchasable:
        row.is_active &&
        row.stock_status !== 'out_of_stock' &&
        row.stock_status !== 'restocking' &&
        (unlimited || row.stock_quantity > 0),
    };
  }

  return { status: 200, body: { stock } };
}
