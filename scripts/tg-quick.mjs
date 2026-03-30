/**
 * TranslateGemma quick test — correct prompt format
 */
const OLLAMA = 'http://localhost:11434/api/generate';

async function translate(text) {
  const resp = await fetch(OLLAMA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'translategemma:4b',
      prompt: `Translate to Ukrainian: ${text}`,
      stream: false,
      options: { temperature: 0.1, num_predict: 1024 },
    }),
  });
  return (await resp.json()).response?.trim() || '';
}

const tests = [
  'JB4 Performance Tuner for BMW N54 335i 135i',
  'Replacement harness for JB4 performance tuners.',
  'Dual Turbo Intake System for 2021+ Audi RS6 / RS7',
  'The JB4 is a plug and play tuner that plugs into easy to access sensors in the engine bay and works with your factory ECU tuning to remap boost, timing, and fueling for optimal performance and reduced turbo lag.',
  'More air = more power + amazing looks, and dramatic sound improvement. The intake pipes are powder-coated black along with a black anodized heat shield. Includes two renewable BMS high flow inverted cone filters. Vehicle Fitment: 2021+ Audi RS6 C8, 2021+ Audi RS7 C8.',
];

for (const t of tests) {
  const t0 = Date.now();
  const result = await translate(t);
  const ms = Date.now() - t0;
  console.log(`[${ms}ms] EN: ${t.slice(0, 80)}`);
  console.log(`       UA: ${result.slice(0, 200)}`);
  console.log('');
}
