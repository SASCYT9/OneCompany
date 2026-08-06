import type { SupportedLocale } from "@/lib/seo";

export type ProductAiPromptData = {
  title: string;
  brand?: string;
  category?: string;
  productType?: string;
  sku?: string;
  description?: string;
  highlights?: string[];
  specifications?: Array<{ label: string; value: string }>;
};

function cleanText(value: string | null | undefined, maxLength: number) {
  const withoutMarkup = String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (withoutMarkup.length <= maxLength) return withoutMarkup;
  return `${withoutMarkup.slice(0, maxLength - 1).trimEnd()}…`;
}

function valueOrMissing(value: string | null | undefined, missing: string) {
  return cleanText(value, 360) || missing;
}

function formatProductFacts(data: ProductAiPromptData, missing: string) {
  const facts = [
    ["Товар", data.title],
    ["Бренд", data.brand],
    ["Категорія", data.category],
    ["Тип товару", data.productType],
    ["Артикул / SKU", data.sku],
  ]
    .map(([label, value]) => {
      const normalizedValue = valueOrMissing(value, missing);
      return normalizedValue === missing ? null : `${label}: ${normalizedValue}`;
    })
    .filter((line): line is string => Boolean(line));

  const description = cleanText(data.description, 1000);
  if (description) facts.push(`Опис: ${description}`);

  const highlights = (data.highlights ?? [])
    .map((item) => cleanText(item, 180))
    .filter(Boolean)
    .slice(0, 6);
  if (highlights.length) {
    facts.push(`Ключові особливості: ${highlights.join("; ")}`);
  }

  const specifications = (data.specifications ?? [])
    .slice(0, 8)
    .map(({ label, value }) => {
      const normalizedLabel = cleanText(label, 80);
      const normalizedValue = cleanText(value, 180);
      return normalizedLabel && normalizedValue ? `${normalizedLabel}: ${normalizedValue}` : null;
    })
    .filter((line): line is string => Boolean(line));
  if (specifications.length) {
    facts.push(`Характеристики: ${specifications.join("; ")}`);
  }

  return facts.join("\n");
}

export function buildProductAiPrompt(locale: SupportedLocale, data: ProductAiPromptData) {
  const isUa = locale === "ua";

  if (isUa) {
    const missing = "не вказано в описі товару";
    const facts = formatProductFacts(data, missing);

    return [
      "Проаналізуй цю автомобільну або мото-деталь як технічний експерт і дай мені один самостійний чесний висновок.",
      "",
      facts,
      "",
      "Поясни українською простими словами, що це за деталь, що вона реально дає автомобілю та власнику і з чого вона зроблена.",
      "Сформуй власну практичну оцінку на основі даних товару, без маркетингових перебільшень.",
      "Якщо матеріал або технологія виготовлення не вказані, прямо скажи: «не вказано в описі товару» — нічого не вигадуй.",
      "Відповідай коротко одним зв’язним поясненням, без анкетного формату та без додаткових уточнень до мене.",
    ].join("\n");
  }

  const missing = "not provided in the product description";
  const facts = [
    ["Product", data.title],
    ["Brand", data.brand],
    ["Category", data.category],
    ["Product type", data.productType],
    ["Part number / SKU", data.sku],
  ]
    .map(([label, value]) => {
      const normalizedValue = valueOrMissing(value, missing);
      return normalizedValue === missing ? null : `${label}: ${normalizedValue}`;
    })
    .filter((line): line is string => Boolean(line));

  const description = cleanText(data.description, 1000);
  if (description) facts.push(`Description: ${description}`);

  const highlights = (data.highlights ?? [])
    .map((item) => cleanText(item, 180))
    .filter(Boolean)
    .slice(0, 6);
  if (highlights.length) facts.push(`Key features: ${highlights.join("; ")}`);

  const specifications = (data.specifications ?? [])
    .slice(0, 8)
    .map(({ label, value }) => {
      const normalizedLabel = cleanText(label, 80);
      const normalizedValue = cleanText(value, 180);
      return normalizedLabel && normalizedValue ? `${normalizedLabel}: ${normalizedValue}` : null;
    })
    .filter((line): line is string => Boolean(line));
  if (specifications.length) facts.push(`Specifications: ${specifications.join("; ")}`);

  return [
    "Analyze this automotive or motorcycle part as a technical expert and give me one independent, honest conclusion.",
    "",
    facts.join("\n"),
    "",
    "Explain in simple English what this part is, what it realistically gives the vehicle and owner, and what it is made of.",
    "Make your own practical assessment from the product data, without marketing exaggeration.",
    'If the material or manufacturing process is not provided, say exactly: "not provided in the product description" — do not invent it.',
    "Keep the answer short and cohesive, without an interview-style format and without asking me follow-up questions.",
  ].join("\n");
}
