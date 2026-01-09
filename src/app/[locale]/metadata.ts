import type { Metadata } from "next";
import { buildPageMetadata, resolveLocale, type SupportedLocale } from "@/lib/seo";
import { 
  allAutomotiveBrands, 
  allMotoBrands, 
  brandMetadata, 
  subcategoryNames,
} from "@/lib/brands";

const homeMetaCopy: Record<SupportedLocale, { title: string; description: string }> = {
  en: {
    title: "OneCompany — Premium Auto & Moto Tuning | Akrapovic, Brabus, Mansory | USA Worldwide Shipping",
    description:
      "Official distributor of 200+ premium tuning brands: Akrapovic, Brabus, Mansory, HRE Wheels, KW, Ohlins. Exhaust systems, suspension, wheels, carbon fiber. Free worldwide shipping. USA, Europe, Middle East.",
  },
  ua: {
    title: "OneCompany — Преміум Тюнінг Авто та Мото | Akrapovic, Brabus, Mansory | Київ, Україна",
    description:
      "Офіційний дистриб'ютор 200+ преміум брендів тюнінгу: Akrapovic, Brabus, Mansory, HRE, KW, Ohlins. Вихлопні системи, підвіска, диски, карбон. Авто та мото тюнінг Київ. Доставка по Україні.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);
  const meta = homeMetaCopy[resolvedLocale];

  // 1. Static high-value keywords
  const staticKeywords = [
    "OneCompany",
    // English - USA Priority
    "premium car tuning USA",
    "auto tuning shop",
    "car performance parts",
    "exhaust systems USA",
    "performance exhaust",
    "aftermarket exhaust",
    "carbon fiber parts",
    "forged wheels USA",
    "sport suspension",
    "brake upgrade kit",
    "turbo upgrade",
    "supercharger kit",
    "performance tuning near me",
    "luxury car tuning",
    "supercar tuning",
    "hypercar parts",
    "exotic car parts",
    "stage 1 tuning",
    "stage 2 tuning",
    "ECU tuning",
    "chip tuning",
    "dyno tuning",
    "track day parts",
    "race car parts",
    "motorsport parts",
    "worldwide shipping tuning",
    "international car parts",
    // Ukrainian
    "тюнінг авто київ",
    "тюнінг авто",
    "тюнінг мото",
    "просто тюнінг",
    "автозапчастини київ",
    "стейдж 1",
    "стейдж 2",
    "чіп тюнінг",
    "тюнінг купити",
    "auto tuning Ukraine",
    "moto tuning Ukraine", 
    "premium car parts",
    "tuning importer",
    "авто тюнінг Україна",
    "мото тюнінг Київ",
    "преміум запчастини",
    "імпортер тюнінгу",
  ];

  // 2. Category keywords (buy intent)
  const categoryKeywords = Object.values(subcategoryNames).flatMap((cat) => [
    `${cat.ua} купити`,
    `${cat.ua} київ`,
    `${cat.en} buy`,
  ]);

  // 3. Brand keywords
  const allBrands = [...allAutomotiveBrands, ...allMotoBrands];
  const brandKeywords = allBrands.flatMap((brand) => {
    const meta = brandMetadata[brand.name];
    const keywords = [
      brand.name,
      `${brand.name} купити`,
      `${brand.name} Ukraine`,
      `${brand.name} київ`,
    ];

    if (meta?.subcategory) {
      const sub = subcategoryNames[meta.subcategory];
      if (sub) {
        keywords.push(`${brand.name} ${sub.ua}`); // e.g. KW підвіска
        keywords.push(`${brand.name} ${sub.en}`); // e.g. KW suspension
      }
    }
    
    return keywords;
  });

  // 4. Market-specific aggressive keywords (Competitor targeting)
  const marketKeywords = [
    // Services (UA)
    "встановлення вихлопу",
    "налаштування стейдж 2",
    "чіп тюнінг двигуна",
    "підбір тюнінгу",
    "замір потужності",
    "індивідуальні проекти",
    "професійний тюнінг",
    // Services (EN)
    "exhaust installation",
    "stage 2 tuning",
    "engine chip tuning",
    "tuning consulting",
    "dyno test",
    "custom projects",
    "professional tuning",
    
    // Models (UA)
    "тюнінг BMW M",
    "тюнінг Audi RS",
    "тюнінг Mercedes AMG",
    "тюнінг Porsche 911",
    "тюнінг Lamborghini Urus",
    "тюнінг Audi RS6",
    "тюнінг G-Class",
    "тюнінг BMW X5M",
    "тюнінг Rolls Royce",
    // Models (EN)
    "BMW M tuning",
    "Audi RS tuning",
    "Mercedes AMG tuning",
    "Porsche 911 tuning",
    "Lamborghini Urus tuning",
    "Audi RS6 tuning",
    "G-Class tuning",
    "BMW X5M tuning",
    "Rolls Royce tuning",

    // Commercial / Trust (UA)
    "офіційний дилер Akrapovic",
    "офіційний дилер Brabus",
    "тюнінг ательє київ",
    "преміум автосервіс",
    "гарантія на тюнінг",
    "прямий імпортер",
    "оптовий продаж тюнінгу",
    // Commercial / Trust (EN)
    "official Akrapovic dealer",
    "official Brabus dealer",
    "tuning studio Kyiv",
    "premium car service",
    "tuning warranty",
    "direct importer",
    "wholesale tuning",
    
    // Specific Parts (UA)
    "даунпайп",
    "ковані диски",
    "литі диски",
    "карбоновий обвіс",
    "титановий вихлоп",
    "керамічні гальма",
    "аеродинамічний обвіс",
    "спортивна підвіска",
    "купити литі диски",
    // Specific Parts (EN)
    "downpipe",
    "forged wheels",
    "alloy wheels",
    "carbon body kit",
    "titanium exhaust",
    "ceramic brakes",
    "aerodynamic kit",
    "sport suspension",
    "buy alloy wheels",
    
    // USA Market Keywords
    "Akrapovic exhaust USA",
    "Brabus tuning USA",
    "Mansory USA dealer",
    "HRE wheels USA",
    "KW suspension USA",
    "Novitec USA",
    "ABT tuning USA",
    "Vorsteiner USA",
    "buy Akrapovic online",
    "buy Brabus online",
    "Akrapovic price",
    "Brabus price",
    "HRE wheels price",
    "performance parts shop",
    "tuning parts online",
    "aftermarket parts USA",
    "import car parts",
    "European car tuning USA",
    "German car tuning",
    "Italian car tuning",
    "BMW tuning parts",
    "Mercedes tuning parts",
    "Porsche tuning parts",
    "Ferrari tuning parts",
    "Lamborghini tuning parts",
    "Audi tuning parts",
    "McLaren tuning parts",
    "Ducati tuning parts",
    "motorcycle exhaust USA",
    "sportbike parts USA",
    "superbike tuning",
    
    // Geographic (USA)
    "car tuning California",
    "tuning shop Florida",
    "performance parts Texas",
    "car tuning New York",
    "tuning Los Angeles",
    "tuning Miami",
    "car parts Dallas",
    "tuning Chicago",
    
    // Geographic (Europe/Middle East)
    "tuning Dubai",
    "car parts UAE",
    "tuning Germany",
    "tuning UK",
    "European car parts"
  ];

  // Deduplicate and combine
  const keywords = Array.from(new Set([
    ...staticKeywords,
    ...categoryKeywords,
    ...brandKeywords,
    ...marketKeywords
  ]));

  return {
    ...buildPageMetadata(resolvedLocale, "", meta),
    keywords: keywords,
  };
}
