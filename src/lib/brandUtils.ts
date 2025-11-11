import type { SimpleBrand } from './brands';

export type GroupedBrands = Record<string, SimpleBrand[]>; // key is uppercase letter

export function groupBrandsByLetter(brands: SimpleBrand[]): GroupedBrands {
  const map: GroupedBrands = {};
  for (const b of brands) {
    const first = (b.name || '').trim().charAt(0).toUpperCase();
    const key = /[A-Z]/.test(first) ? first : '#';
    if (!map[key]) map[key] = [];
    map[key].push(b);
  }
  // sort each group by name
  Object.keys(map).forEach(k => map[k].sort((a, b) => a.name.localeCompare(b.name)));
  return map;
}

export const alphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
