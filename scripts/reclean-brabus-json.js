import fs from 'fs';
import path from 'path';

const INPUT_JSON = path.join(process.cwd(), 'brabus-seo-catalog.json');
const OUTPUT_JSON = path.join(process.cwd(), 'brabus-seo-catalog-cleaned.json');

const triggerPhrases = [
  'Bottrop', 'Боттроп',
  'installed at BRABUS', 'встановлено на заводі',
  'installed by a BRABUS', 'встановлено дилером',
  'requires extensive consultation', 'вимагає детальної консультації',
  'We use cookies', 'Ми використовуємо',
  'purchase and installation', 'придбання та встановленн',
  'installation must be performed', 'монтаж повинен виконува',
  'After internal verification', 'внутрішньої перевірки',
  'YouTube', 'Coveto', 'Google Maps',
  'BRABUS GmbH', 'shopping cart', 'кошика', 'кошику',
  'These articles will be requested', 'без покупки',
  'TÜV', 'without purchase', 'worldwide', 'по всьому світу',
  'веб-сайт', 'country', 'країну', 'країнах',
  'консультант BRABUS', 'BRABUS dealer', 'дилер BRABUS',
  'for the installation', 'вартість встановлення',
  'specialist workshop', 'specialist company', 'спеціалізованою компанією',
  'безпосередньої купівлі', 'inquiry item', 'товар для запиту',
  'Shopping basket', 'наразі недоступний', 'not available for direct purchase'
];

function cleanParagraphs(html) {
  if (!html) return html;
  // split by </p>
  const parts = html.split('</p>');
  const kept = [];
  
  for (let p of parts) {
    if (!p.trim()) continue;
    const fullParagraph = p + '</p>';
    
    // Check if paragraph contains any trigger
    const hasTrigger = triggerPhrases.some(t => fullParagraph.toLowerCase().includes(t.toLowerCase()));
    
    if (!hasTrigger) {
      kept.push(fullParagraph);
    }
  }
  return kept.join('');
}

function main() {
  console.log('🧹 Deep Cleaning Brabus JSON Catalog...');
  const data = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf-8'));
  
  let cleanedCount = 0;
  for (const p of data) {
    let changed = false;
    if (p.descriptionEn) {
      const c = cleanParagraphs(p.descriptionEn);
      if (c !== p.descriptionEn) { p.descriptionEn = c; changed = true; }
    }
    if (p.descriptionUk) {
      const c = cleanParagraphs(p.descriptionUk);
      if (c !== p.descriptionUk) { p.descriptionUk = c; changed = true; }
    }
    
    p.titleEn = p.titleEn || p.title;
    p.titleUk = p.titleUk || p.title;
    
    if (changed) cleanedCount++;
  }
  
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ Saved tightly cleaned catalog to brabus-seo-catalog-cleaned.json. Cleaned ${cleanedCount} products.`);
}

main();
