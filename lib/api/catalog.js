import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

let cache = null;

/** Fallback when products table is empty or not seeded */
export function getCatalogProduct(id) {
  if (!cache) {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
    const raw = readFileSync(join(root, 'src/data/products.json'), 'utf8');
    cache = JSON.parse(raw);
  }
  return cache.find((p) => p.id === id && p.isActive !== false) || null;
}
