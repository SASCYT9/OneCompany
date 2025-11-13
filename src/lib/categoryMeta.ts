export type CategorySlug = 'exhaust' | 'suspension' | 'wheels' | 'brakes' | 'intake' | 'interior' | 'performance';

export type Localized = { ua: string; en: string };

export type CategoryMeta = {
  slug: CategorySlug;
  title: Localized;
  intro: Localized; // What this is, for whom, what benefits
};

export const CATEGORY_META: CategoryMeta[] = [
  {
    slug: 'exhaust',
    title: { ua: 'Системи випуску', en: 'Exhaust Systems' },
    intro: {
      ua: 'Преміум вихлопні системи для потужності, звуку та характеру. Легші матеріали, зменшений опір та активні клапани надають вашому авто емоційний тембр та вимірювані прирости продуктивності.',
      en: 'Premium exhaust systems for power, sound and character. Lighter materials, reduced backpressure and active valves deliver an emotional tone and measurable performance gains.'
    }
  },
  {
    slug: 'suspension',
    title: { ua: 'Підвіска', en: 'Suspension' },
    intro: {
      ua: 'Котушки та амортизатори для точного керування, стабільності та комфорту. Вивірена геометрія та регулювання допомагають досягти ідеального балансу для міста та треку.',
      en: 'Coilovers and dampers for precise control, stability and comfort. Geometry and adjustability refined for the perfect balance on street and track.'
    }
  },
  {
    slug: 'wheels',
    title: { ua: 'Диски та шини', en: 'Wheels & Tires' },
    intro: {
      ua: 'Легкосплавні та ковані диски з мотоспортною спадщиною. Зменшена непідресорена маса, індивідуальні параметри та фініші, що формують стиль і керованість.',
      en: 'Lightweight forged and cast wheels with motorsport pedigree. Reduced unsprung mass, bespoke fitments and finishes that define style and handling.'
    }
  },
  {
    slug: 'brakes',
    title: { ua: 'Гальмівні системи', en: 'Brake Systems' },
    intro: {
      ua: 'Модернізовані супорти, диски та колодки для стабільного гальмування без фейду. Точність педалі, тепловідведення та надійність на дорозі і треку.',
      en: 'Upgraded calipers, discs and pads for consistent, fade-free braking. Pedal precision, heat management and reliability on road and track.'
    }
  },
  {
    slug: 'intake',
    title: { ua: 'Впускна система', en: 'Air Intake' },
    intro: {
      ua: 'Інжинірингові впуски, що покращують потік повітря та температуру на впуску. Карбон та продумана аеродинаміка для стабільних приростів потужності.',
      en: 'Engineered intakes that improve airflow and intake temperatures. Carbon construction and refined aero paths for consistent power gains.'
    }
  },
  {
    slug: 'interior',
    title: { ua: 'Інтер’єр', en: 'Interior' },
    intro: {
      ua: 'Спортивні сидіння та інтер’єрні рішення, що підсилюють контроль і комфорт. Ергономіка, сертифікація та матеріали преміум-класу.',
      en: 'Sport seats and interior solutions that enhance control and comfort. Ergonomics, certifications and premium materials.'
    }
  },
  {
    slug: 'performance',
    title: { ua: 'Продуктивність', en: 'Performance' },
    intro: {
      ua: 'Інтеркулери, пайпінг, охолодження та апгрейди, що підвищують ефективність двигуна. Компоненти з запасом міцності для серйозних проектів.',
      en: 'Intercoolers, piping, cooling and upgrades that raise engine efficiency. Headroom-built components for serious builds.'
    }
  }
];

export function getCategoryMeta(slug: CategorySlug): CategoryMeta | undefined {
  return CATEGORY_META.find(c => c.slug === slug);
}

export const categorySlugs = CATEGORY_META.map(c => c.slug);
