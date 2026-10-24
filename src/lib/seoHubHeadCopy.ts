import type { SupportedLocale } from "@/lib/seo";

/**
 * `<title>` and meta description of the brand homes and their collection
 * hubs. Head only: the visible page copy and the JSON-LD stay as they are.
 *
 * Ukrainian searches for these parts name the product type, the brand and the
 * car, often with "купити" or "Україна" ("do88 інтеркулер купити", "brabus
 * g-class україна"). The old titles were mostly the bare brand ("Brabus | One
 * Company"), so the titles below lead with those words. Descriptions stay
 * within the 165 characters page metadata keeps.
 */
export type HeadCopy = { title: string; description: string };
type LocalizedHeadCopy = Record<SupportedLocale, HeadCopy>;

const SITE = "One Company";

export const BRAND_HOME_HEAD = {
  akrapovic: {
    ua: {
      title: `Вихлопні системи Akrapovič — купити в Україні | ${SITE}`,
      description:
        "Титанові вихлопні системи Akrapovič для BMW M, Porsche, Mercedes-AMG, Audi RS і мотоциклів: Slip-On, Evolution, даунпайпи. Доставка по Україні.",
    },
    en: {
      title: `Akrapovič Exhaust Systems — Buy in Ukraine | ${SITE}`,
      description:
        "Titanium Akrapovič exhaust systems for BMW M, Porsche, Mercedes-AMG, Audi RS and motorcycles: Slip-On, Evolution, downpipes. Delivery across Ukraine.",
    },
  },
  ilmberger: {
    ua: {
      title: `Карбон Ilmberger для спортбайків — купити в Україні | ${SITE}`,
      description:
        "Карбонові деталі Ilmberger з автоклавного препрегу для BMW S 1000 RR, Ducati Panigale V4, Aprilia RSV4 і Yamaha R1. Зроблено в Німеччині, доставка по Україні.",
    },
    en: {
      title: `Ilmberger Carbon Parts for Sportbikes — Buy in Ukraine | ${SITE}`,
      description:
        "Autoclaved prepreg carbon parts by Ilmberger for BMW S 1000 RR, Ducati Panigale V4, Aprilia RSV4 and Yamaha R1. Made in Germany, delivered across Ukraine.",
    },
  },
  eventuri: {
    ua: {
      title: `Карбонові впуски Eventuri — купити в Україні | ${SITE}`,
      description:
        "Карбонові системи впуску, турбоінлети та кришки двигуна Eventuri для BMW M, Audi RS, Mercedes-AMG, Porsche і Toyota Supra. Доставка по Україні.",
    },
    en: {
      title: `Eventuri Carbon Intakes — Buy in Ukraine | ${SITE}`,
      description:
        "Eventuri carbon intake systems, turbo inlets and engine covers for BMW M, Audi RS, Mercedes-AMG, Porsche and Toyota Supra. Delivery across Ukraine.",
    },
  },
  csf: {
    ua: {
      title: `Радіатори та інтеркулери CSF — купити в Україні | ${SITE}`,
      description:
        "Радіатори, інтеркулери та масляні радіатори CSF Racing для BMW, Toyota Supra, Subaru і Porsche — для дороги й треку. Доставка по Україні.",
    },
    en: {
      title: `CSF Radiators & Intercoolers — Buy in Ukraine | ${SITE}`,
      description:
        "CSF Racing radiators, intercoolers and oil coolers for BMW, Toyota Supra, Subaru and Porsche, built for road and track. Delivery across Ukraine.",
    },
  },
  ohlins: {
    ua: {
      title: `Підвіска Öhlins — купити в Україні | ${SITE}`,
      description:
        "Койловери та амортизатори Öhlins Road & Track, Advanced Trackday і Dedicated Track для BMW, Porsche, Toyota, Subaru та інших авто. Доставка по Україні.",
    },
    en: {
      title: `Öhlins Suspension — Buy in Ukraine | ${SITE}`,
      description:
        "Öhlins Road & Track, Advanced Trackday and Dedicated Track coilovers and dampers for BMW, Porsche, Toyota, Subaru and more. Delivery across Ukraine.",
    },
  },
  girodisc: {
    ua: {
      title: `Гальмівні диски GiroDisc — купити в Україні | ${SITE}`,
      description:
        "Двоскладові гальмівні диски GiroDisc, змінні кільця, гоночні колодки й титанові щитки для BMW, Porsche, Mercedes-AMG і Corvette. Доставка по Україні.",
    },
    en: {
      title: `GiroDisc Brake Rotors — Buy in Ukraine | ${SITE}`,
      description:
        "2-piece GiroDisc rotors, replacement rings, racing pads and titanium heat shields for BMW, Porsche, Mercedes-AMG and Corvette. Delivery across Ukraine.",
    },
  },
  ipe: {
    ua: {
      title: `Вихлопні системи iPE — купити в Україні | ${SITE}`,
      description:
        "Титанові вихлопні системи iPE (Innotech Performance Exhaust) з valvetronic-заслінками для Porsche, Ferrari, Lamborghini, Audi і BMW. Доставка по Україні.",
    },
    en: {
      title: `iPE Titanium Exhaust Systems — Buy in Ukraine | ${SITE}`,
      description:
        "iPE (Innotech Performance Exhaust) titanium valvetronic systems for Porsche, Ferrari, Lamborghini, Audi and BMW. Delivery across Ukraine.",
    },
  },
  brabus: {
    ua: {
      title: `Тюнінг Brabus в Україні — обвіси, диски, вихлоп | ${SITE}`,
      description:
        "Тюнінг Brabus для Mercedes G-Class, S-Class, GLE, AMG GT, Porsche і Rolls-Royce: обвіси, ковані диски Monoblock, вихлоп і салон. Доставка по Україні.",
    },
    en: {
      title: `Brabus Tuning in Ukraine — Body Kits, Wheels, Exhaust | ${SITE}`,
      description:
        "Brabus tuning for Mercedes G-Class, S-Class, GLE, AMG GT, Porsche and Rolls-Royce: body kits, Monoblock forged wheels, exhaust and interiors.",
    },
  },
  do88: {
    ua: {
      title: `Інтеркулери та радіатори do88 — купити в Україні | ${SITE}`,
      description:
        "Інтеркулери, радіатори, силіконові патрубки та впускні системи do88 зі Швеції для BMW, Audi, VW, Porsche, Volvo і Toyota. Доставка по Україні.",
    },
    en: {
      title: `do88 Intercoolers & Radiators — Buy in Ukraine | ${SITE}`,
      description:
        "do88 intercoolers, radiators, silicone hoses and intake systems from Sweden for BMW, Audi, VW, Porsche, Volvo and Toyota. Delivery across Ukraine.",
    },
  },
  racechip: {
    ua: {
      title: `Чіп-тюнінг RaceChip GTS 5 — купити в Україні | ${SITE}`,
      description:
        "Офіційний магазин RaceChip: модулі чіп-тюнінгу GTS 5 Black з керуванням зі смартфона (App Control) для 50+ марок авто. Підбір за маркою, моделлю й мотором.",
    },
    en: {
      title: `RaceChip GTS 5 Chip Tuning — Buy in Ukraine | ${SITE}`,
      description:
        "Official RaceChip storefront: GTS 5 Black tuning modules with smartphone App Control for 50+ car brands. Find yours by make, model and engine.",
    },
  },
  burger: {
    ua: {
      title: `Чіп-тюнінг Burger Motorsports JB4 — купити в Україні | ${SITE}`,
      description:
        "Чіпи збільшення потужності JB4, flex fuel кіти, впускні системи та performance-деталі для BMW, Mercedes, Porsche та 30+ марок. Доставка по Україні.",
    },
    en: {
      title: `Burger Motorsports JB4 Tuning — Buy in Ukraine | ${SITE}`,
      description:
        "JB4 power chips, flex fuel kits, intake systems and performance parts for BMW, Mercedes, Porsche and 30+ brands. Delivery across Ukraine.",
    },
  },
  adro: {
    ua: {
      title: `Карбонові обвіси ADRO — купити в Україні | ${SITE}`,
      description:
        "Карбонові обвіси ADRO з препрегу й CFD-аеродинамікою рівня F1 для BMW M3/M4 G8X, Porsche 992 GT3, Toyota GR Supra і Tesla Model 3. Доставка по Україні.",
    },
    en: {
      title: `ADRO Carbon Fiber Aero Kits — Buy in Ukraine | ${SITE}`,
      description:
        "ADRO prepreg carbon aero kits with F1-level CFD for BMW M3/M4 G8X, Porsche 992 GT3, Toyota GR Supra and Tesla Model 3. Delivery across Ukraine.",
    },
  },
  urban: {
    ua: {
      title: `Обвіси Urban Automotive — купити в Україні | ${SITE}`,
      description:
        "Обвіси, карбонові деталі та диски Urban Automotive для Land Rover Defender, Range Rover, Lamborghini Urus, Mercedes G-Class і Audi RS. Доставка по Україні.",
    },
    en: {
      title: `Urban Automotive Body Kits — Buy in Ukraine | ${SITE}`,
      description:
        "Urban Automotive body kits, carbon parts and wheels for Land Rover Defender, Range Rover, Lamborghini Urus, Mercedes G-Class and Audi RS.",
    },
  },
} satisfies Record<string, LocalizedHeadCopy>;

/** "Land Rover" + "Defender 90 / 110 / 130"; a title that already names the make keeps it once. */
function urbanVehicle(card: { title: string; brand: string }): string {
  return card.title.toLowerCase().startsWith(card.brand.toLowerCase())
    ? card.title
    : `${card.brand} ${card.title}`;
}

export function urbanCollectionHead(
  locale: SupportedLocale,
  card: { title: string; brand: string }
): HeadCopy {
  const vehicle = urbanVehicle(card);
  return locale === "ua"
    ? {
        title: `Обвіси Urban для ${vehicle} | ${SITE}`,
        description: `Обвіси, карбонові деталі, диски та аксесуари Urban Automotive для ${vehicle}. Ціни в гривнях, доставка по Україні, консультація з підбору.`,
      }
    : {
        title: `Urban Automotive Body Kits for ${vehicle} | ${SITE}`,
        description: `Urban Automotive body kits, carbon parts, wheels and accessories for ${vehicle}. Prices in UAH, delivery across Ukraine.`,
      };
}

const BRABUS_COLLECTION_SUBJECTS: Record<string, Record<SupportedLocale, string>> = {
  "g-class": { ua: "Тюнінг Brabus для Mercedes G-Class", en: "Brabus Tuning for Mercedes G-Class" },
  "s-class": { ua: "Тюнінг Brabus для Mercedes S-Class", en: "Brabus Tuning for Mercedes S-Class" },
  porsche: { ua: "Тюнінг Brabus для Porsche", en: "Brabus Tuning for Porsche" },
  "rolls-royce": {
    ua: "Тюнінг Brabus для Rolls-Royce і Bentley",
    en: "Brabus Tuning for Rolls-Royce & Bentley",
  },
  bentley: {
    ua: "Тюнінг Brabus для Bentley Continental GT",
    en: "Brabus Tuning for Bentley Continental GT",
  },
  lamborghini: {
    ua: "Тюнінг Brabus для Lamborghini Urus SE",
    en: "Brabus Tuning for Lamborghini Urus SE",
  },
  "range-rover": {
    ua: "Тюнінг Brabus 600 для Range Rover L460",
    en: "Brabus 600 Tuning for Range Rover L460",
  },
  "gle-gls": {
    ua: "Тюнінг Brabus для Mercedes GLE і GLS",
    en: "Brabus Tuning for Mercedes GLE & GLS",
  },
  "amg-gt": { ua: "Тюнінг Brabus для Mercedes-AMG GT", en: "Brabus Tuning for Mercedes-AMG GT" },
  wheels: { ua: "Ковані диски Brabus Monoblock", en: "Brabus Monoblock Forged Wheels" },
};

export function brabusCollectionHead(
  locale: SupportedLocale,
  handle: string,
  fallbackTitle: string
): HeadCopy {
  const subject =
    BRABUS_COLLECTION_SUBJECTS[handle]?.[locale] ??
    (locale === "ua" ? `Тюнінг Brabus: ${fallbackTitle}` : `Brabus ${fallbackTitle}`);
  const isWheels = handle === "wheels";
  if (locale === "ua") {
    return {
      title: `${subject} — купити в Україні | ${SITE}`,
      description: isWheels
        ? `${subject} для Mercedes, Porsche, Rolls-Royce та інших авто. Ціни в гривнях, доставка по Україні, підбір дисків під ваше авто.`
        : `${subject}: аеродинамічні обвіси, ковані диски Monoblock, вихлоп і салон BRABUS. Ціни в гривнях, доставка по Україні.`,
    };
  }
  return {
    title: `${subject} — Buy in Ukraine | ${SITE}`,
    description: isWheels
      ? `${subject} for Mercedes, Porsche, Rolls-Royce and more. Prices in UAH, delivery across Ukraine, fitment advice for your car.`
      : `${subject}: aero body kits, Monoblock forged wheels, exhaust and BRABUS interiors. Prices in UAH, delivery across Ukraine.`,
  };
}

const DO88_COLLECTION_SUBJECTS: Record<string, Record<SupportedLocale, string>> = {
  all: { ua: "Усі деталі do88", en: "All do88 Parts" },
  intercoolers: { ua: "Інтеркулери do88", en: "do88 Intercoolers" },
  radiators: { ua: "Радіатори do88", en: "do88 Radiators" },
  "intake-systems": { ua: "Системи впуску do88", en: "do88 Intake Systems" },
  "performance-hoses": { ua: "Силіконові патрубки do88", en: "do88 Silicone Hoses" },
  "oil-coolers": { ua: "Масляні радіатори do88", en: "do88 Oil Coolers" },
  "y-pipes-plenums": { ua: "Y-пайпи та пленуми do88", en: "do88 Y-Pipes & Plenums" },
  "cooling-accessories": { ua: "Вентилятори й аксесуари do88", en: "do88 Fans & Accessories" },
};

export function do88CollectionHead(
  locale: SupportedLocale,
  handle: string,
  fallback: { title: string; titleUk?: string }
): HeadCopy {
  const subject =
    DO88_COLLECTION_SUBJECTS[handle]?.[locale] ??
    (locale === "ua" ? `${fallback.titleUk ?? fallback.title} do88` : `do88 ${fallback.title}`);
  return locale === "ua"
    ? {
        title: `${subject} — купити в Україні | ${SITE}`,
        description: `${subject} зі Швеції для BMW, Audi, VW, Porsche, Volvo і Toyota: ціни в гривнях, доставка по Україні, підбір за маркою, моделлю й кузовом.`,
      }
    : {
        title: `${subject} — Buy in Ukraine | ${SITE}`,
        description: `${subject} from Sweden for BMW, Audi, VW, Porsche, Volvo and Toyota. Prices in UAH, delivery across Ukraine, search by make, model and chassis.`,
      };
}

export function adroLineHead(
  locale: SupportedLocale,
  line: { name: string; nameUk?: string }
): HeadCopy {
  if (locale === "ua") {
    const vehicle = line.nameUk ?? line.name;
    return {
      title: `Карбоновий обвіс ADRO для ${vehicle} | ${SITE}`,
      description: `Карбонові сплітер, спойлер, дифузор і пороги ADRO для ${vehicle}: препрег-карбон, CFD-аеродинаміка рівня F1. Ціни в гривнях, доставка по Україні.`,
    };
  }
  return {
    title: `ADRO Carbon Aero Kit for ${line.name} | ${SITE}`,
    description: `ADRO carbon splitter, wing, diffuser and side skirts for ${line.name}: prepreg carbon, F1-level CFD aero. Prices in UAH, delivery across Ukraine.`,
  };
}
