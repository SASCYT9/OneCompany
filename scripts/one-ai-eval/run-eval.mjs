#!/usr/bin/env node
/**
 * One AI eval runner. Sends every case in cases.json to a running storefront,
 * strictly one request at a time (the local dev server reads the production
 * catalog, so never parallelise this), and writes raw results plus a short
 * Markdown transcript for manual scoring.
 *
 *   node scripts/one-ai-eval/run-eval.mjs --base http://localhost:3700 \
 *     --target legacy|agent --out eval-legacy.json [--only id1,id2] [--pause 800]
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), all[index + 1] ?? ""]);
    return pairs;
  }, [])
);
const base = args.base || "http://localhost:3700";
const target = args.target === "agent" ? "agent" : "legacy";
const out = args.out || `eval-${target}.json`;
const only = args.only ? new Set(args.only.split(",")) : null;
const pauseMs = Number(args.pause ?? 800);

const cases = JSON.parse(await readFile(path.join(here, "cases.json"), "utf8")).filter(
  (item) => !only || only.has(item.id)
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function compactProduct(product) {
  const eur = product.priceSet?.eur ?? product.price ?? null;
  return {
    brand: product.brand,
    sku: product.partNumber ?? product.sku ?? "",
    name: String(product.name ?? "").slice(0, 140),
    eur: eur === null ? null : Math.round(Number(eur)),
    inStock: Boolean(product.inStock ?? product.availability === "inStock"),
    match: product.matchStatus ?? null,
    reason: product.reason ?? product.matchReason ?? null,
  };
}

async function askLegacy(message, conversationId, locale, ip) {
  const response = await fetch(`${base}/api/shop/stock/assistant`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: base,
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ message, conversationId, context: { locale, currency: "EUR" } }),
  });
  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    conversationId: data.conversationId ?? conversationId,
    mode: data.mode ?? null,
    answer: data.answer || data.message || data.error || "",
    products: (data.products ?? []).map(compactProduct),
    followUps: data.followUps ?? [],
    degraded: data.degradedReason ?? (data.degraded ? "yes" : null),
    pipeline: response.headers.get("x-one-ai-pipeline") ?? data.pipeline ?? null,
  };
}

/** The agent endpoint streams NDJSON events; the runner keeps the final state. */
async function askAgent(message, conversationId, locale, ip) {
  const response = await fetch(`${base}/api/shop/stock/assistant/agent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: base,
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ message, conversationId, context: { locale, currency: "EUR" } }),
  });
  const result = {
    status: response.status,
    conversationId,
    mode: null,
    answer: "",
    products: [],
    followUps: [],
    degraded: null,
    pipeline: "agent",
    firstTokenMs: null,
    tools: [],
    usage: null,
  };
  if (!response.ok || !response.body) {
    result.answer = await response.text().catch(() => "");
    return result;
  }
  const startedAt = performance.now();
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === "text") {
        if (result.firstTokenMs === null)
          result.firstTokenMs = Math.round(performance.now() - startedAt);
        result.answer += event.text;
      } else if (event.type === "status") {
        result.tools.push(event.text);
      } else if (event.type === "replies") {
        result.followUps = event.options ?? [];
      } else if (event.type === "products") {
        result.products.push(...(event.products ?? []).map(compactProduct));
      } else if (event.type === "done") {
        result.conversationId = event.conversationId ?? result.conversationId;
        result.mode = event.catalogHref ? "results" : "answer";
        result.usage = event.usage ?? null;
      } else if (event.type === "error") {
        result.degraded = event.code ?? "error";
        result.answer ||= event.message ?? "";
      }
    }
  }
  return result;
}

function autoSignals(caseItem, turn) {
  const expect = caseItem.expect ?? {};
  const tokens = (expect.vehicle ?? []).map((token) => token.toLowerCase());
  const products = turn.products;
  const vehicleHits = tokens.length
    ? products.filter((product) =>
        tokens.some((token) => product.name.toLowerCase().includes(token))
      ).length
    : null;
  const overBudget =
    expect.maxEur !== undefined
      ? products.filter((product) => product.eur !== null && product.eur > expect.maxEur).length
      : null;
  const skuHit = expect.sku
    ? products.some((product) => product.sku.toUpperCase() === expect.sku.toUpperCase())
    : null;
  const cyrillic = /[а-яіїєґ]/i.test(turn.answer);
  const languageOk = caseItem.lang === "en" ? !cyrillic || /[a-z]{4}/i.test(turn.answer) : cyrillic;
  return { productCount: products.length, vehicleHits, overBudget, skuHit, languageOk };
}

const results = [];
for (const [caseIndex, caseItem] of cases.entries()) {
  const locale = caseItem.lang === "en" ? "en" : "ua";
  const ip = `10.77.${Math.floor(caseIndex / 200)}.${(caseIndex % 200) + 10}`;
  let conversationId = null;
  const turns = [];
  for (const message of caseItem.turns) {
    const startedAt = performance.now();
    let turn;
    try {
      turn =
        target === "agent"
          ? await askAgent(message, conversationId, locale, ip)
          : await askLegacy(message, conversationId, locale, ip);
    } catch (error) {
      turn = { status: 0, answer: String(error?.message ?? error), products: [], followUps: [] };
    }
    turn.latencyMs = Math.round(performance.now() - startedAt);
    turn.message = message;
    turn.signals = autoSignals(caseItem, turn);
    conversationId = turn.conversationId ?? conversationId;
    turns.push(turn);
    process.stdout.write(
      `${caseItem.id} [${turns.length}/${caseItem.turns.length}] ${turn.status} ${turn.latencyMs}ms ` +
        `products=${turn.products.length} mode=${turn.mode ?? "-"}\n`
    );
    await sleep(pauseMs);
  }
  results.push({ id: caseItem.id, lang: caseItem.lang, expect: caseItem.expect, turns });
}

await writeFile(
  out,
  JSON.stringify({ target, base, ranAt: new Date().toISOString(), results }, null, 2)
);

const markdown = results
  .map((item) => {
    const body = item.turns
      .map((turn) => {
        const products = turn.products
          .slice(0, 6)
          .map(
            (product) =>
              `    - ${product.brand} ${product.sku} — ${product.name} — ${product.eur ?? "?"} €` +
              `${product.inStock ? " (в наявності)" : ""}${product.reason ? ` · ${product.reason}` : ""}`
          )
          .join("\n");
        const usage = turn.usage
          ? ` · first text ${turn.usage.firstTextMs ?? "-"} ms · ${turn.usage.modelCalls} calls · $${turn.usage.costUsd}`
          : "";
        return [
          `  > ${turn.message}`,
          `  ${turn.latencyMs} ms · ${turn.mode ?? "-"}${usage}${turn.degraded ? ` · degraded:${turn.degraded}` : ""}`,
          turn.tools?.length ? `  tools: ${turn.tools.join(" | ")}` : "",
          `  ${String(turn.answer).replace(/\s+/g, " ").slice(0, 900)}`,
          products,
          turn.followUps?.length ? `  chips: ${turn.followUps.join(" | ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
    return `### ${item.id}\n${body}`;
  })
  .join("\n\n");
await writeFile(out.replace(/\.json$/, ".md"), markdown);
console.log(`saved ${out}`);
