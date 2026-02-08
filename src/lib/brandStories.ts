import { brandMetadata, countryNames, subcategoryNames } from '@/lib/brands';
import type { ProductSubcategory } from '@/lib/brands';

export type BrandStoryContext = 'Auto' | 'Moto';

export interface BrandStory {
  headline: { en: string; ua: string };
  description: { en: string; ua: string };
  highlights: { en: string; ua: string }[];
}

export interface BrandStoryInput {
  name: string;
  description?: string;
  descriptionUA?: string;
}

function pickCuratedBrandStory(brandName: string, context?: BrandStoryContext): BrandStory | undefined {
  if (context) {
    return curatedBrandStories[`${brandName}_${context}`] ?? curatedBrandStories[brandName];
  }

  return (
    curatedBrandStories[`${brandName}_Auto`] ??
    curatedBrandStories[`${brandName}_Moto`] ??
    curatedBrandStories[brandName]
  );
}

function getSubcategoryTagline(subcategory: ProductSubcategory | undefined, context?: BrandStoryContext) {
  const bySubcategory: Partial<Record<ProductSubcategory, { en: string; ua: string }>> = {
    Engine: { en: 'Power Engineering', ua: 'Інженерія потужності' },
    Exterior: { en: 'Design & Presence', ua: 'Дизайн та характер' },
    Suspension: { en: 'Control & Comfort', ua: 'Контроль та комфорт' },
    Brakes: { en: 'Absolute Control', ua: 'Абсолютний контроль' },
    Wheels: { en: 'Forged Lightness', ua: 'Кована легкість' },
    Exhaust: { en: 'Sound & Performance', ua: 'Звук та продуктивність' },
    Electronics: { en: 'Smart Performance', ua: 'Розумна продуктивність' },
    Interior: { en: 'Crafted Cockpit', ua: 'Досконалий салон' },
    Drivetrain: { en: 'Torque Delivered', ua: 'Передача моменту' },
    Cooling: { en: 'Thermal Advantage', ua: 'Теплова перевага' },
    'Fuel Systems': { en: 'Fuel Precision', ua: 'Точність палива' },
    Aero: { en: 'Downforce & Stability', ua: 'Притиск та стабільність' },
    'Racing Components': { en: 'Track Proven', ua: 'Перевірено треком' },
    'Full Vehicle': { en: 'Turn-Key Builds', ua: 'Готові рішення' },
  };

  if (subcategory && bySubcategory[subcategory]) {
    return bySubcategory[subcategory];
  }

  if (context === 'Moto') {
    return { en: 'Moto Performance', ua: 'Мото продуктивність' };
  }
  if (context === 'Auto') {
    return { en: 'Automotive Performance', ua: 'Авто продуктивність' };
  }
  return { en: 'Performance Essentials', ua: 'Преміум рішення' };
}

function getSubcategoryHighlights(subcategory: ProductSubcategory | undefined): { en: string; ua: string }[] {
  const bySubcategory: Partial<Record<ProductSubcategory, { en: string; ua: string }[]>> = {
    Exhaust: [
      { en: 'Premium materials & precise fitment', ua: 'Преміальні матеріали та точна посадка' },
      { en: 'Sound character with weight reduction', ua: 'Характер звуку та зниження ваги' },
      { en: 'Track-inspired engineering', ua: 'Інженерія з автоспорту' },
    ],
    Wheels: [
      { en: 'Forged strength with low weight', ua: 'Кована міцність та мала вага' },
      { en: 'Custom specs and finishes', ua: 'Індивідуальні параметри та покриття' },
      { en: 'Designed for perfect stance', ua: 'Створено для ідеальної посадки' },
    ],
    Suspension: [
      { en: 'Sharper handling and stability', ua: 'Краще керування та стабільність' },
      { en: 'Street and track-ready setups', ua: 'Налаштування для міста та треку' },
      { en: 'Reliable components under load', ua: 'Надійність під навантаженням' },
    ],
    Brakes: [
      { en: 'Consistent bite and pedal feel', ua: 'Стабільний “укус” та відчуття педалі' },
      { en: 'Fade resistance under heat', ua: 'Стійкість до перегріву' },
      { en: 'OEM+ fitment and durability', ua: 'OEM+ сумісність та довговічність' },
    ],
    Aero: [
      { en: 'Downforce-focused design', ua: 'Дизайн з фокусом на притиск' },
      { en: 'Premium carbon and composites', ua: 'Преміум карбон та композити' },
      { en: 'Track-inspired styling', ua: 'Стиль з автоспортом у ДНК' },
    ],
    Engine: [
      { en: 'Precision parts for power builds', ua: 'Точні деталі для потужних збірок' },
      { en: 'Proven performance gains', ua: 'Перевірений приріст продуктивності' },
      { en: 'Durability at high load', ua: 'Ресурс при високих навантаженнях' },
    ],
    Electronics: [
      { en: 'Accurate control and monitoring', ua: 'Точний контроль та моніторинг' },
      { en: 'OEM-level integration', ua: 'Інтеграція рівня OEM' },
      { en: 'Tuners and enthusiasts trusted', ua: 'Довіра тюнерів та ентузіастів' },
    ],
    Cooling: [
      { en: 'Lower temps under sustained load', ua: 'Нижчі температури при навантаженні' },
      { en: 'High-efficiency heat exchange', ua: 'Ефективний теплообмін' },
      { en: 'Track-ready reliability', ua: 'Надійність для треку' },
    ],
    Drivetrain: [
      { en: 'Stronger torque handling', ua: 'Вища витривалість до моменту' },
      { en: 'Smooth power delivery', ua: 'Плавна передача потужності' },
      { en: 'Built for high-power setups', ua: 'Для високопотужних конфігурацій' },
    ],
    'Fuel Systems': [
      { en: 'Stable fueling under boost', ua: 'Стабільна подача під бустом' },
      { en: 'Precision components and flow', ua: 'Точні компоненти та потоки' },
      { en: 'Designed for high horsepower', ua: 'Розраховано на високу потужність' },
    ],
    Exterior: [
      { en: 'OEM+ look with premium finish', ua: 'OEM+ вигляд з преміум покриттям' },
      { en: 'Carbon and aero accents', ua: 'Карбонові та аеро-акценти' },
      { en: 'Fitment-focused manufacturing', ua: 'Виробництво з фокусом на посадку' },
    ],
    Interior: [
      { en: 'Premium materials and feel', ua: 'Преміум матеріали та тактильність' },
      { en: 'Detail-driven craftsmanship', ua: 'Ремесло, де важлива деталь' },
      { en: 'Designed for daily use', ua: 'Створено для щоденного користування' },
    ],
    'Racing Components': [
      { en: 'Motorsport-derived solutions', ua: 'Рішення з автоспорту' },
      { en: 'Built for extreme conditions', ua: 'Для екстремальних умов' },
      { en: 'Consistency lap after lap', ua: 'Стабільність коло за колом' },
    ],
    'Full Vehicle': [
      { en: 'Turn-key packages and builds', ua: 'Готові пакети та збірки' },
      { en: 'Balanced performance strategy', ua: 'Збалансована стратегія продуктивності' },
      { en: 'One-stop project support', ua: 'Підтримка проєкту “під ключ”' },
    ],
  };

  return (
    (subcategory && bySubcategory[subcategory]) ??
    [
      { en: 'Premium selection and fitment', ua: 'Преміум підбір та сумісність' },
      { en: 'Performance-focused engineering', ua: 'Інженерія з фокусом на результат' },
      { en: 'Fast sourcing and support', ua: 'Швидке постачання та підтримка' },
    ]
  );
}

function buildDefaultDescription(
  brandName: string,
  subcategory: ProductSubcategory | undefined,
  countryKey?: keyof typeof countryNames,
  context?: BrandStoryContext
) {
  const countryEn = countryKey ? countryNames[countryKey].en : undefined;
  const countryUa = countryKey ? countryNames[countryKey].ua : undefined;
  const subEn = subcategory ? subcategoryNames[subcategory].en.toLowerCase() : 'performance parts';
  const subUa = subcategory ? subcategoryNames[subcategory].ua : 'тюнінг та компоненти';

  const contextEn = context === 'Moto' ? 'motorcycle' : context === 'Auto' ? 'automotive' : 'performance';
  const contextUa = context === 'Moto' ? 'мото' : context === 'Auto' ? 'авто' : 'преміум';

  return {
    en: `${brandName} delivers premium ${contextEn} ${subEn}${countryEn ? ` from ${countryEn}` : ''}. Built for performance, fitment, and lasting reliability.`,
    ua: `${brandName} — преміальні ${contextUa} рішення у категорії «${subUa}»${countryUa ? ` з ${countryUa}` : ''}. Орієнтовано на результат, точну сумісність та надійність.`,
  };
}

export function getBrandStoryForBrand(brand: BrandStoryInput, context?: BrandStoryContext): BrandStory {
  const curated = pickCuratedBrandStory(brand.name, context);
  if (curated) return curated;

  const meta = brandMetadata[brand.name];
  const subcategory = meta?.subcategory;
  const tagline = getSubcategoryTagline(subcategory, context);
  const fallbackDescription = buildDefaultDescription(brand.name, subcategory, meta?.country, context);

  return {
    headline: {
      en: `${brand.name} · ${tagline.en}`,
      ua: `${brand.name} · ${tagline.ua}`,
    },
    description: {
      en: brand.description ?? fallbackDescription.en,
      ua: brand.descriptionUA ?? fallbackDescription.ua,
    },
    highlights: getSubcategoryHighlights(subcategory),
  };
}

export const curatedBrandStories: Record<string, BrandStory> = {
  // Auto-specific story for Akrapovic
  Akrapovic_Auto: {
    headline: { en: 'Akrapovic · The Sound of Performance', ua: 'Akrapovic · Звук чистої потужності' },
    description: {
      en: 'Lightweight titanium exhaust systems for premium vehicles. Engineered for sound, performance and weight reduction.',
      ua: 'Легкі титанові вихлопні системи для преміальних авто. Створені для звуку, продуктивності та зниження ваги.',
    },
    highlights: [
      { en: 'Evolution Line (Titanium)', ua: 'Evolution Line (Титан)' },
      { en: 'Slip-On Line (Titanium)', ua: 'Slip-On Line (Титан)' },
      { en: 'Carbon Fiber Diffusers', ua: 'Карбонові дифузори' },
    ],
  },
  // Moto-specific story (renamed from generic Akrapovic)
  Akrapovic_Moto: {
    headline: { en: 'Akrapovic · The Sound of Performance', ua: 'Akrapovic · Еталон звуку та потужності' },
    description: {
      en: 'Legendary titanium exhaust systems tuned for sound, performance and weight reduction.',
      ua: 'Легендарні титанові вихлопні системи, створені для звуку, продуктивності та зниження ваги.',
    },
    highlights: [
      { en: 'Titanium systems', ua: 'Титанові системи' },
      { en: 'Carbon components', ua: 'Карбонові елементи' },
      { en: 'Power increase', ua: 'Збільшення потужності' },
    ],
  },
  // Fallback/Generic (optional, keeping for backward compatibility if needed)
  Akrapovic: {
    headline: { en: 'Akrapovic Exhaust Systems', ua: 'Вихлопні системи Akrapovic' },
    description: {
      en: 'World-class exhaust systems for motorcycles and performance cars.',
      ua: 'Вихлопні системи світового класу для мотоциклів та спортивних авто.',
    },
    highlights: [
      { en: 'Titanium & Carbon Fiber', ua: 'Титан та Карбон' },
      { en: 'Performance & Sound', ua: 'Потужність та Звук' },
      { en: 'Racing Heritage', ua: 'Гоночна спадщина' },
    ],
  },
  'SC-Project': {
    headline: { en: 'SC-Project · The Voice of MotoGP', ua: 'SC-Project · Голос MotoGP' },
    description: {
      en: 'Exhaust systems born on the race track. Maximum volume, aggressive design, and uncompromising quality.',
      ua: 'Вихлопні системи, народжені на гоночному треку. Максимальна гучність, агресивний дизайн та безкомпромісна якість.',
    },
    highlights: [
      { en: 'MotoGP-inspired development', ua: 'Розробка з ДНК MotoGP' },
      { en: 'Aggressive sound', ua: 'Агресивний звук' },
      { en: 'Made in Italy', ua: 'Зроблено в Італії' },
    ],
  },
  Termignoni: {
    headline: { en: 'Termignoni · Italian Legend', ua: 'Termignoni · Італійська легенда' },
    description: {
      en: 'Italian exhaust systems with racing heritage. Classic tone, modern materials, and precise fitment.',
      ua: 'Італійські вихлопні системи з гоночною спадщиною. Класичний тон, сучасні матеріали та точна посадка.',
    },
    highlights: [
      { en: 'Italian design', ua: 'Італійський дизайн' },
      { en: 'Deep bass sound', ua: 'Глибокий бас' },
      { en: 'Racing history', ua: 'Спортивна історія' },
    ],
  },
  Arrow: {
    headline: { en: 'Arrow · Accessible Sport', ua: 'Arrow · Доступний спорт' },
    description: {
      en: 'Wide range of exhaust systems for any motorcycle. From street slip-ons to full racing systems.',
      ua: 'Широкий вибір вихлопних систем для будь-якого мотоцикла. Від вуличних глушників до повних гоночних систем.',
    },
    highlights: [
      { en: 'Wide assortment', ua: 'Широкий асортимент' },
      { en: 'Quality materials', ua: 'Якісні матеріали' },
      { en: 'Made in Italy', ua: 'Зроблено в Італії' },
    ],
  },
  'Ohlins': {
    headline: { en: 'Ohlins · The Gold Standard', ua: 'Ohlins · Золотий стандарт' },
    description: {
      en: 'A benchmark in suspension. Improves handling, comfort, and confidence on road and track.',
      ua: 'Еталон у світі підвісок. Покращує керованість, комфорт та впевненість на дорозі й треку.',
    },
    highlights: [
      { en: 'Swedish quality', ua: 'Шведська якість' },
      { en: 'Improved handling', ua: 'Покращена керованість' },
      { en: 'Adjustable suspension', ua: 'Регульована підвіска' },
    ],
  },
  'Marchesini': {
    headline: { en: 'Marchesini · Lightness of Motion', ua: 'Marchesini · Легкість руху' },
    description: {
      en: 'Legendary forged wheels that radically change motorcycle handling. Less weight means faster acceleration and braking.',
      ua: 'Легендарні ковані диски, що кардинально змінюють керування мотоциклом. Менша вага — швидший розгін та гальмування.',
    },
    highlights: [
      { en: 'Forged aluminum', ua: 'Кований алюміній' },
      { en: 'Forged magnesium', ua: 'Кований магній' },
      { en: 'Instant reaction', ua: 'Миттєва реакція' },
    ],
  },
  'OZ Racing': {
    headline: { en: 'OZ Racing · Style and Speed', ua: 'OZ Racing · Стиль та швидкість' },
    description: {
      en: 'Premium motorcycle wheels from a renowned manufacturer. A balanced mix of strength, weight, and design.',
      ua: 'Преміальні мотоциклетні диски від відомого виробника. Баланс між міцністю, вагою та дизайном.',
    },
    highlights: [
      { en: 'Italian style', ua: 'Італійський стиль' },
      { en: 'Racing technology', ua: 'Технології з гонок' },
      { en: 'Reliability', ua: 'Надійність' },
    ],
  },
  'SparkExhaust': {
    headline: { en: 'Spark · Design and Sound', ua: 'Spark · Дизайн та звук' },
    description: {
      en: 'Modern exhaust systems with an emphasis on style. Unique silencer shapes and rich sound.',
      ua: 'Сучасні вихлопні системи з акцентом на стиль. Унікальні форми глушників та насичений звук.',
    },
    highlights: [
      { en: 'Unique design', ua: 'Унікальний дизайн' },
      { en: 'Quality sound', ua: 'Якісний звук' },
      { en: 'Modern technology', ua: 'Сучасні технології' },
    ],
  },
  'Bitubo': {
    headline: { en: 'Bitubo · Precision Control', ua: 'Bitubo · Точність контролю' },
    description: {
      en: 'High-tech suspension for those who demand the maximum. Excellent alternative to factory shock absorbers.',
      ua: 'Високотехнологічна підвіска для тих, хто вимагає максимуму. Відмінна альтернатива заводським амортизаторам.',
    },
    highlights: [
      { en: 'Precise tuning', ua: 'Точне налаштування' },
      { en: 'Stability', ua: 'Стабільність' },
      { en: 'Italian engineering', ua: 'Італійська інженерія' },
    ],
  },
  Brembo_Auto: {
    headline: { en: 'Brembo GT Braking Systems', ua: 'Brembo GT гальмівні системи' },
    description: {
      en: 'High-performance braking systems for street and track, featuring monoblock calipers and advanced disc technology.',
      ua: 'Високопродуктивні гальмівні системи для вулиці та треку з моноблочними супортами та передовими дисками.',
    },
    highlights: [
      { en: 'GT | GT-R | Pista Kits', ua: 'Комплекти GT | GT-R | Pista' },
      { en: 'Carbon Ceramic Discs', ua: 'Карбон-керамічні диски' },
      { en: 'F1 Derived Technology', ua: 'Технології з Формули-1' },
    ],
  },
  Brembo_Moto: {
    headline: { en: 'Brembo · Absolute Control', ua: 'Brembo · Абсолютний контроль' },
    description: {
      en: 'High-performance braking components designed for confident control on street and track.',
      ua: 'Високопродуктивні гальмівні компоненти для впевненого контролю на дорозі та треку.',
    },
    highlights: [
      { en: 'Powerful braking', ua: 'Потужне гальмування' },
      { en: 'Reliability', ua: 'Надійність' },
      { en: 'Choice of professionals', ua: 'Вибір професіоналів' },
    ],
  },
  Brembo: {
    headline: { en: 'Brembo GP4 braking suites', ua: 'Brembo GP4 гальмівні комплекти' },
    description: {
      en: "Monoblock calipers, Corsa Corta masters and T-drive rotors spec'd for pit crews.",
      ua: 'Моноблок супорти, головні циліндри Corsa Corta та диски T-drive для трекових команд.',
    },
    highlights: [
      { en: 'Track bedding procedures', ua: 'Процедури обкатки для треку' },
      { en: 'Pad libraries for every compound', ua: 'Бібліотека колодок усіх сумішей' },
      { en: 'On-site pedal feel tuning', ua: 'Налаштування педалі на місці' },
    ],
  },
  'Accossato': {
    headline: { en: 'Accossato · Racing Ergonomics', ua: 'Accossato · Гоночна ергономіка' },
    description: {
      en: 'Professional controls for your bike. Master cylinders and levers that give new riding sensations.',
      ua: 'Професійні органи керування для вашого байка. Гальмівні машинки та ручки, що дарують нові відчуття від їзди.',
    },
    highlights: [
      { en: 'Control precision', ua: 'Чіткість керування' },
      { en: 'Bright colors', ua: 'Яскраві кольори' },
      { en: 'Convenience', ua: 'Зручність' },
    ],
  },
  'ValterMoto': {
    headline: { en: 'ValterMoto · Details Matter', ua: 'ValterMoto · Деталі мають значення' },
    description: {
      en: 'Quality accessories and components for tuning. Rearsets, protection, and maintenance equipment.',
      ua: 'Якісні аксесуари та компоненти для тюнінгу. Підніжки, захист та обладнання для обслуговування.',
    },
    highlights: [
      { en: 'Motorcycle protection', ua: 'Захист мотоцикла' },
      { en: 'Stylish accessories', ua: 'Стильні аксесуари' },
      { en: 'Functionality', ua: 'Функціональність' },
    ],
  },
  'Brabus': {
    headline: { en: 'Brabus · Status & Elegance', ua: 'Brabus · Статус та елегантність' },
    description: {
      en: 'Luxury tuning for premium vehicles. Focusing on exterior refinement, power upgrades, and signature exhaust systems.',
      ua: 'Розкішний тюнінг для преміальних авто. Елегантний екстер\'єр, вражаюча потужність та фірмове звучання.',
    },
    highlights: [
      { en: 'Exterior Aerodynamics', ua: 'Аеродинаміка екстер\'єру' },
      { en: 'PowerXtra Performance', ua: 'Збільшення потужності PowerXtra' },
      { en: 'Monoblock Wheels', ua: 'Диски Monoblock' },
    ],
  },
  'Mansory': {
    headline: { en: 'Mansory · Carbon Excellence', ua: 'Mansory · Карбонова досконалість' },
    description: {
      en: 'Exclusive customization for luxury cars. Premium carbon fiber body kits, forged wheels, and performance upgrades.',
      ua: 'Ексклюзивна кастомізація для розкішних авто. Преміальні карбонові обвіси, ковані диски та збільшення потужності.',
    },
    highlights: [
      { en: 'Carbon Body Kits', ua: 'Карбонові обвіси' },
      { en: 'Forged Wheels', ua: 'Ковані диски' },
      { en: 'Performance Exhaust', ua: 'Вихлопні системи' },
    ],
  },
  'HRE wheels': {
    headline: { en: 'HRE · The World\'s Best Custom Forged Wheels', ua: 'HRE · Найкращі у світі ковані диски' },
    description: {
      en: 'Custom forged wheels. Lightweight, strong, and infinitely customizable for your vehicle.',
      ua: 'Ковані диски на замовлення. Легкі, міцні та з безмежними можливостями індивідуалізації.',
    },
    highlights: [
      { en: 'Forged Series P1 / S2', ua: 'Ковані серії P1 / S2' },
      { en: 'FlowForm Technology', ua: 'Технологія FlowForm' },
      { en: 'Made in USA', ua: 'Зроблено в США' },
    ],
  },
  'Urban Automotive': {
    headline: { en: 'Urban · OEM+ Styling', ua: 'Urban · OEM+ стайлінг' },
    description: {
      en: 'Premium styling for luxury SUVs and cars. Carbon fiber kits and custom wheels that enhance the factory look.',
      ua: 'Преміальний стайлінг для розкішних SUV та авто. Карбонові кити та диски, що покращують заводський вигляд.',
    },
    highlights: [
      { en: 'Widetrack kits', ua: 'Комплекти розширення' },
      { en: 'Carbon fiber', ua: 'Карбонові деталі' },
      { en: 'Custom wheels', ua: 'Кастомні диски' },
    ],
  },
  'Eventuri': {
    headline: { en: 'Eventuri · The Art of Airflow', ua: 'Eventuri · Мистецтво потоку' },
    description: {
      en: 'The world\'s best intake systems. Real performance gains, incredible sound, and perfect under-hood aesthetics.',
      ua: 'Найкращі системи впуску у світі. Реальний приріст потужності, неймовірний звук та ідеальна естетика під капотом.',
    },
    highlights: [
      { en: 'Patented design', ua: 'Запатентований дизайн' },
      { en: 'Carbon fiber', ua: 'Карбонове виконання' },
      { en: 'Dyno proven', ua: 'Перевірено на стенді' },
    ],
  },
  'KW Suspension': {
    headline: { en: 'KW · For Every Demand', ua: 'KW · Для будь-яких завдань' },
    description: {
      en: 'The leader in suspension technology. From street comfort to race track performance.',
      ua: 'Лідер у технологіях підвіски. Від комфорту на вулиці до результатів на гоночному треку.',
    },
    highlights: [
      { en: 'Adjustable coilovers', ua: 'Регульовані койловери' },
      { en: 'Electronic damping', ua: 'Електронне регулювання' },
      { en: 'Hydraulic lift', ua: 'Гідравлічний ліфт' },
    ],
  },
  'Novitec': {
    headline: { en: 'Novitec · Refinement for Supercars', ua: 'Novitec · Вишуканість для суперкарів' },
    description: {
      en: 'High-end performance, sound, and styling programs for supercars and GT platforms.',
      ua: 'Преміальні програми продуктивності, звуку та стилю для суперкарів і GT-платформ.',
    },
    highlights: [
      { en: 'N-Largo Widebody', ua: 'N-Largo Widebody' },
      { en: 'Inconel exhaust', ua: 'Вихлопні системи Inconel' },
      { en: 'Carbon aero', ua: 'Карбонова аеродинаміка' },
    ],
  },
  'ABT': {
    headline: { en: 'ABT · From Racetrack to Road', ua: 'ABT · З треку на дорогу' },
    description: {
      en: 'Performance upgrades and styling with strong racing roots. More power, sharper handling, and a distinctive look.',
      ua: 'Апгрейди продуктивності та стилю з гоночним корінням. Більше потужності, точніша керованість і впізнаваний вигляд.',
    },
    highlights: [
      { en: 'Power upgrades', ua: 'Збільшення потужності' },
      { en: 'Sport wheels', ua: 'Спортивні диски' },
      { en: 'Aerodynamics', ua: 'Аеродинаміка' },
    ],
  },

  Vorsteiner: {
    headline: { en: 'Vorsteiner Carbon Importer', ua: 'Vorsteiner — карбоновий імпортер' },
    description: {
      en: 'Carbon aero programs for premium performance platforms with precision-focused fitment.',
      ua: 'Карбонові аеропакети для преміальних платформ з акцентом на точне пасування.',
    },
    highlights: [
      { en: 'Autoclave dry carbon & forged options', ua: 'Сухий та кований карбон з автоклава' },
      { en: 'Finishes ready for paint or PPF', ua: 'Покриття, готові під фарбу або PPF' },
      { en: 'Fitment guidance for clean installs', ua: 'Поради по встановленню для чистого результату' },
    ],
  },
  Armytrix: {
    headline: { en: 'Armytrix Valvetronic Theatre', ua: 'Armytrix — клапанний саунд' },
    description: {
      en: 'Valvetronic exhausts with smart remotes, bluetooth control and night stealth modes.',
      ua: 'Клапанні вихлопи зі смарт-брелоками, bluetooth-контролем та тихими режимами.',
    },
    highlights: [
      { en: 'Titanium and stainless options', ua: 'Титанові та сталеві опції' },
      { en: 'Valve control designed to integrate cleanly', ua: 'Керування клапанами для коректної інтеграції' },
      { en: 'Support for installation planning', ua: 'Підтримка у плануванні монтажу' },
    ],
  },
  CSF: {
    headline: { en: 'CSF Cooling Program', ua: 'CSF — програма охолодження' },
    description: {
      en: 'Billet end-tank intercoolers and radiators that keep intake temps repeatable on stage 3 builds.',
      ua: 'Інтеркулери та радіатори з білетними баками для стабільних температур на stage 3.',
    },
    highlights: [
      { en: 'Drag + track proven cores', ua: 'Перевірені на драгу та треку ядра' },
      { en: 'Heat exchanger bundles available', ua: 'Доступні комплекти теплообмінників' },
      { en: 'Cooling setup support and fitment', ua: 'Підбір та підтримка по сумісності' },
    ],
  },
  Manhart: {
    headline: { en: 'Manhart Bespoke Builds', ua: 'Manhart — індивідуальний сервіс' },
    description: {
      en: 'Complete conversion kits with aero, wheels and ECU calibrations for BMW, Audi and Mercedes.',
      ua: 'Повні комплекти конверсій з аеро, дисками та прошивками для BMW, Audi, Mercedes.',
    },
    highlights: [
      { en: 'Stage-based upgrade philosophy', ua: 'Логіка апгрейдів по стадіях' },
      { en: 'Exterior and interior styling options', ua: 'Опції екстерʼєру та інтерʼєру' },
      { en: 'Support for coding/tuning coordination', ua: 'Підтримка з кодуванням/калібруванням' },
    ],
  },
  Renntech: {
    headline: { en: 'Renntech AMG Power Stages', ua: 'Renntech — ступені потужності AMG' },
    description: {
      en: 'Turbo, cooling and ECU programs engineered by ex-AMG powertrain teams.',
      ua: 'Турбіни, охолодження та ECU від екс-команди AMG.',
    },
    highlights: [
      { en: 'Stage 1-4 calibrations with dyno sheets', ua: 'Stage 1-4 з діно-рапортами' },
      { en: 'TCU + gearbox cooling upgrades', ua: 'TCU та охолодження КПП' },
      { en: 'Worldwide warranty support', ua: 'Підтримка світової гарантії' },
    ],
  },
  'Velos': {
    headline: { en: 'Velos Forged Luxury', ua: 'Velos — розкішне кування' },
    description: {
      en: 'Luxury-focused forged sets with marble, brushed and two-tone finishes for SUVs and limousines.',
      ua: 'Розкішні ковані комплекти з мармуровими, брашованими та двотоновими фінішами для SUV та лімузинів.',
    },
    highlights: [
      { en: '24-26 inch fitments verified for Maybach & Cullinan', ua: '24-26" підбори для Maybach та Cullinan' },
      { en: 'Floating centre caps + bespoke engraving', ua: 'Плаваючі ковпачки та гравіювання' },
      { en: 'TPMS + run-flat compatible', ua: 'Сумісність з TPMS та run-flat' },
    ],
  },
  'Weistec': {
    headline: { en: 'Weistec Engineering Power Lab', ua: 'Weistec Engineering — лабораторія потужності' },
    description: {
      en: 'Billet turbos, meth kits and calibration suites for AMG, McLaren and exotic SUV platforms.',
      ua: 'Білетні турбіни, метанольні комплекти та калібрування для AMG, McLaren та екзотичних SUV.',
    },
    highlights: [
      { en: 'Complete fuel system solutions', ua: 'Повні паливні системи' },
      { en: 'Built transmissions with break-in support', ua: 'Підготовлені КПП з підтримкою обкатки' },
      { en: 'Remote + on-site calibration days', ua: 'Віддалені й виїзні дні калібрування' },
    ],
  },

  'Capristo': {
    headline: { en: 'Capristo Exhaust Systems', ua: 'Capristo — вихлопні системи' },
    description: {
      en: 'Valve-controlled exhaust systems made of heat-resistant stainless steel for supercars.',
      ua: 'Клапанні вихлопні системи з жаростійкої сталі для суперкарів.',
    },
    highlights: [
      { en: 'Programmable control units', ua: 'Програмовані блоки керування' },
      { en: 'Carbon fiber composites', ua: 'Карбонові композити' },
      { en: 'OEM quality', ua: 'OEM якість' },
    ],
  },
  'FI Exhaust': {
    headline: { en: 'Frequency Intelligent Exhaust', ua: 'FI Exhaust — частотний інтелект' },
    description: {
      en: 'Valvetronic technology combining comfort and racing sound for high-performance cars.',
      ua: 'Технологія Valvetronic, що поєднує комфорт та гоночний звук для потужних авто.',
    },
    highlights: [
      { en: 'Mobile app control', ua: 'Керування через додаток' },
      { en: 'Intelligent valve system', ua: 'Розумна система клапанів' },
      { en: 'Signature frequency', ua: 'Фірмова частота' },
    ],
  },
  'RYFT': {
    headline: { en: 'RYFT Titanium Artisan', ua: 'RYFT — титанове мистецтво' },
    description: {
      en: 'Hand-finished titanium exhaust systems and carbon aero for limited-run and premium performance builds.',
      ua: 'Титанові вихлопи та карбон з ручним фінішем для лімітованих і преміальних проєктів.',
    },
    highlights: [
      { en: 'Proprietary velocity loops', ua: 'Фірмові петлі швидкості' },
      { en: 'Aerospace grade titanium', ua: 'Авіаційний титан' },
      { en: 'Limited production', ua: 'Лімітоване виробництво' },
    ],
  },
  'Tubi Style': {
    headline: { en: 'Tubi Style Maranello', ua: 'Tubi Style — звук Маранелло' },
    description: {
      en: 'Maranello-inspired sound and Italian craftsmanship for iconic supercar platforms.',
      ua: 'Звук у стилі Маранелло та італійська майстерність для культових суперкар-платформ.',
    },
    highlights: [
      { en: 'Inconel racing systems', ua: 'Гоночні системи Inconel' },
      { en: 'Restoration classics', ua: 'Класика реставрації' },
      { en: 'Heritage-level craftsmanship', ua: 'Майстерність зі спадщиною' },
    ],
  },
  'Fabspeed': {
    headline: { en: 'Fabspeed Motorsport', ua: 'Fabspeed — автоспорт США' },
    description: {
      en: 'Precision-crafted exhaust and intake systems for Porsche, Ferrari, and McLaren.',
      ua: 'Прецизійні системи вихлопу та впуску для Porsche, Ferrari та McLaren.',
    },
    highlights: [
      { en: 'Dyno-proven performance', ua: 'Підтверджена діно продуктивність' },
      { en: 'Warranty-backed programs', ua: 'Гарантійні програми' },
      { en: 'CNC mandrel bending', ua: 'CNC гнуття' },
    ],
  },
  'Supersprint': {
    headline: { en: 'Supersprint Headers', ua: 'Supersprint — колектори' },
    description: {
      en: 'The authority on exhaust headers and complete systems, dyno-tuned for maximum gains.',
      ua: 'Авторитет у колекторах та повних системах, налаштованих на стенді для максимуму.',
    },
    highlights: [
      { en: 'Individual pipe sizing', ua: 'Індивідуальний підбір труб' },
      { en: 'HJS catalytic converters', ua: 'Каталізатори HJS' },
      { en: 'Long-tube headers', ua: 'Довгі колектори' },
    ],
  },
  'Nitron Suspension': {
    headline: { en: 'Nitron Racing Shocks', ua: 'Nitron — гоночні амортизатори' },
    description: {
      en: 'Hand-built suspension systems from the UK, popular for track days and performance builds.',
      ua: 'Підвіски ручної збірки з Британії, популярні для трек-днів та продуктивних збірок.',
    },
    highlights: [
      { en: 'NTR R1/R3 kits', ua: 'Комплекти NTR R1/R3' },
      { en: 'Titanium finish', ua: 'Титанове покриття' },
      { en: 'Custom spring rates', ua: 'Індивідуальні пружини' },
    ],
  },
  'BC Racing': {
    headline: { en: 'BC Racing Coilovers', ua: 'BC Racing — койловери' },
    description: {
      en: 'A highly configurable coilover platform for street and track, balancing value and performance.',
      ua: 'Гнучка платформа койловерів для вулиці та треку з балансом ціни й можливостей.',
    },
    highlights: [
      { en: 'BR & ER series', ua: 'Серії BR та ER' },
      { en: 'Custom valving options', ua: 'Опції кастомних клапанів' },
      { en: 'Swift Spring upgrades', ua: 'Апгрейд пружин Swift' },
    ],
  },
  'MCA Suspension': {
    headline: { en: 'MCA Time Attack', ua: 'MCA — тайм-аттак підвіска' },
    description: {
      en: 'Australian engineered suspension focused on time attack and track-focused performance.',
      ua: 'Австралійська підвіска з фокусом на тайм-аттак та трекову продуктивність.',
    },
    highlights: [
      { en: 'Red Series competition', ua: 'Змагальна серія Red' },
      { en: 'Gold Series street', ua: 'Вулична серія Gold' },
      { en: 'Traction modulation', ua: 'Модуляція зачепу' },
    ],
  },
  'Hardrace': {
    headline: { en: 'Hardrace Chassis Control', ua: 'Hardrace — контроль шасі' },
    description: {
      en: 'Reinforced suspension arms, bushings, and mounts to eliminate flex and sharpen steering.',
      ua: 'Посилені важелі, сайлентблоки та опори для усунення люфтів та гостроти керма.',
    },
    highlights: [
      { en: 'Pillow ball bushings', ua: 'ШС-з\'єднання' },
      { en: 'Adjustable camber/toe', ua: 'Регульований розвал/сходження' },
      { en: 'Harden rubber mounts', ua: 'Посилені гумові опори' },
    ],
  },
  'SPL Parts': {
    headline: { en: 'SPL Titanium Arms', ua: 'SPL — титанові важелі' },
    description: {
      en: 'High-strength adjustable suspension links for precise alignment on lowered and track cars.',
      ua: 'Високоміцні регульовані важелі для точного розвалу на занижених та трекових авто.',
    },
    highlights: [
      { en: 'Titanium hardware', ua: 'Титанова фурнітура' },
      { en: 'FK rod ends', ua: 'ШС FK' },
      { en: 'Made in USA', ua: 'Вироблено в США' },
    ],
  },
  'Airlift Performance': {
    headline: { en: 'Airlift 3H/3P Systems', ua: 'Airlift — пневмосистеми' },
    description: {
      en: 'Performance air suspension that combines "show" stance with "go" handling capabilities.',
      ua: 'Продуктивна пневмопідвіска, що поєднує стенс для шоу з керованістю для їзди.',
    },
    highlights: [
      { en: '3H height management', ua: 'Керування висотою 3H' },
      { en: 'Track-tested dampers', ua: 'Перевірені на треку амортизатори' },
      { en: 'Bolt-on fitment', ua: 'Bolt-on встановлення' },
    ],
  },
  'ADV.1 wheels': {
    headline: { en: 'ADV.1 Engineered Design', ua: 'ADV.1 — інженерний дизайн' },
    description: {
      en: 'Known for concave wheel design and engineering, offering extensive customization for exotic builds.',
      ua: 'Відомі дизайном та інженерією увігнутих дисків з широкою кастомізацією для екзотичних проєктів.',
    },
    highlights: [
      { en: 'Track Spec configurations', ua: 'Конфігурації Track Spec' },
      { en: 'Hidden hardware options', ua: 'Опції прихованої фурнітури' },
      { en: 'Aerospace aluminum', ua: 'Авіаційний алюміній' },
    ],
  },
  'Strasse wheels': {
    headline: { en: 'Strasse Performance Series', ua: 'Strasse — серія Performance' },
    description: {
      en: 'High-performance 3-piece wheels built for speed and style, featuring deep concave profiles and carbon fiber barrels.',
      ua: 'Високопродуктивні 3-секційні диски для швидкості та стилю, з глибоким конкейвом та карбоновими ободами.',
    },
    highlights: [
      { en: 'Carbon fiber barrels', ua: 'Карбонові ободи' },
      { en: 'Deep concave profiles', ua: 'Глибокі профілі конкейв' },
      { en: 'Floating spoke designs', ua: 'Дизайн плаваючих спиць' },
    ],
  },
  'MV Forged': {
    headline: { en: 'MV Forged Bespoke', ua: 'MV Forged — індивідуальне кування' },
    description: {
      en: 'Precision-milled forged wheels that blend modern aesthetics with motorsport-grade weight reduction.',
      ua: 'Прецизійно фрезеровані ковані диски, що поєднують сучасну естетику зі зниженням ваги рівня автоспорту.',
    },
    highlights: [
      { en: 'Spoke-Lite technology', ua: 'Технологія Spoke-Lite' },
      { en: 'Modular assembly', ua: 'Модульна збірка' },
      { en: 'Aero-discs available', ua: 'Доступні аеро-диски' },
    ],
  },
  'AL13 wheels': {
    headline: { en: 'AL13 Design House', ua: 'AL13 — дім дизайну' },
    description: {
      en: 'The pinnacle of wheel design, offering intricate machining and multi-piece construction for the most discerning builds.',
      ua: 'Вершина дизайну дисків, що пропонує складну обробку та багатосекційну конструкцію для найвибагливіших проєктів.',
    },
    highlights: [
      { en: '4-piece construction', ua: '4-секційна конструкція' },
      { en: 'Precision machining', ua: 'Прецизійна обробка' },
      { en: 'Exotic finishes', ua: 'Екзотичні фініші' },
    ],
  },
  '1221 wheels': {
    headline: { en: '1221 Advanced Metallurgy', ua: '1221 — передова металургія' },
    description: {
      en: 'Utilizing proprietary alloy blends and AP3X technology to create the lightest and strongest wheels on the market.',
      ua: 'Використання фірмових сплавів та технології AP3X для створення найлегших та найміцніших дисків на ринку.',
    },
    highlights: [
      { en: 'AP3X forging technology', ua: 'Технологія кування AP3X' },
      { en: 'Proprietary alloy blends', ua: 'Фірмові суміші сплавів' },
      { en: 'Lightweight optimization', ua: 'Оптимізація ваги' },
    ],
  },
  'Stoptech': {
    headline: { en: 'Stoptech High Performance', ua: 'Stoptech — висока продуктивність' },
    description: {
      en: 'Balanced brake upgrades with stiffer calipers and larger rotors for improved heat capacity and modulation.',
      ua: 'Збалансовані апгрейди гальм із жорсткішими супортами та більшими дисками для кращої теплоємності та модуляції.',
    },
    highlights: [
      { en: 'Trophy Big Brake Kits', ua: 'Комплекти Trophy Big Brake' },
      { en: 'AeroRotors', ua: 'Аеро-ротори' },
      { en: 'Stainless steel lines', ua: 'Армовані шланги' },
    ],
  },
  'Girodisc': {
    headline: { en: 'Girodisc Racing Rotors', ua: 'Girodisc — гоночні диски' },
    description: {
      en: 'Two-piece floating rotors designed to reduce unsprung weight and increase cooling efficiency for track cars.',
      ua: 'Двосекційні плаваючі диски, розроблені для зниження непідресореної маси та покращення охолодження трекових авто.',
    },
    highlights: [
      { en: 'Direct replacement fitment', ua: 'Встановлення в штатні місця' },
      { en: 'High-carbon iron rings', ua: 'Кільця з високовуглецевого чавуну' },
      { en: 'Aluminum hats', ua: 'Алюмінієві центри' },
    ],
  },
  'Paragon brakes': {
    headline: { en: 'Paragon Track Systems', ua: 'Paragon — трекові системи' },
    description: {
      en: 'Motorsport-grade braking components offering exceptional durability and performance for club racers and time attack.',
      ua: 'Гальмівні компоненти рівня автоспорту, що пропонують виняткову витривалість та продуктивність для клубних гонок.',
    },
    highlights: [
      { en: '6-piston calipers', ua: '6-поршневі супорти' },
      { en: 'Titanium pistons available', ua: 'Доступні титанові поршні' },
      { en: 'Anti-knockback springs', ua: 'Пружини проти відбою' },
    ],
  },
  'Sachs Performance': {
    headline: { en: 'Sachs Performance Clutch', ua: 'Sachs Performance — зчеплення' },
    description: {
      en: 'Engineering excellence from ZF Race Engineering, delivering reinforced clutches and suspension for tuned vehicles.',
      ua: 'Інженерна досконалість від ZF Race Engineering: посилені зчеплення та підвіска для тюнінгованих авто.',
    },
    highlights: [
      { en: 'Sintered metal clutch discs', ua: 'Металокерамічні диски зчеплення' },
      { en: 'CSS coilover kits', ua: 'Комплекти койловерів CSS' },
      { en: 'OEM quality standards', ua: 'Стандарти якості OEM' },
    ],
  },
  'STOPART ceramic': {
    headline: { en: 'STOPART Carbon Ceramic', ua: 'STOPART — карбон-кераміка' },
    description: {
      en: 'Advanced carbon ceramic brake upgrades for ultimate fade resistance and weight reduction on high-performance cars.',
      ua: 'Передові карбон-керамічні гальма для максимальної стійкості до перегріву та зниження ваги на потужних авто.',
    },
    highlights: [
      { en: 'Carbon ceramic rotors', ua: 'Карбон-керамічні диски' },
      { en: 'High-temp pads', ua: 'Високотемпературні колодки' },
      { en: 'Bespoke caliper adapters', ua: 'Індивідуальні адаптери супортів' },
    ],
  },
  'RS-R': {
    headline: { en: 'RS-R Suspension & Active', ua: 'RS-R — підвіска та актив' },
    description: {
      en: 'Premium Japanese suspension components known for their high quality and innovative active suspension compatibility.',
      ua: 'Преміальні японські компоненти підвіски, відомі своєю якістю та сумісністю з активними підвісками.',
    },
    highlights: [
      { en: 'Best-i Active coilovers', ua: 'Койловери Best-i Active' },
      { en: 'Ti2000 titanium springs', ua: 'Титанові пружини Ti2000' },
      { en: 'Ran-Up oil additives', ua: 'Присадки Ran-Up' },
    ],
  },
  'Wagner Tuning': {
    headline: { en: 'Wagner Tuning Intercoolers', ua: 'Wagner Tuning — інтеркулери' },
    description: {
      en: 'High-performance intercoolers and downpipes engineered in Germany for maximum cooling and flow.',
      ua: 'Високопродуктивні інтеркулери та даунпайпи, розроблені в Німеччині для максимального охолодження та потоку.',
    },
    highlights: [
      { en: 'Competition intercoolers', ua: 'Інтеркулери Competition' },
      { en: 'Cast end tanks', ua: 'Литі баки' },
      { en: 'Flow-optimized downpipes', ua: 'Оптимізовані даунпайпи' },
    ],
  },
  'Gruppe-M': {
    headline: { en: 'GruppeM Ram Air Systems', ua: 'GruppeM — системи Ram Air' },
    description: {
      en: 'Premium carbon fiber intake systems from Japan, designed to maximize airflow and engine response.',
      ua: 'Преміальні карбонові системи впуску з Японії, розроблені для максимізації потоку повітря та відгуку двигуна.',
    },
    highlights: [
      { en: 'Ram Air System technology', ua: 'Технологія Ram Air System' },
      { en: 'Hand-laid carbon fiber', ua: 'Карбон ручної викладки' },
      { en: 'K&N filter elements', ua: 'Фільтруючі елементи K&N' },
    ],
  },
  'BMC': {
    headline: { en: 'BMC Air Filters', ua: 'BMC — повітряні фільтри' },
    description: {
      en: 'The choice of F1 and supercar manufacturers, offering high-flow air filters and carbon dynamic airboxes.',
      ua: 'Вибір виробників F1 та суперкарів: фільтри високого потоку та карбонові динамічні короби.',
    },
    highlights: [
      { en: 'CDA (Carbon Dynamic Airbox)', ua: 'CDA (Карбоновий динамічний короб)' },
      { en: 'OTA (Oval Trumpet Airbox)', ua: 'OTA (Овальний короб)' },
      { en: 'OEM replacement filters', ua: 'Фільтри для заміни OEM' },
    ],
  },
  'ARMA Speed': {
    headline: { en: 'ARMA Speed Carbon', ua: 'ARMA Speed — карбон' },
    description: {
      en: 'Innovative carbon fiber intake systems with variable air valves and 3D dry carbon technology.',
      ua: 'Інноваційні карбонові системи впуску зі змінними клапанами та технологією 3D сухого карбону.',
    },
    highlights: [
      { en: 'Variable air valve system', ua: 'Система змінних повітряних клапанів' },
      { en: 'Hyper-Flow carbon intakes', ua: 'Карбонові впуски Hyper-Flow' },
      { en: '3D dry carbon finish', ua: 'Фініш 3D сухий карбон' },
    ],
  },
  'Alpha-N': {
    headline: { en: 'Alpha-N Performance', ua: 'Alpha-N — продуктивність' },
    description: {
      en: 'German engineering focused on carbon fiber bodywork and performance upgrades for BMW M models.',
      ua: 'Німецька інженерія, зосереджена на карбонових кузовних елементах та апгрейдах для BMW M.',
    },
    highlights: [
      { en: 'Carbon intake plenums', ua: 'Карбонові ресивери впуску' },
      { en: 'Lightweight body panels', ua: 'Легкі кузовні панелі' },
      { en: 'Clubsport setups', ua: 'Налаштування Clubsport' },
    ],
  },
  'MST Performance': {
    headline: { en: 'MST Performance Intakes', ua: 'MST Performance — впуски' },
    description: {
      en: 'High-quality cold air intake systems designed to improve throttle response and engine sound.',
      ua: 'Високоякісні системи холодного впуску, розроблені для покращення відгуку педалі та звуку двигуна.',
    },
    highlights: [
      { en: 'Cold air intake kits', ua: 'Комплекти холодного впуску' },
      { en: 'Turbo inlet pipes', ua: 'Патрубки входу турбіни' },
      { en: 'Dyno-tested gains', ua: 'Перевірений на діно приріст' },
    ],
  },
  'do88': {
    headline: { en: 'do88 Cooling & Intake', ua: 'do88 — охолодження та впуск' },
    description: {
      en: 'Swedish-engineered cooling and intake solutions for Saab, Volvo, BMW, and Porsche.',
      ua: 'Шведські рішення для охолодження та впуску для Saab, Volvo, BMW та Porsche.',
    },
    highlights: [
      { en: 'Silicone hose kits', ua: 'Комплекти силіконових патрубків' },
      { en: 'Performance intercoolers', ua: 'Продуктивні інтеркулери' },
      { en: 'Carbon intake systems', ua: 'Карбонові системи впуску' },
    ],
  },
  'Karbonius': {
    headline: { en: 'Karbonius Composites', ua: 'Karbonius — композити' },
    description: {
      en: 'The finest autoclave carbon fiber components, specializing in BMW M CSL-style airboxes.',
      ua: 'Найкращі автоклавні карбонові компоненти, що спеціалізуються на ейрбоксах у стилі BMW M CSL.',
    },
    highlights: [
      { en: 'CSL-style airboxes', ua: 'Ейрбокси в стилі CSL' },
      { en: '100% Pre-preg carbon', ua: '100% препрег-карбон' },
      { en: 'OEM-level fitment', ua: 'Пасування рівня OEM' },
    ],
  },
  'Lumma': {
    headline: { en: 'Lumma Design Aerodynamics', ua: 'Lumma — аеродинаміка' },
    description: {
      en: 'Bold widebody conversions and aerodynamic styling kits for premium SUVs and sports cars.',
      ua: 'Сміливі widebody-конверсії та аеродинамічні комплекти для преміальних SUV та спорткарів.',
    },
    highlights: [
      { en: 'CLR widebody kits', ua: 'Widebody-комплекти CLR' },
      { en: 'Custom wheel programs', ua: 'Програми кастомних дисків' },
      { en: 'Interior refinement', ua: 'Оздоблення інтер\'єру' },
    ],
  },
  'Larte Design': {
    headline: { en: 'Larte Design Tuning', ua: 'Larte Design — тюнінг' },
    description: {
      en: 'Exclusive tuning kits made from premium materials like carbon fiber and basalt fiber, certified by TUV Germany.',
      ua: 'Ексклюзивні тюнінг-комплекти з преміальних матеріалів, таких як карбон та базальтове волокно, сертифіковані TUV.',
    },
    highlights: [
      { en: 'TUV certified kits', ua: 'Комплекти з сертифікацією TUV' },
      { en: 'Basalt fiber technology', ua: 'Технологія базальтового волокна' },
      { en: 'Handcrafted quality', ua: 'Якість ручної роботи' },
    ],
  },
  'Ronin Design': {
    headline: { en: 'Ronin Design Body Kits', ua: 'Ronin Design — обвіси' },
    description: {
      en: 'Aggressive and modern body kits designed to transform the aesthetics of high-performance vehicles.',
      ua: 'Агресивні та сучасні обвіси, розроблені для трансформації естетики потужних автомобілів.',
    },
    highlights: [
      { en: 'Modern aesthetic design', ua: 'Сучасний естетичний дизайн' },
      { en: 'Precision fitment', ua: 'Точне пасування' },
      { en: 'Lightweight materials', ua: 'Легкі матеріали' },
    ],
  },
  'Renegade Design': {
    headline: { en: 'Renegade Design Aero', ua: 'Renegade Design — аеро' },
    description: {
      en: 'Unique aerodynamic kits and forged wheels for SUVs and luxury cars, emphasizing individuality.',
      ua: 'Унікальні аеродинамічні комплекти та ковані диски для SUV та люкс-авто, що підкреслюють індивідуальність.',
    },
    highlights: [
      { en: 'Widebody options', ua: 'Опції widebody' },
      { en: 'Forged wheel collection', ua: 'Колекція кованих дисків' },
      { en: '5-year warranty', ua: '5-річна гарантія' },
    ],
  },
  'Liberty Walk': {
    headline: { en: 'Liberty Walk Works', ua: 'Liberty Walk — Works' },
    description: {
      en: 'The originators of the modern widebody movement, offering iconic over-fender kits for Japanese and European exotics.',
      ua: 'Засновники сучасного руху widebody, що пропонують культові комплекти розширення для японської та європейської екзотики.',
    },
    highlights: [
      { en: 'LB-Works widebody', ua: 'Widebody LB-Works' },
      { en: 'LB-Performance aero', ua: 'Аеро LB-Performance' },
      { en: 'Air suspension compatibility', ua: 'Сумісність з пневмопідвіскою' },
    ],
  },
  'Keyvany': {
    headline: { en: 'Keyvany Carbon Experts', ua: 'Keyvany — експерти карбону' },
    description: {
      en: 'High-end carbon fiber body kits and interior upgrades for the most exclusive luxury vehicles.',
      ua: 'Висококласні карбонові обвіси та апгрейди інтер\'єру для найексклюзивніших люкс-авто.',
    },
    highlights: [
      { en: 'Full carbon bodywork', ua: 'Повністю карбоновий кузов' },
      { en: 'Hermes leather interiors', ua: 'Інтер\'єри зі шкіри Hermes' },
      { en: 'Power upgrades', ua: 'Апгрейди потужності' },
    ],
  },
  'Bride': {
    headline: { en: 'Bride Racing Seats', ua: 'Bride — гоночні крісла' },
    description: {
      en: 'Renowned Japanese racing seat manufacturer, delivering lightweight support for circuit and drift.',
      ua: 'Відомий японський виробник гоночних крісел з легкою фіксацією для кільця та дрифту.',
    },
    highlights: [
      { en: 'Low Max system', ua: 'Система Low Max' },
      { en: 'Aramid fiber shells', ua: 'Оболонки з арамідного волокна' },
      { en: 'FIA homologation', ua: 'Омологація FIA' },
    ],
  },
  'Corbeau': {
    headline: { en: 'Corbeau Seats', ua: 'Corbeau — крісла' },
    description: {
      en: 'Affordable and high-quality seating solutions for street, track, and off-road vehicles.',
      ua: 'Доступні та якісні рішення для сидіння для вуличних, трекових та позашляхових авто.',
    },
    highlights: [
      { en: 'Reclining sport seats', ua: 'Спортивні крісла з регулюванням' },
      { en: 'Fixed back racing seats', ua: 'Фіксовані гоночні крісла' },
      { en: 'Harness belts', ua: 'Ремені безпеки' },
    ],
  },
  'OMP': {
    headline: { en: 'OMP Racing', ua: 'OMP — рейсинг' },
    description: {
      en: 'Motorsport safety equipment brand known for seats, suits, and steering wheels used across racing disciplines.',
      ua: 'Бренд обладнання безпеки для автоспорту: крісла, комбінезони та керма для різних дисциплін.',
    },
    highlights: [
      { en: 'HTE-R carbon seats', ua: 'Карбонові крісла HTE-R' },
      { en: 'Superleggero steering wheels', ua: 'Керма Superleggero' },
      { en: 'Dyneema seatbelts', ua: 'Ремені Dyneema' },
    ],
  },
  'Takata': {
    headline: { en: 'Takata Racing Harnesses', ua: 'Takata — гоночні ремені' },
    description: {
      en: 'Iconic green racing harnesses known for their quality and safety in the JDM and tuning scenes.',
      ua: 'Культові зелені гоночні ремені, відомі своєю якістю та безпекою в JDM та тюнінг-сценах.',
    },
    highlights: [
      { en: 'Drift II & III harnesses', ua: 'Ремені Drift II та III' },
      { en: 'FIA approved models', ua: 'Моделі з схваленням FIA' },
      { en: 'Signature green webbing', ua: 'Фірмова зелена стрічка' },
    ],
  },
  'Schroth': {
    headline: { en: 'Schroth Safety Products', ua: 'Schroth — безпека' },
    description: {
      en: 'Advanced racing harness technology including HANS devices and custom restraint systems for professional motorsport.',
      ua: 'Передові технології гоночних ременів, включаючи системи HANS та індивідуальні системи утримання для професійного автоспорту.',
    },
    highlights: [
      { en: 'HANS devices', ua: 'Пристрої HANS' },
      { en: 'Profi II ASM harnesses', ua: 'Ремені Profi II ASM' },
      { en: 'Flexi belt systems', ua: 'Системи ременів Flexi' },
    ],
  },
  'Sabelt': {
    headline: { en: 'Sabelt Seatbelts & Seats', ua: 'Sabelt — ремені та крісла' },
    description: {
      en: 'Italian safety equipment for performance and motorsport use: seats, belts, and restraint systems.',
      ua: 'Італійське обладнання безпеки для продуктивних авто та автоспорту: крісла, ремені та системи утримання.',
    },
    highlights: [
      { en: 'Carbon fiber seats', ua: 'Карбонові крісла' },
      { en: 'Lightweight harnesses', ua: 'Легкі ремені' },
      { en: 'Track-ready restraint solutions', ua: 'Трекові рішення для фіксації' },
    ],
  },
  'Pure Turbos': {
    headline: { en: 'Pure Turbos Upgrades', ua: 'Pure Turbos — апгрейди' },
    description: {
      en: 'Turbocharger upgrade specialists offering stock-housing solutions for meaningful power gains with OEM-like fitment.',
      ua: 'Спеціалісти з апгрейдів турбокомпресорів: рішення в штатному корпусі для відчутного приросту та коректної посадки.',
    },
    highlights: [
      { en: 'Pure800 / Pure1000 kits', ua: 'Комплекти Pure800 / Pure1000' },
      { en: 'Billet compressor wheels', ua: 'Фрезеровані компресорні колеса' },
      { en: 'VSR balanced', ua: 'Балансування VSR' },
    ],
  },
  'Vargas Turbo': {
    headline: { en: 'Vargas Turbo Technologies', ua: 'Vargas Turbo — технології' },
    description: {
      en: 'Innovative turbocharger solutions and engine components for BMW, Ford, and VAG platforms.',
      ua: 'Інноваційні рішення для турбокомпресорів та компонентів двигуна для платформ BMW, Ford та VAG.',
    },
    highlights: [
      { en: 'GC / GC+ turbochargers', ua: 'Турбокомпресори GC / GC+' },
      { en: 'Crank bolt capture', ua: 'Фіксатори болта колінвала' },
      { en: 'Billet valve covers', ua: 'Фрезеровані клапанні кришки' },
    ],
  },
  'VF Engineering': {
    headline: { en: 'VF Engineering Superchargers', ua: 'VF Engineering — компресори' },
    description: {
      en: 'Supercharger systems and ECU tuning for Lamborghini, Audi, and BMW, delivering reliable horsepower.',
      ua: 'Системи механічних нагнітачів та тюнінг ECU для Lamborghini, Audi та BMW, що забезпечують надійну потужність.',
    },
    highlights: [
      { en: 'Hex Flash tuning', ua: 'Тюнінг Hex Flash' },
      { en: 'Supercharger kits', ua: 'Комплекти компресорів' },
      { en: 'Water-cooled manifolds', ua: 'Колектори з водяним охолодженням' },
    ],
  },
  'Burger Motorsport': {
    headline: { en: 'BMS JB4 Tuning', ua: 'BMS JB4 — тюнінг' },
    description: {
      en: 'Famous for the JB4 piggyback tuner, offering plug-and-play performance for turbocharged vehicles.',
      ua: 'Відомі завдяки JB4-тюнеру, що пропонує plug-and-play продуктивність для турбованих авто.',
    },
    highlights: [
      { en: 'JB4 performance tuner', ua: 'Тюнер продуктивності JB4' },
      { en: 'Methanol injection kits', ua: 'Комплекти впорскування метанолу' },
      { en: 'Billet intakes', ua: 'Фрезеровані впуски' },
    ],
  },
  'Mountune': {
    headline: { en: 'Mountune Performance', ua: 'Mountune — продуктивність' },
    description: {
      en: 'Ford factory-backed tuning upgrades, delivering warranty-friendly power for Fiesta and Focus ST/RS.',
      ua: 'Тюнінг-апгрейди з підтримкою заводу Ford, що забезпечують потужність зі збереженням гарантії для Fiesta та Focus ST/RS.',
    },
    highlights: [
      { en: 'MP / MR power packages', ua: 'Пакети потужності MP / MR' },
      { en: 'Forged engine components', ua: 'Ковані компоненти двигуна' },
      { en: 'Intercooler upgrades', ua: 'Апгрейди інтеркулерів' },
    ],
  },
  'Bell Intercoolers': {
    headline: { en: 'Bell Intercoolers Custom', ua: 'Bell Intercoolers — кастом' },
    description: {
      en: 'Custom aluminum intercoolers and heat exchangers built to specification for racing and industrial applications.',
      ua: 'Кастомні алюмінієві інтеркулери та теплообмінники, виготовлені за специфікацією для гонок та промисловості.',
    },
    highlights: [
      { en: 'Custom core sizes', ua: 'Індивідуальні розміри ядер' },
      { en: 'Bar and plate construction', ua: 'Конструкція Bar and plate' },
      { en: 'High-pressure testing', ua: 'Тестування високим тиском' },
    ],
  },
  TECHART: {
    headline: { en: 'TECHART · Design & Presence', ua: 'TECHART · Дизайн та характер' },
    description: {
      en: 'German Porsche tuning house delivering signature body kits, interiors, and performance upgrades with OEM-level integration.',
      ua: 'Німецьке тюнінг-ательє Porsche, фірмові бодікіти, інтер’єри та апгрейди продуктивності з інтеграцією рівня OEM.',
    },
    highlights: [
      { en: 'Unrivaled style and design', ua: 'Неперевершений стиль та дизайн' },
      { en: 'Impeccable quality', ua: 'Бездоганна якість' },
      { en: 'Unique carbon body kits, forged wheels and more', ua: 'Унікальні карбонові обвіси, ковані диски і не тільки' },
    ],
  },
};
