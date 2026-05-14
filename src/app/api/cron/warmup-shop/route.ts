import { NextRequest, NextResponse } from "next/server";

/**
 * Vercel cron warmup for high-traffic shop pages.
 *
 * Vercel scale-down sleeps Lambda instances after ~5–15 min of idle, so the
 * first visitor after a quiet window pays a ~500–1500 ms cold-start tax on
 * top of any ISR regeneration cost. This endpoint, hit by Vercel cron, GETs
 * the heaviest brand pages so a real Lambda instance stays warm and the
 * ISR cache is refreshed in the background before users arrive.
 *
 * Wired up in `vercel.json` -> `crons[]`. Schedule kept under the route's
 * `revalidate=3600` so the cron hit always lands in the "stale" window and
 * triggers background regeneration.
 */

// Most-trafficked brand pages — keep these warm. Both locales because
// language-switched visits go through different ISR keys.
const WARMUP_PATHS = [
  "/ua/shop",
  "/ua/shop/racechip",
  "/ua/shop/racechip/catalog",
  "/ua/shop/brabus",
  "/ua/shop/brabus/products",
  "/ua/shop/akrapovic",
  "/ua/shop/akrapovic/collections",
  "/ua/shop/girodisc",
  "/ua/shop/girodisc/catalog",
  "/ua/shop/ohlins",
  "/ua/shop/ipe",
  "/ua/shop/csf",
  "/ua/shop/adro",
  "/ua/shop/burger/products",
  "/ua/shop/urban",
  "/en/shop/racechip/catalog",
];

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://onecompany.global";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Vercel sets Authorization: Bearer ${CRON_SECRET} when CRON_SECRET env is
  // configured. If unset, allow the request (warmup is idempotent + GET-only).
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const started = Date.now();
  const origin = SITE_ORIGIN.replace(/\/$/, "");

  const results = await Promise.allSettled(
    WARMUP_PATHS.map(async (path) => {
      const url = `${origin}${path}`;
      const t0 = Date.now();
      try {
        const r = await fetch(url, {
          headers: { "x-cron-warmup": "1" },
          cache: "no-store",
        });
        return { path, status: r.status, ms: Date.now() - t0 };
      } catch (e) {
        return { path, error: String(e), ms: Date.now() - t0 };
      }
    })
  );

  const summary = results.map((r) =>
    r.status === "fulfilled" ? r.value : { error: String(r.reason) }
  );
  return NextResponse.json({
    ok: true,
    totalMs: Date.now() - started,
    warmed: summary.length,
    results: summary,
  });
}
