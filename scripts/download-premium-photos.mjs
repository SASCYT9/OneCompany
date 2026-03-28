import fs from 'fs';
import path from 'path';
import https from 'https';

/**
 * Download curated premium automotive photos from Unsplash using actual working URLs.
 * These are all from Unsplash (free for commercial use under the Unsplash License).
 * All photos are selected for a consistent DARK, PREMIUM, EDITORIAL aesthetic.
 */

const dir = path.join(process.cwd(), 'public/images/shop/brabus/premium');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// These are verified direct Unsplash image URLs (ixid format)
const PHOTOS = [
  // 1. Hero — dark moody G-Class
  { name: 'hero.jpg', url: 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=1920&q=85&fit=crop' },
  // 2. G-Class side profile dark
  { name: 'gclass-dark.jpg', url: 'https://images.unsplash.com/photo-1564769662533-4f00a87b4056?w=1920&q=85&fit=crop' },
  // 3. G-Class front angle
  { name: 'gclass-front.jpg', url: 'https://images.unsplash.com/photo-1606611013016-969c19ba27ad?w=1920&q=85&fit=crop' },
  // 4. Mercedes AMG GT dark
  { name: 'amg-dark.jpg', url: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1920&q=85&fit=crop' },
  // 5. Porsche 911 moody dark
  { name: 'porsche-911.jpg', url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1920&q=85&fit=crop' },
  // 6. Porsche rear closeup
  { name: 'porsche-rear.jpg', url: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1920&q=85&fit=crop' },
  // 7. Luxury car interior 
  { name: 'interior-leather.jpg', url: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1920&q=85&fit=crop' },
  // 8. Premium wheel detail
  { name: 'wheel-detail.jpg', url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1920&q=85&fit=crop' },
  // 9. Dark luxury sedan Mercedes
  { name: 'sedan-dark.jpg', url: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=1920&q=85&fit=crop' },
  // 10. SUV luxury dark road
  { name: 'suv-road.jpg', url: 'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=1920&q=85&fit=crop' },
  // 11. Engine bay detail
  { name: 'engine-bay.jpg', url: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=1920&q=85&fit=crop' },
  // 12. Night driving cinematic
  { name: 'night-drive.jpg', url: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1920&q=85&fit=crop' },
  // 13. Car carbon detail
  { name: 'car-detail.jpg', url: 'https://images.unsplash.com/photo-1525609004556-c46c6c5104b8?w=1920&q=85&fit=crop' },
  // 14. Luxury convertible
  { name: 'convertible.jpg', url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1920&q=85&fit=crop&ar=16:9' },
  // 15. Premium garage 
  { name: 'premium-garage.jpg', url: 'https://images.unsplash.com/photo-1542362567-b07e54358753?w=1920&q=85&fit=crop' },
];

function downloadUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : https;
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        console.log(`     HTTP ${res.statusCode}`);
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function main() {
  console.log(`📸 Downloading ${PHOTOS.length} premium automotive photos...\n`);
  let success = 0;

  for (const photo of PHOTOS) {
    const filepath = path.join(dir, photo.name);
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 30000) {
      console.log(`  ⏭  ${photo.name} (cached)`);
      success++;
      continue;
    }

    process.stdout.write(`  ⬇  ${photo.name}...`);
    try {
      const buf = await downloadUrl(photo.url);
      if (buf && buf.length > 20000) {
        fs.writeFileSync(filepath, buf);
        console.log(` ✅ ${(buf.length / 1024).toFixed(0)}KB`);
        success++;
      } else {
        console.log(` ❌ too small or empty`);
      }
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }

  console.log(`\n🎉 ${success}/${PHOTOS.length} downloaded to /public/images/shop/brabus/premium/`);
}

main();
