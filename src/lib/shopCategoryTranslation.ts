/**
 * Category translation map: UA → EN.
 * Used when the `categoryEn` field contains untranslated Ukrainian text.
 */
const CATEGORY_UA_TO_EN: Record<string, string> = {
  'Дзеркала': 'Mirrors',
  'Аксесуари вихлопної системи': 'Exhaust Accessories',
  'Сорочки': 'Apparel',
  'Головні убори': 'Headwear',
  'Системи кат-бек (задня частина)': 'Cat-Back Systems',
  'Даунпайпи, аппайпи та каталізатори': 'Downpipes & Catalytic Converters',
  'Дифузори': 'Diffusers',
  'GPS, Dash-консолі і аксесуари': 'GPS, Dash Consoles & Accessories',
  'Випускні колектори': 'Exhaust Manifolds',
  'Спойлери і аксесуари': 'Spoilers & Accessories',
  'Гальмівні диски': 'Brake Rotors',
  'Гальмівні колодки': 'Brake Pads',
  'Підвіска': 'Suspension',
  'Впуск': 'Intake',
  'Вихлоп': 'Exhaust',
  'Мото вихлоп': 'Moto Exhaust',
  'Мото підвіска': 'Moto Suspension',
  'Мото керування': 'Moto Controls',
  'Мото електроніка': 'Moto Electronics',
  'Мото диски': 'Moto Wheels',
  'Диски': 'Wheels',
  'Гальма': 'Brakes',
  'Охолодження': 'Cooling',
  'Аеродинаміка': 'Aerodynamics',
  'Обвіс': 'Body Kits',
  'Інтер\'єр': 'Interior',
  'Екстер\'єр': 'Exterior',
  'Електроніка': 'Electronics',
  'Тюнінг двигуна': 'Engine Tuning',
  'Карбонові деталі': 'Carbon Parts',
};

/**
 * Detect if text is Ukrainian (contains Cyrillic characters).
 */
function isUkrainianText(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Resolve the English category name.
 * If the EN field contains Ukrainian text, translate it via the mapping.
 */
export function resolveEnglishCategory(categoryEn: string | null | undefined, categoryUa: string | null | undefined): string {
  const en = (categoryEn ?? '').trim();
  const ua = (categoryUa ?? '').trim();

  // If EN is properly in English, return it
  if (en && !isUkrainianText(en)) {
    return en;
  }

  // EN contains Ukrainian — try to translate
  if (en && CATEGORY_UA_TO_EN[en]) {
    return CATEGORY_UA_TO_EN[en];
  }

  // Try the UA field
  if (ua && CATEGORY_UA_TO_EN[ua]) {
    return CATEGORY_UA_TO_EN[ua];
  }

  // Fallback: return whatever we have, or capitalize it
  return en || ua || '';
}
