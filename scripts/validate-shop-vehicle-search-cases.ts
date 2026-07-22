import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type VehicleCase = {
  id: string;
  query: string;
  scope: "auto" | "moto";
  make: string;
  model: string;
  chassis?: string;
  year: number;
};

type ApiFitment = {
  make: string | null;
  models: string[];
  chassisCodes: string[];
  yearRanges: Array<{ from: number; to: number | null }>;
  confidence: string;
};

type ApiItem = {
  id: string;
  name: string;
  brand: string;
  partNumber: string;
  fitmentStatus?: string;
  fitmentSource?: string;
  fitments?: ApiFitment[];
};

type ApiResponse = {
  data: ApiItem[];
  meta: { totalItems: number; fallbackApplied: string | null };
};

const cases: VehicleCase[] = [
  {
    id: "bmw-m3-f80",
    query: "BMW M3 F80 2018",
    scope: "auto",
    make: "BMW",
    model: "M3",
    chassis: "F80",
    year: 2018,
  },
  {
    id: "bmw-m4-g82",
    query: "BMW M4 G82 2022",
    scope: "auto",
    make: "BMW",
    model: "M4",
    chassis: "G82",
    year: 2022,
  },
  {
    id: "porsche-911-turbo-9912",
    query: "Porsche 911 Turbo 991.2 2018",
    scope: "auto",
    make: "Porsche",
    model: "911 Turbo",
    chassis: "991.2",
    year: 2018,
  },
  {
    id: "porsche-911-carrera-9921",
    query: "Porsche 911 Carrera 992.1 2021",
    scope: "auto",
    make: "Porsche",
    model: "911 Carrera",
    chassis: "992.1",
    year: 2021,
  },
  {
    id: "audi-rs6-c8",
    query: "Audi RS6 C8 2021",
    scope: "auto",
    make: "Audi",
    model: "RS6",
    chassis: "C8",
    year: 2021,
  },
  {
    id: "audi-rs3-8y",
    query: "Audi RS3 8Y 2023",
    scope: "auto",
    make: "Audi",
    model: "RS3",
    chassis: "8Y",
    year: 2023,
  },
  {
    id: "volkswagen-golf-mk7",
    query: "Volkswagen Golf MK7 2017",
    scope: "auto",
    make: "Volkswagen",
    model: "Golf",
    chassis: "MK7",
    year: 2017,
  },
  {
    id: "toyota-gr-supra-a90",
    query: "Toyota GR Supra A90 2021",
    scope: "auto",
    make: "Toyota",
    model: "GR Supra",
    chassis: "A90",
    year: 2021,
  },
  {
    id: "nissan-gtr-r35",
    query: "Nissan GT-R R35 2020",
    scope: "auto",
    make: "Nissan",
    model: "Gt-R",
    chassis: "R35",
    year: 2020,
  },
  {
    id: "land-rover-defender-l663",
    query: "Land Rover Defender L663 2022",
    scope: "auto",
    make: "Land Rover",
    model: "Defender",
    chassis: "L663",
    year: 2022,
  },
  {
    id: "mercedes-amg-c-w205",
    query: "Mercedes-AMG C-Class W205 2019",
    scope: "auto",
    make: "Mercedes-AMG",
    model: "C-Class",
    chassis: "W205",
    year: 2019,
  },
  {
    id: "ford-mustang-2019",
    query: "Ford Mustang 2019",
    scope: "auto",
    make: "Ford",
    model: "Mustang",
    year: 2019,
  },
  {
    id: "lamborghini-urus-2021",
    query: "Lamborghini Urus 2021",
    scope: "auto",
    make: "Lamborghini",
    model: "Urus",
    year: 2021,
  },
  {
    id: "ferrari-488-2018",
    query: "Ferrari 488 2018",
    scope: "auto",
    make: "Ferrari",
    model: "488",
    year: 2018,
  },
  {
    id: "mclaren-720s-2020",
    query: "McLaren 720S 2020",
    scope: "auto",
    make: "McLaren",
    model: "720S",
    year: 2020,
  },
];

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeMakeFamily = (value: string | null | undefined) => {
  const normalized = normalize(value);
  return normalized === "mercedes amg" || normalized === "mercedes benz" ? "mercedes" : normalized;
};

function fitmentMatchesVehicle(fitment: ApiFitment, testCase: VehicleCase) {
  if (normalizeMakeFamily(fitment.make) !== normalizeMakeFamily(testCase.make)) return false;
  if (!fitment.models.some((model) => normalize(model) === normalize(testCase.model))) return false;
  if (
    testCase.chassis &&
    !fitment.chassisCodes.some((code) => normalize(code) === normalize(testCase.chassis))
  ) {
    return false;
  }
  return true;
}

function yearState(fitments: ApiFitment[], testCase: VehicleCase) {
  const vehicleFitments = fitments.filter((fitment) => fitmentMatchesVehicle(fitment, testCase));
  const ranges = vehicleFitments.flatMap((fitment) => fitment.yearRanges ?? []);
  if (ranges.length === 0) return "unknown" as const;
  return ranges.some(
    (range) => range.from <= testCase.year && (range.to === null || range.to >= testCase.year)
  )
    ? ("confirmed" as const)
    : ("contradicted" as const);
}

function buildParams(testCase: VehicleCase, includeQuery: boolean, includeYear: boolean) {
  const params = new URLSearchParams({
    locale: "ua",
    scope: testCase.scope,
    make: testCase.make,
    model: testCase.model,
    includeFitment: "true",
    allowFallback: "0",
    page: "1",
    limit: "100",
  });
  if (testCase.chassis) params.set("chassis", testCase.chassis);
  if (includeYear) params.set("year", String(testCase.year));
  if (includeQuery) params.set("q", testCase.query);
  return params;
}

function buildTextOnlyParams(testCase: VehicleCase) {
  return new URLSearchParams({
    locale: "ua",
    scope: testCase.scope,
    q: testCase.query,
    includeFitment: "true",
    allowFallback: "0",
    page: "1",
    limit: "100",
  });
}

async function getJson(baseUrl: string, params: URLSearchParams) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/shop/stock/search?${params.toString()}`, {
    signal: AbortSignal.timeout(120_000),
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return { payload: (await response.json()) as ApiResponse, elapsedMs };
}

async function validateCase(baseUrl: string, testCase: VehicleCase) {
  const filterOnly = await getJson(baseUrl, buildParams(testCase, false, false));
  const filterWithYear = await getJson(baseUrl, buildParams(testCase, false, true));
  const textAndFilters = await getJson(baseUrl, buildParams(testCase, true, true));
  const textOnly = await getJson(baseUrl, buildTextOnlyParams(testCase));

  const inspected = filterWithYear.payload.data;
  const contaminants = inspected.filter(
    (item) => !(item.fitments ?? []).some((fitment) => fitmentMatchesVehicle(fitment, testCase))
  );
  const textOnlyContaminants = textOnly.payload.data.filter(
    (item) => !(item.fitments ?? []).some((fitment) => fitmentMatchesVehicle(fitment, testCase))
  );
  const yearStates = inspected.map((item) => yearState(item.fitments ?? [], testCase));
  const preYearContradicted = filterOnly.payload.data.filter(
    (item) => yearState(item.fitments ?? [], testCase) === "contradicted"
  ).length;
  const confirmedYear = yearStates.filter((state) => state === "confirmed").length;
  const contradictedYear = yearStates.filter((state) => state === "contradicted").length;
  const unknownYear = yearStates.filter((state) => state === "unknown").length;
  const filterTotal = filterOnly.payload.meta.totalItems;
  const structuredTotal = filterWithYear.payload.meta.totalItems;
  const textTotal = textAndFilters.payload.meta.totalItems;
  const textOnlyTotal = textOnly.payload.meta.totalItems;
  const contradictedYearItems = inspected.filter(
    (item) => yearState(item.fitments ?? [], testCase) === "contradicted"
  );
  const textResultIds = new Set(textAndFilters.payload.data.map((item) => item.id));
  const structuredItemsMissingFromText = inspected.filter((item) => !textResultIds.has(item.id));
  const issues: string[] = [];

  if (structuredTotal === 0) issues.push("no_results");
  if (contaminants.length > 0) issues.push("foreign_fitment_in_results");
  if (textOnlyContaminants.length > 0) issues.push("foreign_fitment_in_text_search");
  if (contradictedYear > 0) issues.push("requested_year_contradicted");
  if (preYearContradicted > 0 && structuredTotal === filterTotal) {
    issues.push("year_filter_has_no_effect");
  }
  if (structuredTotal > 0 && textTotal === 0) issues.push("text_search_loses_all_vehicle_results");
  if (textTotal > structuredTotal) issues.push("text_search_expands_structured_result_set");
  if (structuredTotal > 0 && textTotal / structuredTotal < 0.8) {
    issues.push("text_search_drops_vehicle_matches");
  }

  return {
    case: testCase,
    totals: {
      filterOnly: filterTotal,
      filterWithYear: filterWithYear.payload.meta.totalItems,
      textAndFilters: textTotal,
      textOnly: textOnlyTotal,
    },
    inspected: inspected.length,
    contamination: {
      count: contaminants.length,
      samples: contaminants.slice(0, 8).map((item) => ({
        sku: item.partNumber,
        title: item.name,
        fitments: item.fitments,
      })),
    },
    textOnlyContamination: {
      count: textOnlyContaminants.length,
      samples: textOnlyContaminants.slice(0, 8).map((item) => ({
        sku: item.partNumber,
        title: item.name,
        fitments: item.fitments,
      })),
    },
    yearEvidence: {
      confirmed: confirmedYear,
      contradicted: contradictedYear,
      unknown: unknownYear,
    },
    contradictedYearSamples: contradictedYearItems.slice(0, 8).map((item) => ({
      sku: item.partNumber,
      brand: item.brand,
      title: item.name,
      fitments: item.fitments,
    })),
    textRecallAgainstStructured:
      structuredTotal > 0 ? Number((textTotal / structuredTotal).toFixed(3)) : null,
    structuredMissingFromTextSamples: structuredItemsMissingFromText.slice(0, 8).map((item) => ({
      sku: item.partNumber,
      brand: item.brand,
      title: item.name,
    })),
    sampleResults: inspected.slice(0, 8).map((item) => ({
      sku: item.partNumber,
      brand: item.brand,
      title: item.name,
      fitmentStatus: item.fitmentStatus,
      fitmentSource: item.fitmentSource,
    })),
    timingsMs: {
      filterOnly: filterOnly.elapsedMs,
      filterWithYear: filterWithYear.elapsedMs,
      textAndFilters: textAndFilters.elapsedMs,
      textOnly: textOnly.elapsedMs,
    },
    issues,
    status: issues.some((issue) =>
      [
        "no_results",
        "foreign_fitment_in_results",
        "foreign_fitment_in_text_search",
        "requested_year_contradicted",
        "text_search_loses_all_vehicle_results",
        "text_search_drops_vehicle_matches",
      ].includes(issue)
    )
      ? "fail"
      : issues.length > 0
        ? "warning"
        : "pass",
  };
}

async function main() {
  const baseUrl =
    process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ??
    "http://localhost:3000";
  const results = [];
  for (const testCase of cases) {
    console.log(`Validating ${testCase.id}...`);
    try {
      results.push(await validateCase(baseUrl, testCase));
    } catch (error) {
      results.push({
        case: testCase,
        status: "fail",
        issues: ["request_failed"],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    total: results.length,
    passed: results.filter((result) => result.status === "pass").length,
    warnings: results.filter((result) => result.status === "warning").length,
    failed: results.filter((result) => result.status === "fail").length,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    methodology:
      "Legacy public catalog API; structured filter, structured filter + year, text + structured filters, and text-only search; first 100 results inspected per case; fallback disabled.",
    summary,
    results,
  };
  const outputDirectory = path.join(process.cwd(), "artifacts", "stock-fitment-audit");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "vehicle-search-15-cases.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );

  const lines = [
    "# Vehicle search validation — 15 cases",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Pass: ${summary.passed}; warnings: ${summary.warnings}; fail: ${summary.failed}.`,
    "",
    "| Case | Filter | With year | Text + filters | Text only | Filter/Text contamination | Year C/X/? | Status | Issues |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...results.map(
      (result: any) =>
        `| ${result.case.id} | ${result.totals?.filterOnly ?? "—"} | ${result.totals?.filterWithYear ?? "—"} | ${result.totals?.textAndFilters ?? "—"} | ${result.totals?.textOnly ?? "—"} | ${result.contamination?.count ?? "—"}/${result.textOnlyContamination?.count ?? "—"} | ${result.yearEvidence ? `${result.yearEvidence.confirmed}/${result.yearEvidence.contradicted}/${result.yearEvidence.unknown}` : "—"} | ${result.status} | ${(result.issues ?? []).join(", ")} |`
    ),
    "",
    "C/X/? = confirmed / contradicted / unknown year evidence among inspected results.",
    "",
  ];
  await writeFile(
    path.join(outputDirectory, "vehicle-search-15-cases.md"),
    lines.join("\n"),
    "utf8"
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
