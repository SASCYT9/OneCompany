import fs from 'fs';
const s = JSON.parse(fs.readFileSync('public/config/site-content.json', 'utf8'));
s.blog.posts.forEach((p, i) => {
  const mediaTypes = p.media?.map(m => m.type === 'video' ? 'V' : 'I').join('') || '?';
  console.log(`${String(i+1).padStart(2)}. ${p.id.padEnd(30)} | ${String(p.media?.length || 0).padStart(2)}m [${mediaTypes}] | ${p.title.ua.substring(0, 65)}`);
});
