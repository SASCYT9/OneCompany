import { fetchTurn14ItemDetail } from './src/lib/turn14.js';

async function main() {
  try {
    // 100496 is the Prothane item ID we tested earlier
    const detail = await fetchTurn14ItemDetail('100496');
    console.log(JSON.stringify(detail, null, 2));
  } catch (e) {
    console.error(e);
  }
}

main();
