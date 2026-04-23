const GP_PORTAL_FALLBACK_PATTERN =
  /\bGP Portal\b|портал[і]? GP|Price on GP Portal|Ціна на (?:порталі )?GP|Ціна на GP|Портал загальної практики/i;

type LocalizedValue = {
  ua?: string | null;
  en?: string | null;
};

export type UrbanGpFallbackProductInput = {
  slug?: string | null;
  sku?: string | null;
  title?: LocalizedValue;
  titleUa?: string | null;
  titleEn?: string | null;
  category?: LocalizedValue;
  categoryUa?: string | null;
  categoryEn?: string | null;
  collection?: LocalizedValue;
  collectionUa?: string | null;
  collectionEn?: string | null;
  brand?: string | null;
  vendor?: string | null;
  productType?: string | null;
};

type UrbanGpFallbackDescription = {
  shortDescription: LocalizedValue;
  longDescription: LocalizedValue;
  bodyHtml: LocalizedValue;
  seoDescription: LocalizedValue;
};

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value: string | null | undefined) {
  return normalizeWhitespace(
    String(value ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
  );
}

function excerpt(value: string, max: number) {
  const plain = stripHtml(value);
  if (plain.length <= max) {
    return plain;
  }

  const sliced = plain.slice(0, max);
  const stop = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('; '), sliced.lastIndexOf(', '));
  return `${(stop > 80 ? sliced.slice(0, stop) : sliced).trim()}...`;
}

function pickLocalized(input: UrbanGpFallbackProductInput, key: 'title' | 'category' | 'collection', locale: 'ua' | 'en') {
  const direct =
    key === 'title'
      ? locale === 'ua'
        ? input.titleUa
        : input.titleEn
      : key === 'category'
        ? locale === 'ua'
          ? input.categoryUa
          : input.categoryEn
        : locale === 'ua'
          ? input.collectionUa
          : input.collectionEn;

  const nested = input[key]?.[locale];
  const fallback = input[key]?.[locale === 'ua' ? 'en' : 'ua'];

  return normalizeWhitespace(direct ?? nested ?? fallback ?? '');
}

function parseWheelSpec(title: string) {
  const diameter = title.match(/\b(19|20|21|22|23|24|25)"/)?.[0] ?? null;
  const wheelCode = title.match(/\b(UCR|UC\d|WX\d?-?R?|WX\d|UV|UF|NDS)\b/i)?.[0]?.toUpperCase() ?? null;
  const pcd = title.match(/\b\d+x\d+\b/i)?.[0]?.toUpperCase() ?? null;
  const offset = title.match(/\bET-?\d+\b/i)?.[0]?.toUpperCase() ?? null;
  const finish =
    title.match(/\b(Gloss Black|Satin Black|Gloss Bronze|Satin Bronze|Satin Grey|Silver|Black|Polished Face)\b/i)?.[0] ??
    null;
  const axle = title.match(/\b(Front|Rear)\b/i)?.[0] ?? null;
  const fitment = title.match(/\(([^)]+)\)/)?.[1] ?? null;

  return { diameter, wheelCode, pcd, offset, finish, axle, fitment };
}

function isWheelLike(input: UrbanGpFallbackProductInput, title: string) {
  const category = normalizeWhitespace(input.categoryEn ?? input.category?.en ?? input.productType).toLowerCase();
  return (
    category === 'wheels' ||
    category === 'wheel spacers' ||
    category === 'wheel nuts' ||
    /\b(UCR|UC\d|WX\d?-?R?|WX\d|UV|UF|NDS)\b/i.test(title) ||
    /\b\d+x\d+\b/i.test(title)
  );
}

function buildList(items: Array<string | null | undefined>) {
  const lines = items.map((item) => normalizeWhitespace(item)).filter(Boolean);
  return `<ul>${lines.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function buildHtml(input: UrbanGpFallbackProductInput, locale: 'ua' | 'en') {
  const title = pickLocalized(input, 'title', locale) || normalizeWhitespace(input.slug) || 'Urban Automotive product';
  const titleEn = pickLocalized(input, 'title', 'en') || title;
  const category = pickLocalized(input, 'category', locale) || normalizeWhitespace(input.productType) || (locale === 'ua' ? 'Компонент' : 'Component');
  const collection = pickLocalized(input, 'collection', locale);
  const vehicle = collection || (locale === 'ua' ? 'відповідної Urban-конфігурації' : 'the matching Urban configuration');
  const sku = normalizeWhitespace(input.sku);
  const wheel = isWheelLike(input, titleEn);

  if (wheel) {
    const spec = parseWheelSpec(titleEn);
    const details =
      locale === 'ua'
        ? [
            spec.diameter ? `Діаметр: ${spec.diameter}` : null,
            spec.wheelCode ? `Дизайн диска: ${spec.wheelCode}` : null,
            spec.pcd ? `PCD: ${spec.pcd}` : null,
            spec.offset ? `Виліт: ${spec.offset}` : null,
            spec.finish ? `Оздоблення: ${spec.finish}` : null,
            spec.axle ? `Позиція: ${spec.axle}` : null,
            spec.fitment ? `Сумісність: ${spec.fitment}` : null,
            sku ? `Артикул: ${sku}` : null,
            category ? `Категорія: ${category}` : null,
          ]
        : [
            spec.diameter ? `Diameter: ${spec.diameter}` : null,
            spec.wheelCode ? `Wheel design: ${spec.wheelCode}` : null,
            spec.pcd ? `PCD: ${spec.pcd}` : null,
            spec.offset ? `Offset: ${spec.offset}` : null,
            spec.finish ? `Finish: ${spec.finish}` : null,
            spec.axle ? `Axle position: ${spec.axle}` : null,
            spec.fitment ? `Fitment: ${spec.fitment}` : null,
            sku ? `SKU: ${sku}` : null,
            category ? `Category: ${category}` : null,
          ];

    return [
      `<p>${escapeHtml(locale === 'ua' ? `Специфікація Urban Automotive для ${vehicle}.` : `Urban Automotive wheel specification for ${vehicle}.`)}</p>`,
      `<h3>${locale === 'ua' ? 'Специфікація' : 'Specification'}</h3>`,
      buildList(details),
      `<p>${escapeHtml(locale === 'ua' ? 'Перед замовленням підтвердьте фінальну сумісність, оздоблення та комплектацію з менеджером.' : 'Confirm final fitment, finish, and package scope with our team before ordering.')}</p>`,
    ].join('');
  }

  const details =
    locale === 'ua'
      ? [
          `Позиція: ${title}`,
          collection ? `Колекція: ${collection}` : null,
          category ? `Категорія: ${category}` : null,
          sku ? `Артикул: ${sku}` : null,
        ]
      : [
          `Item: ${title}`,
          collection ? `Collection: ${collection}` : null,
          category ? `Category: ${category}` : null,
          sku ? `SKU: ${sku}` : null,
        ];

  return [
    `<p>${escapeHtml(locale === 'ua' ? `Позиція Urban Automotive для ${vehicle}.` : `Urban Automotive product listing for ${vehicle}.`)}</p>`,
    `<h3>${locale === 'ua' ? 'Деталі позиції' : 'Product details'}</h3>`,
    buildList(details),
    `<p>${escapeHtml(locale === 'ua' ? 'Перед замовленням підтвердьте точну сумісність, оздоблення та склад поставки з менеджером.' : 'Confirm exact fitment, finish, and package contents with our team before ordering.')}</p>`,
  ].join('');
}

export function isUnsafeUrbanGpDescription(value: string | null | undefined) {
  return GP_PORTAL_FALLBACK_PATTERN.test(String(value ?? ''));
}

export function buildUrbanGpSafeFallbackDescription(input: UrbanGpFallbackProductInput): UrbanGpFallbackDescription {
  const bodyHtmlEn = buildHtml(input, 'en');
  const bodyHtmlUa = buildHtml(input, 'ua');

  return {
    bodyHtml: {
      en: bodyHtmlEn,
      ua: bodyHtmlUa,
    },
    longDescription: {
      en: stripHtml(bodyHtmlEn),
      ua: stripHtml(bodyHtmlUa),
    },
    shortDescription: {
      en: excerpt(bodyHtmlEn, 220),
      ua: excerpt(bodyHtmlUa, 220),
    },
    seoDescription: {
      en: excerpt(bodyHtmlEn, 155),
      ua: excerpt(bodyHtmlUa, 155),
    },
  };
}
