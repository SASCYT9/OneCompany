import fs from 'fs';

const JSON_PATH = 'd:/OneCompany/do88-products-v4.json';
const SQL_PATH = 'd:/OneCompany/update_do88.sql';

const DICT = {
  'Kolfiberkåpa': { en: 'Carbon Fiber Cover', ua: 'Карбонова кришка' },
  'insugskåpa': { en: 'Intake Cover', ua: 'Впускна кришка' },
  'Insugskåpa': { en: 'Intake Cover', ua: 'Впускна кришка' },
  'Insugssystem': { en: 'Intake System', ua: 'Впускна система' },
  'kolfiber': { en: 'Carbon Fiber', ua: 'Карбон' },
  'Kolfiber': { en: 'Carbon Fiber', ua: 'Карбон' },
  'Modellanpassat': { en: 'Vehicle Specific', ua: 'Оригінальний' },
  'Для авто ': { ua: '' },
  'För': { en: 'For', ua: 'Для' },
  'för': { en: 'for', ua: 'для' },
  'Med': { en: 'With', ua: 'З' },
  'med': { en: 'with', ua: 'з' },
  'Och': { en: 'And', ua: 'Та' },
  'och': { en: 'and', ua: 'та' },
  'Tryckrör': { en: 'Charge Pipe', ua: 'Нагнітальна труба' },
  'tryckrör': { en: 'charge pipe', ua: 'нагнітальна труба' },
  'Tryckslang': { en: 'Boost Hose', ua: 'Патрубок наддуву' },
  'tryckslang': { en: 'boost hose', ua: 'патрубок наддуву' },
  'Kåpa': { en: 'Cover', ua: 'Кришка' },
  'kåpa': { en: 'cover', ua: 'кришка' },
  'Pysventil': { en: 'Bleed Valve', ua: 'Кран' },
};

function fixTitle(text, lang) {
  if (!text) return '';
  let result = text;
  Object.keys(DICT).forEach(sv => {
    const replacement = DICT[sv]?.[lang];
    if (replacement !== undefined) {
      if (sv === 'Для авто ') {
        result = result.replace(sv, replacement);
      } else {
         const regex = new RegExp(`\\b${sv}\\b`, 'g');
         result = result.replace(regex, replacement);
      }
    }
  });
  return result.replace(/\s+/g, ' ').trim();
}

console.log('Generating SQL...');
const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
let sql = 'BEGIN;\n';

for (const p of data) {
  const fixedEn = fixTitle(p.titleEn, 'en').replace(/'/g, "''");
  const fixedUa = fixTitle(p.titleUa, 'ua').replace(/'/g, "''");
  sql += `UPDATE "ShopProduct" SET "titleEn" = '${fixedEn}', "titleUa" = '${fixedUa}' WHERE "sku" = '${p.sku}' AND "vendor" = 'DO88';\n`;
}

sql += 'COMMIT;\n';
fs.writeFileSync(SQL_PATH, sql);
console.log('Generated update_do88.sql successfully.');
