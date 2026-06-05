import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function isActuallyPlaceholder(url: string): boolean {
  const norm = url.toLowerCase();
  
  if (
    norm.includes('l460') || 
    norm.includes('l461') || 
    norm.includes('l494') || 
    norm.includes('transporter') || 
    norm.includes('gwagon') ||
    norm.includes('cullinan') ||
    norm.includes('defender') ||
    norm.includes('urus')
  ) {
    if (/\/(transporter|gwagon|l460|l461|l494|cullinan|defender|urus)(_[a-z0-9\-]+)?\.png$/i.test(norm.split('?')[0])) {
      return true;
    }
  }

  if (
    [
      'coming-soon',
      'comingsoon',
      'placeholder',
      'no-image',
      'image-coming-soon',
      'image_coming_soon',
      'favicon'
    ].some(marker => norm.includes(marker))
  ) {
    return true;
  }

  return false;
}

function isTireImageOnly(url: string): boolean {
  const norm = url.toLowerCase();
  return norm.includes('pirelli') || norm.includes('continental') || norm.includes('sportcontact') || norm.includes('scorpion');
}

async function main() {
  const detailImagesPath = path.resolve(process.cwd(), 'archive', 'scratch', 'gp-portal-detail-images.json');
  if (!fs.existsSync(detailImagesPath)) {
    console.error('gp-portal-detail-images.json not found!');
    return;
  }

  const gpDetails = JSON.parse(fs.readFileSync(detailImagesPath, 'utf8'));

  const dbProducts = await prisma.shopProduct.findMany({
    where: {
      OR: [
        { sku: { startsWith: 'URB-' } },
        { slug: { startsWith: 'urb-' } }
      ]
    },
    select: {
      id: true,
      sku: true,
      slug: true,
      titleEn: true,
      image: true,
      gallery: true
    }
  });

  let output = `Comparing ${gpDetails.length} GP Portal products with database...\n\n`;

  for (const gpItem of gpDetails) {
    const gpSku = gpItem.sku;
    const dbProduct = dbProducts.find((p: any) => {
      const cleanDbSku = p.sku.replace(/-V\d+$/i, '').toLowerCase();
      const cleanGpSku = gpSku.replace(/-V\d+$/i, '').toLowerCase();
      return cleanDbSku === cleanGpSku || p.sku.toLowerCase() === gpSku.toLowerCase();
    });

    output += `==================================================\n`;
    output += `GP SKU: ${gpSku} (${gpItem.title})\n`;
    
    if (!dbProduct) {
      output += `  [Not in DB] No matching product found in storefront DB.\n`;
      continue;
    }

    output += `  DB SKU: ${dbProduct.sku}\n`;
    output += `  DB Title: ${dbProduct.titleEn}\n`;
    output += `  DB Image: ${dbProduct.image}\n`;
    output += `  DB Gallery: ${JSON.stringify(dbProduct.gallery)}\n`;

    const rawGpImages = gpItem.images;
    const cleanGpImages = rawGpImages.filter((img: string) => !isActuallyPlaceholder(img));
    const finalGpImages = cleanGpImages.filter((img: string) => !isTireImageOnly(img));

    output += `  GP Images (Raw): ${rawGpImages.length}\n`;
    rawGpImages.forEach((img: string) => {
      let label = '';
      if (isActuallyPlaceholder(img)) label = ' [PLACEHOLDER SILHOUETTE]';
      else if (isTireImageOnly(img)) label = ' [TIRE ONLY]';
      output += `    - ${img}${label}\n`;
    });

    output += `  GP Images (Valid non-tire): ${finalGpImages.length}\n`;
    finalGpImages.forEach((img: string) => output += `    - ${img}\n`);

    let action = '';
    if (finalGpImages.length === 0) {
      action = 'KEEP DB IMAGES (GP Portal has no valid product photos)';
    } else {
      const hasBlob = dbProduct.image?.includes('vercel-storage.com');
      if (hasBlob) {
        // Compare gallery lengths or elements to see if we missed anything
        const dbGalleryCount = dbProduct.gallery?.length ?? 0;
        if (dbGalleryCount < finalGpImages.length) {
          action = `SYNC ADDITIONAL IMAGES (GP has ${finalGpImages.length} images, DB has ${dbGalleryCount}. We should update.)`;
        } else {
          action = 'ALREADY UPDATED (Database has Blob images)';
        }
      } else {
        action = `MIGRATE TO BLOB (We should upload these ${finalGpImages.length} images to Blob and update DB)`;
      }
    }
    output += `  => RECOMMENDATION: ${action}\n`;
  }

  fs.writeFileSync(path.resolve(process.cwd(), 'archive', 'scratch', 'comparison-results.txt'), output, 'utf8');
  console.log('Saved comparison-results.txt successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
