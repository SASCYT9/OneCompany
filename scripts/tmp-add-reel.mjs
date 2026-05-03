import { chromium } from 'playwright';
import fs from 'fs';
import https from 'https';
import path from 'path';

const shortcode = 'DWvkRABDKnw';

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
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
  
  // 1. Get Caption and Date from Instagram
  let captionText = "";
  let dateText = new Date().toISOString();
  try {
    await page.goto(`https://www.instagram.com/p/${shortcode}/`);
    // wait for either the login popup or main content
    try {
      await page.waitForSelector('time', { timeout: 10000 });
      dateText = await page.$eval('time', el => el.getAttribute('datetime')) || dateText;
    } catch(e) {}
    try {
      captionText = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return h1 ? h1.innerText : '';
      });
    } catch(e) {}
  } catch (e) {
    console.log('Failed to get IG caption:', e);
  }

  // 2. Get Video from fastdl
  await page.goto('https://fastdl.app/en');
  await page.fill('#search-form-input', `https://www.instagram.com/p/${shortcode}/`);
  await page.click('.search-form__button');
  
  try {
    await page.waitForSelector('.output-list__item a.button[href]', { timeout: 15000 });
    const link = await page.$eval('.output-list__item a.button[href]', a => a.href);
    console.log(`Downloading video for ${shortcode}...`);
    const dest = path.resolve('public/videos/blog', `${shortcode}-1.mp4`);
    await downloadFile(link, dest);
    console.log(`Video downloaded!`);
  } catch (e) {
    console.log('Failed to download video:', e);
  }
  
  await browser.close();

  // 3. Update site-content.json
  const siteContentFile = 'public/config/site-content.json';
  const siteContent = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));

  const postHtml = {
    id: "ig-" + shortcode.toLowerCase(),
    slug: "ilmberger-carbon-premium-details-" + shortcode.toLowerCase(),
    title: {
      ua: "Ilmberger Carbon - преміальні деталі для мото",
      en: "Ilmberger Carbon - premium details for moto"
    },
    caption: {
      ua: captionText || "@ilmberger_carbon - це преміальні карбонові деталі для мото, створені з використанням автоклавного виробництва, що забезпечує найвищий рівень міцності та ідеальну гладкість кожної деталі.",
      en: captionText || "@ilmberger_carbon are premium carbon fiber details for motorcycles, created using autoclave production, ensuring the highest level of strength and perfect smoothness of every detail."
    },
    date: dateText,
    location: {
      ua: "Україна",
      en: "Ukraine"
    },
    tags: ["onecompany", "ilmbergercarbon", "motorcycle", "carbonfiber"],
    status: "published",
    media: [
      {
        id: "media-ig-" + shortcode.toLowerCase() + "-1",
        type: "video",
        src: `/videos/blog/${shortcode}-1.mp4`,
        poster: "", // we can leave poster empty or extract a frame later
        alt: "Ilmberger Carbon Video"
      }
    ]
  };

  // Check if exists
  if (!siteContent.blog.posts.some(p => p.id === postHtml.id)) {
    siteContent.blog.posts.unshift(postHtml);
    fs.writeFileSync(siteContentFile, JSON.stringify(siteContent, null, 2));
    console.log(`Added reel ${shortcode} to the blog.`);
  } else {
    console.log(`Reel ${shortcode} already exists in blog.`);
  }
}

main().catch(console.error);
