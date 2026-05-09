const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function analyze() {
  const dir = path.join(__dirname, 'public', 'images', 'shop', 'brabus', 'hq');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));
  
  const results = [];
  for (const file of files) {
    try {
      const stats = await sharp(path.join(dir, file)).stats();
      const channels = stats.channels;
      // Brightness is the average mean across RGB
      const mean = channels.slice(0, 3).reduce((sum, ch) => sum + ch.mean, 0) / 3;
      results.push({ file, mean });
    } catch(e) {
      // ignore
    }
  }

  results.sort((a,b) => a.mean - b.mean);
  
  console.log('--- TOP 25 DARKEST IMAGES ---');
  results.slice(0, 25).forEach(r => console.log(`${r.file} (brightness: ${r.mean.toFixed(1)})`));
  
  console.log('\n--- TOP 20 BRIGHTEST IMAGES ---');
  results.slice(-20).forEach(r => console.log(`${r.file} (brightness: ${r.mean.toFixed(1)})`));
}

analyze().catch(console.error);
