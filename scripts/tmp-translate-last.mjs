import fs from 'fs';

const SITE_CONTENT_FILE = 'public/config/site-content.json';
const siteContent = JSON.parse(fs.readFileSync(SITE_CONTENT_FILE, 'utf8'));

const post = siteContent.blog.posts.find(p => p.id === 'ig-dw6o-tojlsv');
if (post) {
  post.title.en = "When it comes to premium tuning, details matter. Here's why Brixton Forged des...";
  post.title.ua = "Коли мова йде про преміальний тюнінг, деталі вирішують все. Brixton Forged";
  post.caption.en = `When it comes to premium tuning, details make all the difference. Here's why Brixton Forged deserves your attention:

1️⃣ Made from high-quality forged aluminium, carbon, or magnesium alloys. They are significantly lighter yet much stronger than standard cast wheels.
2️⃣ Less wheel weight = better acceleration, braking, and handling.
3️⃣ Each set is calculated to the millimeter for a specific car model. Wheels fit perfectly in the arches without any spacers.

Brixton is the choice of those who understand that premium tuning starts with details.

Available at One Company.

#brixtonforged #onecompany #cartuning`;
  
  console.log('✅ Translated DW6O-TOjLSv');
} else {
  console.log('❌ Post not found');
}

fs.writeFileSync(SITE_CONTENT_FILE, JSON.stringify(siteContent, null, 2));
