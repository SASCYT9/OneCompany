/**
 * QA: assemble final PDF report from all artifacts collected.
 * Output: artifacts/qa-2026-05-13/report/OneCompany_QA_Report_2026-05-13.pdf
 */
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  Image,
  renderToFile,
  Font,
} from "@react-pdf/renderer";
import * as React from "react";
import { promises as fs } from "fs";
import path from "path";

// Register Windows system fonts with full Cyrillic coverage. Built-in Helvetica
// in @react-pdf has no Cyrillic glyphs — UA text would otherwise render as garbage.
Font.register({
  family: "Arial",
  fonts: [
    { src: "C:/Windows/Fonts/arial.ttf" },
    { src: "C:/Windows/Fonts/arialbd.ttf", fontWeight: 700 },
  ],
});
Font.register({
  family: "Courier",
  fonts: [{ src: "C:/Windows/Fonts/cour.ttf" }],
});

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "artifacts/qa-2026-05-13/data");
const SHOTS_DIR = path.join(ROOT, "artifacts/qa-2026-05-13/screenshots");
const REPORT_DIR = path.join(ROOT, "artifacts/qa-2026-05-13/report");
const OUT = path.join(REPORT_DIR, "OneCompany_QA_Report_2026-05-13.pdf");

interface SpotcheckRow {
  store: string;
  source: string;
  productId: string;
  sku: string;
  slug: string;
  url: string;
  titleUa: string;
  titleEn: string;
  hasShortDescUa: boolean;
  hasShortDescEn: boolean;
  hasLongOrBodyUa: boolean;
  hasLongOrBodyEn: boolean;
  priceEur: number | null;
  priceUah: number | null;
  hasImage: boolean;
  imageCount: number;
  httpStatus: number | null;
  htmlHasTitle: boolean | null;
  htmlHasPrice: boolean | null;
  pass: boolean;
  issues: { field: string; detail: string }[];
}

interface ColorFinding {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
  severity: "high" | "medium" | "low";
}

interface VisualIssue {
  route: string;
  theme: string;
  viewport: string;
  type: string;
  detail: string;
}

interface PriceCompareRow {
  brand: string;
  sku: string;
  slug: string;
  title: string;
  ourPriceUsd: number | null;
  ourPriceEur: number | null;
  sourceUrl: string;
  sourcePriceRaw: string | null;
  sourcePriceNum: number | null;
  sourceCurrency: string | null;
  matchOk: boolean;
  deltaPct: number | null;
  status:
    | "compared"
    | "invalid-match"
    | "no-public-price"
    | "no-match"
    | "fetch-error"
    | "product-not-found";
  note: string;
}

interface GlobalHealth {
  generatedAt: string;
  totalActivePublished: number;
  missingUaTitle: number;
  missingEnTitle: number;
  noUaDescription: number;
  noEnDescription: number;
  noImage: number;
  noPositivePrice: number;
  duplicateSkuGroups: number;
  duplicateSkuTotal: number;
  byBrand: { brand: string | null; count: number }[];
  noUaDescByBrand: Record<string, number>;
  noEnDescByBrand: Record<string, number>;
  samples: {
    missingUaTitle: { id: string; sku: string | null; brand: string | null; slug: string }[];
    missingEnTitle: { id: string; sku: string | null; brand: string | null; slug: string }[];
    noImage: { id: string; sku: string | null; brand: string | null; slug: string }[];
    noPrice: { id: string; sku: string | null; brand: string | null }[];
    duplicateSkus: { sku: string | null; count: number }[];
  };
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Arial", color: "#1a1a1a" },
  cover: { padding: 60, justifyContent: "center" },
  coverTitle: { fontSize: 28, fontWeight: 700, marginBottom: 14, color: "#0c0c0c" },
  coverSub: { fontSize: 14, marginBottom: 6, color: "#444" },
  coverMeta: { fontSize: 10, color: "#666", marginTop: 24 },
  accent: { color: "#d5001c" },
  h1: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 10,
    marginTop: 8,
    color: "#0c0c0c",
    borderBottom: 1,
    borderBottomColor: "#d5001c",
    paddingBottom: 4,
  },
  h2: { fontSize: 13, fontWeight: 700, marginTop: 14, marginBottom: 6, color: "#1a1a1a" },
  p: { fontSize: 9, lineHeight: 1.45, marginBottom: 6 },
  smallMono: { fontSize: 7.5, fontFamily: "Courier", color: "#333" },
  table: { width: "100%", marginTop: 6, marginBottom: 8 },
  thead: { flexDirection: "row", backgroundColor: "#141414", color: "#fff", padding: 4 },
  tr: { flexDirection: "row", borderBottom: 0.5, borderBottomColor: "#bbb", padding: 3 },
  trAlt: {
    flexDirection: "row",
    borderBottom: 0.5,
    borderBottomColor: "#bbb",
    padding: 3,
    backgroundColor: "#f4f3f0",
  },
  th: { fontSize: 8, fontWeight: 700, color: "#fff" },
  td: { fontSize: 8, color: "#222" },
  pillPass: {
    backgroundColor: "#1e7e34",
    color: "#fff",
    paddingVertical: 1,
    paddingHorizontal: 4,
    fontSize: 7,
    borderRadius: 2,
  },
  pillFail: {
    backgroundColor: "#c62828",
    color: "#fff",
    paddingVertical: 1,
    paddingHorizontal: 4,
    fontSize: 7,
    borderRadius: 2,
  },
  pillWarn: {
    backgroundColor: "#f9a825",
    color: "#000",
    paddingVertical: 1,
    paddingHorizontal: 4,
    fontSize: 7,
    borderRadius: 2,
  },
  kpi: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  kpiCard: {
    width: "32%",
    padding: 8,
    marginRight: "1%",
    marginBottom: 6,
    border: 1,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
  },
  kpiNum: { fontSize: 20, fontWeight: 700, color: "#0c0c0c" },
  kpiLabel: { fontSize: 8, color: "#666", marginTop: 2 },
  statusRow: { flexDirection: "row", marginBottom: 4, alignItems: "center" },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  finding: { borderLeft: 3, borderLeftColor: "#d5001c", paddingLeft: 6, marginBottom: 8 },
  findingTitle: { fontSize: 10, fontWeight: 700 },
  shotRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  shotBox: { width: "48%", marginRight: "2%", marginBottom: 8 },
  shotImg: { width: "100%", height: 220, objectFit: "cover", objectPositionY: 0 },
  shotCaption: { fontSize: 7, color: "#666", marginTop: 1 },
});

function Pill({ ok }: { ok: boolean }) {
  return <Text style={ok ? styles.pillPass : styles.pillFail}>{ok ? "PASS" : "FAIL"}</Text>;
}

function StatusLine({ label, color, note }: { label: string; color: string; note: string }) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={{ fontSize: 10, fontWeight: 700, width: 180 }}>{label}</Text>
      <Text style={{ fontSize: 9, color: "#444", flex: 1 }}>{note}</Text>
    </View>
  );
}

async function loadJson<T>(p: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

(async () => {
  await fs.mkdir(REPORT_DIR, { recursive: true });

  const spot: SpotcheckRow[] = await loadJson(path.join(DATA_DIR, "product-spotcheck.json"), []);
  const colors: ColorFinding[] = await loadJson(path.join(DATA_DIR, "hardcoded-colors.json"), []);
  const visual: VisualIssue[] = await loadJson(path.join(DATA_DIR, "visual-issues.json"), []);
  const priceCompare: PriceCompareRow[] = await loadJson(
    path.join(DATA_DIR, "price-comparison.json"),
    []
  );
  const health: GlobalHealth = await loadJson(path.join(DATA_DIR, "global-health.json"), {
    generatedAt: "",
    totalActivePublished: 0,
    missingUaTitle: 0,
    missingEnTitle: 0,
    noUaDescription: 0,
    noEnDescription: 0,
    noImage: 0,
    noPositivePrice: 0,
    duplicateSkuGroups: 0,
    duplicateSkuTotal: 0,
    byBrand: [],
    noUaDescByBrand: {},
    noEnDescByBrand: {},
    samples: {
      missingUaTitle: [],
      missingEnTitle: [],
      noImage: [],
      noPrice: [],
      duplicateSkus: [],
    },
  });

  const spotPass = spot.filter((s) => s.pass).length;
  const spotFail = spot.length - spotPass;
  const spotFailures = spot.filter((s) => !s.pass);

  // visual issue groupings
  const visualByType: Record<string, number> = {};
  for (const v of visual) visualByType[v.type] = (visualByType[v.type] ?? 0) + 1;

  const visualByRouteTheme: Record<string, VisualIssue[]> = {};
  for (const v of visual) {
    const k = `${v.route}::${v.theme}`;
    (visualByRouteTheme[k] ??= []).push(v);
  }

  // light traffic-light verdicts
  const lightVerdict = (
    n: number,
    warnAt: number,
    failAt: number
  ): { color: string; label: string } => {
    if (n >= failAt) return { color: "#c62828", label: `${n} issues` };
    if (n >= warnAt) return { color: "#f9a825", label: `${n} issues` };
    return { color: "#1e7e34", label: `${n} issues` };
  };

  const themeLightIssues = visual.filter(
    (v) =>
      v.theme === "light" &&
      (v.type === "invisible-text" ||
        v.type === "page-error" ||
        v.type === "console-error" ||
        v.type === "http-error")
  ).length;
  const themeDarkIssues = visual.filter(
    (v) =>
      v.theme === "dark" &&
      (v.type === "invisible-text" ||
        v.type === "page-error" ||
        v.type === "console-error" ||
        v.type === "http-error")
  ).length;

  // pick noteworthy screenshots to embed: pages with issues — prioritize invisible-text, then page-error
  const interestingRouteThemes: Array<{
    route: string;
    theme: string;
    viewport: string;
    reason: string;
  }> = [];
  const seen = new Set<string>();
  for (const v of visual) {
    if (v.type !== "invisible-text" && v.type !== "page-error" && v.type !== "http-error") continue;
    const key = `${v.route}::${v.theme}::desktop`;
    if (seen.has(key)) continue;
    seen.add(key);
    interestingRouteThemes.push({
      route: v.route,
      theme: v.theme,
      viewport: "desktop",
      reason: v.type,
    });
    if (interestingRouteThemes.length >= 6) break;
  }

  // resolve screenshot paths
  function shotPath(route: string, theme: string, viewport: string): string {
    const safe = (s: string) =>
      s
        .replace(/[/?]/g, "_")
        .replace(/__+/g, "_")
        .replace(/^_+|_+$/g, "");
    return path.join(SHOTS_DIR, `${safe(route || "root")}__${theme}__${viewport}.png`);
  }

  // sample baseline shots for cover + theme overview (home page both themes)
  const baselineShots: Array<{ route: string; theme: string; viewport: string }> = [
    { route: "/ua", theme: "light", viewport: "desktop" },
    { route: "/ua", theme: "dark", viewport: "desktop" },
    { route: "/ua/shop", theme: "light", viewport: "desktop" },
    { route: "/ua/shop", theme: "dark", viewport: "desktop" },
  ];

  async function loadShot(p: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(p);
    } catch {
      return null;
    }
  }

  const baselineLoaded: Array<{ route: string; theme: string; viewport: string; buf: Buffer }> = [];
  for (const s of baselineShots) {
    const buf = await loadShot(shotPath(s.route, s.theme, s.viewport));
    if (buf) baselineLoaded.push({ ...s, buf });
  }
  const interestingLoaded: Array<{
    route: string;
    theme: string;
    viewport: string;
    reason: string;
    buf: Buffer;
  }> = [];
  for (const s of interestingRouteThemes) {
    const buf = await loadShot(shotPath(s.route, s.theme, s.viewport));
    if (buf) interestingLoaded.push({ ...s, buf });
  }
  // suppress unused-var warnings if compile is strict
  void fileExists;

  const Doc = (
    <Document title="OneCompany QA Report — 2026-05-13" author="Claude QA Sweep">
      {/* COVER */}
      <Page size="A4" style={styles.cover}>
        <Text style={styles.coverTitle}>OneCompany — QA Report</Text>
        <Text style={styles.coverSub}>Перевірка після оновлення тем + спот-чек товарів</Text>
        <Text style={styles.coverSub}>
          Гілка: <Text style={styles.accent}>feature/light-theme</Text>
        </Text>
        <Text style={styles.coverMeta}>Дата звіту: 2026-05-13</Text>
        <Text style={styles.coverMeta}>База: db.prisma.io (shared) — read-only</Text>
        <Text style={styles.coverMeta}>
          Покриття: 24 theme-aware маршрути × 2 теми × 2 viewport + 12 brand-shop sanity
        </Text>
        <Text style={styles.coverMeta}>Спот-чек товарів: 5 × 12 магазинів = 60 SKU</Text>
        <Text style={styles.coverMeta}>
          Глобальне здоров'я каталогу: всі {health.totalActivePublished} ACTIVE+published
        </Text>
      </Page>

      {/* EXEC SUMMARY */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>1. Executive Summary</Text>
        <Text style={styles.p}>
          Зведений світлофор по областях. Деталі — у відповідних розділах нижче.
        </Text>

        <StatusLine
          label="Світла тема (light)"
          {...(themeLightIssues === 0
            ? { color: "#1e7e34", note: "Без виявлених проблем у Playwright-проганянні" }
            : themeLightIssues < 10
              ? {
                  color: "#f9a825",
                  note: `${themeLightIssues} зауважень (console/page/http/invisible-text)`,
                }
              : {
                  color: "#c62828",
                  note: `${themeLightIssues} проблем — потрібен ретельний review`,
                })}
        />
        <StatusLine
          label="Темна тема (dark)"
          {...(themeDarkIssues === 0
            ? { color: "#1e7e34", note: "Без виявлених проблем" }
            : themeDarkIssues < 10
              ? { color: "#f9a825", note: `${themeDarkIssues} зауважень` }
              : { color: "#c62828", note: `${themeDarkIssues} проблем` })}
        />
        <StatusLine
          label="Hardcoded кольори (theme-aware)"
          {...lightVerdict(colors.filter((c) => c.severity === "high").length, 5, 50)}
        />
        <StatusLine
          label="Спот-чек товарів (60 SKU)"
          {...(spotFail === 0
            ? { color: "#1e7e34", note: "Усі 60 пройшли" }
            : spotFail < 10
              ? { color: "#f9a825", note: `${spotFail}/60 невдалих` }
              : { color: "#c62828", note: `${spotFail}/60 невдалих — серйозно` })}
        />
        <StatusLine
          label="Глобальне здоров'я каталогу"
          {...(health.duplicateSkuGroups + health.noImage + health.noPositivePrice < 20
            ? { color: "#1e7e34", note: "Невелика частка проблем" }
            : {
                color: "#c62828",
                note: `${health.duplicateSkuGroups} груп дубль-SKU; ${health.noImage} без фото; ${health.noPositivePrice} без ціни`,
              })}
        />

        <Text style={styles.h2}>Ключові KPI</Text>
        <View style={styles.kpi}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{health.totalActivePublished}</Text>
            <Text style={styles.kpiLabel}>ACTIVE + published товарів</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{spotPass}/60</Text>
            <Text style={styles.kpiLabel}>Pass у спот-чеку</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{visual.length}</Text>
            <Text style={styles.kpiLabel}>Visual issues (Playwright)</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{colors.filter((c) => c.severity === "high").length}</Text>
            <Text style={styles.kpiLabel}>Hardcoded high-severity</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{health.noUaDescription}</Text>
            <Text style={styles.kpiLabel}>Без UA-опису</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{health.noImage}</Text>
            <Text style={styles.kpiLabel}>Без жодного фото</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{health.duplicateSkuGroups}</Text>
            <Text style={styles.kpiLabel}>Груп дубль-SKU</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{health.duplicateSkuTotal}</Text>
            <Text style={styles.kpiLabel}>Товарів у дубль-SKU групах</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiNum}>{health.noPositivePrice}</Text>
            <Text style={styles.kpiLabel}>Без позитивної ціни</Text>
          </View>
        </View>

        {baselineLoaded.length > 0 && (
          <>
            <Text style={styles.h2}>Baseline: головна + /shop у двох темах</Text>
            <View style={styles.shotRow}>
              {baselineLoaded.map((s, i) => (
                <View key={i} style={styles.shotBox}>
                  <Image style={styles.shotImg} src={s.buf} />
                  <Text style={styles.shotCaption}>
                    {s.route} · {s.theme} · {s.viewport}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Page>

      {/* VISUAL ISSUES */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>2. Visual / Console Issues</Text>
        <Text style={styles.p}>
          Зведення зауважень з Playwright-проганяння theme-aware маршрутів.
        </Text>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { width: "40%" }]}>Тип</Text>
            <Text style={[styles.th, { width: "60%" }]}>Кількість</Text>
          </View>
          {Object.entries(visualByType).map(([t, c], i) => (
            <View key={t} style={i % 2 ? styles.trAlt : styles.tr}>
              <Text style={[styles.td, { width: "40%" }]}>{t}</Text>
              <Text style={[styles.td, { width: "60%" }]}>{c}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Топ маршрутів з зауваженнями</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { width: "45%" }]}>Route</Text>
            <Text style={[styles.th, { width: "15%" }]}>Theme</Text>
            <Text style={[styles.th, { width: "40%" }]}>Зауваження</Text>
          </View>
          {Object.entries(visualByRouteTheme)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 20)
            .map(([key, arr], i) => {
              const [route, theme] = key.split("::");
              const types = Array.from(new Set(arr.map((a) => a.type))).join(", ");
              return (
                <View key={key} style={i % 2 ? styles.trAlt : styles.tr}>
                  <Text style={[styles.td, { width: "45%" }]}>{route}</Text>
                  <Text style={[styles.td, { width: "15%" }]}>{theme}</Text>
                  <Text style={[styles.td, { width: "40%" }]}>
                    {arr.length} ({types})
                  </Text>
                </View>
              );
            })}
        </View>

        {interestingLoaded.length > 0 && (
          <>
            <Text style={styles.h2}>Скріни проблемних сторінок</Text>
            <View style={styles.shotRow}>
              {interestingLoaded.slice(0, 6).map((s, i) => (
                <View key={i} style={styles.shotBox}>
                  <Image style={styles.shotImg} src={s.buf} />
                  <Text style={styles.shotCaption}>
                    {s.route} · {s.theme} — {s.reason}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {visual.filter((v) => v.type === "invisible-text").length > 0 && (
          <>
            <Text style={styles.h2}>Низький контраст (invisible-text)</Text>
            <Text style={styles.p}>
              Текст, де контраст з фоном &lt; 2.0 (WCAG AA вимагає 4.5). Топ-10:
            </Text>
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { width: "32%" }]}>Route</Text>
                <Text style={[styles.th, { width: "12%" }]}>Theme</Text>
                <Text style={[styles.th, { width: "56%" }]}>Деталь</Text>
              </View>
              {visual
                .filter((v) => v.type === "invisible-text")
                .slice(0, 10)
                .map((v, i) => (
                  <View key={i} style={i % 2 ? styles.trAlt : styles.tr}>
                    <Text style={[styles.td, { width: "32%" }]}>{v.route}</Text>
                    <Text style={[styles.td, { width: "12%" }]}>{v.theme}</Text>
                    <Text style={[styles.td, { width: "56%" }]}>{v.detail.slice(0, 140)}</Text>
                  </View>
                ))}
            </View>
          </>
        )}
      </Page>

      {/* HARDCODED COLORS */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>3. Hardcoded Color Tokens</Text>
        <Text style={styles.p}>
          Файли з hex/rgb/hsl кольорами поза токенами {`{`}--background, --foreground, --primary...
          {`}`}. Виключено: /admin, brand-shop підкаталоги, email/PDF шаблони, forged-мікросайт,
          /shop/components (always-dark). Усього:{" "}
          <Text style={{ fontWeight: 700 }}>{colors.length}</Text> входжень (HIGH:{" "}
          {colors.filter((c) => c.severity === "high").length}, MED:{" "}
          {colors.filter((c) => c.severity === "medium").length}).
        </Text>

        <Text style={styles.h2}>Топ-20 файлів за кількістю</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { width: "70%" }]}>Файл</Text>
            <Text style={[styles.th, { width: "15%" }]}>HIGH</Text>
            <Text style={[styles.th, { width: "15%" }]}>MED</Text>
          </View>
          {(() => {
            const byFile: Record<string, { high: number; med: number }> = {};
            for (const f of colors) {
              byFile[f.file] ??= { high: 0, med: 0 };
              if (f.severity === "high") byFile[f.file].high++;
              else byFile[f.file].med++;
            }
            return Object.entries(byFile)
              .sort((a, b) => b[1].high * 10 + b[1].med - (a[1].high * 10 + a[1].med))
              .slice(0, 20)
              .map(([file, stats], i) => (
                <View key={file} style={i % 2 ? styles.trAlt : styles.tr}>
                  <Text style={[styles.td, styles.smallMono, { width: "70%" }]}>{file}</Text>
                  <Text style={[styles.td, { width: "15%" }]}>{stats.high}</Text>
                  <Text style={[styles.td, { width: "15%" }]}>{stats.med}</Text>
                </View>
              ));
          })()}
        </View>

        <Text style={styles.h2}>Приклади HIGH-severity (white/black hardcode)</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { width: "50%" }]}>Файл:рядок</Text>
            <Text style={[styles.th, { width: "15%" }]}>Pattern</Text>
            <Text style={[styles.th, { width: "35%" }]}>Snippet</Text>
          </View>
          {colors
            .filter((c) => c.severity === "high")
            .slice(0, 15)
            .map((c, i) => (
              <View key={i} style={i % 2 ? styles.trAlt : styles.tr}>
                <Text style={[styles.td, styles.smallMono, { width: "50%" }]}>
                  {c.file}:{c.line}
                </Text>
                <Text style={[styles.td, styles.smallMono, { width: "15%" }]}>{c.pattern}</Text>
                <Text style={[styles.td, styles.smallMono, { width: "35%" }]}>
                  {c.snippet.slice(0, 80)}
                </Text>
              </View>
            ))}
        </View>
      </Page>

      {/* PRODUCT SPOT-CHECK */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>4. Спот-чек товарів (60 SKU)</Text>
        <Text style={styles.p}>
          По 5 випадкових ACTIVE+published товарів на кожен з 12 магазинів (seed=20260513).
          Перевіряємо: title (UA+EN), опис (UA+EN), ціна &gt; 0 (EUR/UAH/USD), фото є, публічна
          сторінка повертає HTTP 200 і містить назву.
        </Text>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { width: "14%" }]}>Магазин</Text>
            <Text style={[styles.th, { width: "24%" }]}>SKU</Text>
            <Text style={[styles.th, { width: "40%" }]}>Title</Text>
            <Text style={[styles.th, { width: "8%" }]}>Price</Text>
            <Text style={[styles.th, { width: "6%" }]}>Img</Text>
            <Text style={[styles.th, { width: "8%" }]}>Result</Text>
          </View>
          {spot.map((r, i) => (
            <View key={r.productId} style={i % 2 ? styles.trAlt : styles.tr}>
              <Text style={[styles.td, { width: "14%" }]}>{r.store}</Text>
              <Text style={[styles.td, styles.smallMono, { width: "24%" }]}>
                {r.sku || r.slug.slice(0, 22)}
              </Text>
              <Text style={[styles.td, { width: "40%" }]}>
                {(r.titleUa || r.titleEn).slice(0, 50)}
              </Text>
              <Text style={[styles.td, { width: "8%" }]}>
                {r.priceEur ? `€${r.priceEur}` : r.priceUah ? `₴${r.priceUah}` : "—"}
              </Text>
              <Text style={[styles.td, { width: "6%" }]}>{r.imageCount}</Text>
              <View style={{ width: "8%" }}>
                <Pill ok={r.pass} />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Деталі невдалих ({spotFailures.length})</Text>
        {spotFailures.map((r) => (
          <View key={r.productId} style={styles.finding}>
            <Text style={styles.findingTitle}>
              {r.store} · {r.sku || r.slug}
            </Text>
            <Text style={styles.smallMono}>{r.url}</Text>
            <Text style={styles.smallMono}>Title UA: "{(r.titleUa || "—").slice(0, 80)}"</Text>
            {r.issues.map((iss, idx) => (
              <Text key={idx} style={[styles.smallMono, { color: "#c62828" }]}>
                • {iss.field}: {iss.detail}
              </Text>
            ))}
          </View>
        ))}
      </Page>

      {/* GLOBAL HEALTH */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>5. Глобальне здоров'я каталогу</Text>
        <Text style={styles.p}>
          Read-only Prisma-запити по всіх ACTIVE+published товарах ({health.totalActivePublished}).
          Дата: {health.generatedAt}.
        </Text>

        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { width: "60%" }]}>Метрика</Text>
            <Text style={[styles.th, { width: "20%" }]}>Кількість</Text>
            <Text style={[styles.th, { width: "20%" }]}>% від total</Text>
          </View>
          {[
            { k: "Без UA title", v: health.missingUaTitle },
            { k: "Без EN title", v: health.missingEnTitle },
            { k: "Без UA опису (short/long/body все порожнє)", v: health.noUaDescription },
            { k: "Без EN опису", v: health.noEnDescription },
            { k: "Без жодного фото (media + image field)", v: health.noImage },
            { k: "Без позитивної ціни (EUR/UAH/USD)", v: health.noPositivePrice },
            { k: "Груп дубль-SKU (count > 1)", v: health.duplicateSkuGroups },
            { k: "Товарів у дубль-SKU групах", v: health.duplicateSkuTotal },
          ].map((row, i) => (
            <View key={row.k} style={i % 2 ? styles.trAlt : styles.tr}>
              <Text style={[styles.td, { width: "60%" }]}>{row.k}</Text>
              <Text style={[styles.td, { width: "20%" }]}>{row.v}</Text>
              <Text style={[styles.td, { width: "20%" }]}>
                {((row.v / Math.max(1, health.totalActivePublished)) * 100).toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Розподіл по брендах</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, { width: "50%" }]}>Brand</Text>
            <Text style={[styles.th, { width: "25%" }]}>Total ACTIVE</Text>
            <Text style={[styles.th, { width: "25%" }]}>Без UA опису</Text>
          </View>
          {health.byBrand.slice(0, 25).map((b, i) => (
            <View key={b.brand ?? `null-${i}`} style={i % 2 ? styles.trAlt : styles.tr}>
              <Text style={[styles.td, { width: "50%" }]}>{b.brand ?? "(no brand)"}</Text>
              <Text style={[styles.td, { width: "25%" }]}>{b.count}</Text>
              <Text style={[styles.td, { width: "25%" }]}>
                {health.noUaDescByBrand[b.brand ?? "(no brand)"] ?? 0}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Зразки проблем</Text>
        {health.samples.duplicateSkus.length > 0 && (
          <>
            <Text style={styles.p}>Top дубль-SKU (sku, count):</Text>
            {health.samples.duplicateSkus.map((d) => (
              <Text key={d.sku ?? ""} style={styles.smallMono}>
                {" "}
                · {d.sku ?? "(null)"} × {d.count}
              </Text>
            ))}
          </>
        )}
        {health.samples.noImage.length > 0 && (
          <>
            <Text style={[styles.p, { marginTop: 6 }]}>Без фото (10 із {health.noImage}):</Text>
            {health.samples.noImage.map((p) => (
              <Text key={p.id} style={styles.smallMono}>
                {" "}
                · [{p.brand ?? "?"}] {p.sku ?? p.slug}
              </Text>
            ))}
          </>
        )}
        {health.samples.noPrice.length > 0 && (
          <>
            <Text style={[styles.p, { marginTop: 6 }]}>Без ціни:</Text>
            {health.samples.noPrice.map((p) => (
              <Text key={p.id} style={styles.smallMono}>
                {" "}
                · [{p.brand ?? "?"}] {p.sku ?? p.id}
              </Text>
            ))}
          </>
        )}
      </Page>

      {/* PRICE COMPARISON */}
      {priceCompare.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.h1}>6. Порівняння цін з оригінальними сайтами</Text>
          <Text style={styles.p}>
            Спроба автоматичного порівняння цін наших товарів (60 SKU зі спот-чеку) з цінами на
            сайтах брендів-оригіналів через Playwright-scraping.{" "}
            <Text style={{ fontWeight: 700 }}>Підсумок: 0 надійних збігів.</Text> Причини детально
            нижче — це не баг каталогу, а структурне обмеження методу.
          </Text>

          <Text style={styles.h2}>Зведена таблиця статусів</Text>
          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={[styles.th, { width: "40%" }]}>Статус</Text>
              <Text style={[styles.th, { width: "15%" }]}>Кількість</Text>
              <Text style={[styles.th, { width: "45%" }]}>Що це означає</Text>
            </View>
            {(() => {
              const tally: Record<string, number> = {};
              for (const r of priceCompare) tally[r.status] = (tally[r.status] ?? 0) + 1;
              const legend: Record<string, string> = {
                compared: "Зіставлено з реальною ціною оригіналу",
                "invalid-match":
                  "Скрейпер потрапив на ту ж сторінку для різних SKU — несправжній збіг",
                "no-public-price": "Бренд не публікує ціни (quote-only через дилера)",
                "no-match": "Селектор ціни не знайдено",
                "fetch-error": "HTTP помилка, DNS не резолвиться, або анти-бот",
                "product-not-found": 'Пошук на сайті повернув "немає результатів"',
              };
              return Object.entries(tally).map(([k, v], i) => (
                <View key={k} style={i % 2 ? styles.trAlt : styles.tr}>
                  <Text style={[styles.td, { width: "40%" }]}>{k}</Text>
                  <Text style={[styles.td, { width: "15%" }]}>{v}</Text>
                  <Text style={[styles.td, { width: "45%" }]}>{legend[k] ?? "—"}</Text>
                </View>
              ));
            })()}
          </View>

          <Text style={styles.h2}>Причини невдач по брендах</Text>
          <View style={styles.table}>
            <View style={styles.thead}>
              <Text style={[styles.th, { width: "18%" }]}>Бренд</Text>
              <Text style={[styles.th, { width: "20%" }]}>Сайт</Text>
              <Text style={[styles.th, { width: "62%" }]}>Чому не вийшло</Text>
            </View>
            {[
              {
                b: "racechip",
                site: "racechip.de",
                why: "Cloudflare-захист — 403/404 на пошук без proper headers. Потрібна сесія з cookies або ручна перевірка.",
              },
              {
                b: "csf",
                site: "csfrace.com",
                why: "Пошук працює, але повертає першу-ліпшу картку для всіх SKU. Наші SKU (8132, 8260...) не мапляться на handle сайту.",
              },
              {
                b: "do88",
                site: "do88.se",
                why: "Невірний пошуковий URL-патерн — 404. Сайт використовує власний пошуковий ендпойнт.",
              },
              {
                b: "girodisc",
                site: "girodisc.com",
                why: "Magento-пошук відрізняється від використаного — 404 на /catalogsearch. Потрібна точна URL-структура.",
              },
              {
                b: "adro",
                site: "adrocarbon.com",
                why: "DNS не резолвиться з цієї машини — можливо бренд має інший домен (можливо adro.us або інший), або гео-блок.",
              },
              {
                b: "burger",
                site: "burgertuning.com",
                why: "Наші внутрішні SKU мають формат BURGER-<shopifyVariantId>, а на сайті інші артикули — пошук не знаходить.",
              },
              {
                b: "akrapovic",
                site: "akrapovic.com",
                why: "Без e-comm. Ціни — лише через авторизованих дилерів.",
              },
              {
                b: "brabus",
                site: "brabus.com",
                why: "Продаж тільки через Brabus Tuning Centers, ціни на запит.",
              },
              {
                b: "ohlins",
                site: "ohlins.com",
                why: "Інформаційний сайт. Ціни розрізняються по регіональних дистриб'юторах.",
              },
              {
                b: "ipe",
                site: "ipe-f1.com",
                why: "iPE Innotech продає через регіональних дилерів; на сайті — каталог без цін.",
              },
              {
                b: "urban",
                site: "urbanautomotive.eu",
                why: "Quote-only — Urban не публікує цін, лише форма запиту.",
              },
            ].map((r, i) => (
              <View key={r.b} style={i % 2 ? styles.trAlt : styles.tr}>
                <Text style={[styles.td, { width: "18%" }]}>{r.b}</Text>
                <Text style={[styles.td, styles.smallMono, { width: "20%" }]}>{r.site}</Text>
                <Text style={[styles.td, { width: "62%" }]}>{r.why}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.h2}>Що рекомендую замість автоматизації</Text>
          <Text style={styles.p}>
            • <Text style={{ fontWeight: 700 }}>Manual spot-check (1-2 товари на бренд)</Text> для
            brands з публічними цінами: CSF, Girodisc, DO88, RaceChip, ADRO, Burger. Відкрити SKU
            вручну на сайті оригіналу і порівняти.
          </Text>
          <Text style={styles.p}>
            • <Text style={{ fontWeight: 700 }}>Mapping table (SKU → brand-site-handle)</Text> —
            створити CSV-довідник у БД (`ShopProductMetafield`?) щоб майбутні автоматичні перевірки
            могли йти прямо на PDP.
          </Text>
          <Text style={styles.p}>
            • <Text style={{ fontWeight: 700 }}>B2B/quote-only бренди</Text> (Akrapovic, Brabus,
            Ohlins, iPE, Urban) — порівняння цін з джерелом неможливе by design. Перевіряти лише
            внутрішню консистентність (наша ціна = ціна на сторінці = ціна в чекауті).
          </Text>

          <Text style={styles.h2}>Артефакти спроби</Text>
          <Text style={styles.smallMono}>
            data/price-comparison.csv — 60 рядків з усіма деталями
          </Text>
          <Text style={styles.smallMono}>data/price-comparison.json — те ж, JSON</Text>
          <Text style={styles.smallMono}>
            source-screenshots/ — скріни сторінок-джерел (де вдалось дійти)
          </Text>
        </Page>
      )}

      {/* RECOMMENDATIONS */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>7. Рекомендації / Action items</Text>

        <Text style={styles.h2}>Пріоритет 1 (блокер — критичний)</Text>
        <View style={styles.finding}>
          <Text style={styles.findingTitle}>
            Дубль-SKU: {health.duplicateSkuGroups} груп / {health.duplicateSkuTotal} товарів
          </Text>
          <Text style={styles.p}>
            {((health.duplicateSkuTotal / Math.max(1, health.totalActivePublished)) * 100).toFixed(
              0
            )}
            % активного каталогу має SKU-колізію. Це впливає на синхронізацію з Turn14 / Airtable,
            фід Google Shopping, і може спричинити неправильну атрибуцію стоків. Запропоновано:
            запустити `scripts/audit-burger-dup-skus.ts` (вже існує) на повний каталог і визначити
            стратегію (a) перейменування дублікатів додаванням brand-префіксу, або (b) злиття
            реальних дублікатів.
          </Text>
        </View>

        {health.noImage > 0 && (
          <View style={styles.finding}>
            <Text style={styles.findingTitle}>
              Без фото: {health.noImage} товарів (
              {((health.noImage / health.totalActivePublished) * 100).toFixed(1)}%)
            </Text>
            <Text style={styles.p}>
              Перевірити Vercel Blob міграцію (`scripts/backfill-do88-missing-images.mjs` як
              шаблон). Для brand'ів з найбільшою часткою — додати скрипт fallback.
            </Text>
          </View>
        )}

        <Text style={styles.h2}>Пріоритет 2 (висока)</Text>
        {(() => {
          const ohlinsFails = spotFailures.filter((f) => f.store === "ohlins").length;
          const akrapovicFails = spotFailures.filter((f) => f.store === "akrapovic").length;
          const items: React.ReactNode[] = [];
          if (ohlinsFails >= 3)
            items.push(
              <View key="ohlins" style={styles.finding}>
                <Text style={styles.findingTitle}>
                  Ohlins: {ohlinsFails}/5 SKU без UA/EN описів
                </Text>
                <Text style={styles.p}>
                  Категорія `35020-*` (амортизатори) і `48000-*` особливо постраждали. Запустити
                  переклад через `npm run shop:translate-atomic-en:dry` + curate-фазу для UA.
                </Text>
              </View>
            );
          if (akrapovicFails >= 2)
            items.push(
              <View key="akrapovic" style={styles.finding}>
                <Text style={styles.findingTitle}>
                  Akrapovic: {akrapovicFails}/5 SKU з page-помилками
                </Text>
                <Text style={styles.p}>
                  Сторінки повертають проблемний HTML або 404 — перевірити маршрут
                  /shop/akrapovic/products/[slug] + i18n fallback.
                </Text>
              </View>
            );
          return items;
        })()}

        {colors.filter((c) => c.severity === "high").length > 30 && (
          <View style={styles.finding}>
            <Text style={styles.findingTitle}>Hardcoded white/black у theme-aware компонентах</Text>
            <Text style={styles.p}>
              {colors.filter((c) => c.severity === "high").length} HIGH-severity знахідок. Найбільші
              накопичувачі: Navigation, Header, OnePage, LandingPage, Footer — це global-компоненти,
              тому помилка тут проявляється на всіх сторінках. Рекомендую замінити на токени
              `text-foreground/bg-background/border-border`.
            </Text>
          </View>
        )}

        <Text style={styles.h2}>Пріоритет 3 (середній)</Text>
        {visualByType["invisible-text"] && visualByType["invisible-text"] > 0 && (
          <View style={styles.finding}>
            <Text style={styles.findingTitle}>
              Низький контраст: {visualByType["invisible-text"]} знахідок
            </Text>
            <Text style={styles.p}>
              Текст з контрастом &lt; 2.0 проти фону. WCAG AA вимагає 4.5 для body text. Перевірити
              opacity-bumps для світлої теми (per memory: світла потребує вищих opacity для
              відповідного контрасту).
            </Text>
          </View>
        )}
        {(visualByType["console-error"] || 0) > 0 && (
          <View style={styles.finding}>
            <Text style={styles.findingTitle}>
              JS console errors: {visualByType["console-error"]}
            </Text>
            <Text style={styles.p}>
              Деталі в `console-errors.csv`. Зазвичай не блокер, але важливо переглянути для
              уникнення регресій.
            </Text>
          </View>
        )}

        <Text style={styles.h2}>Що НЕ перевірялося (поза областю)</Text>
        <Text style={styles.p}>
          • `/admin` сторінки (за дизайном завжди-темні, виключені з theme-аудиту).
        </Text>
        <Text style={styles.p}>
          • Brand-shop сторінки glибше за головну (12 sanity скрінів — лише головна кожного бренду).
        </Text>
        <Text style={styles.p}>
          • Email/PDF шаблони (мають власну тему, не залежать від CSS-токенів).
        </Text>
        <Text style={styles.p}>• Виробничий сервер — усі перевірки на http://localhost:3000.</Text>

        <Text style={styles.h2}>Артефакти на диску</Text>
        <Text style={styles.smallMono}>artifacts/qa-2026-05-13/</Text>
        <Text style={styles.smallMono}> screenshots/ — {/* count */} PNG скрінів</Text>
        <Text style={styles.smallMono}> data/hardcoded-colors.csv + .json</Text>
        <Text style={styles.smallMono}> data/product-spotcheck.csv + .json</Text>
        <Text style={styles.smallMono}> data/visual-issues.json</Text>
        <Text style={styles.smallMono}> data/console-errors.csv</Text>
        <Text style={styles.smallMono}> data/global-health.json</Text>
        <Text style={styles.smallMono}>
          {" "}
          report/OneCompany_QA_Report_2026-05-13.pdf (this file)
        </Text>
      </Page>
    </Document>
  );

  await renderToFile(Doc, OUT);
  const stat = await fs.stat(OUT);
  console.log(`PDF written: ${OUT}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
})();
