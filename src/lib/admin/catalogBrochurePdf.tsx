/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image does not expose the DOM alt prop. */
import React from "react";
import { Document, Font, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { loadProformaImages } from "./orderProformaImages";
import type {
  CatalogBrochureBranding,
  CatalogBrochureCurrency,
  CatalogBrochureDescriptionMode,
  CatalogBrochureGalleryLayout,
  CatalogBrochureLayout,
  CatalogBrochureLanguage,
  CatalogBrochurePhotoMode,
} from "./catalogBrochure";

Font.register({
  family: "Catalog",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/proforma/NotoSans-Regular.ttf") },
    { src: path.join(process.cwd(), "public/fonts/proforma/NotoSans-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const A4_SIZE = { width: 595.28, height: 841.89 } as const;
const PAGE_MARGIN = 36;
const SUMMARY_PAGE_SIZE = 8;
const ACCENT = "#9ebd3a";

export type CatalogBrochurePdfItem = {
  title: string;
  description: string;
  sku: string | null;
  brand: string | null;
  image: string | null;
  imageSources: string[];
  galleryLayout?: CatalogBrochureGalleryLayout;
  price: number | null;
};

export type CatalogBrochurePdfInput = {
  title: string;
  subtitle: string;
  language: CatalogBrochureLanguage;
  currency: CatalogBrochureCurrency;
  layout: CatalogBrochureLayout;
  photoMode?: CatalogBrochurePhotoMode;
  descriptionMode?: CatalogBrochureDescriptionMode;
  branding: CatalogBrochureBranding;
  brandLogoSrc: string | null;
  showPrice: boolean;
  generatedAt: Date;
  items: CatalogBrochurePdfItem[];
};

type LogoAsset = {
  data: Buffer;
  isLight: boolean;
};

const labels = {
  ua: {
    catalog: "ПРЕЗЕНТАЦІЙНИЙ КАТАЛОГ",
    collection: "КОЛЕКЦІЯ / КОНФІГУРАЦІЯ",
    selected: "ВИБРАНІ ДЕТАЛІ",
    selectedDeck: "Добірка компонентів у єдиній конфігурації",
    configuration: "ВАША КОНФІГУРАЦІЯ",
    continuation: "ПРОДОВЖЕННЯ КОНФІГУРАЦІЇ",
    price: "ЦІНА",
    total: "УСІ ПОЗИЦІЇ",
    positions: "ПОЗИЦІЇ",
    request: "ЦІНА ЗА ЗАПИТОМ",
    sku: "АРТИКУЛ",
    note: "Фото та характеристики взято з каталогу OneCompany. Остаточна комплектація, сумісність і ціна підтверджуються менеджером.",
    generated: "СФОРМОВАНО",
    noPhoto: "ФОТО ТОВАРУ НЕ ДОДАНО",
  },
  ru: {
    catalog: "ПРЕЗЕНТАЦИОННЫЙ КАТАЛОГ",
    collection: "КОЛЛЕКЦИЯ / КОНФИГУРАЦИЯ",
    selected: "ВЫБРАННЫЕ ДЕТАЛИ",
    selectedDeck: "Подборка компонентов в единой конфигурации",
    configuration: "ВАША КОНФИГУРАЦИЯ",
    continuation: "ПРОДОЛЖЕНИЕ КОНФИГУРАЦИИ",
    price: "ЦЕНА",
    total: "ВСЕ ПОЗИЦИИ",
    positions: "ПОЗИЦИИ",
    request: "ЦЕНА ПО ЗАПРОСУ",
    sku: "АРТИКУЛ",
    note: "Фото и характеристики взяты из каталога OneCompany. Итоговая комплектация, совместимость и цена подтверждаются менеджером.",
    generated: "СФОРМИРОВАНО",
    noPhoto: "ФОТО ТОВАРА НЕ ДОБАВЛЕНО",
  },
  en: {
    catalog: "PRESENTATION CATALOG",
    collection: "COLLECTION / CONFIGURATION",
    selected: "SELECTED DETAILS",
    selectedDeck: "A curated set of components in one configuration",
    configuration: "YOUR CONFIGURATION",
    continuation: "CONFIGURATION CONTINUED",
    price: "PRICE",
    total: "ALL ITEMS",
    positions: "ITEMS",
    request: "PRICE ON REQUEST",
    sku: "SKU",
    note: "Product imagery and details are taken from the OneCompany catalog. Final configuration, compatibility and pricing are confirmed by a manager.",
    generated: "GENERATED",
    noPhoto: "PRODUCT IMAGE NOT AVAILABLE",
  },
} as const;

const localeMap: Record<CatalogBrochureLanguage, string> = {
  ua: "uk-UA",
  ru: "ru-RU",
  en: "en-GB",
};

function formatMoney(
  value: number | null,
  currency: CatalogBrochureCurrency,
  language: CatalogBrochureLanguage
) {
  if (value == null) return labels[language].request;
  return new Intl.NumberFormat(localeMap[language], {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function safeText(value: string | null | undefined, fallback: string) {
  const text = value
    ?.replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function trimText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength + 1);
  const sentence = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );
  if (sentence >= Math.floor(maxLength * 0.55)) return slice.slice(0, sentence + 1).trim();
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}…`;
}

function productDeck(description: string, fallback: string) {
  const text = safeText(description, fallback);
  const firstSentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  return trimText(firstSentence && firstSentence.length >= 42 ? firstSentence : text, 128);
}

function productDescription(
  description: string,
  fallback: string,
  mode: CatalogBrochureDescriptionMode,
  maxLength: number
) {
  if (mode === "none") return "";
  return trimText(safeText(description, fallback), mode === "short" ? maxLength : 285);
}

function titleSize(title: string) {
  if (title.length <= 44) return 31;
  if (title.length <= 72) return 27;
  if (title.length <= 102) return 23;
  return 20;
}

function coverTitleSize(title: string) {
  if (title.length <= 32) return 42;
  if (title.length <= 58) return 35;
  return 30;
}

function splitIntoGroups<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function ProductPhoto({
  picture,
  emptyLabel,
  imageStyle,
}: {
  picture: Buffer | null;
  emptyLabel: string;
  imageStyle: Style;
}) {
  if (picture) return <Image src={picture} style={imageStyle} />;
  return (
    <View style={{ ...imageStyle, ...styles.emptyPhoto }}>
      <Text style={styles.emptyPhotoLabel}>{emptyLabel}</Text>
    </View>
  );
}

function ProductGallery({
  pictures,
  emptyLabel,
  photoMode,
  galleryLayout,
  heroStyle,
  galleryStyle,
  cellStyle,
  galleryHeight,
}: {
  pictures: Array<Buffer | null>;
  emptyLabel: string;
  photoMode: CatalogBrochurePhotoMode;
  galleryLayout: CatalogBrochureGalleryLayout;
  heroStyle: Style;
  galleryStyle: Style;
  cellStyle: Style;
  galleryHeight: number;
}) {
  const available = pictures.filter((picture): picture is Buffer => Boolean(picture));
  if (available.length <= 1 || photoMode === "hero") {
    return (
      <ProductPhoto picture={available[0] ?? null} emptyLabel={emptyLabel} imageStyle={heroStyle} />
    );
  }

  const useFeatureLayout =
    galleryLayout === "feature" || (galleryLayout === "auto" && available.length === 3);
  if (useFeatureLayout && available.length === 2) {
    return (
      <View style={{ ...galleryStyle, flexDirection: "row", flexWrap: "nowrap" }}>
        <ProductPhoto
          picture={available[0]}
          emptyLabel={emptyLabel}
          imageStyle={{ ...cellStyle, width: "62%", height: galleryHeight }}
        />
        <ProductPhoto
          picture={available[1]}
          emptyLabel={emptyLabel}
          imageStyle={{ ...cellStyle, width: "38%", height: galleryHeight }}
        />
      </View>
    );
  }
  if (useFeatureLayout && available.length === 3) {
    return (
      <View style={{ ...galleryStyle, flexDirection: "row", flexWrap: "nowrap" }}>
        <ProductPhoto
          picture={available[0]}
          emptyLabel={emptyLabel}
          imageStyle={{ ...cellStyle, width: "58%", height: galleryHeight }}
        />
        <View style={{ width: "42%", height: galleryHeight, flexDirection: "column" }}>
          <ProductPhoto
            picture={available[1]}
            emptyLabel={emptyLabel}
            imageStyle={{ ...cellStyle, width: "100%", height: galleryHeight / 2 }}
          />
          <ProductPhoto
            picture={available[2]}
            emptyLabel={emptyLabel}
            imageStyle={{ ...cellStyle, width: "100%", height: galleryHeight / 2 }}
          />
        </View>
      </View>
    );
  }

  const columns = available.length <= 3 ? available.length : available.length <= 6 ? 3 : 4;
  const rows = splitIntoGroups(available, columns);
  const rowHeight = Math.max(68, Math.floor(galleryHeight / rows.length));
  return (
    <View style={{ ...galleryStyle, flexDirection: "column", flexWrap: "nowrap" }}>
      {rows.map((row, rowIndex) => (
        <View
          key={`gallery-row-${rowIndex}`}
          style={{ width: "100%", height: rowHeight, flexDirection: "row" }}
        >
          {row.map((picture, index) => (
            <ProductPhoto
              key={`gallery-${rowIndex}-${index}`}
              picture={picture}
              emptyLabel={emptyLabel}
              imageStyle={{
                ...cellStyle,
                width: `${100 / row.length}%`,
                height: rowHeight,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function LogoMark({
  logo,
  branding,
  surface,
}: {
  logo: LogoAsset | null;
  branding: CatalogBrochureBranding;
  surface: "dark" | "light";
}) {
  if (!logo || branding === "none") return null;
  const needsContrast = surface === "light" ? logo.isLight : !logo.isLight;
  return (
    <View
      style={
        needsContrast
          ? surface === "light"
            ? styles.logoFrameDark
            : styles.logoFrameLight
          : styles.logoFrameClear
      }
    >
      <Image src={logo.data} style={styles.logoImage} />
    </View>
  );
}

function PageFooter({
  documentMark,
  pageNumber,
  pageCount,
}: {
  documentMark: string;
  pageNumber: number;
  pageCount: number;
}) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{documentMark}</Text>
      <Text style={styles.footerText}>
        {String(pageNumber).padStart(2, "0")} / {String(pageCount).padStart(2, "0")}
      </Text>
    </View>
  );
}

function PageHeader({
  logo,
  branding,
  title,
  descriptor,
}: {
  logo: LogoAsset | null;
  branding: CatalogBrochureBranding;
  title: string;
  descriptor: string;
}) {
  return (
    <View style={styles.header}>
      <LogoMark logo={logo} branding={branding} surface="light" />
      <View style={styles.headerMeta}>
        <Text style={styles.headerMetaLine}>{title}</Text>
        <Text style={styles.headerMetaLine}>{descriptor}</Text>
      </View>
    </View>
  );
}

const styles = {
  page: {
    fontFamily: "Catalog",
    width: A4_SIZE.width,
    height: A4_SIZE.height,
    backgroundColor: "#ffffff",
    color: "#17191a",
    paddingTop: 36,
    paddingHorizontal: PAGE_MARGIN,
    paddingBottom: 40,
  },
  coverPage: {
    fontFamily: "Catalog",
    width: A4_SIZE.width,
    height: A4_SIZE.height,
    backgroundColor: "#ffffff",
    color: "#17191a",
    padding: 0,
  },
  coverTop: {
    height: 252,
    backgroundColor: "#141718",
    color: "#ffffff",
    paddingTop: 35,
    paddingHorizontal: PAGE_MARGIN,
  },
  logoFrameClear: {
    width: 132,
    height: 31,
    justifyContent: "center" as const,
    alignItems: "flex-start" as const,
  },
  logoFrameDark: {
    width: 132,
    height: 31,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "#141718",
    borderWidth: 0.6,
    borderColor: "#353a3b",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  logoFrameLight: {
    width: 132,
    height: 31,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "#ffffff",
    borderWidth: 0.6,
    borderColor: "#d0d4d5",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  logoImage: {
    width: 124,
    height: 22,
    objectFit: "contain" as const,
  },
  coverKicker: {
    marginTop: 48,
    fontSize: 8.5,
    letterSpacing: 2.5,
    color: "#c8cecf",
  },
  coverTitle: {
    marginTop: 18,
    maxWidth: 500,
    lineHeight: 1.03,
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
  },
  coverHero: {
    width: A4_SIZE.width,
    height: 382,
    objectFit: "cover" as const,
    backgroundColor: "#eceeed",
  },
  coverBottom: {
    height: 208,
    paddingTop: 28,
    paddingHorizontal: PAGE_MARGIN,
    paddingBottom: 25,
  },
  coverAccent: {
    width: 44,
    height: 3,
    backgroundColor: ACCENT,
    marginBottom: 17,
  },
  coverStatement: {
    maxWidth: 470,
    fontSize: 23,
    lineHeight: 1.1,
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
  },
  coverInfo: {
    marginTop: 13,
    maxWidth: 450,
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#767e82",
  },
  coverFooter: {
    position: "absolute" as const,
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    bottom: 19,
    paddingTop: 8,
    borderTopWidth: 0.55,
    borderTopColor: "#d5d8d9",
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
  },
  header: {
    height: 34,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: 34,
  },
  headerMeta: {
    maxWidth: 258,
    alignItems: "flex-end" as const,
  },
  headerMetaLine: {
    marginBottom: 4,
    fontSize: 7.3,
    letterSpacing: 1.1,
    color: "#6f777b",
    textAlign: "right" as const,
    textTransform: "uppercase" as const,
  },
  introBlock: {
    height: 126,
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 2.1,
    color: "#6f777b",
    marginBottom: 13,
    textTransform: "uppercase" as const,
  },
  productTitle: {
    lineHeight: 1.05,
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
  },
  productDeck: {
    marginTop: 10,
    maxWidth: 470,
    fontSize: 10.5,
    lineHeight: 1.35,
    color: "#777f83",
  },
  fullBleedPhoto: {
    width: A4_SIZE.width,
    height: 328,
    marginLeft: -PAGE_MARGIN,
    objectFit: "cover" as const,
    backgroundColor: "#eff1f0",
  },
  galleryBand: {
    width: A4_SIZE.width,
    height: 328,
    marginLeft: -PAGE_MARGIN,
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    backgroundColor: "#eff1f0",
  },
  galleryCell: {
    objectFit: "cover" as const,
    borderRightWidth: 0.8,
    borderBottomWidth: 0.8,
    borderColor: "#ffffff",
    backgroundColor: "#eff1f0",
  },
  emptyPhoto: {
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "#eff1f0",
  },
  emptyPhotoLabel: {
    fontSize: 8,
    letterSpacing: 1.7,
    color: "#858d90",
  },
  caption: {
    height: 21,
    paddingTop: 7,
    fontSize: 6.7,
    color: "#858c90",
  },
  detailRow: {
    minHeight: 150,
    paddingTop: 18,
    borderTopWidth: 0.6,
    borderTopColor: "#d2d6d7",
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
  },
  detailCopy: {
    width: "66%" as const,
    paddingRight: 20,
  },
  detailLabel: {
    fontSize: 7.5,
    letterSpacing: 1.7,
    color: "#6e777b",
    marginBottom: 11,
  },
  detailDescription: {
    fontSize: 9.7,
    lineHeight: 1.48,
    color: "#232627",
  },
  sku: {
    marginTop: 14,
    fontSize: 7.4,
    letterSpacing: 0.5,
    color: "#7a8286",
  },
  priceBlock: {
    width: "32%" as const,
    alignItems: "flex-end" as const,
  },
  priceLabel: {
    fontSize: 7.5,
    letterSpacing: 1.7,
    color: "#6e777b",
    marginBottom: 14,
  },
  price: {
    fontSize: 27,
    lineHeight: 1,
    fontWeight: 700 as const,
    textAlign: "right" as const,
  },
  footer: {
    position: "absolute" as const,
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    bottom: 18,
    borderTopWidth: 0.55,
    borderTopColor: "#d5d8d9",
    paddingTop: 8,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
  },
  footerText: {
    fontSize: 6.6,
    letterSpacing: 1.3,
    color: "#747c80",
    textTransform: "uppercase" as const,
  },
  doubleIntro: {
    height: 109,
  },
  doubleTitle: {
    fontSize: 27,
    lineHeight: 1.05,
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
  },
  doubleDeck: {
    marginTop: 11,
    fontSize: 10.5,
    color: "#777f83",
  },
  doubleImageBand: {
    width: A4_SIZE.width,
    height: 286,
    marginLeft: -PAGE_MARGIN,
    flexDirection: "row" as const,
    backgroundColor: "#eff1f0",
  },
  doubleImageColumn: {
    width: "50%" as const,
    height: 286,
  },
  doubleImage: {
    width: "100%" as const,
    height: 286,
    objectFit: "cover" as const,
    backgroundColor: "#eff1f0",
  },
  doubleProductGallery: {
    width: "100%" as const,
    height: 286,
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    backgroundColor: "#eff1f0",
  },
  doubleGalleryCell: {
    objectFit: "cover" as const,
    borderRightWidth: 0.7,
    borderBottomWidth: 0.7,
    borderColor: "#ffffff",
    backgroundColor: "#eff1f0",
  },
  doubleCaption: {
    height: 24,
    paddingTop: 7,
    fontSize: 6.7,
    color: "#858c90",
  },
  doubleDetails: {
    flexDirection: "row" as const,
    borderTopWidth: 0.6,
    borderTopColor: "#d2d6d7",
  },
  doubleColumn: {
    width: "50%" as const,
    minHeight: 220,
    paddingTop: 16,
    paddingRight: 22,
  },
  doubleColumnSecond: {
    paddingLeft: 22,
    paddingRight: 0,
    borderLeftWidth: 0.6,
    borderLeftColor: "#d2d6d7",
  },
  doubleIndex: {
    fontSize: 9,
    fontWeight: 700 as const,
    color: ACCENT,
    marginBottom: 10,
  },
  doubleProductTitle: {
    minHeight: 46,
    fontSize: 14.5,
    lineHeight: 1.16,
    fontWeight: 700 as const,
  },
  doubleProductDescription: {
    minHeight: 53,
    marginTop: 8,
    fontSize: 8.3,
    lineHeight: 1.4,
    color: "#737b7f",
  },
  doublePrice: {
    marginTop: 13,
    fontSize: 20,
    fontWeight: 700 as const,
  },
  doubleSku: {
    marginTop: 10,
    fontSize: 6.8,
    color: "#798185",
  },
  summaryHeadingBlock: {
    marginTop: 9,
    marginBottom: 21,
  },
  summaryKicker: {
    fontSize: 8,
    letterSpacing: 1.9,
    color: "#6f777b",
    marginBottom: 12,
  },
  summaryTitle: {
    fontSize: 29,
    lineHeight: 1.04,
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
  },
  summaryHero: {
    width: "100%" as const,
    height: 134,
    objectFit: "cover" as const,
    backgroundColor: "#eff1f0",
    marginBottom: 17,
  },
  summaryTableHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingBottom: 10,
    borderBottomWidth: 0.7,
    borderBottomColor: "#c3c8c9",
  },
  summaryTableHeaderText: {
    fontSize: 7.5,
    fontWeight: 700 as const,
    letterSpacing: 1.5,
    color: "#70787c",
  },
  summaryRow: {
    minHeight: 41,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    borderBottomWidth: 0.55,
    borderBottomColor: "#d5d9da",
    paddingVertical: 6,
  },
  summaryIndex: {
    width: 29,
    fontSize: 8,
    fontWeight: 700 as const,
    color: ACCENT,
  },
  summaryName: {
    flex: 1,
    paddingRight: 14,
  },
  summaryNameText: {
    fontSize: 8.4,
    lineHeight: 1.2,
    fontWeight: 700 as const,
  },
  summarySku: {
    marginTop: 3,
    fontSize: 6.4,
    color: "#7b8387",
  },
  summaryPrice: {
    width: 102,
    fontSize: 9.2,
    fontWeight: 700 as const,
    textAlign: "right" as const,
  },
  totalBox: {
    marginTop: 16,
    minHeight: 66,
    paddingHorizontal: 18,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    backgroundColor: "#151819",
    color: "#ffffff",
  },
  totalLabel: {
    fontSize: 8.5,
    fontWeight: 700 as const,
    letterSpacing: 1.7,
  },
  totalValue: {
    fontSize: 26,
    fontWeight: 700 as const,
  },
  note: {
    marginTop: 13,
    fontSize: 6.7,
    lineHeight: 1.4,
    color: "#7c8488",
  },
};

async function loadLogo(source: string): Promise<LogoAsset | null> {
  try {
    const normalized = source.replace(/^\/+/, "");
    if (normalized.includes("..") || normalized.includes("\\")) return null;
    const bytes = await readFile(path.join(process.cwd(), "public", normalized));
    const raster = sharp(bytes, { density: 260 }).resize(520, 160, { fit: "inside" }).png();
    const [data, pixels] = await Promise.all([
      raster.clone().toBuffer(),
      raster.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ]);
    let luma = 0;
    let weight = 0;
    for (let index = 0; index < pixels.data.length; index += 4) {
      const alpha = pixels.data[index + 3] / 255;
      if (alpha < 0.08) continue;
      luma +=
        (pixels.data[index] * 0.2126 +
          pixels.data[index + 1] * 0.7152 +
          pixels.data[index + 2] * 0.0722) *
        alpha;
      weight += alpha;
    }
    return { data, isLight: weight > 0 && luma / weight >= 150 };
  } catch {
    return null;
  }
}

async function prepareCatalogPicture(picture: Buffer | null) {
  if (!picture) return null;
  try {
    return await sharp(picture)
      .flatten({ background: "#ffffff" })
      .trim({ background: "#ffffff", threshold: 10 })
      .resize(1500, 930, {
        fit: "contain",
        withoutEnlargement: false,
        background: { r: 239, g: 241, b: 240, alpha: 1 },
      })
      .flatten({ background: "#eff1f0" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    return picture;
  }
}

function SingleProductPage({
  item,
  pictures,
  itemIndex,
  pageNumber,
  pageCount,
  pageLogo,
  input,
  documentMark,
  generated,
}: {
  item: CatalogBrochurePdfItem;
  pictures: Array<Buffer | null>;
  itemIndex: number;
  pageNumber: number;
  pageCount: number;
  pageLogo: LogoAsset | null;
  input: CatalogBrochurePdfInput;
  documentMark: string;
  generated: string;
}) {
  const t = labels[input.language];
  const title = safeText(item.title, "Product");
  return (
    <Page size={A4_SIZE} style={styles.page} wrap>
      <PageHeader
        logo={pageLogo}
        branding={input.branding}
        title={safeText(input.title, t.catalog)}
        descriptor={`${String(itemIndex + 1).padStart(2, "0")} / ${t.collection}`}
      />
      <View style={styles.introBlock}>
        <Text style={styles.sectionLabel}>
          {String(itemIndex + 1).padStart(2, "0")} / {t.collection}
        </Text>
        <Text style={{ ...styles.productTitle, fontSize: titleSize(title) }}>{title}</Text>
        {input.descriptionMode !== "short" && input.descriptionMode !== "none" ? (
          <Text style={styles.productDeck}>{productDeck(item.description, t.collection)}</Text>
        ) : null}
      </View>
      <ProductGallery
        pictures={pictures}
        emptyLabel={t.noPhoto}
        photoMode={input.photoMode ?? "hero"}
        galleryLayout={item.galleryLayout ?? "auto"}
        heroStyle={styles.fullBleedPhoto}
        galleryStyle={styles.galleryBand}
        cellStyle={styles.galleryCell}
        galleryHeight={328}
      />
      <Text style={styles.caption}>
        {safeText(item.brand, "OneCompany")} ·{" "}
        {t.generated.toLocaleLowerCase(localeMap[input.language])} {generated}
      </Text>
      <View style={styles.detailRow}>
        <View style={styles.detailCopy}>
          <Text style={styles.detailLabel}>
            {String(itemIndex + 1).padStart(2, "0")} / {t.collection}
          </Text>
          {input.descriptionMode !== "none" ? (
            <Text style={styles.detailDescription}>
              {productDescription(
                item.description,
                t.collection,
                input.descriptionMode ?? "full",
                150
              )}
            </Text>
          ) : null}
          <Text style={styles.sku}>
            {t.sku}: {item.sku || "—"}
          </Text>
        </View>
        {input.showPrice ? (
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>{t.price}</Text>
            <Text style={styles.price}>
              {formatMoney(item.price, input.currency, input.language)}
            </Text>
          </View>
        ) : null}
      </View>
      <PageFooter documentMark={documentMark} pageNumber={pageNumber} pageCount={pageCount} />
    </Page>
  );
}

function DoubleProductPage({
  group,
  pictures,
  startIndex,
  pageNumber,
  pageCount,
  pageLogo,
  input,
  documentMark,
}: {
  group: CatalogBrochurePdfItem[];
  pictures: Array<Array<Buffer | null>>;
  startIndex: number;
  pageNumber: number;
  pageCount: number;
  pageLogo: LogoAsset | null;
  input: CatalogBrochurePdfInput;
  documentMark: string;
}) {
  const t = labels[input.language];
  return (
    <Page size={A4_SIZE} style={styles.page} wrap>
      <PageHeader
        logo={pageLogo}
        branding={input.branding}
        title={safeText(input.title, t.catalog)}
        descriptor={`${String(startIndex + 1).padStart(2, "0")} + ${String(startIndex + 2).padStart(2, "0")} / ${t.collection}`}
      />
      <View style={styles.doubleIntro}>
        <Text style={styles.sectionLabel}>
          {String(startIndex + 1).padStart(2, "0")} + {String(startIndex + 2).padStart(2, "0")} /{" "}
          {t.collection}
        </Text>
        <Text style={styles.doubleTitle}>{t.selected}</Text>
        <Text style={styles.doubleDeck}>{t.selectedDeck}</Text>
      </View>
      <View style={styles.doubleImageBand}>
        {group.map((item, index) => (
          <View key={`${item.sku ?? item.title}-image`} style={styles.doubleImageColumn}>
            <ProductGallery
              pictures={pictures[index] ?? []}
              emptyLabel={t.noPhoto}
              photoMode={input.photoMode ?? "hero"}
              galleryLayout={item.galleryLayout ?? "auto"}
              heroStyle={styles.doubleImage}
              galleryStyle={styles.doubleProductGallery}
              cellStyle={styles.doubleGalleryCell}
              galleryHeight={286}
            />
          </View>
        ))}
      </View>
      <Text style={styles.doubleCaption}>{t.selectedDeck}</Text>
      <View style={styles.doubleDetails}>
        {group.map((item, index) => (
          <View
            key={`${item.sku ?? item.title}-detail`}
            style={
              index === 1
                ? { ...styles.doubleColumn, ...styles.doubleColumnSecond }
                : styles.doubleColumn
            }
          >
            <Text style={styles.doubleIndex}>
              {String(startIndex + index + 1).padStart(2, "0")}
            </Text>
            <Text style={styles.doubleProductTitle}>
              {trimText(safeText(item.title, "Product"), 102)}
            </Text>
            {input.descriptionMode !== "none" ? (
              <Text style={styles.doubleProductDescription}>
                {productDescription(
                  item.description,
                  t.collection,
                  input.descriptionMode ?? "full",
                  95
                )}
              </Text>
            ) : null}
            {input.showPrice ? (
              <Text style={styles.doublePrice}>
                {formatMoney(item.price, input.currency, input.language)}
              </Text>
            ) : null}
            <Text style={styles.doubleSku}>
              {t.sku}: {item.sku || "—"}
            </Text>
          </View>
        ))}
      </View>
      <PageFooter documentMark={documentMark} pageNumber={pageNumber} pageCount={pageCount} />
    </Page>
  );
}

export async function renderCatalogBrochurePdf(input: CatalogBrochurePdfInput) {
  const t = labels[input.language];
  const [oneCompanyLight, oneCompanyDark, brandLogo] = await Promise.all([
    loadLogo("/branding/logo-light.svg"),
    loadLogo("/branding/logo-dark.svg"),
    input.branding === "brand" && input.brandLogoSrc
      ? loadLogo(input.brandLogoSrc)
      : Promise.resolve(null),
  ]);
  const coverLogo = input.branding === "onecompany" ? oneCompanyLight : brandLogo;
  const pageLogo = input.branding === "onecompany" ? oneCompanyDark : brandLogo;
  const imageSourceGroups = input.items.map((item) =>
    Array.from(
      new Set(
        [item.image, ...item.imageSources].filter(
          (source): source is string => typeof source === "string" && source.trim().length > 0
        )
      )
    )
  );
  const imageRequests = imageSourceGroups.flatMap((sources, itemIndex) =>
    sources.map((source, sourceIndex) => ({
      title: input.items[itemIndex]?.title ?? "Product",
      productSlug: `${input.items[itemIndex]?.sku || input.items[itemIndex]?.title || "product"}-${sourceIndex}`,
      image: source,
      imageSources: [source],
      quantity: 1,
      price: input.items[itemIndex]?.price ?? 0,
      total: input.items[itemIndex]?.price ?? 0,
    }))
  );
  const loadedPictures = await loadProformaImages(imageRequests, { maxDimension: 1500 });
  let pictureOffset = 0;
  const pictures = await Promise.all(
    imageSourceGroups.map(async (sources) => {
      const prepared = await Promise.all(
        sources.map(() => prepareCatalogPicture(loadedPictures[pictureOffset++] ?? null))
      );
      return prepared;
    })
  );
  const productGroups = splitIntoGroups(input.items, input.layout === "double" ? 2 : 1);
  const summaryGroups = splitIntoGroups(input.items, SUMMARY_PAGE_SIZE);
  const pageCount = 1 + productGroups.length + summaryGroups.length;
  const total = input.items.every((item) => item.price != null)
    ? input.items.reduce((sum, item) => sum + (item.price ?? 0), 0)
    : null;
  const generated = new Intl.DateTimeFormat(localeMap[input.language], {
    dateStyle: "medium",
    timeZone: "Europe/Kyiv",
  }).format(input.generatedAt);
  const documentMark =
    input.branding === "onecompany"
      ? "ONECOMPANY"
      : input.branding === "brand"
        ? safeText(input.items[0]?.brand, "")
        : "";
  const coverTitle = safeText(input.title, t.catalog);
  const coverSubtitle = safeText(input.subtitle, t.collection);

  return renderToBuffer(
    <Document title={coverTitle} author="OneCompany">
      <Page size={A4_SIZE} style={styles.coverPage} wrap={false}>
        <View style={styles.coverTop}>
          <LogoMark logo={coverLogo} branding={input.branding} surface="dark" />
          <Text style={styles.coverKicker}>{t.catalog}</Text>
          <Text style={{ ...styles.coverTitle, fontSize: coverTitleSize(coverTitle) }}>
            {coverTitle}
          </Text>
        </View>
        <ProductPhoto
          picture={pictures[0]?.[0] ?? null}
          emptyLabel={t.noPhoto}
          imageStyle={styles.coverHero}
        />
        <View style={styles.coverBottom}>
          <View style={styles.coverAccent} />
          <Text style={styles.coverStatement}>{coverSubtitle}</Text>
          <Text style={styles.coverInfo}>
            {input.items.length} {t.positions.toLocaleLowerCase(localeMap[input.language])} ·{" "}
            {t.collection}
          </Text>
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.footerText}>{documentMark || t.catalog}</Text>
          <Text style={styles.footerText}>01 / {String(pageCount).padStart(2, "0")}</Text>
        </View>
      </Page>

      {productGroups.map((group, groupIndex) => {
        const startIndex = groupIndex * (input.layout === "double" ? 2 : 1);
        const pageNumber = groupIndex + 2;
        if (input.layout === "double" && group.length === 2) {
          return (
            <DoubleProductPage
              key={`double-${groupIndex}`}
              group={group}
              pictures={[pictures[startIndex] ?? [], pictures[startIndex + 1] ?? []]}
              startIndex={startIndex}
              pageNumber={pageNumber}
              pageCount={pageCount}
              pageLogo={pageLogo}
              input={input}
              documentMark={documentMark}
            />
          );
        }
        return (
          <SingleProductPage
            key={`single-${startIndex}`}
            item={group[0]}
            pictures={pictures[startIndex] ?? []}
            itemIndex={startIndex}
            pageNumber={pageNumber}
            pageCount={pageCount}
            pageLogo={pageLogo}
            input={input}
            documentMark={documentMark}
            generated={generated}
          />
        );
      })}

      {summaryGroups.map((group, groupIndex) => {
        const isFirst = groupIndex === 0;
        const isLast = groupIndex === summaryGroups.length - 1;
        const startIndex = groupIndex * SUMMARY_PAGE_SIZE;
        const pageNumber = 2 + productGroups.length + groupIndex;
        return (
          <Page key={`summary-${groupIndex}`} size={A4_SIZE} style={styles.page} wrap>
            <PageHeader
              logo={pageLogo}
              branding={input.branding}
              title={coverTitle}
              descriptor={t.collection}
            />
            <View style={styles.summaryHeadingBlock}>
              <Text style={styles.summaryKicker}>
                {input.items.length} {t.positions} · {input.currency}
              </Text>
              <Text style={styles.summaryTitle}>{isFirst ? t.configuration : t.continuation}</Text>
            </View>
            {isFirst ? (
              <ProductPhoto
                picture={pictures[0]?.[0] ?? null}
                emptyLabel={t.noPhoto}
                imageStyle={styles.summaryHero}
              />
            ) : null}
            <View style={styles.summaryTableHeader}>
              <Text style={styles.summaryTableHeaderText}>{t.positions}</Text>
              {input.showPrice ? (
                <Text style={styles.summaryTableHeaderText}>{t.price}</Text>
              ) : null}
            </View>
            {group.map((item, index) => (
              <View
                key={`${item.sku ?? item.title}-summary`}
                style={styles.summaryRow}
                wrap={false}
              >
                <Text style={styles.summaryIndex}>
                  {String(startIndex + index + 1).padStart(2, "0")}
                </Text>
                <View style={styles.summaryName}>
                  <Text style={styles.summaryNameText}>
                    {trimText(safeText(item.title, "Product"), 105)}
                  </Text>
                  <Text style={styles.summarySku}>{item.sku || "—"}</Text>
                </View>
                {input.showPrice ? (
                  <Text style={styles.summaryPrice}>
                    {formatMoney(item.price, input.currency, input.language)}
                  </Text>
                ) : null}
              </View>
            ))}
            {isLast && input.showPrice ? (
              <View style={styles.totalBox} wrap={false}>
                <Text style={styles.totalLabel}>{t.total}</Text>
                <Text style={styles.totalValue}>
                  {formatMoney(total, input.currency, input.language)}
                </Text>
              </View>
            ) : null}
            {isLast ? <Text style={styles.note}>{t.note}</Text> : null}
            <PageFooter documentMark={documentMark} pageNumber={pageNumber} pageCount={pageCount} />
          </Page>
        );
      })}
    </Document>
  );
}
