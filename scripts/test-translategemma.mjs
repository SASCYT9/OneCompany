/**
 * TranslateGemma 4B — Speed & Quality Test
 * Specialized translation model vs general Gemma3
 */
import 'dotenv/config';
import { PrismaClient } from '../node_modules/.prisma/client/index.js';

const prisma = new PrismaClient();
const OLLAMA = 'http://localhost:11434/api/generate';

// TranslateGemma uses a specific prompt format:
// <2uk> text to translate
// Where <2uk> means "translate to Ukrainian"

async function translateTG(text) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 60000);

  const resp = await fetch(OLLAMA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      model: 'translategemma:4b',
      prompt: `<2uk> ${text}`,
      stream: false,
      options: { temperature: 0.1, num_predict: 2048 },
    }),
  });

  const data = await resp.json();
  return data.response?.trim() || '';
}

async function main() {
  console.log('🔄 TranslateGemma 4B — Translation Test\n');

  const tests = [
    // Title
    'JB4 Performance Tuner for BMW N54 335i 135i',
    // Short desc
    'Replacement harness for JB4 performance tuners.',
    // Medium desc
    'The JB4 is a plug and play tuner that plugs into easy to access sensors in the engine bay and works with your factory ECU tuning to remap boost, timing, and fueling for optimal performance and reduced turbo lag. Including maps for pump gas, race gas, and ethanol fuel mixtures up to 30% E85.',
    // Long desc
    'More air = more power + amazing looks, and dramatic sound improvement. A few of the issues with the new V8 RS engines are a highly restrictive factory intake and just not enough sound coming from under the hood during acceleration. We addressed all of these issues with our new Audi RS dual air intake system, unlocking extra horsepower and torque to the wheels. In addition to the extra power and throttle response, the turbo spool and sound are dramatically improved. The intake pipes are powder-coated black along with a black anodized heat shield. Includes two renewable BMS high flow inverted cone filters.',
    // Vehicle fitment
    'Vehicle Fitment: BMW 2 Series 2022-2024 G42 G43 B46/B48 BMW 220i 230i, BMW 3 Series 2019-2025 G20 B48 BMW 330i 330ix, BMW 4 Series 2021-2025 G22 G24 B48 BMW 430i 430ix',
  ];

  for (let i = 0; i < tests.length; i++) {
    const t0 = Date.now();
    const result = await translateTG(tests[i]);
    const ms = Date.now() - t0;
    
    console.log(`--- Test ${i + 1} (${ms}ms) ---`);
    console.log(`EN: ${tests[i].slice(0, 120)}${tests[i].length > 120 ? '...' : ''}`);
    console.log(`UA: ${result.slice(0, 200)}${result.length > 200 ? '...' : ''}`);
    console.log('');
  }

  // Speed estimate
  const t0 = Date.now();
  await translateTG(tests[2]); // medium
  const mediumMs = Date.now() - t0;
  console.log(`\n⏱️ Speed estimate:`);
  console.log(`  Medium text: ${mediumMs}ms`);
  console.log(`  Est. total for 606 products (title+desc): ~${Math.round(606 * 2 * mediumMs / 60000)} min`);

  await prisma.$disconnect();
}

main().catch(console.error);
