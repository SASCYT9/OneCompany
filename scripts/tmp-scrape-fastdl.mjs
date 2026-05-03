import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';

const shortcodes = [
  'DW3qRqdDO4l',
  'DWzAIIoDHb4',
  'DWn0fWMjB1t',
  'DWlaTXVjBNO',
  'DWTU9BsDEJC',
  'DVG3S66DAgX'
];

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
  
  const results = {};
  
  for (const shortcode of shortcodes) {
    console.log(`Processing ${shortcode}...`);
    await page.goto('https://fastdl.app/en');
    await page.fill('#search-form-input', `https://www.instagram.com/p/${shortcode}/`);
    await page.click('.search-form__button');
    
    let links = [];
    try {
      await page.waitForSelector('.output-list__item', { timeout: 15000 });
      links = await page.$$eval('.output-list__item a.button[href]', els => els.map(a => a.href));
    } catch (e) {
      console.log(`Failed to get links for ${shortcode}`);
    }
    
    results[shortcode] = [];
    
    for (let i = 0; i < links.length; i++) {
      const url = links[i];
      const isVideo = url.includes('.mp4') || url.includes('&dl=1') && url.includes('.mp4');
      // Notice some files don't have extension in URL, but snapinsta/fastdl usually provides .mp4 in it.
      // Let's check headers if needed, or just assume from extension
      const actualExt = isVideo ? '.mp4' : '.jpg';
      const fileName = `${shortcode}-${i+1}${actualExt}`;
      const dest = path.resolve('public/images/blog', fileName); // save videos here too for simplicity, or in public/videos/blog
      console.log(`Downloading ${fileName}...`);
      await downloadFile(url, dest);
      
      const publicPath = (actualExt === '.mp4' ? '/videos/blog/' : '/images/blog/') + fileName;
      if (actualExt === '.mp4') {
        // Move to videos/blog
        const vidDest = path.resolve('public/videos/blog', fileName);
        if(!fs.existsSync(path.dirname(vidDest))) fs.mkdirSync(path.dirname(vidDest), {recursive:true});
        fs.renameSync(dest, vidDest);
      }
      results[shortcode].push({ type: actualExt === '.mp4' ? 'video' : 'image', src: publicPath });
    }
  }
  
  await browser.close();
  
  fs.writeFileSync('scripts/fastdl-results.json', JSON.stringify(results, null, 2));
  console.log('✅ Done!');
}

main().catch(console.error);
