/**
 * Feature flags for the B2B shop portal.
 *
 * `TURN14_ENABLED` — toggles the Turn14 distributor integration on/off.
 * Default: OFF. When off, /shop/stock and its brand/search endpoints skip
 * Turn14 entirely and the `/shop/stock/[id]` detail page 404s. We keep
 * the code paths intact so the integration can be re-enabled by flipping
 * one env var once we migrate from per-item to bulk pagination
 * (`/v1/items?page=N`) per Turn14's recommendation.
 *
 * Set `TURN14_ENABLED=true` (or `1`) in Vercel env to re-enable.
 */
export function isTurn14Enabled(): boolean {
  const raw = (process.env.TURN14_ENABLED || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
