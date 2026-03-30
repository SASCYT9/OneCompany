import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const apiKey = process.env.DEEPL_AUTH_KEY;
if (!apiKey || apiKey === "твій_новий_ключ_сюди_вставляти") {
  console.error("Missing valid DEEPL_AUTH_KEY. Please add it to your .env file.");
  process.exit(1);
}

// Automatically switch URL based on key type (DeepL Free keys end in :fx)
const isFreeKey = apiKey.endsWith(':fx');
const DEEPL_URL = isFreeKey 
  ? 'https://api-free.deepl.com/v2/translate' 
  : 'https://api.deepl.com/v2/translate';

// We just read the output from the scraper
const INPUT_JSON = path.join(process.cwd(), 'brabus-products.json');
const OUTPUT_JSON = path.join(process.cwd(), 'brabus-seo-catalog.json');

// DeepL allows multiple texts per request, but we'll do concurrent individual requests for simplicity and safety, 
// using a moderate limit. DeepL Pro can handle high concurrency.
const limit = pLimit(10); 

async function translateWithDeepL(text, targetLang, retries = 3) {
  if (!text) return text;
  
  try {
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('target_lang', targetLang.toUpperCase());
    params.append('tag_handling', 'html'); // Preserve HTML exactly!
    params.append('preserve_formatting', '1');

    const response = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 403) {
         throw new Error('403 Forbidden - Invalid DeepL API key. Make sure you pasted the Pro key properly.');
      }
      throw new Error(`DeepL API error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    return data.translations && data.translations[0] ? data.translations[0].text : text;
  } catch (err) {
    if (retries > 0 && !err.message.includes('403 Forbidden')) {
      console.warn(`[!] DeepL Error: ${err.message}. Retrying... (${retries} left)`);
      await new Promise(r => setTimeout(r, 2000));
      return translateWithDeepL(text, targetLang, retries - 1);
    }
    throw err;
  }
}

async function main() {
  console.log('🤖 Brabus DeepL Pro Translation Engine (Preserving HTML)');
  console.log('========================================================');
  
  if (!fs.existsSync(INPUT_JSON)) {
    console.error(`File not found: ${INPUT_JSON}`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf-8'));
  console.log(`📡 Loaded ${products.length} products for DeepL translation (${isFreeKey ? "Free API" : "Pro API"}).\n`);

  let processed = 0;
  const outProducts = [];

  const promises = products.map((product) =>
    limit(async () => {
      try {
        // We always use English as base. If it doesn't exist, fallback to DE maybe? But we always scrape EN descriptions.
        const baseTitle = product.title || "";
        const baseDesc = product.description || "";

        let titleUk = "";
        let descUk = "";

        if (baseTitle) {
           titleUk = await translateWithDeepL(baseTitle, "UK");
        }
        if (baseDesc) {
           descUk = await translateWithDeepL(baseDesc, "UK");
        }

        // Map the SEO fields that the importer script expects
        product.titleEn = baseTitle;
        product.titleUk = titleUk;
        product.descriptionEn = baseDesc;
        product.descriptionUk = descUk;

        outProducts.push(product);
        processed++;

        if (processed % 10 === 0 || processed === products.length) {
          process.stdout.write(`\r✅ Translated [${processed}/${products.length}] items...`);
          // Save incrementally just in case
          fs.writeFileSync(OUTPUT_JSON, JSON.stringify(outProducts, null, 2), 'utf-8');
        }
      } catch (err) {
         console.error(`\n❌ Failed to process product ${product.sku}: ${err.message}`);
         process.exit(1);
      }
    })
  );

  await Promise.all(promises);
  console.log(`\n\n🎉 Finished translation! Catalog saved to ${OUTPUT_JSON}`);
}

main();
