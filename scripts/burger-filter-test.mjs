// Quick filter test — what to exclude from Burger Motorsports catalog

const EXCLUDE_TITLE = [
  /Official.*Clothing/i, /Keychain/i, /Towel/i, /Banner/i,
  /Sticker/i, /Decal/i, /\bHat\b/i, /Flexfit/i, /Emblem.*Badge/i,
  /CARB Sticker/i, /Core Deposit/i,
  /^Add /i, /^Choose /i, /^Include /i, /^Upgrade /i,
  /^Optional /i, /^Options$/i, /^Do you need/i,
  /per Foot$/i, /FSB for JB4/i,
  /Phone Mount/i, /Cell Phone/i, /Faraday/i,
];

async function run() {
  let all = [];
  for (let p = 1; p <= 3; p++) {
    const r = await fetch(`https://burgertuning.com/products.json?limit=250&page=${p}`);
    const d = await r.json();
    all = all.concat(d.products);
  }

  const excluded = all.filter(p => EXCLUDE_TITLE.some(rx => rx.test(p.title)));
  const kept = all.filter(p => !EXCLUDE_TITLE.some(rx => rx.test(p.title)));

  console.log(`EXCLUDED (${excluded.length}):`);
  excluded.forEach(p => console.log(`  ❌ [${p.product_type}] ${p.title}`));

  console.log(`\nKEPT: ${kept.length} products`);

  const tc = {};
  kept.forEach(p => { tc[p.product_type] = (tc[p.product_type] || 0) + 1; });
  console.log('\nProduct Types (after filter):');
  Object.entries(tc).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  ${c} — ${t}`));
}
run();
