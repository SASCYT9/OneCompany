import test from "node:test";
import assert from "node:assert/strict";
import { buildProductAiPrompt, buildProductAiProviderHref } from "../../../src/lib/shopAiOpinion";

const LAMBORGHINI = {
  title: "Кришка двигуна з карбону (матова) для LAMBORGHINI Huracan",
  brand: "Eventuri",
  sku: "EVE-HCN-CFM-ENG",
  productType: "Кришки двигуна",
  url: "https://onecompany.global/ua/shop/lamborghini-huracan-carbon-engine-cover-set-satin-finish",
  description: "<p><strong>Карбоновий комплект</strong> накладок на двигун&nbsp;Eventuri.</p>",
};

test("names the exact part and asks four concrete questions", () => {
  const prompt = buildProductAiPrompt("ua", LAMBORGHINI);

  assert.match(prompt, /^Ти — незалежний експерт з тюнінгу/);
  assert.match(
    prompt,
    /Сторінка товару: https:\/\/onecompany\.global\/ua\/shop\/lamborghini-huracan/
  );
  assert.match(prompt, /Бренд: Eventuri/);
  assert.match(prompt, /Артикул: EVE-HCN-CFM-ENG/);
  assert.match(prompt, /Тип: Кришки двигуна/);
  assert.match(prompt, /Опис продавця: Карбоновий комплект накладок на двигун Eventuri\./);
  for (const question of [
    "1. Що це за деталь",
    "2. Для яких авто",
    "3. Чи потрібні",
    "4. Плюси й мінуси",
  ]) {
    assert.ok(prompt.includes(question), question);
  }
  assert.match(prompt, /не вигадуй цифр/);
  assert.doesNotMatch(prompt, /undefined|null|<|&nbsp;/);
});

test("skips empty facts and meaningless product types", () => {
  for (const productType of ["Для автомобілів > Ford", "Компонент", ""]) {
    const prompt = buildProductAiPrompt("ua", { title: "GFB DV+", brand: "GFB", productType });
    assert.doesNotMatch(prompt, /^Тип:/m, productType);
    assert.doesNotMatch(prompt, /^Артикул:|^Сторінка товару:|^Опис продавця:/m);
  }
});

test("keeps the opened link short with a long description", () => {
  const prompt = buildProductAiPrompt("ua", { ...LAMBORGHINI, description: "Опис ".repeat(2000) });
  const description = prompt.match(/^Опис продавця: (.*)$/m)?.[1] ?? "";

  assert.ok(description.length <= 350, `description is ${description.length} characters`);
  assert.ok(description.endsWith("…"));
  for (const provider of ["chatgpt", "perplexity"] as const) {
    const href = buildProductAiProviderHref(provider, prompt);
    assert.ok(href.length < 9000, `${provider} link is ${href.length} characters`);
  }
});

test("opens ChatGPT with web search and Perplexity with the same question", () => {
  const prompt = buildProductAiPrompt("en", {
    ...LAMBORGHINI,
    title: "Eventuri carbon engine cover",
  });

  assert.match(prompt, /^You are an independent car and motorcycle tuning expert/);
  assert.match(prompt, /Part number: EVE-HCN-CFM-ENG/);
  assert.match(prompt, /Answer in English/);
  assert.equal(
    buildProductAiProviderHref("chatgpt", prompt),
    `https://chatgpt.com/?hints=search&q=${encodeURIComponent(prompt)}`
  );
  assert.equal(
    buildProductAiProviderHref("perplexity", prompt),
    `https://www.perplexity.ai/?q=${encodeURIComponent(prompt)}`
  );
});
