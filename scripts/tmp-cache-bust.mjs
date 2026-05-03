import fs from 'fs';
import path from 'path';

const siteContentFile = 'public/config/site-content.json';
const siteContent = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));

const postsToBust = [
  'DW3qRqdDO4l',
  'DWzAIIoDHb4',
  'DWn0fWMjB1t',
  'DWlaTXVjBNO',
  'DWTU9BsDEJC',
  'DVG3S66DAgX'
].map(s => "ig-" + s.toLowerCase());

let updated = 0;

postsToBust.forEach(postId => {
  const post = siteContent.blog.posts.find(p => p.id === postId);
  if (post && post.media) {
    post.media.forEach(m => {
      if (m.type === 'image' && m.src.includes('/images/blog/')) {
        const oldSrc = m.src; // e.g. /images/blog/DWTU9BsDEJC-1.jpg
        
        // If it already has v2, skip
        if (oldSrc.includes('-v2-')) return;
        
        const fileName = path.basename(oldSrc);
        const newFileName = fileName.replace('-', '-v2-'); // e.g. DWTU9BsDEJC-v2-1.jpg
        const newSrc = `/images/blog/${newFileName}`;
        
        const oldPath = path.resolve('public', fileName === oldSrc.substring(1) ? oldSrc : `images/blog/${fileName}`);
        const newPath = path.resolve('public/images/blog', newFileName);
        
        // Rename the actual file
        try {
          if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            // Update the JSON
            m.src = newSrc;
            updated++;
          }
        } catch (e) {
          console.error(`Failed to rename ${fileName}:`, e);
        }
      }
    });
  }
});

fs.writeFileSync(siteContentFile, JSON.stringify(siteContent, null, 2));
console.log(`Cache busted ${updated} images in site-content.json!`);
