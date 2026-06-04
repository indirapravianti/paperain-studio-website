import products from '../../src/data/products.json' with { type: 'json' };

/** Fallback when products table is empty or not seeded */
export function getCatalogProduct(id) {
  return products.find((p) => p.id === id && p.isActive !== false) || null;
}
