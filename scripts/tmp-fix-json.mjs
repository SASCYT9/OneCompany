import fs from 'fs';

const siteContentFile = 'public/config/site-content.json';
const fastdlFile = 'scripts/fastdl-results.json';

const siteContent = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));
const fastdlResults = JSON.parse(fs.readFileSync(fastdlFile, 'utf8'));

let updated = 0;

Object.keys(fastdlResults).forEach(shortcode => {
  const mediaArray = fastdlResults[shortcode];
  const postId = "ig-" + shortcode.toLowerCase();
  
  const post = siteContent.blog.posts.find(p => p.id === postId);
  if (post) {
    // mapped to site-content schema
    post.media = mediaArray.map((m, index) => ({
      id: `media-${postId}-${index + 1}`,
      type: m.type,
      src: m.src,
      alt: post.title.en || "Instagram media"
    }));
    updated++;
    console.log(`Updated media for post ${shortcode} with ${mediaArray.length} items`);
  }
});

fs.writeFileSync(siteContentFile, JSON.stringify(siteContent, null, 2));
console.log(`Successfully updated ${updated} posts in site-content.json!`);
