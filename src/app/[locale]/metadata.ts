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
    title: "onecompany · Premium Auto & Moto Tuning Importer Ukraine | Since 2007",
    description:
      "Official B2B importer of 200+ premium auto & moto tuning brands in Ukraine. Akrapovic, Brabus, HRE, KW, Brembo. Expert sourcing, global logistics, warranty support since 2007. Kyiv, Baseina 21B.",
  },
  ua: {
    title: "onecompany · Офіційний Імпортер Преміум Авто та Мото Тюнінгу Україна | З 2007",
    description:
      "Офіційний B2B дистриб'ютор 200+ преміум брендів авто та мото тюнінгу в Україні. Akrapovic, Brabus, HRE, KW, Brembo. Експертний підбір, глобальна логістика, гарантійна підтримка з 2007. Київ, Басейна 21Б.",
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
    "onecompany",
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
    "buy alloy wheels"
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
