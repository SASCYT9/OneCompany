/**
 * One-shot diagnostic to figure out the correct Turn14 filter syntax.
 *
 * Tries 5 different request shapes against Turn14's /v1/items endpoint
 * and reports, for each:
 *   - HTTP status
 *   - meta.total_pages and meta.count if present
 *   - distribution of attributes.brand_name across the FIRST page
 *   - first item id + part_number + brand_id (sanity check)
 *
 * GET only. Admin-gated. Will be removed once we identify the right
 * filter shape.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { getTurn14AccessToken } from '@/lib/turn14';

const TURN14_API_BASE = 'https://api.turn14.com/v1';

async function probe(rawQuery: string, label: string): Promise<{
  label: string;
  url: string;
  status: number | null;
  ok: boolean;
  totalPages?: number;
  count?: number;
  brandNameDistribution?: Record<string, number>;
  firstItem?: { id: string; partNumber?: string; brandId?: string; brandName?: string };
  error?: string;
}> {
  const url = `${TURN14_API_BASE}/items${rawQuery ? `?${rawQuery}` : ''}`;
  try {
    const token = await getTurn14AccessToken();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const status = res.status;
    if (!res.ok) {
      const text = await res.text();
      return { label, url, status, ok: false, error: text.slice(0, 200) };
    }
    const body = await res.json();
    const items: any[] = body?.data || [];
    const dist: Record<string, number> = {};
    for (const it of items) {
      const name = (it?.attributes?.brand_name || it?.attributes?.brand || '<none>').toString().trim();
      dist[name] = (dist[name] || 0) + 1;
    }
    const first = items[0];
    return {
      label,
      url,
      status,
      ok: true,
      totalPages: body?.meta?.total_pages,
      count: items.length,
      brandNameDistribution: dist,
      firstItem: first
        ? {
            id: String(first.id),
            partNumber: first.attributes?.part_number,
            brandId: first.attributes?.brand_id !== undefined ? String(first.attributes.brand_id) : undefined,
            brandName: first.attributes?.brand_name || first.attributes?.brand,
          }
        : undefined,
    };
  } catch (err) {
    return { label, url, status: null, ok: false, error: (err as Error).message };
  }
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  assertAdminRequest(cookieStore);

  const url = new URL(req.url);
  const brandId = url.searchParams.get('brandId') || '436'; // GiroDisc default
  const sku = url.searchParams.get('sku') || 'A1-163';

  const probes = [
    { q: `brand_id=${brandId}`, label: 'A. ?brand_id=N (current code)' },
    { q: `filter[brand_id]=${brandId}`, label: 'B. ?filter[brand_id]=N (JSON:API)' },
    { q: `filter%5Bbrand_id%5D=${brandId}`, label: 'C. ?filter%5Bbrand_id%5D=N (encoded JSON:API)' },
    { q: `mfr_part_number=${sku}`, label: `D. ?mfr_part_number=${sku}` },
    { q: `part_number=${sku}`, label: `E. ?part_number=${sku}` },
    { q: `keyword=${sku}`, label: `F. ?keyword=${sku} (search)` },
    { q: `keyword=${sku}&filter[brand_id]=${brandId}`, label: 'G. keyword + filter[brand_id]' },
  ];

  // Run sequentially with small spacing to honor Turn14's 5 req/s.
  const results: any[] = [];
  for (const p of probes) {
    const r = await probe(p.q, p.label);
    results.push(r);
    await new Promise((res) => setTimeout(res, 260));
  }

  // Bonus: try the nested resource shape /v1/brands/:id/items
  try {
    const token = await getTurn14AccessToken();
    const nestedUrl = `${TURN14_API_BASE}/brands/${brandId}/items`;
    const r = await fetch(nestedUrl, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (r.ok) {
      const body = await r.json();
      const items: any[] = body?.data || [];
      const dist: Record<string, number> = {};
      for (const it of items) {
        const n = (it?.attributes?.brand_name || it?.attributes?.brand || '<none>').toString().trim();
        dist[n] = (dist[n] || 0) + 1;
      }
      results.push({
        label: 'H. /v1/brands/N/items (nested)',
        url: nestedUrl,
        status: r.status,
        ok: true,
        totalPages: body?.meta?.total_pages,
        count: items.length,
        brandNameDistribution: dist,
        firstItem: items[0] ? { id: String(items[0].id), partNumber: items[0].attributes?.part_number, brandId: String(items[0].attributes?.brand_id ?? ''), brandName: items[0].attributes?.brand_name } : undefined,
      });
    } else {
      const text = await r.text();
      results.push({ label: 'H. /v1/brands/N/items (nested)', url: nestedUrl, status: r.status, ok: false, error: text.slice(0, 200) });
    }
  } catch (err) {
    results.push({ label: 'H. /v1/brands/N/items (nested)', status: null, ok: false, error: (err as Error).message });
  }

  return NextResponse.json({ brandId, sku, results });
}
