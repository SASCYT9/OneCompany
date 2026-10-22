"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  FileSpreadsheet,
  History,
  MessageSquareText,
  PackageX,
  PoundSterling,
  Radar,
  Scale,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import type {
  PriceWatchNewItem,
  PriceWatchOverview,
  PriceWatchOverviewSource,
  PriceWatchOverviewStatus,
  PriceWatchRecentChange,
} from "@/lib/operations/priceWatch";
import type { PriceWatchFinding } from "@/lib/operations/priceWatchChecks";
import {
  formatPriceWatchMoney,
  formatPriceWatchNumber,
  formatPriceWatchPercent,
  priceWatchItemName,
} from "@/lib/operations/priceWatchReport";
import { findPriceWatchSource, type PriceWatchCurrency } from "@/lib/operations/priceWatchSources";
import { cn } from "@/lib/utils";

import { OpsPageHeader } from "./OpsPageHeader";
import { OpsSurface } from "./OpsSurface";

type Tone = "red" | "amber" | "green" | "blue" | "zinc";

const TONE_DOT: Record<Tone, string> = {
  red: "bg-red-500",
  amber: "bg-amber-400",
  green: "bg-emerald-500",
  blue: "bg-sky-400",
  zinc: "bg-zinc-600",
};

const TONE_TEXT: Record<Tone, string> = {
  red: "text-red-300",
  amber: "text-amber-300",
  green: "text-emerald-300",
  blue: "text-sky-300",
  zinc: "text-zinc-400",
};

const STATUS: Record<PriceWatchOverviewStatus, { label: string; tone: Tone }> = {
  ok: { label: "В порядке", tone: "green" },
  findings: { label: "Есть отличия", tone: "amber" },
  baseline: { label: "Цены запомнены", tone: "blue" },
  format_change: { label: "Сменился формат", tone: "amber" },
  mass_change: { label: "Похоже на новый прайс", tone: "amber" },
  error: { label: "Ошибка проверки", tone: "red" },
  running: { label: "Проверяется", tone: "blue" },
  waiting: { label: "Ждёт первой проверки", tone: "zinc" },
  planned: { label: "Следующий этап", tone: "zinc" },
  price_list: { label: "По прайсу", tone: "zinc" },
};

/** What the page shows for a source: money lost first, then overdue price lists. */
function displayStatus(source: PriceWatchOverviewSource): { label: string; tone: Tone } {
  if ((source.run?.summary.counts?.cheaper ?? 0) > 0 && source.status !== "error") {
    return { label: "Дешевле формулы", tone: "red" };
  }
  if (source.priceList?.overdue && source.status !== "error") {
    return { label: "Пора обновить прайс", tone: "amber" };
  }
  return STATUS[source.status];
}

function everyLabel(hours: number | null) {
  if (!hours || hours <= 24) return "каждый день";
  if (hours >= 168) return "раз в неделю";
  return `каждые ${hours} ч`;
}

function howChecked(source: PriceWatchOverviewSource) {
  switch (source.kind) {
    case "formula":
      return `Сайт → наша формула, ${everyLabel(source.everyHours)}`;
    case "changes":
      return `Сайт → изменения цен, ${everyLabel(source.everyHours)}`;
    case "atomic":
      return "Фид Atomic, сайт обновляется сам";
    case "price_list":
      return source.everyHours ? "Прайс + сайт поставщика как сигнал" : "Прайс, напоминание";
    default:
      return "Пока вручную";
  }
}

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Kyiv",
});
const dateOnly = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Kyiv",
});

function ago(iso: string | null, nowIso: string) {
  if (!iso) return "ещё не было";
  const minutes = Math.round((Date.parse(nowIso) - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return dateTime.format(new Date(iso));
}

function StatusBadge({ source }: { source: PriceWatchOverviewSource }) {
  const status = displayStatus(source);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold",
        TONE_TEXT[status.tone]
      )}
    >
      <span className={cn("h-2 w-2 shrink-0", TONE_DOT[status.tone])} />
      {status.label}
    </span>
  );
}

function SupplierLink({ url, children }: { url: string | null; children: ReactNode }) {
  if (!url) return <>{children}</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-zinc-300 underline decoration-white/20 underline-offset-2 hover:text-sky-300"
    >
      {children}
      <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}

/** Renders the bot's Telegram HTML (b, i, code, a, blockquote) without innerHTML. */
function TelegramHtml({ html }: { html: string }) {
  const unescape = (text: string) =>
    text
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&amp;", "&");
  type Node = { tag: string; href?: string; children: ReactNode[] };
  const root: Node = { tag: "root", children: [] };
  const stack: Node[] = [root];
  let last = 0;
  let key = 0;
  const pattern = /<(\/?)(b|i|code|blockquote|a)(?:\s+([^>]*))?>/g;
  for (const match of html.matchAll(pattern)) {
    const top = stack[stack.length - 1];
    if (match.index > last) top.children.push(unescape(html.slice(last, match.index)));
    last = match.index + match[0].length;
    if (match[1]) {
      const node = stack.length > 1 ? stack.pop()! : null;
      if (!node) continue;
      const children = node.children;
      const parent = stack[stack.length - 1];
      key += 1;
      if (node.tag === "b")
        parent.children.push(
          <strong key={key} className="font-semibold text-zinc-50">
            {children}
          </strong>
        );
      else if (node.tag === "i")
        parent.children.push(
          <em key={key} className="text-zinc-400">
            {children}
          </em>
        );
      else if (node.tag === "code")
        parent.children.push(
          <code key={key} className="font-mono text-[0.92em] text-zinc-200">
            {children}
          </code>
        );
      else if (node.tag === "blockquote")
        parent.children.push(
          <span
            key={key}
            className="my-1 block border-l-2 border-sky-500/60 bg-white/[0.03] py-1 pl-3 text-zinc-300"
          >
            {children}
          </span>
        );
      else
        parent.children.push(
          node.href && /^https:\/\//.test(node.href) ? (
            <a
              key={key}
              href={node.href}
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ) : (
            <Fragment key={key}>{children}</Fragment>
          )
        );
    } else {
      const href = match[3]?.match(/href="([^"]*)"/)?.[1];
      stack.push({ tag: match[2], href: href ? unescape(href) : undefined, children: [] });
    }
  }
  if (last < html.length) stack[stack.length - 1].children.push(unescape(html.slice(last)));
  return (
    <div className="whitespace-pre-wrap break-words text-[14px] leading-6 text-zinc-200">
      {root.children}
    </div>
  );
}

function TelegramPreview({ html, buttons }: { html: string; buttons: string[][] }) {
  return (
    <div className="max-w-[560px]">
      <div className="border border-white/10 bg-[#1f2329] px-4 py-3">
        <TelegramHtml html={html} />
      </div>
      <div className="mt-1 grid gap-1">
        {buttons.map((row, index) => (
          <div
            key={index}
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
          >
            {row.map((label) => (
              <div
                key={label}
                className="border border-white/10 bg-[#2a2f36] px-2 py-2 text-center text-[13px] text-zinc-100"
              >
                {label}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function findingCells(finding: PriceWatchFinding) {
  if (finding.kind === "cheaper" || finding.kind === "dearer") {
    return {
      ours: formatPriceWatchMoney(finding.ours, finding.currency),
      target: formatPriceWatchMoney(finding.expected, finding.currency),
      note: `по формуле · у поставщика ${formatPriceWatchMoney(finding.now, finding.supplierCurrency ?? finding.currency)}`,
    };
  }
  if (finding.kind === "up" || finding.kind === "down") {
    const supplier = finding.supplierCurrency ?? finding.currency;
    return {
      ours: formatPriceWatchMoney(finding.ours, finding.currency),
      target: `${formatPriceWatchMoney(finding.before, supplier)} → ${formatPriceWatchMoney(finding.now, supplier)}`,
      note: "цена поставщика",
    };
  }
  return { ours: formatPriceWatchMoney(finding.ours, finding.currency), target: "—", note: "" };
}

function FindingsTable({ findings }: { findings: PriceWatchFinding[] }) {
  const [all, setAll] = useState(false);
  const priced = findings.filter((finding) => !["gone", "sold_out", "fx"].includes(finding.kind));
  const visible = all ? priced : priced.slice(0, 8);
  if (!priced.length) return null;
  return (
    <div className="mt-3 border border-white/10">
      <div className="hidden grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1.2fr)_90px] gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500 md:grid">
        <span>Товар</span>
        <span>У нас</span>
        <span>Должно быть / у поставщика</span>
        <span className="text-right">Разница</span>
      </div>
      {visible.map((finding) => {
        const cells = findingCells(finding);
        const name = priceWatchItemName(finding);
        return (
          <div
            key={`${finding.kind}:${finding.sku}`}
            className="grid grid-cols-1 gap-1 border-b border-white/5 px-3 py-2 text-sm last:border-0 md:grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1.2fr)_90px] md:gap-3"
          >
            <span className="min-w-0">
              <span className="block truncate" title={name}>
                {finding.url ? (
                  <a
                    href={finding.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-200 underline decoration-white/20 underline-offset-2 hover:text-sky-300"
                  >
                    {name}
                  </a>
                ) : (
                  name
                )}
              </span>
              {name !== finding.sku ? (
                <span className="block truncate font-mono text-[11px] text-zinc-600">
                  {finding.sku}
                </span>
              ) : null}
              {finding.isNew ? (
                <span className="ml-2 border border-sky-500/40 px-1 text-[10px] font-semibold uppercase text-sky-300">
                  новое
                </span>
              ) : null}
            </span>
            <span className="text-zinc-300">
              <span className="text-zinc-500 md:hidden">у нас </span>
              {cells.ours}
            </span>
            <span className="text-zinc-100">
              {cells.target}
              <span className="block text-[11px] text-zinc-500">{cells.note}</span>
            </span>
            <span
              className={cn(
                "font-semibold md:text-right",
                finding.kind === "cheaper" || finding.kind === "up"
                  ? "text-red-300"
                  : "text-amber-300"
              )}
            >
              {formatPriceWatchPercent(finding.deltaPct)}
            </span>
          </div>
        );
      })}
      {priced.length > 8 ? (
        <button
          type="button"
          onClick={() => setAll((value) => !value)}
          className="w-full border-t border-white/10 px-3 py-2 text-left text-xs font-semibold text-sky-300 hover:bg-white/[0.03]"
        >
          {all ? "Свернуть" : `Показать все ${priced.length}`}
        </button>
      ) : null}
    </div>
  );
}

function ItemChips({ title, findings }: { title: string; findings: PriceWatchFinding[] }) {
  const [open, setOpen] = useState(false);
  if (!findings.length) return null;
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs font-semibold text-zinc-400 hover:text-zinc-200"
      >
        {open ? "▾" : "▸"} {title}: {findings.length}
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {findings.map((finding) => (
            <span
              key={finding.sku}
              className="border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-zinc-300"
            >
              <SupplierLink url={finding.url ?? null}>{priceWatchItemName(finding)}</SupplierLink>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AttentionCard({ source, nowIso }: { source: PriceWatchOverviewSource; nowIso: string }) {
  const run = source.run;
  const findings = run?.findings ?? [];
  const counts = run?.summary.counts ?? {};
  const parts = [
    counts.cheaper ? `${counts.cheaper} дешевле формулы` : null,
    counts.dearer ? `${counts.dearer} дороже формулы` : null,
    (counts.up ?? 0) + (counts.down ?? 0)
      ? `${(counts.up ?? 0) + (counts.down ?? 0)} изменили цену`
      : null,
    counts.gone ? `${counts.gone} пропали у поставщика` : null,
    counts.sold_out ? `${counts.sold_out} закончились` : null,
  ].filter(Boolean);
  return (
    <section className="min-w-0 border border-white/10 bg-[#171717] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-zinc-50">{source.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <SupplierLink url={source.url}>{source.site}</SupplierLink>
            <span>{formatPriceWatchNumber(source.products, 0)} товаров</span>
            {run ? <span>проверено {ago(run.finishedAt, nowIso)}</span> : null}
          </div>
        </div>
        <StatusBadge source={source} />
      </div>
      <p className="mt-3 text-sm text-zinc-400">
        <span className="text-zinc-500">Формула: </span>
        {source.formula}
      </p>
      {run?.summary.notice ? (
        <p className="mt-2 border-l-2 border-amber-400/70 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-100">
          {run.summary.notice.charAt(0).toUpperCase() + run.summary.notice.slice(1)}.
        </p>
      ) : null}
      {run?.status === "error" ? (
        <p className="mt-2 border-l-2 border-red-500/70 bg-red-500/[0.06] px-3 py-2 text-sm text-red-100">
          Не удалось проверить: {run.summary.error ?? "сайт не ответил"}. Следующая попытка через 3
          часа.
        </p>
      ) : null}
      {source.priceList?.overdue ? (
        <p className="mt-2 border-l-2 border-amber-400/70 bg-amber-400/[0.06] px-3 py-2 text-sm text-amber-100">
          Цены посчитаны по: {source.priceList.label}, от{" "}
          {dateOnly.format(new Date(source.priceList.date))} Пора запросить у поставщика актуальный
          прайс — бот напоминает с{" "}
          {source.priceList.nextReminderAt
            ? dateOnly.format(new Date(source.priceList.nextReminderAt))
            : "сегодня"}
        </p>
      ) : null}
      {parts.length ? (
        <p className="mt-3 text-sm font-semibold text-zinc-200">{parts.join(" · ")}</p>
      ) : null}
      <FindingsTable findings={findings} />
      <ItemChips
        title="Пропали у поставщика"
        findings={findings.filter((finding) => finding.kind === "gone")}
      />
      <ItemChips
        title="Закончились у поставщика"
        findings={findings.filter((finding) => finding.kind === "sold_out")}
      />
    </section>
  );
}

/** What the supplier shows about our products: stock, weight and box size («только для нас»). */
function SourceFacts({
  source,
  className,
}: {
  source: PriceWatchOverviewSource;
  className?: string;
}) {
  const facts = source.facts;
  if (!facts?.matched) return null;
  if (source.kind === "competitor") {
    return (
      <span className={cn("block text-[11px] text-zinc-500", className)}>
        у конкурента {formatPriceWatchNumber(facts.matched, 0)}
      </span>
    );
  }
  return (
    <span className={cn("block text-[11px] text-zinc-500", className)}>
      {facts.outOfStock ? (
        <span className="text-amber-300">
          нет у производителя: {formatPriceWatchNumber(facts.outOfStock, 0)}
        </span>
      ) : facts.withStock ? (
        "всё в наличии"
      ) : (
        "наличие не публикует"
      )}
      {facts.withWeight ? ` · вес ${formatPriceWatchNumber(facts.withWeight, 0)}` : ""}
      {facts.withSize ? ` · размеры ${formatPriceWatchNumber(facts.withSize, 0)}` : ""}
    </span>
  );
}

function SectionTitle({
  icon: Icon,
  children,
  hint,
}: {
  icon: typeof Radar;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
        <Icon className="h-4 w-4 text-blue-400" />
        {children}
      </h2>
      {hint ? <p className="mt-1 text-sm text-zinc-500">{hint}</p> : null}
    </div>
  );
}

/** New at suppliers this week: products we could import, grouped by source. */
function NewItems({ items }: { items: PriceWatchNewItem[] }) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const visible = all ? items : items.slice(0, 12);
  return (
    <div>
      <SectionTitle
        icon={Sparkles}
        hint="Появились у поставщиков за неделю, на сайте их нет — кандидаты в импорт."
      >
        Новое у поставщиков · {formatPriceWatchNumber(items.length, 0)}
      </SectionTitle>
      <div className="border border-white/10 bg-[#171717]">
        {visible.map((item) => (
          <div
            key={`${item.sourceKey}:${item.title}:${item.url ?? ""}`}
            className="grid grid-cols-1 gap-1 border-b border-white/5 px-4 py-2.5 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_130px_120px_110px] sm:gap-3"
          >
            <span className="min-w-0 truncate text-zinc-200" title={item.title}>
              <SupplierLink url={item.url}>{item.title}</SupplierLink>
            </span>
            <span className="text-xs text-zinc-500 sm:text-sm">
              {findPriceWatchSource(item.sourceKey)?.title ?? item.sourceKey}
            </span>
            <span className="tabular-nums text-zinc-300">
              {item.price
                ? formatPriceWatchMoney(item.price, (item.currency ?? "EUR") as PriceWatchCurrency)
                : "—"}
            </span>
            <span className="text-xs text-zinc-500">
              {dateTime.format(new Date(item.firstSeenAt))}
            </span>
          </div>
        ))}
        {items.length > 12 ? (
          <button
            type="button"
            onClick={() => setAll((value) => !value)}
            className="w-full border-t border-white/10 px-4 py-2 text-left text-xs font-semibold text-sky-300 hover:bg-white/[0.03]"
          >
            {all ? "Свернуть" : `Показать все ${items.length}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const CHANGE_ORIGIN: Record<string, string> = {
  command: "команда",
  digest: "из отчёта",
  card: "из карточки",
  undo: "отмена",
  price_list: "прайс",
  lead_time: "срок на сайте",
};

function changeResult(change: PriceWatchRecentChange): { label: string; tone: Tone } {
  if (change.status === "undone") return { label: "Отменено", tone: "zinc" };
  if (change.status === "failed") return { label: "Не применено", tone: "red" };
  if (change.status === "applying") {
    return { label: `Применяется: ${change.appliedCount} из ${change.itemCount}`, tone: "blue" };
  }
  return change.failedCount
    ? { label: `Применено ${change.appliedCount}, ошибок ${change.failedCount}`, tone: "amber" }
    : { label: `Применено ${change.appliedCount} из ${change.itemCount}`, tone: "green" };
}

/** Changes made from Telegram: who, what and the result, for 30 days. */
function RecentChanges({ changes, nowIso }: { changes: PriceWatchRecentChange[]; nowIso: string }) {
  if (!changes.length) return null;
  return (
    <div>
      <SectionTitle
        icon={History}
        hint="Цены, изменённые из Telegram за 30 дней. Каждое изменение есть в журнале админки."
      >
        Изменения цен из бота
      </SectionTitle>
      <div className="border border-white/10 bg-[#171717]">
        {changes.map((change) => {
          const result = changeResult(change);
          const origin = change.origin.startsWith("price_list")
            ? "прайс"
            : (CHANGE_ORIGIN[change.origin] ?? change.origin);
          return (
            <div
              key={change.id}
              className="grid grid-cols-1 gap-1 border-b border-white/5 px-4 py-2.5 text-sm last:border-0 md:grid-cols-[minmax(0,1fr)_150px_200px_120px] md:gap-3"
            >
              <span className="min-w-0">
                <span className="block truncate text-zinc-200" title={change.title}>
                  {change.title}
                </span>
                <span className="text-[11px] text-zinc-600">{origin}</span>
              </span>
              <span className="text-xs text-zinc-400 md:text-sm">{change.requestedBy}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-semibold",
                  TONE_TEXT[result.tone]
                )}
              >
                <span className={cn("h-2 w-2 shrink-0", TONE_DOT[result.tone])} />
                {result.label}
              </span>
              <span className="text-xs text-zinc-500">
                {ago(change.appliedAt ?? change.createdAt, nowIso)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const COMMANDS: Array<[string, string]> = [
  ["цена V167-678-63 9005", "поставить цену товару (валюта — как у товара, или «€», «$», «грн»)"],
  ["цена Brabus +5%", "весь бренд на процент; акционные цены не трогаются"],
  ["цена Brabus по формуле", "исправить всё, что последняя проверка нашла не по формуле"],
  ["V167-678-63 · наличие …", "карточка: наша цена, поставщик, наличие, вес, конкуренты"],
  [
    "Excel / CSV в чат",
    "прайс: Dinan и APR — по формуле Ігоря; другие — по правилу бренда или с подписью «+10%»",
  ],
];

/** The bot's price commands, for owners. */
function CommandsHelp() {
  return (
    <div className="max-w-[560px] border border-white/10 bg-[#171717] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <MessageSquareText className="h-4 w-4 text-blue-400" />
        Команды в чате с ботом
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        {COMMANDS.map(([command, meaning]) => (
          <div key={command}>
            <dt className="font-mono text-[13px] text-zinc-100">{command}</dt>
            <dd className="text-zinc-500">{meaning}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 border-t border-white/10 pt-3 text-xs text-zinc-500">
        Менять цены могут только владельцы. Бот сначала показывает, что изменится, и ждёт
        «Применить»; отменить можно 30 минут.
      </p>
    </div>
  );
}

export function OpsPriceWatch({ overview }: { overview: PriceWatchOverview | null }) {
  const [preview, setPreview] = useState<"daily" | "weekly" | "reminders" | "examples">("daily");
  if (!overview) {
    return (
      <OpsSurface>
        <OpsPageHeader
          title="Цены поставщиков"
          description="Откуда берутся цены и что изменилось у поставщиков"
        />
        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <div className="border border-white/10 bg-[#171717] p-6 text-sm text-zinc-400">
            Проверок ещё не было. Первая пройдёт в течение часа после включения — затем здесь
            появятся цены всех источников.
          </div>
        </div>
      </OpsSurface>
    );
  }
  const nowIso = overview.generatedAt;
  const attention = overview.sources.filter(
    (source) =>
      source.status === "error" ||
      Boolean(source.run?.summary.notice) ||
      (source.run?.status !== "baseline" && (source.run?.findingsCount ?? 0) > 0) ||
      source.priceList?.overdue
  );
  const rank = (source: PriceWatchOverviewSource) => {
    const tone = displayStatus(source).tone;
    return tone === "red" ? 0 : tone === "amber" ? 1 : 2;
  };
  attention.sort((left, right) => rank(left) - rank(right));
  const fx = overview.fx;
  const tiles = [
    {
      label: "Под контролем",
      value: `${formatPriceWatchNumber(overview.totals.productsWatched, 0)}`,
      hint: `из ${formatPriceWatchNumber(overview.totals.products, 0)} товаров`,
      icon: Radar,
    },
    {
      label: "Отличий найдено",
      value: formatPriceWatchNumber(overview.totals.findings, 0),
      hint: "с формулой или у поставщика",
      icon: AlertTriangle,
    },
    {
      label: "Прайсы к обновлению",
      value: String(overview.totals.priceListsDue),
      hint: "PDF, Excel и CSV",
      icon: FileSpreadsheet,
    },
    {
      label: "Ошибки проверки",
      value: String(overview.totals.errors),
      hint: "сайт не ответил или изменился",
      icon: ShieldAlert,
    },
    {
      label: "Нет у производителя",
      value: formatPriceWatchNumber(overview.totals.outOfStock, 0),
      hint: "наличие у поставщиков, только для нас",
      icon: PackageX,
    },
    {
      label: "Вес известен",
      value: formatPriceWatchNumber(overview.totals.withWeight, 0),
      hint: overview.totals.withSize
        ? `размеры коробки: ${formatPriceWatchNumber(overview.totals.withSize, 0)} — для доставки`
        : "для будущего расчёта доставки",
      icon: Scale,
    },
    {
      label: "Новое у поставщиков",
      value: formatPriceWatchNumber(overview.totals.newItems, 0),
      hint: "за неделю, нет на сайте",
      icon: Sparkles,
    },
    {
      label: "GBP/USD по НБУ",
      value: fx ? formatPriceWatchNumber(fx.gbpUsd, 3) : "—",
      hint: fx
        ? fx.formulas
            .map(
              (entry) =>
                `${entry.source.split(" ")[0]} ${formatPriceWatchNumber(entry.gbpUsd, 3)} (${formatPriceWatchPercent(entry.driftPct)})`
            )
            .join(" · ")
        : "курс ещё не проверялся",
      icon: PoundSterling,
    },
  ];
  const previews: Record<
    typeof preview,
    Array<{ key: string; label?: string; html: string; buttons: string[][] }>
  > = {
    daily: overview.preview.daily
      ? [
          {
            key: "daily",
            html: overview.preview.daily,
            buttons: [["📊 Открыть «Цены»"], ["📋 Создать задачу"]],
          },
        ]
      : [],
    weekly: [
      {
        key: "weekly",
        html: overview.preview.weekly,
        buttons: [["📊 Открыть «Цены»"], ["📋 Создать задачу"]],
      },
    ],
    reminders: overview.preview.reminders.map((reminder) => ({
      key: reminder.key,
      html: reminder.text,
      buttons: [
        ["✅ Прайс актуален", "⏰ Через неделю"],
        ["📋 Создать задачу"],
        ["📊 Открыть «Цены»"],
      ],
    })),
    examples: (overview.preview.examples ?? []).map((example) => ({
      key: example.key,
      label: example.label,
      html: example.html,
      buttons: example.buttons,
    })),
  };
  const tabs: Array<[typeof preview, string]> = [
    ["daily", "Ежедневное"],
    ["weekly", "Обзор недели"],
    ["reminders", `Напоминания (${previews.reminders.length})`],
    ...(previews.examples.length
      ? [["examples", "Ответы на команды"] as [typeof preview, string]]
      : []),
  ];
  return (
    <OpsSurface>
      <OpsPageHeader
        title="Цены поставщиков"
        description="Откуда берутся цены на сайте, что изменилось у поставщиков и когда обновлять прайсы"
        actions={
          <>
            {overview.demo ? (
              <span className="border border-amber-400/40 px-2 py-1 text-xs font-semibold text-amber-300">
                Пробная проверка · ничего не записано
              </span>
            ) : null}
            <span className="text-xs text-zinc-500">
              Данные на {dateTime.format(new Date(overview.generatedAt))}
            </span>
          </>
        }
      />
      <div className="mx-auto max-w-[1500px] space-y-8 p-4 pb-28 sm:p-6 lg:p-8">
        <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:grid-cols-4">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <div key={tile.label} className="bg-[#171717] p-4">
                <Icon className="h-4 w-4 text-blue-400" />
                <div className="mt-3 text-2xl font-bold text-zinc-50">{tile.value}</div>
                <div className="mt-0.5 text-xs text-zinc-400">{tile.label}</div>
                <div className="mt-1 text-[11px] text-zinc-600">{tile.hint}</div>
              </div>
            );
          })}
        </div>

        {attention.length ? (
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
              Требует внимания
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {attention.map((source) => (
                <AttentionCard key={source.key} source={source} nowIso={nowIso} />
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
            Все источники цен
          </h2>
          <div className="hidden border border-white/10 bg-[#171717] lg:block">
            <div className="grid grid-cols-[minmax(170px,1.2fr)_minmax(140px,1fr)_minmax(170px,1.1fr)_minmax(150px,1fr)_110px_160px] gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
              <span>Бренд</span>
              <span>Откуда цена</span>
              <span>Как проверяем</span>
              <span>Товаров · у поставщика</span>
              <span>Проверено</span>
              <span>Статус</span>
            </div>
            {overview.sources.map((source) => (
              <div
                key={source.key}
                className="grid grid-cols-[minmax(170px,1.2fr)_minmax(140px,1fr)_minmax(170px,1.1fr)_minmax(150px,1fr)_110px_160px] items-center gap-4 border-b border-white/5 px-4 py-3 text-sm last:border-0"
              >
                <span>
                  <span className="block font-bold text-zinc-50">{source.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500" title={source.formula}>
                    <span className="line-clamp-1">{source.formula}</span>
                  </span>
                </span>
                <span className="text-zinc-400">
                  <SupplierLink url={source.url}>{source.site}</SupplierLink>
                </span>
                <span className="text-zinc-400">
                  {howChecked(source)}
                  {source.note ? (
                    <span className="block text-xs text-zinc-600">{source.note}</span>
                  ) : null}
                  {source.priceList ? (
                    <span className="block text-xs text-zinc-600">
                      прайс от {dateOnly.format(new Date(source.priceList.date))}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-zinc-300">
                  {formatPriceWatchNumber(source.products, 0)}
                  <SourceFacts source={source} />
                </span>
                <span className="text-xs text-zinc-500">
                  {source.kind === "planned" || (source.kind === "price_list" && !source.everyHours)
                    ? "—"
                    : ago(source.lastFinishedAt, nowIso)}
                </span>
                <StatusBadge source={source} />
              </div>
            ))}
          </div>
          <div className="space-y-2 lg:hidden">
            {overview.sources.map((source) => (
              <div key={source.key} className="border border-white/10 bg-[#171717] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-zinc-50">{source.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      <SupplierLink url={source.url}>{source.site}</SupplierLink> ·{" "}
                      {formatPriceWatchNumber(source.products, 0)} товаров
                    </div>
                  </div>
                  <StatusBadge source={source} />
                </div>
                <div className="mt-2 text-xs text-zinc-400">{howChecked(source)}</div>
                <SourceFacts source={source} className="mt-1" />
              </div>
            ))}
          </div>
        </div>

        <NewItems items={overview.newItems ?? []} />

        <RecentChanges changes={overview.changes ?? []} nowIso={nowIso} />

        <div>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-zinc-500">
            Как это пишет бот
          </h2>
          <p className="mb-3 text-sm text-zinc-500">
            @OneCompanyOpenClawBot пишет владельцам в 10:00 только когда есть новое; по
            понедельникам — обзор всех источников. Напоминание о прайсе — в день срока и ещё раз
            через неделю.
          </p>
          <div className="mb-4 flex gap-2 overflow-x-auto">
            {tabs.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPreview(value)}
                className={cn(
                  "h-10 shrink-0 border px-3 text-sm font-semibold",
                  preview === value
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-white/10 bg-[#171717] text-zinc-400"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              {previews[preview].length ? (
                previews[preview].map((message) => (
                  <div key={message.key} className="min-w-0">
                    {message.label ? (
                      <div className="mb-1.5 text-xs font-semibold text-zinc-500">
                        {message.label}
                      </div>
                    ) : null}
                    <TelegramPreview html={message.html} buttons={message.buttons} />
                  </div>
                ))
              ) : (
                <div className="max-w-[560px] border border-white/10 bg-[#171717] p-4 text-sm text-zinc-400">
                  {preview === "daily"
                    ? "Сегодня бот промолчит: новых изменений нет."
                    : "Сейчас ни один прайс не ждёт обновления."}
                </div>
              )}
            </div>
            <CommandsHelp />
          </div>
        </div>
      </div>
    </OpsSurface>
  );
}
