import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const siteContentFile = 'public/config/site-content.json';
const siteContent = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));

// Find posts that we accidentally titled "One Company tuning project"
const brokenPosts = siteContent.blog.posts.filter(p => p.title.en === "One Company tuning project");

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const post of brokenPosts) {
    console.log(`Fixing post: ${post.id}`);
    const shortcode = post.id.replace('ig-', '').toLowerCase();

    // 1. Fix the Caption via proper meta tags
    try {
      await page.goto(`https://www.instagram.com/p/${shortcode}/`);
      await page.waitForTimeout(2000); // Wait for meta to load just in case

      const metaDesc = await page.$eval('meta[property="og:title"]', el => el.content).catch(() => "");
      let caption = metaDesc;
      
      // Meta is usually like 'One Company on Instagram: "Real caption here"'
      if (caption.includes('on Instagram: "')) {
         caption = caption.split('on Instagram: "')[1];
         if (caption.endsWith('"')) caption = caption.slice(0, -1);
      } else if (caption.includes('on Instagram: ')) {
         caption = caption.split('on Instagram: ')[1];
      }

      if (caption && caption.length > 5) {
        let titleParts = caption.split('\n')[0].trim();
        if (titleParts.length > 60) titleParts = titleParts.substring(0, 60) + "...";

        post.title.ua = titleParts;
        post.title.en = titleParts;
        post.caption.ua = caption;
        post.caption.en = caption;
        console.log(`Fixed caption for ${shortcode} -> ${titleParts}`);
      } else {
        console.log(`Still failed to get caption for ${shortcode}`);
      }
    } catch (e) {
      console.log(`Error getting caption for ${shortcode}`, e.message);
    }

    // 2. Fix the MP4 masquerading as JPG
    if (post.media) {
      post.media.forEach(m => {
        if (m.src.startsWith('/images/blog/')) {
          const fileName = path.basename(m.src);
          const fullPath = path.resolve('public/images/blog/', fileName);
          
          if (fs.existsSync(fullPath)) {
            // Read first 12 bytes
            const buffer = Buffer.alloc(12);
            const fd = fs.openSync(fullPath, 'r');
            fs.readSync(fd, buffer, 0, 12, 0);
            fs.closeSync(fd);
            
            // Check if ftyp
            if (buffer.toString('utf8', 4, 8) === 'ftyp') {
              console.log(`${fileName} IS A VIDEO! Converting to .mp4`);
              const newFileName = fileName.replace('.jpg', '.mp4');
              const newPath = path.resolve('public/videos/blog/', newFileName);
              
              // Move file
              fs.renameSync(fullPath, newPath);
              
              // Update JSON
              m.src = `/videos/blog/${newFileName}`;
              m.type = 'video';
            }
          }
        }
      });
    }
  }

  // Sort again just in case, though the dates are currently all "now"
  // Let's also restore proper order if they all have same date? They are sorted correctly already.
  
  fs.writeFileSync(siteContentFile, JSON.stringify(siteContent, null, 2));
  console.log(`Fixed all broken posts!`);

  await browser.close();
}

main().catch(console.error);
