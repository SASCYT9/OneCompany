/**
 * Burger Motorsports — Translation Preview
 * Translates 5 sample descriptions to show the user quality before full batch
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const prisma = new PrismaClient();

const PROMPT_TEMPLATE = `You are a professional Ukrainian translator for an automotive performance parts e-commerce store "One Company".

TASK: Translate the product title and description from English to Ukrainian.

RULES:
1. Use natural Ukrainian, not machine translation. 
2. Keep automotive terminology accurate: "тюнер", "підключи і працюй" (plug & play), "крутний момент", "к.с." (HP), "турбонаддув", etc.
3. Keep brand names untranslated: JB4, BMS, Fuel-It!, JB+, CANflex, JB4PRO
4. Keep model/engine codes untranslated: N54, B58, S58, B48, etc.
5. Keep vehicle names in original: BMW 335i, Kia Stinger, etc.
6. Do NOT add any content that is not in the original.
7. Do NOT mention Burger Motorsports as the seller — we are "One Company", the authorized dealer.
8. Translate "Made in USA" → "Виробництво США".
9. If description mentions warranty, translate as "Гарантія виробника".
10. Keep technical specs (psi, hp, whp, tq, etc.) in original units.

INPUT TITLE: {title}

INPUT DESCRIPTION:
{description}

Respond ONLY with raw JSON (no markdown, no code blocks):
{
  "titleUa": "translated Ukrainian title",
  "descriptionUa": "translated Ukrainian description"
}`;

async function translateOne(title, description) {
  const prompt = PROMPT_TEMPLATE
    .replace('{title}', title)
    .replace('{description}', description);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 },
  });

  let raw = result.response.text().trim();
  if (raw.startsWith('```json')) raw = raw.replace(/^```json\n?/, '').replace(/```$/, '').trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```\n?/, '').replace(/```$/, '').trim();
  return JSON.parse(raw);
}

async function main() {
  console.log('🍔 Burger Motorsports — Translation Preview\n');

  // Pick 5 diverse products: short, medium, long, different types
  const samples = await prisma.shopProduct.findMany({
    where: { brand: 'Burger Motorsports', bodyHtmlEn: { not: '' } },
    select: { id: true, titleEn: true, bodyHtmlEn: true, productType: true, priceUsd: true },
    orderBy: { priceUsd: 'desc' },
  });

  // Pick diverse samples
  const picks = [
    samples.find(s => s.productType === 'JB4 Tuners' && s.bodyHtmlEn.length > 1000),
    samples.find(s => s.productType === 'Flex Fuel Kits' && s.bodyHtmlEn.length > 500),
    samples.find(s => s.productType === 'Intakes'),
    samples.find(s => s.bodyHtmlEn.length < 150),
    samples.find(s => s.productType === 'Port Injection & Manifolds'),
  ].filter(Boolean);

  for (const product of picks) {
    console.log('━'.repeat(80));
    console.log(`📦 [${product.productType}] ${product.titleEn}`);
    console.log(`   Price: $${product.priceUsd} | Desc length: ${product.bodyHtmlEn.length} chars`);
    console.log('');
    
    // Show original (truncated)
    console.log('📝 ORIGINAL EN:');
    console.log(product.bodyHtmlEn.slice(0, 300) + (product.bodyHtmlEn.length > 300 ? '...' : ''));
    console.log('');

    try {
      const translated = await translateOne(product.titleEn, product.bodyHtmlEn.slice(0, 2000));
      
      console.log('🇺🇦 TITLE UA:');
      console.log(`   EN: ${product.titleEn}`);
      console.log(`   UA: ${translated.titleUa}`);
      console.log('');
      console.log('🇺🇦 DESCRIPTION UA (preview):');
      console.log(translated.descriptionUa.slice(0, 400) + (translated.descriptionUa.length > 400 ? '...' : ''));
    } catch (err) {
      console.log('❌ Translation failed:', err.message);
    }
    console.log('\n');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
