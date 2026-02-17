import type { Metadata } from "next";
import { buildPageMetadata, type SupportedLocale } from "@/lib/seo";

type BrandSegment = "moto" | "usa" | "europe" | "oem" | "racing";

const segmentMeta: Record<
  BrandSegment,
  Record<SupportedLocale, { title: string; description: string }>
> = {
  moto: {
    ua: {
      title: "Мото бренди тюнінгу · OneCompany",
      description:
        "Каталог мото брендів тюнінгу: вихлоп, гальма, підвіска, карбон та електроніка для преміальних мотоциклів.",
    },
    en: {
      title: "Moto Tuning Brands · OneCompany",
      description:
        "Catalog of premium motorcycle tuning brands: exhaust, brakes, suspension, carbon parts and electronics.",
    },
  },
  usa: {
    ua: {
      title: "Бренди США · OneCompany",
      description:
        "Американські бренди преміум тюнінгу для авто: вихлоп, підвіска, гальма, диски та аеродинаміка.",
    },
    en: {
      title: "USA Brands · OneCompany",
      description:
        "Premium US tuning brands for performance cars: exhaust, suspension, brakes, wheels and aero kits.",
    },
  },
  europe: {
    ua: {
      title: "Європейські бренди · OneCompany",
      description:
        "Європейські бренди тюнінгу для авто: офіційний імпорт, логістика та експертний підбір рішень.",
    },
    en: {
      title: "European Brands · OneCompany",
      description:
        "European performance tuning brands with official importer support, global logistics and expert sourcing.",
    },
  },
  oem: {
    ua: {
      title: "OEM бренди · OneCompany",
      description:
        "OEM та factory-grade бренди для тюнінгу: сумісність, надійність і якість для щоденного та трекового авто.",
    },
    en: {
      title: "OEM Brands · OneCompany",
      description:
        "OEM and factory-grade tuning brands focused on fitment quality, reliability and motorsport-ready solutions.",
    },
  },
  racing: {
    ua: {
      title: "Racing бренди · OneCompany",
      description:
        "Гоночні бренди для треку та автоспорту: підвіска, гальма, аеро, карбон і компоненти продуктивності.",
    },
    en: {
      title: "Racing Brands · OneCompany",
      description:
        "Racing-focused brands for track and motorsport builds: suspension, brakes, aero, carbon and performance parts.",
    },
  },
};

export function buildBrandsSegmentMetadata(
  locale: SupportedLocale,
  segment: BrandSegment
): Metadata {
  return buildPageMetadata(locale, `brands/${segment}`, segmentMeta[segment][locale]);
}
