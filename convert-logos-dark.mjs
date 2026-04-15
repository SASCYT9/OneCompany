import fs from 'fs';
import path from 'path';

async function run() {
try {
  const sharp = (await import('sharp')).default;
  const files = ['eventuri-logo.svg', 'fi-logo.svg'];
  
  for (const file of files) {
    const rawPath = path.join('d:/OneCompany/public/brands', file);
    if(fs.existsSync(rawPath)) {
      let content = fs.readFileSync(rawPath, 'utf-8');
      
      // Replace white fills with dark
      content = content.replace(/fill="#ffffff"/g, 'fill="#111111"');
      content = content.replace(/fill="#FFF"/gi, 'fill="#111111"');
      
      const darkSvgPath = rawPath.replace('.svg', '-dark.svg');
      fs.writeFileSync(darkSvgPath, content);
      
      const darkPngPath = rawPath.replace('.svg', '-dark.png');
      await sharp(Buffer.from(content))
        .png()
        .toFile(darkPngPath);
      
      console.log('Converted', darkPngPath);
    }
  }
} catch (e) {
  console.error('Sharp error', e);
}
}
run();
