import {
  canonicalizeShopSearchQuery,
  normalizeShopSearchText,
  isShopSearchCodeToken,
} from "./shopSearch";

type SearchDictionaryItem = {
  titleText: string;
  brandText?: string;
  product?: { title?: { ua?: string; en?: string } };
};
const dictionaries = new WeakMap<readonly SearchDictionaryItem[], Map<string, string[]>>();

function dictionaryFor(items: readonly SearchDictionaryItem[]) {
  const cached = dictionaries.get(items);
  if (cached) return cached;
  const groups = new Map<string, Set<string>>();
  for (const item of items) {
    const raw = `${item.titleText} ${item.brandText ?? ""} ${item.product?.title?.ua ?? ""} ${item.product?.title?.en ?? ""}`;
    for (const word of `${normalizeShopSearchText(raw)} ${canonicalizeShopSearchQuery(raw)}`.split(
      " "
    )) {
      if (word.length < 4 || word.length > 40 || /\d/.test(word)) continue;
      const prefix = word.slice(0, 2);
      const group = groups.get(prefix) ?? new Set<string>();
      group.add(word);
      groups.set(prefix, group);
    }
  }
  const dictionary = new Map([...groups].map(([key, words]) => [key, [...words]]));
  dictionaries.set(items, dictionary);
  return dictionary;
}

/** One insertion, deletion, replacement, or adjacent transposition. */
export function isOneShopSearchTypo(left: string, right: string) {
  if (left === right || Math.abs(left.length - right.length) > 1) return false;
  let index = 0;
  while (index < Math.min(left.length, right.length) && left[index] === right[index]) index++;
  if (left.length === right.length) {
    return (
      left.slice(index + 1) === right.slice(index + 1) ||
      (left[index] === right[index + 1] &&
        left[index + 1] === right[index] &&
        left.slice(index + 2) === right.slice(index + 2))
    );
  }
  return left.length > right.length
    ? left.slice(index + 1) === right.slice(index)
    : left.slice(index) === right.slice(index + 1);
}

/** Only after zero exact results. Never guess an SKU, engine, model, or short brand. */
export function getShopSearchFallbackQuery(query: string, items: readonly SearchDictionaryItem[]) {
  const normalized = canonicalizeShopSearchQuery(query);
  const words = normalized.split(" ");
  const dictionary = dictionaryFor(items);
  let changes = 0;
  const corrected = words.map((word, index) => {
    if (word.length < 5 || word.length > 40 || /\d/.test(word) || isShopSearchCodeToken(word))
      return word;
    const vocabulary = dictionary.get(word.slice(0, 2)) ?? [];
    if (vocabulary.includes(word)) return word;
    const candidates = vocabulary.filter((candidate) => isOneShopSearchTypo(word, candidate));
    if (candidates.length === 0 && index === words.length - 1) {
      candidates.push(...vocabulary.filter((candidate) => candidate.startsWith(word)));
    }
    if (candidates.length !== 1) return word;
    changes++;
    return candidates[0];
  });
  return changes > 0 && changes <= 2 ? corrected.join(" ") : null;
}
