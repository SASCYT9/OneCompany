import { promises as fs } from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import { categoryData } from "../src/lib/categoryData";
import { readSiteContent } from "../src/lib/siteContentServer";
import { siteConfig, type SupportedLocale } from "../src/lib/seo";
import {
  extractLocaleFromPath,
  getPeerLocalePath,
  indexablePatterns,
  isIndexablePath,
  isNoindexPath,
  localizedStaticSlugs,
  localeAgnosticPublicPrefixes,
  noindexPatterns,
  noindexPrefixes,
  normalizePathname,
  stripLocaleFromPath,
} from "../src/lib/seoIndexPolicy";

type CliOptions = {
  baseUrl: URL;
  locales: SupportedLocale[];
  maxDepth: number;
};

type HreflangMap = Record<string, string>;

type FetchedPage = {
  status: number;
  redirectTarget: string;
  canonical: string;
  hreflangMap: HreflangMap;
  xRobotsTag: string;
  metaRobots: string;
  outlinks: string[];
};

type AuditRow = {
  url: string;
  status: number;
  redirect_target: string;
  canonical: string;
  hreflang_map: HreflangMap;
  x_robots_tag: string;
  meta_robots: string;
  in_sitemap: boolean;
  inlink_count: number;
  is_orphan: boolean;
  duplicate_canonical_group: string;
};

type GateFailure = {
  rule: string;
  url: string;
  details: string;
};

const USER_AGENT = "OneCompanyStructureAuditBot/1.0 (+https://onecompany.global)";
const REPORT_DIR = path.join(process.cwd(), "reports");
const REPORT_JSON_PATH = path.join(REPORT_DIR, "seo-structure-report.json");
const REPORT_CSV_PATH = path.join(REPORT_DIR, "seo-structure-report.csv");

const CRAWL_SKIP_FILE_PATTERN = /\.[a-z0-9]{2,8}$/i;

function parseArgs(argv: string[]): CliOptions {
  const baseUrlRaw = getArgValue(argv, "--baseUrl") ?? siteConfig.url;
  const localesRaw = getArgValue(argv, "--locales") ?? siteConfig.locales.join(",");
  const maxDepthRaw = getArgValue(argv, "--maxDepth") ?? "4";

  const parsedBase = new URL(baseUrlRaw);
  const baseUrl = new URL(parsedBase.origin);

  const locales = localesRaw
    .split(",")
    .map((locale) => locale.trim())
    .filter((locale): locale is SupportedLocale =>
      siteConfig.locales.includes(locale as SupportedLocale)
    );

  if (locales.length === 0) {
    throw new Error(
      `No supported locales provided. Supported values: ${siteConfig.locales.join(", ")}`
    );
  }

  const maxDepth = Number.parseInt(maxDepthRaw, 10);
  if (!Number.isFinite(maxDepth) || maxDepth < 0) {
    throw new Error("--maxDepth must be a non-negative integer");
  }

  return {
    baseUrl,
    locales,
    maxDepth,
  };
}

function getArgValue(argv: string[], key: string): string | null {
  const inline = argv.find((arg) => arg.startsWith(`${key}=`));
  if (inline) {
    return inline.slice(key.length + 1);
  }

  const index = argv.findIndex((arg) => arg === key);
  if (index !== -1 && argv[index + 1]) {
    return argv[index + 1];
  }

  return null;
}

function normalizeAbsoluteUrl(raw: string, base: URL): string | null {
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    url.hash = "";
    url.search = "";
    url.pathname = normalizePathname(url.pathname);

    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function normalizeInternalUrl(raw: string, base: URL): string | null {
  const normalized = normalizeAbsoluteUrl(raw, base);
  if (!normalized) {
    return null;
  }

  const normalizedUrl = new URL(normalized);
  if (normalizedUrl.origin !== base.origin) {
    return null;
  }

  if (CRAWL_SKIP_FILE_PATTERN.test(normalizedUrl.pathname)) {
    return null;
  }

  return normalized;
}

function addInlink(inlinks: Map<string, Set<string>>, target: string, source: string): void {
  if (target === source) {
    return;
  }

  if (!inlinks.has(target)) {
    inlinks.set(target, new Set<string>());
  }

  inlinks.get(target)?.add(source);
}

async function fetchPage(url: string, base: URL): Promise<FetchedPage> {
  let status = 0;
  let redirectTarget = "";
  let canonical = "";
  let hreflangMap: HreflangMap = {};
  let xRobotsTag = "";
  let metaRobots = "";
  const outlinks = new Set<string>();

  try {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
      },
    });

    status = response.status;
    xRobotsTag = response.headers.get("x-robots-tag") ?? "";

    const location = response.headers.get("location");
    if (location) {
      redirectTarget = normalizeAbsoluteUrl(location, new URL(url)) ?? location;
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.includes("text/html")) {
      const html = await response.text();
      const $ = load(html);

      const canonicalHref = $('link[rel="canonical"]').first().attr("href");
      if (canonicalHref) {
        canonical = normalizeAbsoluteUrl(canonicalHref, new URL(url)) ?? canonicalHref;
      }

      $('link[rel="alternate"][hreflang]').each((_, element) => {
        const hreflang = ($(element).attr("hreflang") ?? "").trim().toLowerCase();
        const href = ($(element).attr("href") ?? "").trim();
        if (!hreflang || !href) {
          return;
        }

        const normalizedHref = normalizeAbsoluteUrl(href, new URL(url));
        if (normalizedHref) {
          hreflangMap[hreflang] = normalizedHref;
        }
      });

      const robotsMetaContent =
        $('meta[name="robots"]').first().attr("content") ??
        $('meta[name="googlebot"]').first().attr("content") ??
        "";
      metaRobots = robotsMetaContent.trim();

      $('a[href]').each((_, element) => {
        const href = ($(element).attr("href") ?? "").trim();
        if (!href) {
          return;
        }

        const normalized = normalizeInternalUrl(href, base);
        if (normalized) {
          outlinks.add(normalized);
        }
      });
    }
  } catch (error) {
    status = 0;
    xRobotsTag = `fetch-error: ${(error as Error).message}`;
  }

  hreflangMap = sortObjectKeys(hreflangMap);

  return {
    status,
    redirectTarget,
    canonical,
    hreflangMap,
    xRobotsTag,
    metaRobots,
    outlinks: [...outlinks],
  };
}

async function crawlSite(
  seeds: string[],
  maxDepth: number,
  base: URL
): Promise<{
  pages: Map<string, FetchedPage>;
  inlinks: Map<string, Set<string>>;
}> {
  const queue: Array<{ url: string; depth: number }> = seeds.map((url) => ({
    url,
    depth: 0,
  }));

  const visited = new Set<string>();
  const pages = new Map<string, FetchedPage>();
  const inlinks = new Map<string, Set<string>>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (visited.has(current.url)) {
      continue;
    }
    visited.add(current.url);

    const page = await fetchPage(current.url, base);
    pages.set(current.url, page);

    if (page.redirectTarget) {
      const redirectInternal = normalizeInternalUrl(page.redirectTarget, base);
      if (redirectInternal && !visited.has(redirectInternal) && current.depth + 1 <= maxDepth) {
        queue.push({ url: redirectInternal, depth: current.depth + 1 });
      }
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    for (const target of page.outlinks) {
      addInlink(inlinks, target, current.url);
      if (!visited.has(target)) {
        queue.push({
          url: target,
          depth: current.depth + 1,
        });
      }
    }
  }

  return { pages, inlinks };
}

async function collectSitemapUrls(base: URL): Promise<Set<string>> {
  const sitemapUrls = new Set<string>();
  const visitedSitemaps = new Set<string>();

  async function readSitemap(sitemapUrl: string): Promise<void> {
    if (visitedSitemaps.has(sitemapUrl)) {
      return;
    }
    visitedSitemaps.add(sitemapUrl);

    const response = await fetch(sitemapUrl, {
      headers: {
        "user-agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Unable to read sitemap ${sitemapUrl}: ${response.status}`);
    }

    const xml = await response.text();
    const locMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)];
    const locs = locMatches
      .map((match) => decodeXmlEntities(match[1].trim()))
      .filter((value) => value.length > 0);

    if (xml.includes("<sitemapindex")) {
      for (const loc of locs) {
        const nested = normalizeAbsoluteUrl(loc, base);
        if (nested) {
          await readSitemap(nested);
        }
      }
      return;
    }

    for (const loc of locs) {
      const normalized = normalizeAbsoluteUrl(loc, base);
      if (normalized) {
        sitemapUrls.add(normalized);
      }
    }
  }

  await readSitemap(`${base.origin}/sitemap.xml`);

  return sitemapUrls;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function buildExpectedIndexableUrls(
  base: URL,
  locales: SupportedLocale[]
): Promise<Set<string>> {
  const expected = new Set<string>();
  const content = await readSiteContent();

  const publishedBlogSlugs = content.blog.posts
    .filter((post) => post.status === "published")
    .map((post) => post.slug)
    .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

  for (const locale of locales) {
    for (const slug of localizedStaticSlugs) {
      const localizedPath = slug === "" ? `/${locale}` : `/${locale}${slug}`;
      expected.add(`${base.origin}${normalizePathname(localizedPath)}`);
    }

    for (const category of categoryData) {
      const localizedPath = `/${locale}/${category.segment}/categories/${category.slug}`;
      expected.add(`${base.origin}${normalizePathname(localizedPath)}`);
    }

    for (const slug of publishedBlogSlugs) {
      const localizedPath = `/${locale}/blog/${slug}`;
      expected.add(`${base.origin}${normalizePathname(localizedPath)}`);
    }
  }

  return expected;
}

function sortObjectKeys<T extends Record<string, string>>(record: T): T {
  const sortedEntries = Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(sortedEntries) as T;
}

function isUrlIndexable(url: string, row: AuditRow): boolean {
  const pathname = normalizePathname(new URL(url).pathname);
  if (!isIndexablePath(pathname)) {
    return false;
  }

  if (row.status < 200 || row.status >= 300) {
    return false;
  }

  const robotsSignal = `${row.meta_robots},${row.x_robots_tag}`.toLowerCase();
  if (robotsSignal.includes("noindex")) {
    return false;
  }

  return true;
}

function buildExpectedHreflangMap(url: string, base: URL): HreflangMap | null {
  const pathname = normalizePathname(new URL(url).pathname);
  const locale = extractLocaleFromPath(pathname);
  if (!locale) {
    return null;
  }

  const suffix = stripLocaleFromPath(pathname);
  const uaPath = getPeerLocalePath(pathname, "ua");
  const enPath = getPeerLocalePath(pathname, "en");
  const xDefault = suffix === "/" ? `${base.origin}/ua` : `${base.origin}${uaPath}`;

  return {
    uk: `${base.origin}${uaPath}`,
    en: `${base.origin}${enPath}`,
    "x-default": xDefault,
  };
}

function buildGateFailures(
  rows: AuditRow[],
  expectedIndexableUrls: Set<string>,
  base: URL,
  locales: SupportedLocale[]
): GateFailure[] {
  const failures: GateFailure[] = [];
  const rowMap = new Map(rows.map((row) => [row.url, row]));

  const localeEntrypoints = new Set(locales.map((locale) => `${base.origin}/${locale}`));
  const gateIndexableUrls = new Set<string>(expectedIndexableUrls);
  for (const row of rows) {
    if (isUrlIndexable(row.url, row)) {
      gateIndexableUrls.add(row.url);
    }
  }

  for (const url of gateIndexableUrls) {
    const row = rowMap.get(url);
    if (!row) {
      failures.push({
        rule: "indexable-url-missing-report-row",
        url,
        details: "URL missing from audit rows.",
      });
      continue;
    }

    if (row.status < 200 || row.status >= 300) {
      failures.push({
        rule: "indexable-url-not-200",
        url,
        details: `Expected indexable URL to return 200 but got ${row.status}.`,
      });
      continue;
    }

    if (row.canonical !== url) {
      failures.push({
        rule: "indexable-url-missing-self-canonical",
        url,
        details: `Canonical mismatch. expected=${url} actual=${row.canonical || "(missing)"}`,
      });
    }

    const expectedHreflang = buildExpectedHreflangMap(url, base);
    if (expectedHreflang) {
      const actual = row.hreflang_map;
      const hasAll =
        actual.uk === expectedHreflang.uk &&
        actual.en === expectedHreflang.en &&
        actual["x-default"] === expectedHreflang["x-default"];

      if (!hasAll) {
        failures.push({
          rule: "indexable-url-missing-hreflang-pair",
          url,
          details: `Expected hreflang uk=${expectedHreflang.uk}, en=${expectedHreflang.en}, x-default=${expectedHreflang["x-default"]}`,
        });
      }
    }

    if (!row.in_sitemap) {
      failures.push({
        rule: "indexable-url-missing-in-sitemap",
        url,
        details: "Indexable URL is absent in sitemap.",
      });
    }

    if (!localeEntrypoints.has(url) && row.is_orphan) {
      failures.push({
        rule: "indexable-url-orphan",
        url,
        details: "Indexable URL has zero internal inlinks.",
      });
    }
  }

  for (const row of rows) {
    const pathname = normalizePathname(new URL(row.url).pathname);
    if (!isNoindexPath(pathname)) {
      continue;
    }

    const robotsSignal = `${row.meta_robots},${row.x_robots_tag}`.toLowerCase();
    if (!robotsSignal.includes("noindex")) {
      failures.push({
        rule: "noindex-zone-missing-noindex-signal",
        url: row.url,
        details: "Service URL should emit noindex in meta robots or X-Robots-Tag.",
      });
    }
  }

  return failures;
}

function toCsv(rows: AuditRow[]): string {
  const headers: Array<keyof AuditRow> = [
    "url",
    "status",
    "redirect_target",
    "canonical",
    "hreflang_map",
    "x_robots_tag",
    "meta_robots",
    "in_sitemap",
    "inlink_count",
    "is_orphan",
    "duplicate_canonical_group",
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((header) => {
      const raw = row[header];
      const value = typeof raw === "object" && raw !== null ? JSON.stringify(raw) : String(raw);
      return `"${value.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(","));
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log("SEO structure audit started");
  console.log(`- baseUrl: ${options.baseUrl.origin}`);
  console.log(`- locales: ${options.locales.join(",")}`);
  console.log(`- maxDepth: ${options.maxDepth}`);
  console.log(
    `- policy patterns: indexable=${indexablePatterns.length}, noindex=${noindexPatterns.length}`
  );

  const expectedIndexableUrls = await buildExpectedIndexableUrls(options.baseUrl, options.locales);
  const sitemapUrls = await collectSitemapUrls(options.baseUrl);

  const seedPaths = [
    "/",
    ...options.locales.map((locale) => `/${locale}`),
    ...localeAgnosticPublicPrefixes,
    ...noindexPrefixes,
  ];

  const seeds = [...new Set(seedPaths)]
    .map((seedPath) => normalizeInternalUrl(seedPath, options.baseUrl))
    .filter((value): value is string => Boolean(value));

  const { pages, inlinks } = await crawlSite(seeds, options.maxDepth, options.baseUrl);

  for (const expectedUrl of expectedIndexableUrls) {
    if (!pages.has(expectedUrl)) {
      pages.set(expectedUrl, await fetchPage(expectedUrl, options.baseUrl));
    }
  }

  const allUrls = new Set<string>([
    ...pages.keys(),
    ...sitemapUrls,
    ...expectedIndexableUrls,
  ]);

  const rows: AuditRow[] = [...allUrls]
    .sort((a, b) => a.localeCompare(b))
    .map((url) => {
      const page = pages.get(url);
      const inlinkCount = inlinks.get(url)?.size ?? 0;
      const status = page?.status ?? 0;
      const redirectTarget = page?.redirectTarget ?? "";
      const canonical = page?.canonical ?? "";
      const hreflangMap = page?.hreflangMap ?? {};
      const xRobotsTag = page?.xRobotsTag ?? "";
      const metaRobots = page?.metaRobots ?? "";

      const isOrphan = isUrlIndexable(url, {
        url,
        status,
        redirect_target: redirectTarget,
        canonical,
        hreflang_map: hreflangMap,
        x_robots_tag: xRobotsTag,
        meta_robots: metaRobots,
        in_sitemap: sitemapUrls.has(url),
        inlink_count: inlinkCount,
        is_orphan: false,
        duplicate_canonical_group: "",
      })
        ? inlinkCount === 0
        : false;

      return {
        url,
        status,
        redirect_target: redirectTarget,
        canonical,
        hreflang_map: hreflangMap,
        x_robots_tag: xRobotsTag,
        meta_robots: metaRobots,
        in_sitemap: sitemapUrls.has(url),
        inlink_count: inlinkCount,
        is_orphan: isOrphan,
        duplicate_canonical_group: "",
      };
    });

  const canonicalGroups = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.canonical) {
      continue;
    }
    if (!canonicalGroups.has(row.canonical)) {
      canonicalGroups.set(row.canonical, []);
    }
    canonicalGroups.get(row.canonical)?.push(row.url);
  }

  const withDuplicateGroups = rows.map((row) => {
    const group = row.canonical ? canonicalGroups.get(row.canonical) ?? [] : [];
    return {
      ...row,
      duplicate_canonical_group: group.length > 1 ? row.canonical : "",
    };
  });

  const failures = buildGateFailures(
    withDuplicateGroups,
    expectedIndexableUrls,
    options.baseUrl,
    options.locales
  );

  const summary = {
    crawled_urls: pages.size,
    expected_indexable_urls: expectedIndexableUrls.size,
    sitemap_urls: sitemapUrls.size,
    report_rows: withDuplicateGroups.length,
    orphan_indexable_urls: withDuplicateGroups.filter((row) => row.is_orphan).length,
    gate_failures: failures.length,
  };

  await fs.mkdir(REPORT_DIR, { recursive: true });

  const reportPayload = {
    generated_at: new Date().toISOString(),
    base_url: options.baseUrl.origin,
    locales: options.locales,
    max_depth: options.maxDepth,
    policy: {
      indexablePatterns: indexablePatterns.map((pattern) => pattern.toString()),
      noindexPatterns: noindexPatterns.map((pattern) => pattern.toString()),
    },
    summary,
    failures,
    rows: withDuplicateGroups,
  };

  await fs.writeFile(REPORT_JSON_PATH, JSON.stringify(reportPayload, null, 2), "utf-8");
  await fs.writeFile(REPORT_CSV_PATH, toCsv(withDuplicateGroups), "utf-8");

  console.log(`Report saved: ${REPORT_JSON_PATH}`);
  console.log(`Report saved: ${REPORT_CSV_PATH}`);
  console.log(`Gate failures: ${failures.length}`);

  if (failures.length > 0) {
    for (const failure of failures.slice(0, 20)) {
      console.error(`[FAIL] ${failure.rule} :: ${failure.url} :: ${failure.details}`);
    }

    if (failures.length > 20) {
      console.error(`... and ${failures.length - 20} more`);
    }

    process.exit(1);
  }

  console.log("SEO structure gate passed.");
}

main().catch((error) => {
  console.error("SEO structure audit failed:", error);
  process.exit(1);
});
