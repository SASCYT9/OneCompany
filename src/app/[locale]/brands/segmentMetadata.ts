import type { Metadata } from "next";
import { buildPageMetadata, type SupportedLocale } from "@/lib/seo";

type BrandSegment = "moto" | "usa" | "europe" | "oem" | "racing";

const segmentMeta: Record<
  BrandSegment,
  Record<SupportedLocale, { title: string; description: string }>
> = {
  moto: {
    ua: {
      title: "Мото бренди для тюнінгу та сервісу | OneCompany",
      description:
        "Мото бренди для тюнінгу: вихлоп, гальма, підвіска, ECU, карбон і електроніка. Комерційні поставки та підбір під проєкт.",
    },
    en: {
      title: "Moto Performance Brands | OneCompany",
      description:
        "Motorcycle performance brands: exhaust, brakes, suspension, ECU, carbon parts and electronics with official sourcing support.",
    },
  },
  usa: {
    ua: {
      title: "Бренди США для авто тюнінгу | OneCompany",
      description:
        "Американські бренди для авто тюнінгу: вихлоп, підвіска, гальма, диски, OEM та racing рішення з офіційним постачанням.",
    },
    en: {
      title: "USA Performance Brands | OneCompany",
      description:
        "US performance brands for tuning builds: exhaust, suspension, brakes, wheels, OEM and racing-oriented components.",
    },
  },
  europe: {
    ua: {
      title: "Європейські бренди тюнінгу | OneCompany",
      description:
        "Європейські бренди тюнінгу для авто і мото: OEM та performance рішення, офіційний імпорт і професійний підбір.",
    },
    en: {
      title: "European Tuning Brands | OneCompany",
      description:
        "European tuning brands for auto and moto projects with official importer support and reliable logistics.",
    },
  },
  oem: {
    ua: {
      title: "OEM бренди для авто та мото | OneCompany",
      description:
        "OEM бренди для авто та мото тюнінгу: заводська сумісність, надійність і сервісний підбір для щоденних та трекових проєктів.",
    },
    en: {
      title: "OEM Tuning Brands | OneCompany",
      description:
        "OEM and factory-grade tuning brands focused on fitment quality, reliability and service-ready installation.",
    },
  },
  racing: {
    ua: {
      title: "Racing бренди для треку | OneCompany",
      description:
        "Racing бренди для треку: підвіска, гальма, аеро, карбон, електроніка і продуктивні рішення для motorsport-проєктів.",
    },
    en: {
      title: "Racing Parts Brands | OneCompany",
      description:
        "Racing-focused brands for track builds: suspension, brakes, aero, carbon and motorsport performance parts.",
    },
  },
};

export function buildBrandsSegmentMetadata(
  locale: SupportedLocale,
  segment: BrandSegment
): Metadata {
  return buildPageMetadata(locale, `brands/${segment}`, segmentMeta[segment][locale]);
}
