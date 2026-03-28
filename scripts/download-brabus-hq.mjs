import fs from 'fs';
import path from 'path';
import https from 'https';

const urls = {
  'rocket1000.jpg': 'https://www.brabus.com/_Resources/Persistent/8/a/6/9/8a69e4ce9240409fe69b4e05b9b7e7ab43770387/Brabus_Rocket_1000_20.jpg',
  'gclass-w463a.jpg': 'https://www.brabus.com/_Resources/Persistent/6/8/2/7/68274c2e80c594534716f85cddc31fe4f3d9f5e8/Brabus_G800_DTL_11-1387x780.jpg',
  'gclass-w465.jpg': 'https://www.brabus.com/_Resources/Persistent/4/4/6/4/44648b78b056bedbaddff56e3012111ce13d7890/Brabus_G_800_w465_04-1387x780.jpg',
  'gclass-w465-showcase.jpg': 'https://www.brabus.com/_Resources/Persistent/2/f/d/3/2fd344fcbb1ffcccb3ee0b2b64efbdad0dfb0b9a/Brabus_G_800_w465_14-1387x780.jpg',
  'porsche.jpg': 'https://www.brabus.com/_Resources/Persistent/f/1/8/8/f188339b165b45f49618b14a3ea3cb5b8ad28dc4/BRABUS_820_Porsche_911_Turbo_S_Cabriolet-04-1387x780.jpg',
  'porsche-showcase.jpg': 'https://www.brabus.com/_Resources/Persistent/8/b/8/1/8b81dbafbda170cff73e659c259b34dcbcfff90c/BRABUS_820_Porsche_911_Turbo_S_Cabriolet-06-1387x780.jpg',
  'rolls-royce.jpg': 'https://www.brabus.com/_Resources/Persistent/4/d/b/0/4db0d403f90e50e930fefeaa208cc67ef7ba7802/BRABUS_700_Blue_Sky_04-1387x780.jpg',
  's-class.jpg': 'https://www.brabus.com/_Resources/Persistent/1/5/7/e/157e3f899e31ff7e5473e6a98aeeb11b666a3ea6/BRABUS_500_W223_02-1387x780.jpg',
  'range-rover.jpg': 'https://www.brabus.com/_Resources/Persistent/5/a/b/6/5ab6a6234b413009774620d41829e0839f1c7d6c/BRABUS_600_Range_Rover_04-1387x780.jpg',
  'interior-1.jpg': 'https://www.brabus.com/_Resources/Persistent/a/9/2/9/a929fb07490ea651817dd948e3a24b1ecda9ded6/BRABUS_750_Bodo_Buschmann_Edition_Interior-29-1387x780.jpg'
};

const dir = path.join(process.cwd(), 'public/images/shop/brabus/hq');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

async function download(filename, url) {
  const filepath = path.join(dir, filename);
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://www.brabus.com/' } }, (res) => {
      if (res.statusCode !== 200) {
        console.log(`Failed format for ${filename}: ${res.statusCode}`);
        resolve();
        return;
      }
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => {
        stream.close();
        console.log(`✅ Downloaded: ${filename}`);
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  for (const [filename, url] of Object.entries(urls)) {
    await download(filename, url);
  }
}
main();
