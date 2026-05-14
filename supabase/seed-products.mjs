/**
 * Seed script: uploads products.json into Supabase.
 * 
 * Usage:
 *   PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your-service-role-key \
 *   node supabase/seed-products.mjs
 * 
 * Uses the SERVICE ROLE key (not anon key) to bypass RLS.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars: PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const products = JSON.parse(readFileSync('src/data/products.json', 'utf8'));

async function seed() {
  console.log(`Seeding ${products.length} products...`);

  const productRows = products.map(p => ({
    id: p.id,
    title: p.title,
    price: p.price,
    category: p.category,
    image: p.image,
    description: p.description || null,
    is_new: p.isNew || false,
    is_favorite: p.isFavorite || false,
    is_active: p.isActive ?? true,
    images: p.images || null,
  }));

  const { error: prodError } = await supabase
    .from('products')
    .upsert(productRows, { onConflict: 'id' });

  if (prodError) {
    console.error('Error inserting products:', prodError);
    process.exit(1);
  }
  console.log(`  ✓ ${productRows.length} products upserted`);

  const variantRows = [];
  for (const p of products) {
    if (p.variants && p.variants.length > 0) {
      p.variants.forEach((v, i) => {
        variantRows.push({
          id: v.id,
          product_id: p.id,
          label: v.label,
          image: v.image,
          sort_order: i,
        });
      });
    }
  }

  if (variantRows.length > 0) {
    const { error: varError } = await supabase
      .from('product_variants')
      .upsert(variantRows, { onConflict: 'id' });

    if (varError) {
      console.error('Error inserting variants:', varError);
      process.exit(1);
    }
    console.log(`  ✓ ${variantRows.length} variants upserted`);
  }

  console.log('Done!');
}

seed();
