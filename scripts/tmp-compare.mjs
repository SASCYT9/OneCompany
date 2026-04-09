import fs from 'fs';

// All shortcodes from Instagram profile (newest first), excluding pinned "Хто ми" (DTsKmdmjFgF)
const instagramPosts = [
  { shortcode: "DW6O-TOjLSv", type: "reel" },   // NEW?
  { shortcode: "DW3qRqdDO4l", type: "post" },
  { shortcode: "DWzAIIoDHb4", type: "post" },
  { shortcode: "DWvkRABDKnw", type: "reel" },
  { shortcode: "DWn0fWMjB1t", type: "post" },
  { shortcode: "DWlaTXVjBNO", type: "post" },
  { shortcode: "DWebA1mjNjq", type: "reel" },
  { shortcode: "DWbybFkjHXp", type: "post" },
  { shortcode: "DWWGptejKmd", type: "reel" },
  { shortcode: "DWTU9BsDEJC", type: "post" },
  { shortcode: "DWPLJ-PjAwZ", type: "post" },
  { shortcode: "DVG3S66DAgX", type: "post" },
  { shortcode: "DVBOSsajMKr", type: "post" },
  { shortcode: "DU8slwwDP1C", type: "post" },
  { shortcode: "DU56J1EjLFg", type: "post" },
  { shortcode: "DU3a9YgDGjR", type: "post" },
  { shortcode: "DU0nuWGDNDv", type: "reel" },
  { shortcode: "DUuv-rjjALG", type: "reel" },
  { shortcode: "DUqaNSJDP8u", type: "reel" },
  { shortcode: "DUn2XLEDKVQ", type: "reel" },
  { shortcode: "DUlQRivDHIC", type: "post" },
  { shortcode: "DUipnH6DBek", type: "post" },
  { shortcode: "DUbIS32DOtX", type: "post" },
  { shortcode: "DUYUhJFDBsQ", type: "reel" },
  { shortcode: "DUVvmlqDKcQ", type: "reel" },
  { shortcode: "DUTF_x9DPIl", type: "post" },
];

const siteContent = JSON.parse(fs.readFileSync('public/config/site-content.json', 'utf8'));
const blogIds = siteContent.blog.posts.map(p => p.id);

console.log("=== COMPARISON: Instagram vs Blog ===\n");

let missing = [];
let present = [];

for (const ig of instagramPosts) {
  const postId = "ig-" + ig.shortcode.toLowerCase();
  const found = blogIds.includes(postId);
  if (found) {
    present.push(ig.shortcode);
    console.log(`✅ ${ig.shortcode.padEnd(15)} (${ig.type.padEnd(4)}) — IN BLOG`);
  } else {
    missing.push(ig);
    console.log(`❌ ${ig.shortcode.padEnd(15)} (${ig.type.padEnd(4)}) — MISSING!`);
  }
}

console.log(`\n--- Summary ---`);
console.log(`In blog: ${present.length}/${instagramPosts.length}`);
console.log(`Missing: ${missing.length}`);
if (missing.length > 0) {
  console.log(`\nMissing shortcodes:`);
  missing.forEach(m => console.log(`  - ${m.shortcode} (${m.type})`));
}
