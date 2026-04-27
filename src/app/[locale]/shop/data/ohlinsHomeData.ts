export const OHLINS_HERO = {
  title: "FEEL THE ROAD",
  titleUa: "ВІДЧУЙ ДОРОГУ",
  subtitle: "Advanced Suspension Technology",
  subtitleUa: "Передові Технології Підвіски",
  description: "Authorised distributor of Öhlins Racing. Patented DFV technology, gold-anodised aerospace alloy, hand-tuned in Sweden.",
  descriptionUa: "Авторизований дистриб'ютор Öhlins Racing. Запатентована технологія DFV, авіаційний сплав із золотим анодуванням, ручна доводка у Швеції.",
  ctaText: "Explore Catalog",
  ctaTextUa: "Відкрити Каталог",
  badgeEyebrow: "official distributor · est. 2007 · one company",
};

export const OHLINS_PRODUCT_LINES = [
  {
    id: "road-track",
    name: "Road & Track",
    nameUa: "Road & Track",
    description: "Daily comfort, weekend track. DFV-equipped coilovers tuned for both worlds.",
    descriptionUa: "Щодня — комфорт, у вихідні — трек. Койловери з DFV для обох світів.",
    image: "/images/shop/ohlins/line-roadtrack.png",
    link: "/shop/ohlins/collections/road-track"
  },
  {
    id: "advanced-track",
    name: "Advanced Track Day",
    nameUa: "Advanced Track Day",
    description: "TTX twin-tube architecture, transferred directly from GT3 and Le Mans programmes.",
    descriptionUa: "Архітектура TTX twin-tube, перенесена напряму з програм GT3 та Le Mans.",
    image: "/images/shop/ohlins/line-advancedtrack.png",
    link: "/shop/ohlins/collections/advanced-track"
  },
  {
    id: "dedicated-track",
    name: "Dedicated Track",
    nameUa: "Dedicated Track",
    description: "Pure motorsport. Single-purpose dampers — built for the grid, not the boulevard.",
    descriptionUa: "Чистий автоспорт. Вузькоспеціалізовані амортизатори — для стартової решітки, а не для бульвару.",
    image: "/images/shop/ohlins/ohlins-hero-ttx.png",
    link: "/shop/ohlins/collections/dedicated-track"
  },
  {
    id: "accessories",
    name: "Accessories",
    nameUa: "Аксесуари",
    description: "Springs, cancellation kits, top mounts — the supporting cast that completes the build.",
    descriptionUa: "Пружини, верхні опори, cancellation kits — деталі, що завершують збірку.",
    image: "/images/shop/ohlins/ohlins-dfv.png",
    link: "/shop/ohlins/collections/accessories"
  }
];

export const OHLINS_HERITAGE = {
  title: "Engineered to a single standard.",
  titleUa: "Створено за єдиним стандартом.",
  description: "Designed, machined, dyno-tested in Upplands Väsby, Sweden. The same atelier that supplies factory racing programmes ships every retail damper to the same tolerance.",
  descriptionUa: "Розроблено, оброблено та випробувано на дино в Upplands Väsby, Швеція. Те саме ательє, що постачає заводські гоночні програми, відвантажує кожен амортизатор за єдиним допуском.",
  image: "/images/shop/ohlins/factory-fallback.jpg"
};

export const OHLINS_TIMELINE = [
  { year: "1976", label: "Founded in Sweden", labelUa: "Засновано у Швеції" },
  { year: "1985", label: "First MotoGP World Title", labelUa: "Перший титул MotoGP" },
  { year: "2007", label: "OEM Partnerships Begin", labelUa: "Початок OEM-партнерств" },
  { year: "2024", label: "Tenneco Performance Era", labelUa: "Епоха Tenneco Performance" }
];

export const OHLINS_PILLARS = [
  {
    icon: "dfv",
    label: "Patented DFV",
    labelUa: "Запатентована DFV",
    body: "Symmetric damping on compression and rebound. The wheel returns to the road without lifting the nose.",
    bodyUa: "Симетричне демпфування на стиск і відбій. Колесо повертається на дорогу, не задираючи переду."
  },
  {
    icon: "aluminum",
    label: "Aerospace Alloy",
    labelUa: "Авіаційний Сплав",
    body: "Gold anodising over aerospace-grade aluminium. Heat sheds faster, finish stays Öhlins.",
    bodyUa: "Золоте анодування поверх авіаційного алюмінію. Тепло сходить швидше, фірмовий вигляд лишається."
  },
  {
    icon: "sweden",
    label: "Made in Sweden",
    labelUa: "Зроблено у Швеції",
    body: "Each unit machined and dyno-validated in Upplands Väsby — to a single OEM-grade tolerance.",
    bodyUa: "Кожен вузол оброблено та перевірено на дино в Upplands Väsby — за єдиним OEM-допуском."
  }
];

export const OHLINS_LEGENDS = {
  title: "Specified on the cars that matter.",
  titleUa: "Стандарт на авто, що мають значення.",
  description: "Porsche 911 GT3, BMW M4 CSL, Mercedes-AMG GT R, McLaren 765LT — Öhlins is the OEM-sanctioned suspension upgrade for the marques that build the benchmark.",
  descriptionUa: "Porsche 911 GT3, BMW M4 CSL, Mercedes-AMG GT R, McLaren 765LT — Öhlins є санкціонованим OEM-оновленням підвіски для марок, що задають еталон.",
  image: "/images/shop/ohlins/hero-fallback.jpg",
  brands: ["Porsche", "BMW M", "Mercedes-AMG", "McLaren", "Ford Performance", "Toyota Gazoo"]
};

export const OHLINS_RACE_SERIES = [
  "MotoGP", "Formula 1", "WRC", "Le Mans", "DTM", "GT3", "Nürburgring 24h", "Pikes Peak"
];

/* Hero filter vehicle tree is now built dynamically from the live Öhlins
 * catalog at request time — see `buildOhlinsHeroVehicleTree` in
 * `src/lib/ohlinsCatalog.ts`. Page server-component fetches products and
 * passes the validated tree as `availableVehicles` prop.
 */

export const OHLINS_MATERIALS = [
  {
    name: "Dual Flow Valve (DFV)",
    nameUa: "Dual Flow Valve (DFV)",
    description: "Our patented DFV technology provides the same characteristics on rebound as it does on compression. This allows the wheel to quickly return to the ground after a bump, providing maximum traction and grip without sacrificing comfort.",
    descriptionUa: "Наша запатентована технологія DFV забезпечує однакові характеристики як на відбій, так і на стиск. Це дозволяє колесу швидко повертатися на дорогу після нерівностей, забезпечуючи максимальне зчеплення з покриттям без шкоди для комфорту.",
    image: "/images/shop/ohlins/ohlins-dfv.png"
  },
  {
    name: "Aviation Grade Materials",
    nameUa: "Авіаційні Матеріали",
    description: "Constructed from aerospace-grade aluminum and subjected to our signature gold anodizing process. This provides maximum heat dissipation, perfect corrosion resistance, and the unmistakable Öhlins visual identity.",
    descriptionUa: "Виготовлено з аерокосмічного алюмінію зі спеціальним золотим анодуванням. Це забезпечує максимальне розсіювання тепла, ідеальну стійкість до корозії та неповторний візуальний стиль Öhlins.",
    image: "/images/shop/ohlins/ohlins-hero-ttx.png"
  }
];
