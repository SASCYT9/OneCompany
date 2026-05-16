// Re-run the exact UI filter logic against current DB state and report
// the chassis dropdown contents for every model, plus any anomalies.
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const CHASSIS_TAG = /^[A-Z]\s?\d{3}[A-Z]?$/;
const CHASSIS_TITLE = /[–—-]\s*([A-Z]\s?\d{3}[A-Z]?)\s*[–—-]/;
const norm = (v) => v.replace(/^([A-Z])\s*(\d)/, "$1 $2");

const MODEL_KEYS = new Set([
  "G-Klasse",
  "A-Klasse",
  "C-Klasse",
  "CLS-Klasse",
  "E-Klasse",
  "EQC-Klasse",
  "EQC",
  "EQS-Klasse",
  "EQS SUV",
  "GLB-Klasse",
  "GLC-Klasse",
  "GLE-Klasse",
  "GLS-Klasse",
  "GT-Klasse",
  "S-Klasse",
  "SL-Klasse",
  "V-Klasse",
  "X-Klasse",
  "Porsche 911 Turbo",
  "Porsche Taycan",
  "Rolls-Royce Ghost",
  "Rolls-Royce Cullinan",
  "Bentley Continental GT Speed",
  "Bentley Continental GTC Speed",
  "Lamborghini Urus SE",
  "P530",
  "smart #1",
  "smart #3",
]);

const EXPECTED = {
  "G-Klasse": new Set(["W 463", "W 463A", "W 465"]),
  "S-Klasse": new Set([
    "W 222",
    "W 223",
    "V 222",
    "V 223",
    "X 222",
    "X 223",
    "Z 223",
    "C 217",
    "A 217",
  ]),
  "EQS-Klasse": new Set(["V 297", "X 297"]),
  "EQS SUV": new Set(["X 296"]),
  "SL-Klasse": new Set(["R 230", "R 231", "R 232"]),
  "GT-Klasse": new Set(["X 290", "C 190", "R 190", "C 192"]),
  "A-Klasse": new Set(["W 177", "V 177"]),
  "C-Klasse": new Set(["W 205", "S 205", "A 205", "C 205", "W 206", "S 206", "A 206", "C 206"]),
  "CLS-Klasse": new Set(["C 257", "X 257"]),
  "E-Klasse": new Set(["W 213", "S 213", "A 238", "C 238", "W 214", "S 214"]),
  EQC: new Set(["N 293"]),
  "GLB-Klasse": new Set(["X 247"]),
  "GLC-Klasse": new Set(["X 253", "C 253", "X 254", "C 254"]),
  "GLE-Klasse": new Set(["V 167", "C 167", "C 292"]),
  "GLS-Klasse": new Set(["X 166", "X 167"]),
  "V-Klasse": new Set(["W 447", "V 447"]),
  "X-Klasse": new Set(["W 470"]),
};

const products = await p.shopProduct.findMany({
  where: {
    OR: [
      { brand: { equals: "brabus", mode: "insensitive" } },
      { vendor: { equals: "brabus", mode: "insensitive" } },
    ],
  },
  select: { sku: true, titleEn: true, titleUa: true, tags: true },
});

function modelKey(x) {
  return (x.tags || []).find((t) => MODEL_KEYS.has(t)) || null;
}
function chassisKey(x) {
  const tag = (x.tags || []).find((t) => CHASSIS_TAG.test(t));
  if (tag) return norm(tag);
  for (const t of [x.titleEn, x.titleUa]) {
    if (!t) continue;
    const m = t.match(CHASSIS_TITLE);
    if (m) return norm(m[1]);
  }
  return null;
}

// Replay availableChassis for each model
const perModel = new Map();
for (const x of products) {
  const m = modelKey(x);
  if (!m) continue;
  const c = chassisKey(x);
  if (!c) continue;
  if (!perModel.has(m)) perModel.set(m, new Map());
  perModel.get(m).set(c, (perModel.get(m).get(c) || 0) + 1);
}

let anomalies = 0;
for (const [model, counts] of [...perModel.entries()].sort()) {
  const expected = EXPECTED[model];
  const items = [...counts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true })
  );
  const bad = expected ? items.filter(([c]) => !expected.has(c)) : [];
  const status = bad.length === 0 ? "OK" : `FAIL (${bad.length} foreign chassis)`;
  console.log(`\n${model.padEnd(20)} ${status}`);
  for (const [c, n] of items) {
    const flag = expected && !expected.has(c) ? "  <-- FOREIGN" : "";
    console.log(`  ${c.padEnd(8)} ${String(n).padStart(4)}${flag}`);
  }
  anomalies += bad.length;
}

console.log(`\n===== Total foreign-chassis anomalies: ${anomalies} =====`);
await p.$disconnect();
