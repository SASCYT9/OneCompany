import { chromium } from 'playwright';
import fs from 'fs';
import https from 'https';
import path from 'path';

// List of new shortcodes to process
const SHORTCODES = [
  "DWebA1mjNjq",
  "DWbybFkjHXp",
  "DWWGptejKmd",
  "DWPLJ-PjAwZ",
  "DVBOSsajMKr",
  "DU8slwwDP1C",
  "DU56J1EjLFg",
  "DU3a9YgDGjR"
];

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      // follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { try { fs.unlinkSync(dest); } catch {} reject(err); });
  });
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const siteContentFile = 'public/config/site-content.json';
  const siteContent = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));

  for (const shortcode of SHORTCODES) {
    console.log(`\n=== Processing: ${shortcode} ===`);
    const postId = "ig-" + shortcode.toLowerCase();
    
    // Check if already in blog AND has multiple properly mapped media (meaning we didn't just add a broken 1/1 image)
    const existingPostIndex = siteContent.blog.posts.findIndex(p => p.id === postId);
    if (existingPostIndex !== -1) {
      // It exists. But does it have valid non-broken media?
      const existingMedia = siteContent.blog.posts[existingPostIndex].media;
      if (existingMedia && existingMedia.length > 0 && existingMedia.some(m => m.src.includes('-v2-') || m.src.includes('-v3-'))) {
        console.log(`Skipping ${shortcode}, already added correctly.`);
        continue;
      } else {
         // Needs fixing! But we'll just safely re-add it or replace it.
         console.log(`${shortcode} exists but might be broken, re-scraping...`);
      }
    }

    // 1. Get Caption and Date from Instagram
    let captionText = "Instagram post";
    let dateText = new Date().toISOString();
    try {
      await page.goto(`https://www.instagram.com/p/${shortcode}/`);
      try {
        await page.waitForSelector('time', { timeout: 3000 });
        dateText = await page.$eval('time', el => el.getAttribute('datetime')) || dateText;
      } catch(e) {}
      try {
        captionText = await page.evaluate(() => {
          const h1 = document.querySelector('h1');
          return h1 ? h1.innerText : '';
        });
      } catch(e) {}
    } catch (e) {
      console.log('Failed to get IG caption:', e.message);
    }
    
    if (!captionText) {
      captionText = "One Company tuning project";
    }

    // 2. Get Media from FastDL
    let mediaList = [];
    try {
      await page.goto('https://fastdl.app/en');
      await page.fill('#search-form-input', `https://www.instagram.com/p/${shortcode}/`);
      await page.click('.search-form__button');
      
      await page.waitForSelector('.output-list__item', { timeout: 15000 });
      mediaList = await page.$$eval('.output-list__item', items => {
        return items.map(item => {
           const dlAnchor = item.querySelector('a.button[href]');
           if (!dlAnchor) return null;
           const link = dlAnchor.href;
           const isVideo = link.includes('dl-video') || dlAnchor.innerText.toLowerCase().includes('video');
           return {
             type: isVideo ? 'video' : 'image',
             link: link
           };
        }).filter(Boolean);
      });
      console.log(`Found ${mediaList.length} media items via fastdl`);
    } catch (e) {
      console.log('Failed to get fastdl media:', e.message);
      continue; // skip if we can't extract media
    }

    // 3. Download Media
    const mappedMedia = [];
    for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        const ext = item.type === 'video' ? 'mp4' : 'jpg';
        // USE -v3- CACHE BUSTER!
        const fileName = `${shortcode}-v3-${i+1}.${ext}`;
        const relativeFolder = item.type === 'video' ? '/videos/blog/' : '/images/blog/';
        const dest = path.resolve('public' + relativeFolder, fileName);
        
        console.log(`Downloading ${fileName}...`);
        try {
            await downloadFile(item.link, dest);
            mappedMedia.push({
               id: `media-${postId}-${i+1}`,
               type: item.type,
               src: relativeFolder + fileName,
               alt: "One Company tuning"
            });
        } catch(e) {
            console.log(`Error downloading ${fileName}`, e.message);
        }
    }

    if (mappedMedia.length === 0) {
       console.log(`FAILED to download any media for ${shortcode}, skipping.`);
       continue;
    }

    // 4. Update site-content.json
    let titleParts = captionText.split('\n')[0].trim();
    if (titleParts.length > 60) titleParts = titleParts.substring(0, 60) + "..."; // limit title

    const newPost = {
      id: postId,
      slug: "brand-case-" + shortcode.toLowerCase(),
      title: {
        ua: titleParts,
        en: titleParts
      },
      caption: {
        ua: captionText,
        en: captionText // TODO auto-translate if needed, but for now duplicate
      },
      date: dateText,
      location: {
        ua: "Україна",
        en: "Ukraine"
      },
      tags: ["onecompany", "tuning"],
      status: "published",
      media: mappedMedia
    };

    if (existingPostIndex !== -1) {
       siteContent.blog.posts[existingPostIndex] = newPost; // update in place
    } else {
       siteContent.blog.posts.push(newPost); // we will sort them later
    }
  }

  // Sort all posts by date descending
  siteContent.blog.posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(siteContentFile, JSON.stringify(siteContent, null, 2));
  console.log(`\n\nSuccesfully updated blog with ${SHORTCODES.length} posts!`);

  await browser.close();
}

main().catch(console.error);
