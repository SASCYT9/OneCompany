import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY environment variable. Exiting.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const INPUT_JSON = path.join(process.cwd(), 'brabus-products.json');
const OUTPUT_JSON = path.join(process.cwd(), 'brabus-catalog.json');

async function translateText(text) {
  if (!text || text.trim() === '') return '';
  try {
    const prompt = `Translate the following automotive tuning product text to Ukrainian.
Preserve all HTML formatting exactly. Do NOT add conversational text. Output ONLY the translation.

Text:
${text}`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('Translation error:', err);
    return text;
  }
}

async function main() {
  console.log('🤖 Brabus Catalog Gemini Translator');
  console.log('====================================');
  
  if (!fs.existsSync(INPUT_JSON)) {
    console.error(`File not found: ${INPUT_JSON}`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf-8'));
  console.log(`Loaded ${products.length} products for translation.\n`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`Translating [${i+1}/${products.length}] ${product.sku} ...`);
    
    // Translate Title
    if (product.title && !product.titleUk) {
      product.titleUk = await translateText(product.title);
    }
    
    // Translate Description
    if (product.description && !product.descriptionUk) {
       product.descriptionUk = await translateText(product.description);
    } else if (!product.description) {
       product.descriptionUk = '';
    }
    
    // Optional sleep for rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(products, null, 2), 'utf-8');
  console.log(`\n✅ Saved translated catalog to ${OUTPUT_JSON}`);
}

main();
