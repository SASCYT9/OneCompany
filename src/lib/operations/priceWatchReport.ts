import type {
  PriceWatchFinding,
  PriceWatchFindingKind,
  PriceWatchStatus,
  PriceWatchSummary,
} from "@/lib/operations/priceWatchChecks";
import type { PriceWatchCurrency, PriceWatchKind } from "@/lib/operations/priceWatchSources";

/**
 * Telegram texts of the price watch (HTML parse mode). Everything dynamic is
 * escaped here; callers attach the buttons. Russian, like the rest of the bot.
 */

/** Telegram allows 4096 characters; leave room for entities and the buttons. */
export const PRICE_WATCH_MESSAGE_LIMIT = 3_900;
const NBSP = " ";

export type PriceWatchDigestEntry = {
  key: string;
  title: string;
  kind: PriceWatchKind;
  site: string;
  status: PriceWatchStatus;
  checked: number;
  findingsCount: number;
  newFindings: number;
  findings: PriceWatchFinding[];
  summary: PriceWatchSummary;
};

export type PriceWatchPriceListLine = {
  title: string;
  nextReminderAt: string | null;
  overdue: boolean;
};

export type PriceWatchButtonSpec =
  | { text: string; url: string }
  | {
      text: string;
      action: "price_digest_task" | "price_ack" | "price_snooze" | "price_list_task";
      style?: "primary" | "success" | "danger";
    };

export function escapeTelegramHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function ruPlural(count: number, one: string, few: string, many: string) {
  const lastTwo = Math.abs(count) % 100;
  const last = lastTwo % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

const products = (count: number) => ruPlural(count, "товар", "товара", "товаров");

export function formatPriceWatchNumber(value: number, digits?: number) {
  const fraction = digits ?? (Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2);
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(value);
}

export function formatPriceWatchMoney(
  value: number | null | undefined,
  currency: PriceWatchCurrency
) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const number = formatPriceWatchNumber(value);
  if (currency === "EUR") return `${number}${NBSP}€`;
  if (currency === "USD") return `$${number}`;
  if (currency === "GBP") return `£${number}`;
  return `${number}${NBSP}₴`;
}

export function formatPriceWatchPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatPriceWatchNumber(Math.abs(value), 1)}${NBSP}%`;
}

function dayLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone, day: "numeric", month: "short" }).format(
    date
  );
}

function link(text: string, url: string | null | undefined) {
  const safe = escapeTelegramHtml(text);
  return url && /^https:\/\//.test(url)
    ? `<a href="${escapeTelegramHtml(url).replaceAll('"', "&quot;")}">${safe}</a>`
    : safe;
}

/** SKUs we made from supplier ids (CTC-123…, BURGER-V-456…) mean nothing to people. */
const SYNTHETIC_SKU = /^(?:CTC|BURGER(?:-V)?)-\d+/i;

/** What people recognise: the brand SKU, or a short product name for our synthetic SKUs. */
export function priceWatchItemName(finding: Pick<PriceWatchFinding, "sku" | "title">) {
  if (!SYNTHETIC_SKU.test(finding.sku) || !finding.title) return finding.sku;
  const name = finding.title
    .replace(/^(?:CT Carbon|Burger Motorsports|BMS)\s+/i, "")
    .replace(/\s+Carbon Fibre\b/gi, "")
    .replace(/\s*\((?:19|20)\d{2}(?:\s*[-–]\s*(?:(?:19|20)\d{2})?|\+)?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return name.length > 44 ? `${name.slice(0, 43).trimEnd()}…` : name;
}

/** The name opens the supplier's page when there is one. */
function itemLabel(finding: PriceWatchFinding) {
  const name = priceWatchItemName(finding);
  return finding.url && /^https:\/\//.test(finding.url)
    ? link(name, finding.url)
    : `<code>${escapeTelegramHtml(name)}</code>`;
}

function findingLine(finding: PriceWatchFinding) {
  const sku = itemLabel(finding);
  if (finding.kind === "cheaper" || finding.kind === "dearer") {
    return `${sku}  ${formatPriceWatchMoney(finding.ours, finding.currency)} → <b>${formatPriceWatchMoney(
      finding.expected,
      finding.currency
    )}</b> (${formatPriceWatchPercent(finding.deltaPct)})`;
  }
  if (finding.kind === "up" || finding.kind === "down") {
    const supplier = finding.supplierCurrency ?? finding.currency;
    return `${sku}  ${formatPriceWatchMoney(finding.before, supplier)} → <b>${formatPriceWatchMoney(
      finding.now,
      supplier
    )}</b> (${formatPriceWatchPercent(finding.deltaPct)}) · у нас ${formatPriceWatchMoney(
      finding.ours,
      finding.currency
    )}`;
  }
  if (finding.kind === "competitor") {
    return `${sku}  у нас ${formatPriceWatchMoney(finding.ours, "UAH")} · у них <b>${formatPriceWatchMoney(
      finding.now,
      "UAH"
    )}</b> (${formatPriceWatchPercent(finding.deltaPct)})`;
  }
  return `${sku} ${escapeTelegramHtml(finding.title)}`;
}

/** Long lists fold into an expandable quote so the message stays readable. */
function foldedList(title: string, findings: PriceWatchFinding[], limit: number) {
  if (!findings.length) return [];
  const shown = findings
    .slice(0, limit)
    .map((finding) => escapeTelegramHtml(priceWatchItemName(finding)));
  const rest = findings.length - shown.length;
  return [
    `<blockquote expandable>${escapeTelegramHtml(title)}: ${shown.join(", ")}${
      rest > 0 ? ` …и ещё ${rest}` : ""
    }</blockquote>`,
  ];
}

type RenderLimits = { lines: number; skus: number };

function pick(findings: PriceWatchFinding[], kinds: PriceWatchFindingKind[], onlyNew: boolean) {
  return findings.filter(
    (finding) => kinds.includes(finding.kind) && (!onlyNew || finding.isNew !== false)
  );
}

function formatNewCount(total: number, fresh: number) {
  return fresh && fresh < total ? ` (новых: ${fresh})` : "";
}

/** The colour of a source's header: red loses money, yellow needs a look, white is for the record. */
function entryMark(entry: PriceWatchDigestEntry, has: { cheaper: boolean; other: boolean }) {
  if (entry.status === "error") return "⚠️";
  if (has.cheaper) return "🔴";
  if (
    has.other ||
    entry.summary.notice ||
    entry.status === "format_change" ||
    entry.status === "mass_change"
  ) {
    return "🟡";
  }
  return "⚪";
}

/** One block per source: a header, then what changed. Empty when there is nothing to say. */
function renderEntry(entry: PriceWatchDigestEntry, limits: RenderLimits, weekly: boolean) {
  const title = `<b>${escapeTelegramHtml(entry.title)}</b>`;
  const site = escapeTelegramHtml(entry.site);
  const counts = entry.summary.counts ?? {};
  const onlyNew = !weekly;
  // A first look only remembered prices: it goes to the one-line summary.
  if (entry.status === "baseline") return [];
  if (entry.status === "error") {
    return [
      `⚠️ ${title} · ${site}`,
      `Не удалось проверить: ${escapeTelegramHtml(entry.summary.error ?? "сайт не ответил")}. Попробую снова через 3 часа.`,
    ];
  }
  const cheaper = pick(entry.findings, ["cheaper"], onlyNew);
  const dearer = pick(entry.findings, ["dearer"], onlyNew);
  const moved = pick(entry.findings, ["up", "down"], onlyNew);
  const rival = pick(entry.findings, ["competitor"], onlyNew);
  const gone = pick(entry.findings, ["gone"], onlyNew);
  const soldOut = pick(entry.findings, ["sold_out"], onlyNew);
  const backInStock = pick(entry.findings, ["back_in_stock"], onlyNew);
  const fx = pick(entry.findings, ["fx"], onlyNew);
  const body: string[] = [];
  if (entry.summary.notice) {
    body.push(
      `${escapeTelegramHtml(entry.summary.notice.charAt(0).toUpperCase() + entry.summary.notice.slice(1))}.`
    );
  }
  if (entry.status === "format_change" && entry.summary.massChange?.vatLike) {
    const change = entry.summary.massChange;
    body.push(
      `Поставщик сменил формат цен, а не цены: ${change.count} из ${change.total} цен стали ровно ×${formatPriceWatchNumber(
        change.ratio,
        2
      )}. Похоже на ${change.ratio > 1 ? "добавленный" : "убранный"} НДС. Цены на сайте не трогаю — нужно проверить формулу.`
    );
  }
  if (entry.status === "mass_change" && entry.summary.massChange) {
    const change = entry.summary.massChange;
    body.push(
      `Поставщик изменил почти все цены на ${formatPriceWatchPercent(
        (change.ratio - 1) * 100
      )} (${change.count} из ${change.total}) — похоже на новый прайс.`
    );
  }
  const list = (items: PriceWatchFinding[]) => [
    ...items.slice(0, limits.lines).map(findingLine),
    ...(items.length > limits.lines ? [`…и ещё ${items.length - limits.lines}`] : []),
  ];
  if (cheaper.length) {
    const total = counts.cheaper ?? cheaper.length;
    body.push(
      `${total} ${products(total)} у нас дешевле формулы${formatNewCount(total, cheaper.length)}:`,
      ...list(cheaper)
    );
  }
  if (dearer.length) {
    const total = counts.dearer ?? dearer.length;
    body.push(
      `${total} ${products(total)} у нас дороже формулы${formatNewCount(total, dearer.length)}:`,
      ...list(dearer)
    );
  }
  if (moved.length) {
    const up = moved.filter((finding) => finding.kind === "up").length;
    body.push(
      `У поставщика изменились цены: ${moved.length} ${products(moved.length)} (↑${NBSP}${up}, ↓${NBSP}${
        moved.length - up
      }):`,
      ...list(moved)
    );
  }
  if (rival.length) {
    const total = counts.competitor ?? rival.length;
    body.push(
      `${total} ${products(total)} у нас дороже, чем у них${formatNewCount(total, rival.length)}:`,
      ...list(rival)
    );
  }
  for (const finding of fx) {
    body.push(
      `GBP/USD по НБУ ${formatPriceWatchNumber(Number(finding.now), 3)}, а в формуле ${escapeTelegramHtml(
        finding.sku
      )} ${formatPriceWatchNumber(Number(finding.expected), 3)} (${formatPriceWatchPercent(
        finding.deltaPct
      )}) — цены ${escapeTelegramHtml(finding.sku)} ${
        Number(finding.deltaPct) > 0 ? "занижены" : "завышены"
      } примерно на столько же.`
    );
  }
  body.push(
    ...foldedList(
      `Пропали у поставщика: ${gone.length} ${products(gone.length)}`,
      gone,
      limits.skus
    ),
    ...foldedList(
      `Закончились у производителя: ${soldOut.length} ${products(soldOut.length)}`,
      soldOut,
      limits.skus
    ),
    ...foldedList(
      `Снова в наличии у производителя: ${backInStock.length} ${products(backInStock.length)}`,
      backInStock,
      limits.skus
    )
  );
  if (!body.length) return [];
  const mark = entryMark(entry, {
    cheaper: cheaper.length > 0,
    other: dearer.length + moved.length + rival.length + fx.length > 0,
  });
  return [`${mark} ${title} · ${site}`, ...body];
}

/** Worth a message: something new, broken or changed in format. */
export function isPriceWatchEntryReportable(entry: PriceWatchDigestEntry) {
  if (entry.status === "baseline") return false;
  return (
    entry.status === "error" ||
    entry.status === "format_change" ||
    entry.status === "mass_change" ||
    Boolean(entry.summary.notice) ||
    entry.findings.some((finding) => finding.isNew !== false)
  );
}

/** One line each for sources without a block of their own. */
function quietLines(entries: PriceWatchDigestEntry[], rendered: ReadonlySet<string>) {
  const rest = entries.filter((entry) => !rendered.has(entry.key) && entry.kind !== "fx");
  const name = (entry: PriceWatchDigestEntry) =>
    entry.checked
      ? `${escapeTelegramHtml(entry.title)} (${formatPriceWatchNumber(entry.checked, 0)})`
      : escapeTelegramHtml(entry.title);
  const ok = rest.filter((entry) => entry.status === "ok");
  const known = rest.filter(
    (entry) => entry.status === "findings" || entry.status === "mass_change"
  );
  const baseline = rest.filter((entry) => entry.status === "baseline");
  return [
    ...(ok.length ? [`🟢 В порядке: ${ok.map(name).join(", ")}`] : []),
    ...(known.length
      ? [
          `⚪ Без новых изменений: ${known
            .map(
              (entry) =>
                `${escapeTelegramHtml(entry.title)} (${entry.findingsCount} ${ruPlural(
                  entry.findingsCount,
                  "известное отличие",
                  "известных отличия",
                  "известных отличий"
                )})`
            )
            .join(", ")}`,
        ]
      : []),
    ...(baseline.length
      ? [
          `🔵 Запомнил цены: ${baseline
            .map(
              (entry) =>
                `${escapeTelegramHtml(entry.title)} (${formatPriceWatchNumber(
                  entry.summary.matched ?? entry.checked,
                  0
                )})`
            )
            .join(", ")} — изменения покажу со следующей проверки.`,
        ]
      : []),
  ];
}

function fxLine(entries: PriceWatchDigestEntry[]) {
  const fx = entries.find((entry) => entry.kind === "fx" && entry.status === "ok")?.summary.fx;
  if (!fx) return [];
  const formulas = fx.formulas
    .map(
      (entry) =>
        `${escapeTelegramHtml(entry.source)} ${formatPriceWatchNumber(entry.gbpUsd, 3)} (${formatPriceWatchPercent(
          entry.driftPct
        )})`
    )
    .join(", ");
  return [
    `💱 GBP/USD ${formatPriceWatchNumber(fx.gbpUsd, 3)} по НБУ · в формулах ${formulas} — в норме`,
  ];
}

function priceListLines(lines: PriceWatchPriceListLine[], timeZone: string) {
  if (!lines.length) return [];
  const sorted = [...lines].sort(
    (left, right) =>
      Number(right.overdue) - Number(left.overdue) ||
      String(left.nextReminderAt).localeCompare(String(right.nextReminderAt))
  );
  return [
    `📎 Прайсы: ${sorted
      .map((line) => {
        const when = line.nextReminderAt ? dayLabel(new Date(line.nextReminderAt), timeZone) : null;
        return `${escapeTelegramHtml(line.title)} — ${
          line.overdue
            ? `пора обновить${when ? ` (с ${when})` : ""}`
            : when
              ? `до ${when}`
              : "без срока"
        }`;
      })
      .join("; ")}`,
  ];
}

/**
 * The daily message, or null on a quiet day. On Mondays (weekly) it also lists
 * what is fine, the price lists and what is not checked automatically yet.
 */
export function renderPriceWatchDigest(input: {
  now: Date;
  timeZone: string;
  entries: PriceWatchDigestEntry[];
  weekly: boolean;
  priceLists?: PriceWatchPriceListLine[];
  planned?: { titles: string[]; products: number };
  /** Weekly: supplier items we do not sell yet, first seen this week. */
  newItems?: Array<{ title: string; count: number }>;
  /** Weekly: our products the manufacturer has out of stock now. */
  stock?: Array<{ title: string; outOfStock: number }>;
}): string | null {
  const reportable = input.entries.filter(isPriceWatchEntryReportable);
  if (!input.weekly && !reportable.length) return null;
  const sources = input.entries.filter((entry) => entry.kind !== "fx");
  // Competitor checks look at the same products again; count each product once.
  const checked = sources
    .filter((entry) => entry.kind !== "competitor")
    .reduce((sum, entry) => sum + entry.checked, 0);
  const header = [
    `💶 <b>Цены поставщиков${input.weekly ? ": обзор недели" : ""}</b> · ${dayLabel(
      input.now,
      input.timeZone
    )}`,
    `Проверено: ${sources.length} ${ruPlural(sources.length, "источник", "источника", "источников")}${
      checked ? ` · ${formatPriceWatchNumber(checked, 0)} ${products(checked)}` : ""
    }`,
  ];
  const ordered = [...(input.weekly ? input.entries : reportable)].sort(
    (left, right) => entryRank(left) - entryRank(right)
  );
  const attempts: RenderLimits[] = [
    { lines: 5, skus: 40 },
    { lines: 3, skus: 15 },
    { lines: 2, skus: 6 },
    { lines: 1, skus: 3 },
  ];
  for (const limits of attempts) {
    const rendered = new Set<string>();
    const blocks = ordered
      .map((entry) => {
        const block = renderEntry(entry, limits, input.weekly);
        if (block.length) rendered.add(entry.key);
        return block;
      })
      .filter((block) => block.length);
    const footer = [
      ...quietLines(input.entries, rendered),
      ...(input.weekly ? fxLine(input.entries) : []),
      ...(input.weekly && input.stock?.some((line) => line.outOfStock > 0)
        ? [
            `📦 Нет в наличии у производителя: ${input.stock
              .filter((line) => line.outOfStock > 0)
              .map((line) => `${escapeTelegramHtml(line.title)} ${line.outOfStock}`)
              .join(", ")}`,
          ]
        : []),
      ...(input.weekly && input.newItems?.some((line) => line.count > 0)
        ? [
            `🆕 Новое у поставщиков за неделю: ${input.newItems
              .filter((line) => line.count > 0)
              .map((line) => `${escapeTelegramHtml(line.title)} ${line.count}`)
              .join(", ")} — список в «Работа → Цены»`,
          ]
        : []),
      ...(input.weekly ? priceListLines(input.priceLists ?? [], input.timeZone) : []),
      ...(input.weekly && input.planned?.titles.length
        ? [
            `⏳ Пока без автоматической проверки: ${escapeTelegramHtml(
              input.planned.titles.join(", ")
            )} — ${formatPriceWatchNumber(input.planned.products, 0)} ${products(input.planned.products)}`,
          ]
        : []),
    ];
    const text = [
      ...header,
      ...blocks.flatMap((block) => ["", ...block]),
      ...(footer.length ? ["", ...footer] : []),
    ].join("\n");
    if (text.length <= PRICE_WATCH_MESSAGE_LIMIT) return text;
  }
  const short = [
    ...header,
    "",
    ...ordered.map(
      (entry) =>
        `• ${escapeTelegramHtml(entry.title)}: ${entry.status === "error" ? "ошибка проверки" : `${entry.findingsCount} ${products(entry.findingsCount)} с отличиями`}`
    ),
    "",
    "Подробности — в «Работа → Цены».",
  ].join("\n");
  return short.slice(0, PRICE_WATCH_MESSAGE_LIMIT);
}

function entryRank(entry: PriceWatchDigestEntry) {
  if (entry.status === "error") return 0;
  if ((entry.summary.counts?.cheaper ?? 0) > 0) return 1;
  if (entry.status === "format_change" || entry.status === "mass_change" || entry.summary.notice)
    return 2;
  if (entry.status === "findings") return 3;
  if (entry.kind === "fx") return 4;
  return 5;
}

export function priceWatchDigestButtons(pricesUrl: string | null): PriceWatchButtonSpec[][] {
  return [
    ...(pricesUrl ? [[{ text: "📊 Открыть «Цены»", url: pricesUrl }]] : []),
    [
      {
        text: "📋 Создать задачу",
        action: "price_digest_task" as const,
        style: "primary" as const,
      },
    ],
  ];
}

function monthsBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (30.44 * 24 * 60 * 60 * 1000)));
}

/** "Time to ask for a new price list", sent on the due day and once more a week later. */
export function renderPriceListReminder(input: {
  title: string;
  label: string;
  priceListDate: Date;
  now: Date;
  products: number;
  formula: string;
  secondTime: boolean;
  signal?: { changed: number; site: string } | null;
}) {
  const months = monthsBetween(input.priceListDate, input.now);
  const age =
    months >= 1 ? `${months} ${ruPlural(months, "месяц", "месяца", "месяцев")}` : "меньше месяца";
  return [
    `📎 <b>Пора проверить прайс ${escapeTelegramHtml(input.title)}</b>`,
    `${formatPriceWatchNumber(input.products, 0)} ${products(input.products)} на сайте посчитаны по: ${escapeTelegramHtml(
      input.label
    )}.`,
    `С даты прайса прошло ${age} — запросите у поставщика актуальный.`,
    ...(input.signal?.changed
      ? [
          `На ${escapeTelegramHtml(input.signal.site)} с прошлой проверки изменились цены у ${input.signal.changed} ${products(
            input.signal.changed
          )} — похоже, у поставщика уже новые цены.`,
        ]
      : []),
    `<i>Формула: ${escapeTelegramHtml(input.formula)}</i>`,
    ...(input.secondTime
      ? ["", "Напоминаю второй раз — дальше не буду, прайс останется в «Работа → Цены»."]
      : []),
  ].join("\n");
}

export function priceListReminderButtons(pricesUrl: string | null): PriceWatchButtonSpec[][] {
  return [
    [
      { text: "✅ Прайс актуален", action: "price_ack", style: "success" },
      { text: "⏰ Через неделю", action: "price_snooze" },
    ],
    [{ text: "📋 Создать задачу", action: "price_list_task", style: "primary" }],
    ...(pricesUrl ? [[{ text: "📊 Открыть «Цены»", url: pricesUrl }]] : []),
  ];
}

/** Plain-text task description from the findings of a digest. */
export function renderPriceWatchTaskDescription(entries: PriceWatchDigestEntry[], limit = 40) {
  const lines: string[] = [];
  for (const entry of entries) {
    const findings = entry.findings.filter((finding) => finding.isNew !== false);
    if (!findings.length && entry.status !== "error" && !entry.summary.notice) continue;
    lines.push(`${entry.title} (${entry.site}):`);
    if (entry.status === "error")
      lines.push(`- не удалось проверить: ${entry.summary.error ?? "ошибка"}`);
    if (entry.summary.notice) lines.push(`- ${entry.summary.notice}`);
    for (const finding of findings.slice(0, limit)) {
      const name = priceWatchItemName(finding);
      const item = name === finding.sku ? finding.sku : `${name} (${finding.sku})`;
      const text =
        finding.kind === "cheaper" || finding.kind === "dearer"
          ? `${item}: у нас ${formatPriceWatchMoney(finding.ours, finding.currency)}, по формуле ${formatPriceWatchMoney(
              finding.expected,
              finding.currency
            )} (${formatPriceWatchPercent(finding.deltaPct)})`
          : finding.kind === "up" || finding.kind === "down"
            ? `${item}: у поставщика ${formatPriceWatchMoney(
                finding.before,
                finding.supplierCurrency ?? finding.currency
              )} → ${formatPriceWatchMoney(finding.now, finding.supplierCurrency ?? finding.currency)}, у нас ${formatPriceWatchMoney(
                finding.ours,
                finding.currency
              )}`
            : finding.kind === "gone"
              ? `${item}: нет у поставщика`
              : finding.kind === "sold_out"
                ? `${item}: закончился у поставщика`
                : `${item}: курс в формуле отличается на ${formatPriceWatchPercent(finding.deltaPct)}`;
      lines.push(`- ${text}${finding.url ? ` ${finding.url}` : ""}`);
    }
    if (findings.length > limit) lines.push(`- …и ещё ${findings.length - limit}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}
