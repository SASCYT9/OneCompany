/**
 * Read-only probe of catalog search quality. Sends GET requests only.
 *
 *   npx tsx scripts/probe-catalog-search.ts [baseUrl]
 *
 * Prints, per golden query, how many products the list endpoint returns and
 * whether the expectation holds. Use it before and after a change (production
 * vs Preview) to compare "was / became".
 */
type Golden = {
  q: string;
  /** Minimum number of results. */
  min?: number;
  /** Maximum number of results (guards against junk when a query is specific). */
  max?: number;
  /** Required substring of the first result title (case-insensitive). */
  firstIncludes?: string;
  /** Forbidden substring in the first three result titles. */
  topExcludes?: string;
};

const GOLDEN: readonly Golden[] = [
  { q: "Racechip Touareg", min: 5, firstIncludes: "touareg" },
  { q: "Touareg Racechip", min: 5, firstIncludes: "touareg" },
  { q: "Racechip Tuareg", min: 5 },
  { q: "рейсчіп туарег", min: 5 },
  { q: "Racechip BMW", min: 5 },
  { q: "Racechip Golf", min: 1 },
  { q: "racechip audi rs6", min: 1 },
  { q: "akrapovic g80", min: 5 },
  { q: "g80 akrapovic", min: 5 },
  { q: "akrapovic m5", min: 5 },
  { q: "акрапович м3", min: 5 },
  { q: "ipe 911", min: 1 },
  { q: "do88 bmw m3", min: 1 },
  { q: "urban range rover", min: 1 },
  { q: "urus akrapovic", min: 1 },
  { q: "урус", min: 5 },
  { q: "гелендваген", min: 5 },
  { q: "tuareg", min: 5 },
  { q: "brabus w463a", min: 1 },
  { q: "w463a", min: 1 },
  { q: "w 463a", min: 1 },
  { q: "golf r", min: 1, max: 600 },
  { q: "гальмівні диски m3", min: 1, topExcludes: "spacer" },
  { q: "вихлоп m5", min: 5 },
  { q: "exhaust bmw m5", min: 5 },
  { q: "girodisc m3", min: 5 },
  { q: "cayenne exhaust", min: 5 },
  { q: "zzzzqq", max: 0 },
];

type Row = { name?: string };

async function getJson(url: string): Promise<{ data?: Row[]; meta?: { totalItems?: number } }> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as { data?: Row[]; meta?: { totalItems?: number } };
}

async function main() {
  const base = (process.argv[2] ?? "https://onecompany.global").replace(/\/$/, "");
  let failed = 0;
  for (const golden of GOLDEN) {
    const params = new URLSearchParams({ q: golden.q, locale: "ua", scope: "auto" });
    const search = await getJson(`${base}/api/shop/stock/search?${params}`);
    const suggest = await getJson(
      `${base}/api/shop/stock/suggest?${new URLSearchParams({ q: golden.q, locale: "ua", v: "4", scope: "auto" })}`
    );
    const total = search.meta?.totalItems ?? search.data?.length ?? 0;
    const titles = (search.data ?? []).map((row) => (row.name ?? "").toLowerCase());
    const problems: string[] = [];
    if (golden.min !== undefined && total < golden.min) problems.push(`min ${golden.min}`);
    if (golden.max !== undefined && total > golden.max) problems.push(`max ${golden.max}`);
    if (golden.firstIncludes && !titles[0]?.includes(golden.firstIncludes.toLowerCase())) {
      problems.push(`first must include "${golden.firstIncludes}"`);
    }
    if (
      golden.topExcludes &&
      titles.slice(0, 3).some((title) => title.includes(golden.topExcludes!.toLowerCase()))
    ) {
      problems.push(`top must not include "${golden.topExcludes}"`);
    }
    if ((golden.min ?? 0) > 0 && (suggest.data?.length ?? 0) === 0) problems.push("no suggestions");
    if (problems.length) failed += 1;
    console.log(
      `${problems.length ? "FAIL" : "ok  "} ${golden.q.padEnd(28)} list=${String(total).padStart(5)} suggest=${suggest.data?.length ?? 0} ${problems.join("; ")}`
    );
  }
  console.log(`\n${GOLDEN.length - failed}/${GOLDEN.length} passed against ${base}`);
  process.exitCode = failed ? 1 : 0;
}

void main();
