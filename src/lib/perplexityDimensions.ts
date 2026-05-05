/**
 * Perplexity-backed dimension fallback.
 *
 * HARD RULE: this module must NEVER attempt to populate product CONTENT
 * (titles, descriptions, marketing copy). It only asks Perplexity for
 * physical packaging dimensions and weight.
 *
 * The fallback is wired but inert by default:
 *   - If `PERPLEXITY_API_KEY` is not set, every call returns null with a
 *     clear `reason`. This lets us run the pipeline end-to-end on a branch
 *     without billable API traffic.
 *   - When the key is present we still default to a low-temperature, JSON-
 *     mode prompt that constrains output to numeric fields.
 *
 * Wire-up is deliberately simple — one HTTPS call. We add tests / caching
 * later once we've decided this is the right vendor.
 */

const PERPLEXITY_API_BASE = 'https://api.perplexity.ai';
const DEFAULT_MODEL = 'sonar';

export interface PerplexityDimsLookupInput {
  brand: string;
  productTitle: string;
  sku?: string | null;
  /** Free-form extra context like category, vehicle fitment, etc. */
  hint?: string | null;
}

export interface PerplexityDimsLookupResult {
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  /** Always true when this function returned a value — Perplexity is best-effort. */
  estimated: true;
  source: 'perplexity';
  model: string;
  rawResponse?: string;
}

export interface PerplexityDimsLookupSkip {
  ok: false;
  reason: 'no_api_key' | 'http_error' | 'invalid_response' | 'no_data';
  detail?: string;
}

export type PerplexityDimsLookupOutcome =
  | (PerplexityDimsLookupResult & { ok: true })
  | PerplexityDimsLookupSkip;

function buildPrompt(input: PerplexityDimsLookupInput): string {
  const parts = [
    `Brand: ${input.brand}`,
    `Product: ${input.productTitle}`,
  ];
  if (input.sku) parts.push(`SKU/MPN: ${input.sku}`);
  if (input.hint) parts.push(`Context: ${input.hint}`);
  return [
    'You are a logistics data lookup assistant. Return ONLY a JSON object describing the typical SHIPPED packaging dimensions and weight for the part below. Do NOT describe the product, do NOT include marketing copy.',
    '',
    parts.join('\n'),
    '',
    'Required JSON shape:',
    '{ "weight_kg": number|null, "length_cm": number|null, "width_cm": number|null, "height_cm": number|null, "confidence": "low"|"medium"|"high", "notes": string|null }',
    '',
    'Rules:',
    '- All numeric values are positive metric units (kg, cm).',
    '- Use null for any field you cannot estimate confidently.',
    '- Do NOT invent values. Prefer null over a guess.',
    '- Do NOT output any prose outside the JSON object.',
  ].join('\n');
}

function parseJsonFromText(raw: string): Record<string, unknown> | null {
  // The model sometimes wraps JSON in code fences. Strip and try.
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function coercePositive(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
}

/**
 * Ask Perplexity for typical shipped dimensions. Returns null-ish with
 * `ok: false` if the API key is missing or the response cannot be parsed.
 *
 * Caller is responsible for marking the variant as `isDimensionsEstimated: true`
 * when persisting the result.
 */
export async function lookupShippingDims(
  input: PerplexityDimsLookupInput,
  options: { model?: string; timeoutMs?: number } = {},
): Promise<PerplexityDimsLookupOutcome> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      reason: 'no_api_key',
      detail: 'Set PERPLEXITY_API_KEY in env to enable the dimensions fallback.',
    };
  }

  const model = options.model || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${PERPLEXITY_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [{ role: 'user', content: buildPrompt(input) }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      reason: 'http_error',
      detail: (err as Error).message,
    };
  }
  clearTimeout(timer);

  if (!response.ok) {
    return {
      ok: false,
      reason: 'http_error',
      detail: `${response.status} ${response.statusText}`,
    };
  }

  let body: any;
  try {
    body = await response.json();
  } catch (err) {
    return { ok: false, reason: 'invalid_response', detail: (err as Error).message };
  }

  const text: string | undefined = body?.choices?.[0]?.message?.content;
  if (!text) {
    return { ok: false, reason: 'invalid_response', detail: 'no message content' };
  }

  const json = parseJsonFromText(text);
  if (!json) {
    return { ok: false, reason: 'invalid_response', detail: 'could not parse JSON from response' };
  }

  const weightKg = coercePositive(json.weight_kg);
  const lengthCm = coercePositive(json.length_cm);
  const widthCm = coercePositive(json.width_cm);
  const heightCm = coercePositive(json.height_cm);

  if (weightKg === null && lengthCm === null && widthCm === null && heightCm === null) {
    return { ok: false, reason: 'no_data', detail: 'all fields null' };
  }

  return {
    ok: true,
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    estimated: true,
    source: 'perplexity',
    model,
    rawResponse: text,
  };
}
