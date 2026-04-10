#!/usr/bin/env node
/**
 * GiroDisc Missing Products Importer (Supabase REST API)
 * Finds products from girodisc-products.json not yet in DB and inserts them.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SupaBase_SUPABASE_URL || process.env.SupaBase_SUPABASE_URL;
const SUPABASE_KEY = process.env.SupaBase_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const DISCOUNT = 0.10;
const UAH_TO_EUR = 52;
const UAH_TO_USD = 45;

function calcPrices(priceUah) {
  if (!priceUah || priceUah <= 0) return { uah: null, eur: null, usd: null };
  const d = priceUah * (1 - DISCOUNT);
  return { uah: d.toFixed(2), eur: (d / UAH_TO_EUR).toFixed(2), usd: (d / UAH_TO_USD).toFixed(2) };
}

function generateSlug(p) {
  let slug = p.handle;
  if (!slug.startsWith('girodisc-')) slug = `girodisc-${slug}`;
  return slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 200);
}

function classifyCategory(cat) {
  const map = {
    rotors: { ua: 'Гальмівні диски', en: 'Brake Rotors' },
    pads: { ua: 'Гальмівні колодки', en: 'Brake Pads' },
    shields: { ua: 'Теплові щити', en: 'Heat Shields' },
    hardware: { ua: 'Кріплення', en: 'Hardware' },
  };
  return map[cat] || map.rotors;
}

async function supabaseInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
}

async function supabaseSelect(table, select, filter) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set('select', select);
  if (filter) url.search += `&${filter}`;
  const res = await fetch(url.toString(), {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Range': '0-9999',
      'Prefer': 'count=exact',
    },
  });
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.error('API Error:', JSON.stringify(data).substring(0, 200));
    return [];
  }
  return data;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const jsonPath = path.join(process.cwd(), 'data', 'girodisc-products.json');
  const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📦 Loaded ${products.length} products from JSON`);

  const existing = await supabaseSelect('ShopProduct', 'slug', 'brand=eq.GiroDisc');
  const existingSlugs = new Set(existing.map(r => r.slug));
  console.log(`📁 ${existingSlugs.size} products already in DB`);

  const missing = products.filter(p => !existingSlugs.has(generateSlug(p)));
  console.log(`🔍 ${missing.length} missing products to insert\n`);

  if (missing.length === 0) {
    console.log('✅ All products already imported!');
    return;
  }

  // Insert products in batches of 10
  const BATCH = 10;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const rows = batch.map(p => {
      const slug = generateSlug(p);
      const prices = calcPrices(p.priceUah);
      const comparePrices = calcPrices(p.compareAtPriceUah);
      const cat = classifyCategory(p.category);
      return {
        slug, sku: p.sku, scope: 'SHOP', brand: 'GiroDisc', vendor: 'GiroDisc',
        titleUa: p.title.trim(), titleEn: p.title.trim(),
        categoryUa: cat.ua, categoryEn: cat.en,
        shortDescUa: `GiroDisc ${p.sku || ''} — преміальний гальмівний компонент`,
        shortDescEn: `GiroDisc ${p.sku || ''} — premium brake component`,
        priceUah: prices.uah, priceEur: prices.eur, priceUsd: prices.usd,
        compareAtUah: comparePrices.uah, compareAtEur: comparePrices.eur, compareAtUsd: comparePrices.usd,
        isPublished: true, status: 'ACTIVE', stock: 'inStock',
        bodyHtmlUa: p.bodyHtml, bodyHtmlEn: p.bodyHtml,
        longDescUa: p.bodyHtml, longDescEn: p.bodyHtml,
        tags: JSON.stringify(['brand:girodisc', `category:${p.category}`, p.sku ? `sku:${p.sku}` : null].filter(Boolean)),
        image: p.image, supplier: 'atomic-shop.ua', originCountry: 'US',
      };
    });

    try {
      await supabaseInsert('ShopProduct', rows);
      inserted += batch.length;
      console.log(`  ✅ Batch ${Math.floor(i/BATCH)+1}: +${batch.length} (total: ${inserted}/${missing.length})`);
    } catch (err) {
      console.error(`  ❌ Batch error: ${err.message.substring(0, 120)}`);
      // Try one by one
      for (const row of rows) {
        try {
          await supabaseInsert('ShopProduct', [row]);
          inserted++;
        } catch (e2) {
          errors++;
          if (errors <= 5) console.error(`    ❌ ${row.sku}: ${e2.message.substring(0, 100)}`);
          if (e2.message.includes('402')) {
            console.error('\n🚫 Egress quota still exceeded. Try again later.');
            process.exit(1);
          }
        }
      }
    }
    await sleep(200);
  }

  console.log(`\n📊 Products: inserted=${inserted}, errors=${errors}`);

  // Link to collections & create variants
  console.log('\n🔗 Linking to collections & creating variants...');

  const allProducts = await supabaseSelect('ShopProduct', 'id,slug', 'brand=eq.GiroDisc');
  const slugToId = new Map(allProducts.map(p => [p.slug, p.id]));

  const COLL = {
    main: 'col_girodisc_main', rotors: 'col_girodisc_rotors',
    pads: 'col_girodisc_pads', shields: 'col_girodisc_shields', hardware: 'col_girodisc_hardware',
  };

  const links = [];
  const variants = [];

  for (const p of missing) {
    const slug = generateSlug(p);
    const productId = slugToId.get(slug);
    if (!productId) continue;
    links.push({ productId, collectionId: COLL.main });
    if (COLL[p.category]) links.push({ productId, collectionId: COLL[p.category] });

    const prices = calcPrices(p.priceUah);
    const comparePrices = calcPrices(p.compareAtPriceUah);
    variants.push({
      productId, sku: p.sku, title: 'Default',
      priceUah: prices.uah, priceEur: prices.eur, priceUsd: prices.usd,
      compareAtUah: comparePrices.uah, compareAtEur: comparePrices.eur, compareAtUsd: comparePrices.usd,
      inventoryQty: 0, inventoryPolicy: 'CONTINUE', isDefault: true,
    });
  }

  // Batch insert links
  for (let i = 0; i < links.length; i += 50) {
    try { await supabaseInsert('ShopProductCollection', links.slice(i, i + 50)); } catch {}
  }
  console.log(`  ✅ ${links.length} collection links`);

  // Batch insert variants
  for (let i = 0; i < variants.length; i += 50) {
    try { await supabaseInsert('ShopProductVariant', variants.slice(i, i + 50)); } catch {}
  }
  console.log(`  ✅ ${variants.length} variants`);

  // Gallery media
  let mediaCount = 0;
  for (const p of missing) {
    const productId = slugToId.get(generateSlug(p));
    if (!productId || !p.gallery?.length) continue;
    try {
      await supabaseInsert('ShopProductMedia', p.gallery.map((src, idx) => ({
        productId, mediaType: 'IMAGE', src,
        altText: `${p.title} - ${idx + 1}`, position: idx + 1,
      })));
      mediaCount += p.gallery.length;
    } catch {}
  }
  console.log(`  ✅ ${mediaCount} media items`);

  const finalCount = await supabaseSelect('ShopProduct', 'slug', 'brand=eq.GiroDisc');
  console.log(`\n🏁 Final: ${finalCount.length} GiroDisc products in DB`);
}

main().catch(console.error);
