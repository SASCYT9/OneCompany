import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pLimit from 'p-limit';

import dotenv from 'dotenv';
dotenv.config({ override: true });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY environment variable. Exiting.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using the best model

const INPUT_JSON = path.join(process.cwd(), 'brabus-products.json');
const OUTPUT_JSON = path.join(process.cwd(), 'brabus-seo-catalog.json');

const CONCURRENCY = 5; // Safe setting for free/dev API keys

async function generateSeoContent(title, description, retries = 3) {
  if (!title && !description) return null;
  
  const prompt = `You are a premium luxury automotive SEO copywriter for Brabus products.
Task: Process the following product title and description.
1. Create a slightly optimized English SEO Title (seoTitleEn) - keep it premium, factual, do not add fake claims. Max 70 chars.
2. Create an enhanced English description (seoDescEn) - slightly improve the flow of the original text, add a touch of exclusivity, but KEEP ALL HTML formatting exactly (paragraphs, bolding etc). Do NOT invent technical specs. Just make it sound more premium than a raw scraped copy.
3. Provide a high-quality Ukrainian manual translation of the title (seoTitleUa).
4. Provide a high-quality Ukrainian manual translation of the enhanced description (seoDescUa). Keep all HTML tags. Do not use direct machine translation words. Use professional automotive terminology ("робочий об'єм", "крутний момент", "карбоновий", etc).

Input Title:
${title}

Input Description HTML:
${description || ""}

Respond ONLY with raw JSON in this exact format (no markdown blocks, no \`\`\`json):
{
  "seoTitleEn": "...",
  "seoTitleUa": "...",
  "seoDescEn": "...",
  "seoDescUa": "..."
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3, // keep it factual
      }
    });
    
    let rawText = result.response.text().trim();
    if (rawText.startsWith('\`\`\`json')) {
      rawText = rawText.replace(/^\`\`\`json/m, '').replace(/\`\`\`$/m, '').trim();
    }
    return JSON.parse(rawText);
  } catch (err) {
    if (retries > 0) {
      console.warn(`[!] API Error: ${err.message}. Retrying in 3s... (${retries} left)`);
      if (err.message && err.message.includes("429")) {
        await new Promise(r => setTimeout(r, 10000));
      } else {
        await new Promise(r => setTimeout(r, 3000));
      }
      return generateSeoContent(title, description, retries - 1);
    }
    console.error('Translation error on final retry:', err);
    return null;
  }
}

async function main() {
  console.log('🤖 Brabus Multi-threaded Gemini SEO Engine');
  console.log('==========================================');
  
  if (!fs.existsSync(INPUT_JSON)) {
    console.error(`File not found: ${INPUT_JSON}`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf-8'));
  console.log(`📡 Loaded ${products.length} products for SEO generation.\n`);

  let processed = 0;
  const limit = pLimit(CONCURRENCY);

  const outProducts = [];

  const promises = products.map((product, i) =>
    limit(async () => {
      // If we already have localized data, we could skip, but we want fresh SEO content.
      // We will only run if it's missing the new seoDescEn field.
      if (!product.seoDescEn && (product.title || product.description)) {
        const seoData = await generateSeoContent(product.title, product.description);
        if (seoData) {
          product.titleEn = seoData.seoTitleEn || product.title;
          product.titleUk = seoData.seoTitleUa;
          product.descriptionEn = seoData.seoDescEn || product.description;
          product.descriptionUk = seoData.seoDescUa;
        }
      }
      
      outProducts.push(product);
      processed++;
      if (processed % 5 === 0 || processed === products.length) {
        process.stdout.write(`\r✅ Processed [${processed}/${products.length}] items...`);
        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(outProducts, null, 2), 'utf-8');
      }
      await new Promise(r => setTimeout(r, 400));
    })
  );

  await Promise.all(promises);

  console.log(`\n\n🎉 Finished processing! Catalog saved to ${OUTPUT_JSON}`);
}

main();
