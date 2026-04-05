import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { getProductsForUrbanCollection } from './src/lib/urbanCollectionMatcher';

const prisma = new PrismaClient();
const TEMPLATE_DIR = path.join(process.cwd(), 'reference', 'urban-shopify-theme', 'templates');

function parseJsoncTemplate(filePath: string): any {
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/^\uFEFF/, '');
  text = text.replace(/\/\*[\s\S]*?\*\//g, ''); // strip block comments
  return JSON.parse(text);
}

const URBAN_COLLECTIONS = [
  'land-rover-defender-110', 'lamborghini-urus', 'mercedes-g-wagon-w465-widetrack',
  'audi-rs6-rs7', 'land-rover-defender-90', 'land-rover-defender-130',
  'land-rover-defender-110-octa', 'lamborghini-urus-s', 'lamborghini-urus-performante',
  'lamborghini-urus-se', 'lamborghini-aventador-s', 'audi-rsq8-facelift',
  'audi-rsq8', 'audi-rs4', 'audi-rs3', 'rolls-royce-cullinan', 'rolls-royce-cullinan-series-ii',
  'rolls-royce-ghost-series-ii', 'mercedes-g-wagon-w465-aerokit', 'mercedes-g-wagon-softkit',
  'mercedes-eqc', 'range-rover-l460', 'range-rover-sport-l461', 'range-rover-sport-l494',
  'bentley-continental-gt', 'volkswagen-golf-r', 'volkswagen-transporter-t6-1'
];

function extractImagesFromJson(obj: any): string[] {
  let images: string[] = [];
  if (typeof obj === 'string') {
    if (obj.includes('shopify://shop_images/')) {
      const parts = obj.split('/');
      const filename = parts[parts.length - 1];
      images.push(`/images/shop/urban/products/fallback/${filename}`);
    } else if (obj.startsWith('/images/shop/urban/')) {
      images.push(obj);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    if (obj.settings && obj.settings.external_image_url) images.push(obj.settings.external_image_url);
    if (obj.settings && obj.settings.external_poster_url) images.push(obj.settings.external_poster_url);
    for (const key in obj) {
      images = images.concat(extractImagesFromJson(obj[key]));
    }
  }
  return [...new Set(images)];
}

const GLOBAL_FALLBACK_IMAGES = [
  '/images/shop/urban/carousel/models/defender2020Plus/2025Updates/webp/urban-automotive-defender-2020-onwards-1-2560.webp',
  '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-1-2560.webp',
  '/images/shop/urban/carousel/models/urus/carousel-1-1920.jpg',
  '/images/shop/urban/carousel/models/rangeRover2022Plus/webp/urban-range-rover-mk-dons-1-1920.webp'
];

async function main() {
  const dbProducts = await prisma.shopProduct.findMany({
    where: { slug: { startsWith: 'urb' } },
    include: { collections: { include: { collection: true } } }
  });

  console.log(`Loaded ${dbProducts.length} Urban products from DB.`);

  let updatedCount = 0;
  let skippedCount = 0;

  const mappedCatalog = dbProducts.map(p => ({
    id: p.id,
    matcherFormat: {
      title: { ua: p.titleUa, en: p.titleEn },
      collection: { ua: p.collectionUa || '', en: p.collectionEn || '' },
      tags: p.tags,
      brand: 'Urban Automotive', // Force the brand for the matcher
      collections: p.collections.map(c => ({
        handle: c.collection.handle,
        title: { ua: c.collection.titleUa, en: c.collection.titleEn }
      }))
    }
  }));

  const updatedIds = new Set<string>();

  for (const handle of URBAN_COLLECTIONS) {
    let images: string[] = [];
    const filePath = path.join(TEMPLATE_DIR, `collection.${handle}.json`);
    if (fs.existsSync(filePath)) {
      const parsed = parseJsoncTemplate(filePath);
      images = extractImagesFromJson(parsed).filter(img => img && img.trim() !== '');
    }

    if (images.length === 0) images = GLOBAL_FALLBACK_IMAGES;

    const matchingMapped = getProductsForUrbanCollection(mappedCatalog.map(m => m.matcherFormat) as any, handle);
    
    // We match by English Title to find the original ID
    const matchingDbProducts = matchingMapped.map(m => {
      return dbProducts.find(db => db.titleEn === m.title.en);
    }).filter(Boolean);

    for (let i = 0; i < matchingDbProducts.length; i++) {
      const p = matchingDbProducts[i];
      if (!p) continue;

      if (updatedIds.has(p.id)) continue;
      
      const imageToUse = images[i % images.length];

      await prisma.shopProduct.update({
        where: { id: p.id },
        data: {
          brand: 'Urban Automotive',
          vendor: 'Urban Automotive',
          image: p.image && !p.image.includes('placeholder') ? p.image : imageToUse,
          gallery: p.image && !p.image.includes('placeholder') ? p.gallery : [imageToUse]
        }
      });

      updatedIds.add(p.id);
      updatedCount++;
    }
  }

  // Fallback for ANY product that didn't match ANY collection (e.g. pure universal wheels)
  for (let i = 0; i < dbProducts.length; i++) {
    const p = dbProducts[i];
    if (!updatedIds.has(p.id)) {
      const imageToUse = GLOBAL_FALLBACK_IMAGES[i % GLOBAL_FALLBACK_IMAGES.length];
      await prisma.shopProduct.update({
        where: { id: p.id },
        data: {
          brand: 'Urban Automotive',
          vendor: 'Urban Automotive',
          image: p.image && !p.image.includes('placeholder') ? p.image : imageToUse,
          gallery: p.image && !p.image.includes('placeholder') ? p.gallery : [imageToUse]
        }
      });
      updatedCount++;
      skippedCount++;
    }
  }

  console.log(`Success! Updated ${updatedCount} products overall (including ${skippedCount} universal fallbacks).`);
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
