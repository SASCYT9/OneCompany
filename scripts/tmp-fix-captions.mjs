import fs from 'fs';

const siteContentFile = 'public/config/site-content.json';
const siteContent = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));

let fixed = 0;

siteContent.blog.posts.forEach(post => {
  // Fix captions that have "X likes, Y comments - onecompany.global DATE: "REAL CAPTION""
  for (const lang of ['ua', 'en']) {
    if (!post.caption?.[lang]) continue;
    
    const text = post.caption[lang];
    
    // Pattern: "5 likes, 0 comments - onecompany.global March 29, 2026: "Real caption here""
    const match = text.match(/(?:\d+ likes?,\s*\d+ comments?\s*-\s*)?onecompany\.global\s+\w+\s+\d+,\s*\d{4}:\s*"?(.+)"?$/s);
    if (match) {
      let clean = match[1].trim();
      // Remove trailing quote if present
      if (clean.endsWith('"')) clean = clean.slice(0, -1);
      
      post.caption[lang] = clean;
      
      // Also fix title from first line
      let titleLine = clean.split('\n')[0].trim();
      if (titleLine.length > 80) titleLine = titleLine.substring(0, 77) + '...';
      post.title[lang] = titleLine;
      
      fixed++;
      console.log(`Fixed ${post.id} [${lang}]: "${titleLine}"`);
    }
  }
  
  // Also fix posts still stuck with "One Company tuning project"
  if (post.title.ua === 'One Company tuning project') {
    console.log(`Still broken (no caption): ${post.id}`);
  }
});

fs.writeFileSync(siteContentFile, JSON.stringify(siteContent, null, 2));
console.log(`\nFixed ${fixed} caption fields total.`);
