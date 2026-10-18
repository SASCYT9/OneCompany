import type { SupportedLocale } from "@/lib/seo";

export type ProductAiPromptData = {
  title: string;
  brand?: string;
  sku?: string;
  /** Short product type, e.g. "Вихлопна система". Category paths are ignored. */
  productType?: string;
  /** Absolute product page URL, so the assistant can read the page itself. */
  url?: string;
  description?: string;
};

/** The description is only a hint (the assistant reads the page); this keeps the link short. */
const DESCRIPTION_MAX_LENGTH = 350;

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

function factLines(rows: Array<[label: string, value: string | null | undefined]>) {
  return rows
    .map(([label, value]) => {
      const text = cleanText(value, 200);
      return text ? `${label}: ${text}` : null;
    })
    .filter((line): line is string => Boolean(line));
}

function usableProductType(value: string | null | undefined) {
  const text = cleanText(value, 80);
  // Generic placeholders and "Для автомобілів > Ford" style paths say nothing useful.
  if (!text || /[>/|]/.test(text) || /^(компонент|component|товар|product)$/i.test(text)) return "";
  return text;
}

/**
 * The question opened in ChatGPT or Perplexity from a product page. It names
 * the exact part (brand, SKU, page link), asks four concrete questions and
 * tells the assistant not to invent figures, so the answer stays about this
 * part instead of generic tuning advice.
 */
export function buildProductAiPrompt(locale: SupportedLocale, data: ProductAiPromptData) {
  const description = cleanText(data.description, DESCRIPTION_MAX_LENGTH);
  const productType = usableProductType(data.productType);

  if (locale === "ua") {
    return [
      "Ти — незалежний експерт з тюнінгу автомобілів і мотоциклів. Я думаю купити цю деталь.",
      "",
      ...factLines([
        ["Сторінка товару", data.url],
        ["Товар", data.title],
        ["Бренд", data.brand],
        ["Артикул", data.sku],
        ["Тип", productType],
        ["Опис продавця", description],
      ]),
      "",
      "Відповідай українською, коротко, по пунктах:",
      "1. Що це за деталь і що вона реально дає, без реклами.",
      "2. Для яких авто, двигунів і років підходить; що перевірити перед покупкою.",
      "3. Чи потрібні додаткові деталі, прошивка або професійне встановлення.",
      "4. Плюси й мінуси.",
      "Спирайся на сторінку товару й офіційні дані виробника за артикулом. Якщо чогось не знаєш напевно — так і напиши, не вигадуй цифр.",
    ].join("\n");
  }

  return [
    "You are an independent car and motorcycle tuning expert. I am considering buying this part.",
    "",
    ...factLines([
      ["Product page", data.url],
      ["Product", data.title],
      ["Brand", data.brand],
      ["Part number", data.sku],
      ["Type", productType],
      ["Seller description", description],
    ]),
    "",
    "Answer in English, briefly, as a list:",
    "1. What this part is and what it really does, without marketing.",
    "2. Which cars, engines and years it fits; what to check before buying.",
    "3. Whether it needs extra parts, a tune or professional installation.",
    "4. Pros and cons.",
    "Rely on the product page and the manufacturer's official data for this part number. If you are not sure about something, say so and do not invent figures.",
  ].join("\n");
}

export type ProductAiProvider = "chatgpt" | "perplexity";

export function buildProductAiProviderHref(provider: ProductAiProvider, prompt: string) {
  const query = encodeURIComponent(prompt);
  // `hints=search` opens ChatGPT with web search on, so it can read the product page.
  return provider === "chatgpt"
    ? `https://chatgpt.com/?hints=search&q=${query}`
    : `https://www.perplexity.ai/?q=${query}`;
}
