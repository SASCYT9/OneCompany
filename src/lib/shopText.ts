import type { SupportedLocale } from '@/lib/seo';

type LocalizedValue = {
  ua: string;
  en: string;
};

const CYRILLIC_RE = /[А-Яа-яІіЇїЄєҐґ]/;

const DIRECT_REPLACEMENTS: Array<[string, string]> = [
  ['Карбоновий задній бампер', 'Carbon rear bumper'],
  ['Карбоновий спліттер переднього бампера', 'Carbon front bumper splitter'],
  ['Карбоновий задній дифузор', 'Carbon rear diffuser'],
  ['Карбонові накладки на пороги', 'Carbon side sill trims'],
  ['Нижній карбоновий спойлер', 'Lower carbon spoiler'],
  ['Верхній карбоновий спойлер', 'Upper carbon spoiler'],
  ['Карбонові вентиляційні отвори капота', 'Carbon hood vents'],
  ['Комплект задніх дифузорів', 'Rear diffuser kit'],
  ['Накладки на фари передніх бамперів', 'Front bumper light trims'],
  ['Аеродинамічний обвіс', 'Aerodynamic body kit'],
  ['Алюмінієві фінішні накладки на вихлопну трубу', 'Aluminum exhaust tip trims'],
  ['Задній дифузор та підніжка з карбонового волокна', 'Rear diffuser and side step in carbon fiber'],
  ['з карбонового волокна', 'in carbon fiber'],
  ['обвіс', 'body kit'],
  ['підніжка', 'side step'],
  ['вихлопну трубу', 'exhaust tip'],
  ['фінішні накладки', 'finish trims'],
  ['алюмінієві', 'aluminum'],
  ['та', 'and'],
  ['23-дюймові повністю ковані диски', '23-inch fully forged wheels'],
  ['23-дюймові литі диски', '23-inch cast wheels'],
  ['Карбоновий', 'Carbon'],
  ['Карбонова', 'Carbon'],
  ['Карбонове', 'Carbon'],
  ['Карбонові', 'Carbon'],
  ['Карбонового', 'Carbon'],
  ['Комплект', 'Kit'],
  ['комплект', 'kit'],
  ['задній', 'rear'],
  ['задня', 'rear'],
  ['заднє', 'rear'],
  ['задні', 'rear'],
  ['передній', 'front'],
  ['передня', 'front'],
  ['переднє', 'front'],
  ['передні', 'front'],
  ['бамперів', 'bumpers'],
  ['бампера', 'bumper'],
  ['бампер', 'bumper'],
  ['спліттер', 'splitter'],
  ['спойлер', 'spoiler'],
  ['дифузорів', 'diffusers'],
  ['дифузора', 'diffuser'],
  ['дифузор', 'diffuser'],
  ['накладки', 'trim caps'],
  ['пороги', 'side sills'],
  ['отвори', 'vents'],
  ['вентиляційні', 'ventilation'],
  ['капота', 'hood'],
  ['дюймові', 'inch'],
  ['литі диски', 'cast wheels'],
  ['ковані диски', 'forged wheels'],
  ['повністю ковані диски', 'fully forged wheels'],
  ['на замовлення', 'made to order'],
  ['пара', 'pair'],
  ['сатин', 'satin'],
  ['не сумісний з буксирним гаком', 'not compatible with tow bar'],
  ['Марка авто', 'Vehicle brand'],
  ['Модель', 'Model'],
];

const CHAR_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'yu', я: 'ya',
};

function transliterateUk(input: string) {
  return input
    .split('')
    .map((char) => {
      const lower = char.toLowerCase();
      const mapped = CHAR_MAP[lower];
      if (!mapped) return char;
      return char === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .join('');
}

function cleanupSpacing(input: string) {
  return input
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.)])/g, '$1')
    .replace(/([(])\s+/g, '$1')
    .trim();
}

function looksFakeEnglish(ua: string, en: string) {
  const uaValue = ua.trim();
  const enValue = en.trim();
  if (!uaValue || !enValue) return true;
  return uaValue === enValue && CYRILLIC_RE.test(enValue);
}

function generateEnglishFallback(ua: string) {
  let value = ua;
  for (const [pattern, replacement] of DIRECT_REPLACEMENTS) {
    value = value.replaceAll(pattern, replacement);
  }
  return cleanupSpacing(transliterateUk(value));
}

export function localizeShopText(
  locale: SupportedLocale,
  value: LocalizedValue,
  options?: {
    kind?: 'title' | 'label' | 'description';
  }
) {
  if (locale === 'ua') {
    return value.ua;
  }

  const ua = String(value.ua ?? '').trim();
  const en = String(value.en ?? '').trim();
  const kind = options?.kind ?? 'label';

  if (en && !looksFakeEnglish(ua, en) && !CYRILLIC_RE.test(en)) {
    return en;
  }

  if (kind === 'description') {
    if (ua) {
      return generateEnglishFallback(ua);
    }
    return en || ua;
  }

  return generateEnglishFallback(ua || en);
}

export function hasSuspiciousEnglishText(value: LocalizedValue) {
  return looksFakeEnglish(String(value.ua ?? ''), String(value.en ?? ''));
}
