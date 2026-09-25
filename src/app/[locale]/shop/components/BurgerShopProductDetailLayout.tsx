"use client";

import Image from "next/image";
import {
  buildShopProductImageSrcSet,
  resolveShopProductImageSrc,
} from "@/components/shop/ShopProductImage";
import Link from "next/link";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import { ShopPrimaryPriceBox } from "@/components/shop/ShopPrimaryPriceBox";
import { ShopB2BPricingBand } from "@/components/shop/ShopB2BPricingBand";
import {
  localizeShopText,
  localizeShopProductTitle,
  localizeShopDescription,
} from "@/lib/shopText";
import { getBrandLogo } from "@/lib/brandLogos";
import type { SupportedLocale } from "@/lib/seo";
import type { ShopProduct, ShopProductVariantSummary } from "@/lib/shopCatalog";
import type { ShopViewerPricingContext } from "@/lib/shopPricingAudience";
import { resolveShopProductPricing } from "@/lib/shopPricingAudience";
import { useShopViewerContext } from "@/lib/useShopViewerContext";
import { htmlToPlainText } from "@/lib/sanitizeRichTextHtml";
import styles from "./BurgerShopProductDetailLayout.module.css";
import { MobileProductDisclosure } from "./MobileProductDisclosure";
import { SHOW_STOCK_BADGE } from "@/lib/shopStockUi";
import { ProductAiOpinionPanel } from "@/components/shop/ProductAiOpinionPanel";
import { ShopBrandLink } from "@/components/shop/ShopBrandLink";

type Props = {
  locale: string;
  resolvedLocale: SupportedLocale;
  product: ShopProduct;
  pricing: ReturnType<typeof resolveShopProductPricing>;
  viewerContext: ShopViewerPricingContext;
  rates: Record<string, number> | null;
  defaultVariant: ShopProductVariantSummary | null;
};

function formatPrice(locale: SupportedLocale, amount: number, currency: "EUR" | "USD" | "UAH") {
  const formatter = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  if (locale === "ua" && currency === "UAH") return `${formatted} грн`;
  return locale === "ua" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

function burgerImageAtWidth(src: string, width: number) {
  try {
    const url = new URL(src);
    if (url.hostname === "cdn.shopify.com" && url.protocol === "https:") {
      // Current Burger images include a required UUID suffix in the filename.
      // Keep it when requesting Shopify's resized image.
      url.searchParams.set("width", String(width));
      return url.toString();
    }
  } catch {
    // Relative/local images use the shared image resolver below.
  }
  return resolveShopProductImageSrc(src, width);
}

function burgerImageSrcSet(src: string) {
  try {
    const url = new URL(src);
    if (url.hostname === "cdn.shopify.com" && url.protocol === "https:") {
      return [640, 1200, 1800, 2400]
        .map((width) => `${burgerImageAtWidth(src, width)} ${width}w`)
        .join(", ");
    }
  } catch {
    // Relative/local images use the shared responsive source set below.
  }
  return buildShopProductImageSrcSet(src, [640, 1200, 1800, 2400]);
}

function localizeBurgerOptionName(name: string, isUa: boolean) {
  const normalizedName = name.trim();
  if (!isUa) return normalizedName;
  const labels: Record<string, string> = {
    "Add our Bluetooth ECA?": "Bluetooth-модуль ECA",
    "Add a harness?": "Джгут або подовжувач",
    "Choose connector": "Тип адаптера",
    "Upgrade to 950cc injector?": "Інжектор",
    "Add fuel injectors?": "Форсунки портового впорскування",
    "Add injectors?": "Додаткові форсунки",
    "Add Port Injection Controller?": "Контролер портового впорскування",
    "Add port injection controller?": "Контролер портового впорскування",
    "Add flex fuel kit?": "Комплект Flex Fuel",
    "Choose filter color": "Колір фільтрів",
    "Choose Fuel Injectors": "Розмір форсунок",
    "Choose tank color": "Колір бака",
    "Add CANfuel controller?": "Додатковий контролер CANfuel",
    "Choose a kit": "Варіант CPI-комплекту",
    "Choose your manifold type:": "Тип впускного колектора",
    "Add injectors and fuel line": "Форсунки та паливна магістраль",
    "Add Port Injection Controller": "Додатковий контролер портового впорскування",
    "Choose Your Intake": "Тип впускної системи",
    "Choose Your 500hp Package": "Комплектація пакета JB4 N54",
    "Choose intake": "Тип впускної системи",
    "Choose intake filter color": "Колір фільтра",
    "Choose filter": "Тип фільтра",
    "Choose Filter": "Тип фільтра",
    "Filter Color": "Колір фільтра",
    "Choose Oil Catch Can": "Версія масляного уловлювача",
    "Select air filter type": "Тип повітряного фільтра",
    "Choose oil catch can": "Тип уловлювача оливи",
    "Choose vehicle": "Модель автомобіля",
    "Choose spark plugs": "Тип свічок запалювання",
    "tuner": "Версія автомобіля",
    "Choose Your Port Injection Kit:": "Тип комплекту портового впорскування",
    "Add fuel line and injectors?": "Форсунки та паливна магістраль",
    "Add Basic Fuel Line and Injectors?": "Форсунки та паливна магістраль",
    "Add Fuel Line and Injectors?": "Форсунки та паливна магістраль",
    "Add fuel injectors and basic fuel line": "Форсунки та паливна магістраль",
    "Port Injection Controller:": "Контролер портового впорскування",
    "Add an injector controller?": "Контролер",
    "Filter color": "Тип фільтрів",
    "Engine": "Двигун",
    "System": "Система",
    "Please select a tuner:": "Оберіть тюнер",
    "Harness Type": "Тип джгута",
    "Type": "Тип",
    "Choose your powertrain": "Оберіть силову установку",
    "Choose your vehicle": "Оберіть автомобіль",
    "B48 generation": "Покоління B48",
    "Thread and vehicle": "Різьба та застосування",
    "Package configuration": "Конфігурація комплекту",
    "Device model and condition": "Модель пристрою та стан",
    "Transmission and drivetrain": "Коробка передач і привід",
    Configuration: "Комплектація",
    "Tow-hook thread": "Різьба буксирувального гака",
    "Fitting type": "Тип фітинга",
    "Pack and finish": "Кількість і колір",
    "Differential size": "Розмір диференціала",
    "Engine Type": "Тип двигуна",
    "Select Vehicle": "Оберіть автомобіль",
    "Include N54 drop-in filter?": "Додати drop-in фільтр N54?",
    "Please Choose": "Оберіть комплектацію",
    "Please choose": "Оберіть комплектацію",
  };
  if (labels[normalizedName]) return labels[normalizedName];
  if (/^Choose /i.test(normalizedName)) return `Оберіть ${normalizedName.replace(/^Choose /i, "")}`;
  return normalizedName;
}

function stripBurgerOptionPrice(value: string) {
  return value
    .replace(/\s*\+\s*\[\s*\$\s*[\d,.]+\s*\]/gi, "")
    .replace(/\s*\[\s*\+?\s*\$\s*[\d,.]+\s*\]/gi, "")
    .replace(/\s*\(\s*\+?\s*\$\s*[\d,.]+\s*\)/gi, "")
    .replace(/\s*\+\s*\$\s*[\d,.]+/gi, "")
    .replace(/\s+Save\s+\$\s*[\d,.]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function localizeBurgerOptionValue(value: string, isUa: boolean, productSlug?: string) {
  const cleanValue = stripBurgerOptionPrice(value);
  if (!isUa) return cleanValue;
  if (productSlug === "burger-n54-jb-quick-install" &&
      /^yes include n54 drop-in performance filter$/i.test(cleanValue)) return "Так, додати drop-in фільтр N54";
  if (productSlug === "burger-n54-jb-quick-install" && /^no$/i.test(cleanValue)) return "Без додаткового фільтра";
  if (productSlug === "burger-s58-bmw-water-methanol-port-injection-kit" &&
      /^do not add a port injection controller$/i.test(cleanValue)) return "Без додаткового CANfuel";
  if (productSlug === "burger-s58-bmw-water-methanol-port-injection-kit" &&
      /^Fuel-It! CANfuel Sequential Port Fuel Injection Controller$/i.test(cleanValue)) {
    return "Додати Fuel-It! CANfuel для керування PI/WMI";
  }
  if (/^Opaque Black$/i.test(cleanValue)) return "Непрозорий чорний бак";
  if (/^Translucent White$/i.test(cleanValue)) return "Напівпрозорий білий бак";
  if (/^CPI Kit without FSB$/i.test(cleanValue)) return "CPI без контролера FSB";
  if (/^CPI Kit with FSB$/i.test(cleanValue)) return "CPI з контролером FSB для JB4";
  if (/^CPI Kit with Stand Alone Controller$/i.test(cleanValue)) return "CPI з автономним контролером";
  const phoenixManifold = cleanValue.match(/^Phoenix Racing N(54|55) Port Injection Intake Manifold$/i);
  if (phoenixManifold) return `Phoenix Racing · N${phoenixManifold[1]} · впускний колектор PI`;
  if (/do not add an eca/i.test(value)) return "Без Bluetooth ECA";
  if (/add the fuel-it! bluetooth (?:eca|analyzer)/i.test(value)) return "З Bluetooth ECA";
  if (/do not include the 950cc injector/i.test(value)) return "Стандартний інжектор 550cc";
  if (/upgrade me to the 950cc injector/i.test(value)) return "Інжектор 950cc";
  if (/do not add an injector controller/i.test(value)) return "Без контролера";
  if (/include fsb for jb4 control/i.test(value)) return "З контролером FSB";
  if (/^(?:do not add|do not include|do not add fuel|do not include fuel).*injectors?(?: and fuel line)?$/i.test(cleanValue)) {
    return /fuel line/i.test(cleanValue)
      ? "Без форсунок і паливної магістралі"
      : "Без додаткових форсунок";
  }
  const injectorLine = cleanValue.match(/^add\s+(750|950|1050)cc\s+(DW|IDX)(?:\s+fuel)?\s+injectors?(?:\s+and\s+fuel\s+line)?$/i);
  if (injectorLine) return `Форсунки ${injectorLine[2].toUpperCase()} ${injectorLine[1]}cc${/fuel line/i.test(cleanValue) ? " та паливна магістраль" : ""}`;
  if (/^do not add (?:a )?(?:port injection|PI) controller$/i.test(cleanValue)) {
    return "Без контролера портового впорскування";
  }
  if (/^Fuel-It! CANfuel Sequential Port Fuel Injection Controller$/i.test(cleanValue)) {
    return "З контролером портового впорскування Fuel-It! CANfuel";
  }
  if (/^Elite$/i.test(cleanValue)) return "Elite — версія з додатковим зворотним портом";
  if (/^Manifold$/i.test(cleanValue)) return "Manifold — версія з впускним колектором";
  if (/^do not add a flex fuel kit$/i.test(cleanValue)) return "Без додаткового Flex Fuel Kit";
  const flexFuelChoice = cleanValue.match(/^(I already have|Add) (?:your )?(?:a )?(Fuel-It!|CANflex)?\s*flex fuel kit(?: on my| for) (M2\/M3\/M4|X3M\/X4M)$/i);
  if (flexFuelChoice) {
    const action = /^I already have$/i.test(flexFuelChoice[1]) ? "Вже маю" : "Додати";
    const brand = flexFuelChoice[2] ? `${flexFuelChoice[2]} ` : "";
    return `${action} ${brand}Flex Fuel Kit · ${flexFuelChoice[3]}`;
  }
  if (/^Blue Oiled Renewable Performance Filters$/i.test(value)) return "Сині масляні багаторазові фільтри";
  if (/^Red Oiled Renewable Performance Filters$/i.test(value)) return "Червоні масляні багаторазові фільтри";
  if (/^Blue Filters$/i.test(value)) return "Сині фільтри";
  if (/^Red Filters$/i.test(value)) return "Червоні фільтри";
  if (/^Blue Intake Filter$/i.test(cleanValue)) return "Синій фільтр впуску";
  if (/^Red Intake Filter$/i.test(cleanValue)) return "Червоний фільтр впуску";
  if (/^Blue Oiled Renewable Performance Filter$/i.test(cleanValue)) return "Синій масляний багаторазовий фільтр";
  if (/^Red Oiled Renewable Performance Filter$/i.test(cleanValue)) return "Червоний масляний багаторазовий фільтр";
  if (/^Dry Extendable Performance Filter$/i.test(cleanValue)) return "Сухий фільтр Dry Extendable";
  if (/^Non-Hybrid Engine$/i.test(cleanValue)) return "Бензиновий двигун без гібридної системи";
  if (/^Hybrid Engine$/i.test(cleanValue)) return "Гібридний двигун";
  if (/^2023\+ S68 BMW XM$/i.test(cleanValue)) return "BMW XM G09 · S68 · 2023+";
  if (/^2024\+ S68 BMW X5M\/X6M$/i.test(cleanValue)) return "BMW X5M/X6M F95/F96 · S68 · 2024+";
  if (/^Gen1 \(2016-2019\) \*\*\* CARB APPROVED \*\*\*$/i.test(cleanValue)) {
    return "B58 Gen 1 · 2016–2019 · CARB-approved";
  }
  if (/^Gen1 \(2016-2019\)$/i.test(cleanValue)) return "B58 Gen 1 · 2016–2019";
  if (/^Gen2 \(2020\+\) JB4PRO$/i.test(cleanValue)) return "B58 Gen 2 · 2020+ · JB4PRO";
  if (/^Gen2 \(2020\+\)$/i.test(cleanValue)) return "B58 Gen 2 · 2020+";
  if (/^Zero Maintenance Oil Catch Can$/i.test(cleanValue)) return "Уловлювач оливи без обслуговування";
  if (/^Serviceable Oil Catch Can$/i.test(cleanValue)) return "Обслуговуваний уловлювач оливи";
  if (/^Denso 5346 IKH24 "1 Step" High Performance Spark Plugs$/i.test(cleanValue)) {
    return "Свічки Denso 5346 IKH24 · 1 Step";
  }
  if (/^HKS M45IL High Performance Spark Plugs$/i.test(cleanValue)) return "Свічки HKS M45IL";
  if (/^2017\+ Carrera\/S$/i.test(cleanValue)) return "Porsche 911 Carrera / Carrera S · 2017+";
  if (/^2017\+ Carrera GTS$/i.test(cleanValue)) return "Porsche 911 Carrera GTS · 2017+";
  if (/^BMS B58 BMW M240i M340i M440i Competition Cold Air Intake$/i.test(cleanValue)) {
    return "Впуск BMS Competition для BMW B58 G-Series";
  }
  if (/^BMS Silicone Front Mount Cold Air Intake for G Chassis B58 BMW$/i.test(cleanValue)) {
    return "Передній силіконовий впуск BMS для BMW B58 G-Series";
  }
  const s58G8xIntake = cleanValue.match(/^BMS G8x (S58 Performance Intake in Matte Black Finish|Front Mount S58 Performance Intake|Silicone Front Mount S58 Performance Intakes)(?: with)?(?: (Blue|Red) Filters)?$/i);
  if (s58G8xIntake) {
    const style = /Matte Black/i.test(s58G8xIntake[1])
      ? "верхній · матове чорне покриття"
      : /Silicone/i.test(s58G8xIntake[1]) ? "передній · силіконовий" : "передній";
    const color = s58G8xIntake[2] ? ` · ${s58G8xIntake[2].toLowerCase() === "blue" ? "сині" : "червоні"} фільтри` : "";
    return `Впуск BMS G8x S58 · ${style}${color}`;
  }
  const s58F97Intake = cleanValue.match(/^BMS F97 F98 S58 Performance Intake in Matte Black Finish with (Blue|Red) Filters$/i);
  if (s58F97Intake) return `Впуск BMS F97/F98 S58 · матове чорне покриття · ${s58F97Intake[1].toLowerCase() === "blue" ? "сині" : "червоні"} фільтри`;
  const s58F97Silicone = cleanValue.match(/^BMS Silicone Front Mount F97 F98 S58 Performance Intakes with (Blue|Red) Filters$/i);
  if (s58F97Silicone) return `Впуск BMS F97/F98 S58 · передній силіконовий · ${s58F97Silicone[1].toLowerCase() === "blue" ? "сині" : "червоні"} фільтри`;
  const n54Package = cleanValue.match(/^500 Horsepower N54 (Race )?Package w\/Stage (1|2) Fuel Pump$/i);
  if (n54Package) return `JB4 N54 · насос Stage ${n54Package[2]} · ${n54Package[1] ? "Race інтеркулер" : "стандартний інтеркулер"}`;
  if (/^Dry Extendable Performance Filters$/i.test(value)) return "Сухі фільтри";
  if (/^2\.0L I4 Turbo$/i.test(value)) return "2,0 л I4 Turbo";
  if (/^3\.3L V6 Turbo$/i.test(value)) return "3,3 л V6 Turbo";
  if (/^2022\+ Toyota Tundra 3\.4L V6 Hybrid Twin Turbo$/i.test(value)) {
    return "Toyota Tundra 2022+ · 3,4 л V6 Hybrid Twin Turbo";
  }
  if (/^2022\+ Toyota Tundra 3\.4L V6 Twin Turbo$/i.test(value)) {
    return "Toyota Tundra 2022+ · 3,4 л V6 Twin Turbo";
  }
  if (/^2021\+ Ford Bronco 2\.3L and 2\.7L Turbo$/i.test(value)) {
    return "Ford Bronco 2021+ · 2,3/2,7 л Turbo";
  }
  if (/^2022\+ Ford Bronco Raptor 3\.0L V6 Turbo$/i.test(value)) {
    return "Ford Bronco Raptor 2022+ · 3,0 л V6 Turbo";
  }
  if (/^M5\/M6 and 2014\+ X5M\/X6M \(Harness TypeB\)$/i.test(value)) {
    return "M5/M6 і X5M/X6M 2014+ · джгут Type B";
  }
  if (/^2010-2013 X5M\/X6M Models \(Harness TypeA\)$/i.test(value)) {
    return "BMW X5M/X6M 2010–2013 · джгут Type A";
  }
  if (/^Harness Type A \(2009-2011\)$/i.test(value)) return "Джгут Type A (2009–2011)";
  if (/^Harness Type B \(2012-Present\)$/i.test(value)) return "Джгут Type B (2012+)";
  if (/^N55 - 2011 - Early 2012 \(TypeA TMAP Sensor\)$/i.test(value)) {
    return "N55 · 2011 — початок 2012 · датчик TMAP Type A";
  }
  if (/^N55 - Mid 2012 - 2013 \(TypeB TMAP, F30-N55-STG1\)$/i.test(value)) {
    return "N55 · середина 2012–2013 · датчик TMAP Type B";
  }
  if (/^N55 - 2014 & Newer Vehicles \(TypeB TMAP\)$/i.test(value)) {
    return "N55 · 2014+ · датчик TMAP Type B";
  }
  if (/do not add a harness/i.test(value)) return "Без додаткової проводки";
  return cleanValue
    .replace(/\bExtension\b/gi, "подовжувач")
    .replace(/\bHarness\b/gi, "джгут")
    .replace(/\badapter\b/gi, "адаптер")
    .replace(/\bFuel Line\b/gi, "паливна магістраль")
    .replace(/\bInjectors?\b/gi, "форсунки")
    .replace(/\bAdd\b/gi, "Додати")
    .replace(/\bDo NOT add\b/gi, "Без");
}

function formatDescriptionDisplay(text: string) {
  if (!text) return "";

  // If input is already structured HTML (has h3/ul/li/p tags), pass through —
  // the Tailwind `prose` class will style it. Don't flatten to plain text.
  if (/<(?:h[1-6]|ul|ol|li)\b/i.test(text)) {
    return text;
  }

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const plainText = htmlToPlainText(text);
  if (!plainText) return "";

  // 1. Double newlines -> single newline for normalization
  let html = escapeHtml(plainText).replace(/\n\n+/g, "\n");

  // 2. Identify common headings and wrap them
  const headingRegex =
    /(Характеристики та переваги|Особливості|Features and benefits|Applications|Застосування|Особливості та переваги|What's Included:?|Що в комплекті:?|Шо в комплекті:?|Fitment:?|Сумісність:?|Vehicle Fitment:?|Підходить для:?)/gi;
  html = html.replace(
    headingRegex,
    '<strong style="color: var(--burger-yellow); font-size: 1.05em; letter-spacing: 0.15em; display: inline-block; margin-top: 24px; margin-bottom: 12px; text-transform: uppercase;">$1</strong>'
  );

  // 3. Convert explicit newlines into breaks
  html = html.replace(/\n/g, "<br/><br/>");

  // 4. Format multiple bullet points that are squashed on one line or multiple lines
  // The lazily captured text (.*?) will grab everything until the next bullet, <br/>, or end of string.
  html = html.replace(
    /•\s*(.*?)(?=\s*•|<br\/>|$)/g,
    '<div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; padding-left: 8px;"><span style="color: var(--burger-yellow); font-size: 16px; line-height: 1.4; flex-shrink: 0;">•</span><span style="opacity: 0.9; line-height: 1.6;">$1</span></div>'
  );

  // 5. Break up massive walls of text
  // We split by existing breaks, then apply a 2-sentence split rule to long chunks
  const blocks = html.split("<br/><br/>");
  const processedBlocks = blocks.map((block) => {
    // If block is a list item or a heading or too short, skip breaking it
    if (block.length < 150 || block.includes("display: flex") || block.includes("<strong")) {
      return block;
    }

    let sentenceCount = 0;
    // Look for a period, exclamation, or question mark followed by a space and a capital letter
    return block.replace(/([.!?])\s+([А-ЯІЇЄҐA-Z])/g, (match, punct, nextLetter) => {
      sentenceCount++;
      return sentenceCount % 2 === 0 ? `${punct}<br/><br/>${nextLetter}` : match;
    });
  });

  html = processedBlocks.join("<br/><br/>");

  // 6. Clean up trailing/leading breaks
  html = html.replace(/^(<br\/>)+/, "").replace(/(<br\/>)+$/, "");

  return html;
}

export function BurgerShopProductDetailLayout({
  locale,
  resolvedLocale,
  product,
  pricing: ssrPricing,
  viewerContext: ssrViewerContext,
  rates,
  defaultVariant,
}: Props) {
  const viewerContext = useShopViewerContext(ssrViewerContext);
  const isUa = resolvedLocale === "ua";
  const variants = product.variants ?? [];
  const canChooseVariant = variants.length > 1;
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [brokenIdx, setBrokenIdx] = useState<Set<number>>(new Set());
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    defaultVariant?.id ?? null
  );
  const selectedVariant =
    (canChooseVariant && variants.find((variant) => variant.id === selectedVariantId)) ||
    defaultVariant;
  const selectedVariantUnavailable = canChooseVariant && selectedVariant?.inventoryQty === 0;
  const selectVariant = (id: string) => {
    setSelectedVariantId(id);
    setActiveImageIdx(0);
    setBrokenIdx(new Set());
  };
  const selectedSku = selectedVariant?.sku || product.sku;
  const manufacturerSku = selectedSku && !/^BURGER-(?:V-)?\d+$/i.test(selectedSku) &&
    !/\s/.test(selectedSku) && /^[A-Za-z0-9]/.test(selectedSku) ? selectedSku : null;
  const selectedOptions = selectedVariant?.optionValues ?? [];
  const fuelItWithoutEca = product.slug.includes("48-extension-for-fuel-it-flex-fuel-analyzer") &&
    [selectedVariant?.title, ...selectedOptions].some((option) =>
      /do not add an eca/i.test(option ?? "")
    );
  const variantPrice = selectedVariant?.price;
  const hasSelectedVariantPrice = !canChooseVariant || Boolean(variantPrice &&
    (variantPrice.eur > 0 || variantPrice.usd > 0 || variantPrice.uah > 0));
  const pricing = resolveShopProductPricing(
    canChooseVariant && variantPrice
      ? {
          ...product,
          price: variantPrice,
          europePrice: selectedVariant.europePrice,
          b2bPrice: selectedVariant.b2bPrice,
          compareAt: selectedVariant.compareAt,
          b2bCompareAt: selectedVariant.b2bCompareAt,
          weightKg: selectedVariant.weightKg ?? product.weightKg,
        }
      : product,
    viewerContext
  );
  const optionAxes = canChooseVariant
    ? [0, 1, 2]
        .map((index) => ({
          index,
          name: localizeBurgerOptionName(
            product.options?.find((option) => option.position === index + 1)?.name ??
              (isUa ? `Опція ${index + 1}` : `Option ${index + 1}`),
            isUa
          ),
          values: Array.from(new Set(variants.map((variant) => variant.optionValues?.[index]).filter(
            (value): value is string => Boolean(value)
          ))),
        }))
        .filter((axis) => axis.values.length > 1)
    : [];
  const chooseOption = (index: number, value: string) => {
    const currentValues = selectedVariant?.optionValues ?? [];
    const nextVariant =
      variants.find((variant) =>
        variant.optionValues?.[index] === value &&
        variant.optionValues.every((candidate, candidateIndex) =>
          candidateIndex === index || candidate === currentValues[candidateIndex]
        )
      ) ?? variants.find((variant) => variant.optionValues?.[index] === value);
    if (nextVariant?.id) selectVariant(nextVariant.id);
  };
  const title = localizeShopProductTitle(resolvedLocale, product);

  // Clean description string from backend (either bodyHtml or longDescription)
  const descriptionRaw = localizeShopDescription(resolvedLocale, product.longDescription);

  // Build gallery: filter out empty/duplicate URLs, dedupe with main image first
  const rawGallery = (product.gallery || []).filter(
    (g): g is string => !!g && typeof g === "string" && g.trim().length > 0
  );
  const galleryUnique = canChooseVariant && selectedVariant?.image
    ? [selectedVariant.image]
    : Array.from(new Set([...(product.image ? [product.image] : []), ...rawGallery]));
  const gallery = galleryUnique.length ? galleryUnique : product.image ? [product.image] : [];
  const visibleGallery = gallery.filter((_, i) => !brokenIdx.has(i));
  // activeImageIdx indexes the ORIGINAL gallery array (kept in sync with thumb
  // click via realIdx). If that image is broken or out of range, fall back to
  // the first visible image so we never show the wrong picture.
  const mainImage =
    (activeImageIdx >= 0 && activeImageIdx < gallery.length && !brokenIdx.has(activeImageIdx)
      ? gallery[activeImageIdx]
      : visibleGallery[0]) || "";
  const isInStock = product.stock === "inStock";

  const computeCrossPrices = (priceObj: { eur: number; usd: number; uah: number }) => {
    let computedUah = priceObj.uah || 0;
    let computedEur = priceObj.eur || 0;
    let computedUsd = priceObj.usd || 0;
    const hasValid = (v?: number) => typeof v === "number" && v > 0;
    if (hasValid(priceObj.uah) && rates) {
      if (!hasValid(computedEur)) computedEur = (priceObj.uah / rates.UAH) * rates.EUR;
      if (!hasValid(computedUsd)) computedUsd = (priceObj.uah / rates.UAH) * rates.USD;
    } else if (hasValid(priceObj.eur) && rates) {
      if (!hasValid(computedUah)) computedUah = (priceObj.eur / rates.EUR) * rates.UAH;
      if (!hasValid(computedUsd)) computedUsd = (priceObj.eur / rates.EUR) * rates.USD;
    } else if (hasValid(priceObj.usd) && rates) {
      if (!hasValid(computedUah)) computedUah = (priceObj.usd / rates.USD) * rates.UAH;
      if (!hasValid(computedEur)) computedEur = (priceObj.usd / rates.USD) * rates.EUR;
    }
    return { uah: computedUah, eur: computedEur, usd: computedUsd };
  };

  return (
    <div className="burger-shop" style={{ minHeight: "100dvh", paddingTop: 100 }}>
      {/* ── Back Link ── */}
      <div className="burger-back" style={{ paddingBottom: 0 }}>
        <Link href={`/${locale}/shop/burger/products`} className="burger-back__link">
          ← {isUa ? "До каталогу Burger" : "Back to Burger catalog"}
        </Link>
      </div>

      <div className={styles.content}>
        <div className={styles.grid}>
          {/* ── Left: Media Gallery ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {/* Main Image */}
            <div
              style={{
                aspectRatio: "1",
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--foreground) / 0.12)",
                borderRadius: 12,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "clamp(20px, 4vw, 40px)",
                overflow: "hidden",
              }}
            >
              {mainImage ? (
                <img
                  src={mainImage}
                  srcSet={burgerImageSrcSet(mainImage)}
                  sizes="(max-width: 1023px) calc(100vw - 80px), (max-width: 1400px) 50vw, 640px"
                  alt={title}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  onError={() => {
                    // Mark this image broken; advance to next visible image if available.
                    setBrokenIdx((prev) => new Set([...prev, gallery.indexOf(mainImage)]));
                    setActiveImageIdx(0);
                  }}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <ShoppingBag size={80} color="hsl(var(--foreground) / 0.25)" />
              )}

              {/* Badges */}
              <div style={{ position: "absolute", top: 20, left: 20, display: "flex", gap: 8 }}>
                {product.tags?.find((t) => t.startsWith("type:")) && (
                  <span
                    style={{
                      padding: "5px 10px",
                      background: "var(--burger-yellow, #FFD700)",
                      color: "#000",
                      fontSize: 10,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      borderRadius: 3,
                    }}
                  >
                    {product.tags
                      .find((t) => t.startsWith("type:"))
                      ?.slice(5)
                      .replace(/-/g, " ")}
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnails — click to switch main image */}
            {visibleGallery.length > 1 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.min(visibleGallery.length, 5)}, 1fr)`,
                  gap: 10,
                }}
              >
                {visibleGallery.slice(0, 5).map((img) => {
                  const realIdx = gallery.indexOf(img);
                  const isActive = realIdx === activeImageIdx;
                  return (
                    <button
                      key={realIdx + img}
                      type="button"
                      aria-label={`${isUa ? "Фото" : "Image"} ${realIdx + 1}`}
                      aria-pressed={isActive}
                      onClick={() => setActiveImageIdx(realIdx)}
                      style={{
                        all: "unset",
                        boxSizing: "border-box",
                        minWidth: 0,
                        aspectRatio: "1",
                        background: "hsl(var(--card))",
                        border: `1.5px solid ${isActive ? "var(--burger-yellow, #FFD700)" : "hsl(var(--foreground) / 0.12)"}`,
                        borderRadius: 8,
                        padding: 10,
                        cursor: "pointer",
                        transition: "border-color 0.15s, opacity 0.15s",
                        opacity: isActive ? 1 : 0.7,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.opacity = "1";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.opacity = isActive ? "1" : "0.7";
                      }}
                    >
                      <img
                        src={burgerImageAtWidth(img, 240)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => setBrokenIdx((prev) => new Set([...prev, realIdx]))}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right: Details ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              minWidth: 0,
              overflowWrap: "anywhere",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    background: "#fff",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 3,
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={getBrandLogo(product.brand)}
                    alt={product.brand}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <ShopBrandLink
                    brand={product.brand}
                    locale={resolvedLocale}
                    className={styles.brandLink}
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: "hsl(var(--foreground) / 0.65)",
                      fontWeight: 600,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: "hsl(var(--foreground) / 0.4)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {manufacturerSku
                      ? `SKU: ${manufacturerSku}`
                      : isUa ? "Артикул виробника не вказано" : "Manufacturer SKU not provided"}
                  </div>
                </div>
              </div>

              <h1
                style={{
                  fontSize: "clamp(22px, 2.4vw, 30px)",
                  fontWeight: 700,
                  lineHeight: 1.25,
                  letterSpacing: "-0.01em",
                  marginBottom: 0,
                  color: "hsl(var(--foreground))",
                }}
              >
                {title}
              </h1>

              {/* Price Block */}
              <div
                style={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--foreground) / 0.12)",
                  padding: "clamp(20px, 4vw, 32px)",
                  marginTop: 32,
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                }}
              >
                <div>
                  {(canChooseVariant || fuelItWithoutEca) && (
                    <div style={{ display: "grid", gap: 14, marginBottom: 24 }}>
                      {canChooseVariant && (optionAxes.length > 0 ? optionAxes.map((axis) => (
                        <label key={axis.index} style={{ display: "grid", gap: 7, fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{axis.name}</span>
                          <select
                            value={selectedVariant?.optionValues?.[axis.index] ?? ""}
                            onChange={(event) => chooseOption(axis.index, event.target.value)}
                            style={{ width: "100%", padding: "12px", borderRadius: 6,
                              border: "1px solid hsl(var(--foreground) / 0.25)",
                              background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                          >
                            {axis.values.map((value) => {
                              const allUnavailable = variants
                                .filter((variant) => variant.optionValues?.[axis.index] === value)
                                .every((variant) => variant.inventoryQty === 0);
                              return <option key={value} value={value}>
                                {localizeBurgerOptionValue(value, isUa, product.slug)}
                                {allUnavailable ? (isUa ? " — тимчасово недоступно" : " — unavailable") : ""}
                              </option>;
                            })}
                          </select>
                        </label>
                      )) : (
                        <label style={{ display: "grid", gap: 7, fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{isUa ? "Варіант" : "Variant"}</span>
                          <select
                            value={selectedVariant?.id ?? ""}
                            onChange={(event) => selectVariant(event.target.value)}
                            style={{ width: "100%", padding: "12px", borderRadius: 6,
                              border: "1px solid hsl(var(--foreground) / 0.25)",
                              background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                          >
                            {variants.map((variant) => (
                              <option key={variant.id ?? variant.position} value={variant.id}>
                                {variant.title || variant.sku || (isUa ? "Варіант" : "Variant")}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                      {selectedVariant && (
                        <div style={{ fontSize: 13, lineHeight: 1.5, padding: "12px 14px",
                          border: "1px solid hsl(var(--foreground) / 0.16)", borderRadius: 6 }}>
                          <strong>{isUa ? "Обрана комплектація: " : "Selected configuration: "}</strong>
                          {selectedOptions.length
                            ? selectedOptions.map((value) => localizeBurgerOptionValue(value, isUa, product.slug)).join(" · ")
                            : selectedVariant.title}
                          {fuelItWithoutEca && (
                            <div style={{ marginTop: 8 }}>
                              {isUa
                                ? "Bluetooth-модуль ECA і датчик етанолу до цієї комплектації не входять."
                                : "The Bluetooth ECA module and ethanol sensor are not included in this configuration."}
                            </div>
                          )}
                          {selectedVariantUnavailable && (
                            <div style={{ marginTop: 8 }}>
                              {isUa ? "Зараз недоступно у постачальника." : "Currently unavailable from the supplier."}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                  )}
                  <div
                    style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 16 }}
                  >
                    <div style={{ fontSize: 36, fontWeight: 800, color: "var(--burger-yellow)" }}>
                      <ShopPrimaryPriceBox
                        locale={resolvedLocale}
                        isUa={isUa}
                        price={pricing.effectivePrice}
                      />
                    </div>
                    {pricing.effectiveCompareAt && (
                      <div
                        style={{
                          fontSize: 18,
                          textDecoration: "line-through",
                          color: "hsl(var(--foreground) / 0.35)",
                        }}
                      >
                        {formatPrice(
                          resolvedLocale,
                          computeCrossPrices(pricing.effectiveCompareAt).usd,
                          "USD"
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <ShopB2BPricingBand pricing={pricing} locale={resolvedLocale} />
                  </div>
                  {SHOW_STOCK_BADGE ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 16,
                        padding: "6px 12px",
                        background: isInStock ? "rgba(0, 200, 83, 0.1)" : "rgba(255, 152, 0, 0.1)",
                        border: `1px solid ${isInStock ? "rgba(0, 200, 83, 0.3)" : "rgba(255, 152, 0, 0.3)"}`,
                        color: isInStock ? "#00e676" : "#ff9800",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: isInStock ? "#00e676" : "#ff9800",
                        }}
                      />
                      {isInStock
                        ? isUa
                          ? "В наявності"
                          : "In stock"
                        : isUa
                          ? "Під замовлення"
                          : "Pre order"}
                    </div>
                  ) : null}
                </div>

                {/* CTA Action logic */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
                  <div style={{ width: "100%", padding: "2px" }}>
                    {selectedVariantUnavailable || !hasSelectedVariantPrice || !pricing.effectivePrice ||
                      pricing.effectivePrice.usd === 0 ? (
                      <Link
                        href={`/${resolvedLocale}/contact`}
                        className="burger-btn w-full justify-center text-center uppercase tracking-widest font-bold"
                        style={{
                          background: "white",
                          color: "black",
                          padding: "16px",
                          borderRadius: "8px",
                          display: "block",
                        }}
                      >
                        {selectedVariantUnavailable
                          ? (isUa ? "Уточнити доступність" : "Check availability")
                          : (isUa ? "Запитати ціну" : "Request Price")}
                      </Link>
                    ) : (
                      <AddToCartButton
                        slug={product.slug}
                        locale={resolvedLocale}
                        variantId={selectedVariant?.id ?? null}
                        productName={title}
                        variant="default"
                        label={isUa ? "Додати в кошик" : "Add to Cart"}
                        className="burger-btn burger-btn--primary w-full justify-center"
                      />
                    )}
                  </div>
                  <ProductAiOpinionPanel
                    locale={resolvedLocale}
                    product={product}
                    shape="rounded"
                    className={styles.aiOpinion}
                  />
                </div>
              </div>
            </div>

            {/* Description HTML */}
            {descriptionRaw && (
              <MobileProductDisclosure title={isUa ? "Опис" : "Description"} className="mt-2">
                <div
                  className="prose prose-invert max-w-none burger-prose"
                  dangerouslySetInnerHTML={{ __html: formatDescriptionDisplay(descriptionRaw) }}
                />
              </MobileProductDisclosure>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
