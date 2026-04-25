const GP_PORTAL_FALLBACK_PATTERN =
  /\bGP Portal\b|портал[і]? GP|Price on GP Portal|Ціна на (?:порталі )?GP|Ціна на GP|Портал загальної практики/i;
const POOR_URBAN_UA_COPY_PATTERN =
  /передня\s+передня|задн(ій|я)\s+час\b|плаваюч[а-яіїєґ]*\s+вушк|з\s+чотирма\s+заготовками|OEM-якісн|змінити\s+зовнішній\s+вигляд|перетворити\s+зовнішн[а-яіїєґ]*\s+вигляд|естетичн[а-яіїєґ]*\s+приваблив|візуальн[а-яіїєґ]*\s+(видимість|ефект|приваблив)|продуктивного позашляховика|попередньо оновлен|широкофюзеляжн|міськ[а-яіїєґ]*\s+емблем|программн|вутк|деталі позиції|позиція Urban Automotive для|обвіси Visual Carbon Fibre|специфікація побудована|розроблен[а-яіїєґ]*,?\s+щоб|створен[а-яіїєґ]*,?\s+щоб|покращеною зовнішністю|зміни положення|змінити естетику|набір арки|вибагливого|вуглецевого волокна[^.]{0,120}вуглецевого волокна/i;

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

export function hasPoorUrbanUaMachineCopy(value: string | null | undefined) {
  return POOR_URBAN_UA_COPY_PATTERN.test(stripHtml(value));
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

export function getUrbanCuratedDescriptionOverride(
  input: Pick<UrbanGpFallbackProductInput, 'slug'>
): UrbanGpFallbackDescription | null {
  if (input.slug === 'urb-dif-25358211-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Visual Carbon Fibre rear diffuser gives the Audi RS3 8Y Hatchback a much stronger rear profile. It replaces the standard lower visual language with a more technical carbon finish, integrated bumper sill treatment, and the signature Urban emblem.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Rear diffuser assembly in Visual Carbon Fibre.',
        'Integrated rear bumper sill elements.',
        'Urban emblem detail for a branded rear finish.',
        'Designed for Audi RS3 8Y Hatchback fitment.',
      ]),
      '<p>Front bumper intake trims, side sills, rear spoiler, wheels, tyres, interior upgrades, and installation work are not included with this rear diffuser.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Задній дифузор Urban Visual Carbon Fibre робить Audi RS3 8Y Hatchback значно виразнішим ззаду. Він замінює стандартну нижню графіку на технічніше карбонове оформлення з інтегрованими боковими елементами бампера та фірмовою емблемою Urban.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Задній дифузор у виконанні Visual Carbon Fibre.',
        'Інтегровані бокові елементи заднього бампера.',
        'Емблема Urban для фірмового завершення задньої частини.',
        'Розроблено для Audi RS3 8Y Hatchback.',
      ]),
      '<p>Передні накладки повітрозабірників, бокові пороги, задній спойлер, диски, шини, оновлення салону та роботи з монтажу не входять до цього заднього дифузора.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-fro-25358209-v1') {
    const bodyHtmlEn = [
      '<p>Urban Visual Carbon Fibre front bumper intake trims give the Audi RS3 8Y a sharper, more focused front end. They add carbon detail to the intake area while keeping the RS3 clean, purposeful, and OEM Plus rather than overstyled.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Front bumper intake trim set in Visual Carbon Fibre.',
        'Designed for Audi RS3 8Y Hatchback and Saloon applications.',
        'Carbon visual detail for the front intake surrounds.',
        'Matched to the wider Urban RS3 exterior styling language.',
      ]),
      '<p>Rear diffuser, side sills, rear spoiler, wheels, tyres, interior upgrades, and installation work are not included with these front intake trims.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Передні накладки повітрозабірників Urban Visual Carbon Fibre роблять Audi RS3 8Y гострішою та зібранішою спереду. Вони додають карбоновий акцент у зоні повітрозабірників, зберігаючи чистий OEM Plus-характер RS3 без зайвої візуальної агресії.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Комплект накладок повітрозабірників переднього бампера у виконанні Visual Carbon Fibre.',
        'Розроблено для Audi RS3 8Y Hatchback та Saloon.',
        'Карбоновий акцент для оформлення передніх повітрозабірників.',
        'Виконані в єдиній зовнішній стилістиці Urban RS3.',
      ]),
      '<p>Задній дифузор, бокові пороги, задній спойлер, диски, шини, оновлення салону та роботи з монтажу не входять до цих передніх накладок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-sil-25358218-v1') {
    const bodyHtmlEn = [
      '<p>Urban Visual Carbon Fibre rear quarter sills add a sharper lower rear detail to the Audi RS4 B9/B9.5. The piece visually ties the rear bumper area into the wider Urban carbon programme and gives the RS4 a more finished, technical rear stance.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Rear quarter sill / rear lower spat treatment in Visual Carbon Fibre.',
        'Lacquered carbon finish matched to the Urban RS4 exterior programme.',
        'Designed for Audi RS4 B9 and B9.5 fitment.',
      ]),
      '<p>Front splitter, side sill package, upper and lower rear spoilers, wheels, tyres, interior upgrades, and installation work are not included with these rear lower trims.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Задні нижні накладки Urban Visual Carbon Fibre додають Audi RS4 B9/B9.5 чіткішу деталь у нижній задній зоні. Елемент візуально поєднує область заднього бампера з карбоновою програмою Urban і робить задній профіль RS4 більш завершеним та технічним.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Задні quarter sills / нижні задні spats у виконанні Visual Carbon Fibre.',
        'Лаковане карбонове оздоблення в стилі зовнішньої програми Urban RS4.',
        'Розроблено для Audi RS4 B9 та B9.5.',
      ]),
      '<p>Передній спліттер, пакет бокових порогів, верхній і нижній задні спойлери, диски, шини, оновлення салону та роботи з монтажу не входять до цих задніх нижніх накладок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-spl-25358221-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Visual Carbon Fibre front splitter gives the Audi RS4 B9.5 a lower, more purposeful front edge. It sharpens the car without losing the clean OEM Plus character that suits the RS4 body.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Front splitter in Visual Carbon Fibre with Urban branding.',
        'Lacquered carbon finish for the RS4 B9.5 front bumper.',
        'Designed to visually lower and widen the front profile.',
      ]),
      '<p>Rear quarter sills, rear spoilers, wheels, tyres, interior upgrades, and installation work are not included with this front splitter.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Передній спліттер Urban Visual Carbon Fibre робить Audi RS4 B9.5 нижчою візуально та більш зібраною спереду. Він підкреслює характер автомобіля, але зберігає чистий OEM Plus-стиль, який пасує кузову RS4.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Передній спліттер у виконанні Visual Carbon Fibre з брендингом Urban.',
        'Лаковане карбонове оздоблення для переднього бампера RS4 B9.5.',
        'Візуально занижує та розширює передній профіль автомобіля.',
      ]),
      '<p>Задні нижні накладки, задні спойлери, диски, шини, оновлення салону та роботи з монтажу не входять до цього переднього спліттера.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-spo-25358219-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Visual Carbon Fibre lower rear lip spoiler adds a cleaner and more defined lower rear line to the Audi RS4 B9/B9.5. It is a focused rear-detail upgrade, not a full rear bumper package.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Lower rear lip spoiler in Visual Carbon Fibre.',
        'Lacquered carbon finish for the RS4 rear profile.',
        'Designed for Audi RS4 B9 and B9.5 applications.',
      ]),
      '<p>Upper rear lip spoiler, front splitter, rear quarter sills, wheels, tyres, interior upgrades, and installation work are not included with this lower rear spoiler.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Нижній задній lip spoiler Urban Visual Carbon Fibre додає Audi RS4 B9/B9.5 чистішу й чіткішу нижню лінію ззаду. Це окреме заднє карбонове доопрацювання, а не повний пакет заднього бампера.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Нижній задній lip spoiler у виконанні Visual Carbon Fibre.',
        'Лаковане карбонове оздоблення для заднього профілю RS4.',
        'Розроблено для Audi RS4 B9 та B9.5.',
      ]),
      '<p>Верхній задній lip spoiler, передній спліттер, задні нижні накладки, диски, шини, оновлення салону та роботи з монтажу не входять до цього нижнього заднього спойлера.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-spo-25358220-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Visual Carbon Fibre upper rear lip spoiler gives the Audi RS4 B9/B9.5 a more distinctive roofline and rear finish. It adds the upper carbon signature that visually completes the RS4 rear profile.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Upper rear lip spoiler in Visual Carbon Fibre.',
        'Lacquered carbon finish matched to the Urban RS4 programme.',
        'Designed for Audi RS4 B9 and B9.5 applications.',
      ]),
      '<p>Lower rear lip spoiler, front splitter, rear quarter sills, wheels, tyres, interior upgrades, and installation work are not included with this upper rear spoiler.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Верхній задній lip spoiler Urban Visual Carbon Fibre робить Audi RS4 B9/B9.5 впізнаванішою по лінії даху та задньому профілю. Це верхній карбоновий акцент, який візуально завершує задню частину RS4.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Верхній задній lip spoiler у виконанні Visual Carbon Fibre.',
        'Лаковане карбонове оздоблення в стилі програми Urban RS4.',
        'Розроблено для Audi RS4 B9 та B9.5.',
      ]),
      '<p>Нижній задній lip spoiler, передній спліттер, задні нижні накладки, диски, шини, оновлення салону та роботи з монтажу не входять до цього верхнього заднього спойлера.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-dif-25358226-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Visual Carbon Fibre rear diffuser gives the Audi C8 RS6 / RS7 a more technical and aggressive rear finish. It adds the lower carbon structure and Urban emblem that make the rear of the car feel much more bespoke.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Rear diffuser assembly in Visual Carbon Fibre.',
        'Urban emblem integrated into the rear carbon detail.',
        'Designed for Audi C8 RS6 and RS7 applications.',
      ]),
      '<p>Lower rear lip spoiler, front splitter, side sills, exhaust system, wheels, tyres, interior upgrades, and installation work are not included with this rear diffuser.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Задній дифузор Urban Visual Carbon Fibre робить Audi C8 RS6 / RS7 технічнішим і агресивнішим ззаду. Він додає нижню карбонову структуру та емблему Urban, завдяки чому задня частина автомобіля виглядає значно індивідуальніше.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Задній дифузор у виконанні Visual Carbon Fibre.',
        'Емблема Urban інтегрована в задню карбонову деталь.',
        'Розроблено для Audi C8 RS6 та RS7.',
      ]),
      '<p>Нижній задній lip spoiler, передній спліттер, бокові пороги, вихлопна система, диски, шини, оновлення салону та роботи з монтажу не входять до цього заднього дифузора.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-spo-25358227-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Visual Carbon Fibre lower rear lip spoiler adds depth and definition to the rear bumper area of the Audi C8 RS6 / RS7. It is a focused lower rear styling piece that works with the car’s performance shape without turning it into a full rear package.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Lower rear lip spoiler in Visual Carbon Fibre.',
        'Carbon detail for the lower rear bumper line.',
        'Designed for Audi C8 RS6 and RS7 applications.',
      ]),
      '<p>Rear diffuser, front splitter, side sills, exhaust system, wheels, tyres, interior upgrades, and installation work are not included with this lower rear spoiler.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Нижній задній lip spoiler Urban Visual Carbon Fibre додає Audi C8 RS6 / RS7 глибину й чіткість у зоні заднього бампера. Це окрема нижня задня деталь, яка працює з динамічною формою автомобіля, але не є повним заднім пакетом.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Нижній задній lip spoiler у виконанні Visual Carbon Fibre.',
        'Карбоновий акцент для нижньої лінії заднього бампера.',
        'Розроблено для Audi C8 RS6 та RS7.',
      ]),
      '<p>Задній дифузор, передній спліттер, бокові пороги, вихлопна система, диски, шини, оновлення салону та роботи з монтажу не входять до цього нижнього заднього спойлера.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-fro-25358230-v1') {
    const bodyHtmlEn = [
      '<p>Urban Visual Carbon Fibre front eyebrow blades sharpen the front bumper detail of the Audi RSQ8 Pre-Facelift. They add a controlled carbon accent to the intake area and make the front end feel more focused without changing the whole bumper package.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Left and right front eyebrow extensions in Visual Carbon Fibre.',
        'Designed for Audi RSQ8 Pre-Facelift models.',
        'Carbon detail for the front bumper intake line.',
      ]),
      '<p>Front splitter, rear diffuser, rear spoilers, side sills, wheels, tyres, interior upgrades, and installation work are not included with these front eyebrow blades.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Передні eyebrow-накладки Urban Visual Carbon Fibre підкреслюють деталі переднього бампера Audi RSQ8 Pre-Facelift. Вони додають контрольований карбоновий акцент у зоні повітрозабірників і роблять передню частину зібранішою без заміни всього бампера.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Ліва та права передні eyebrow-накладки у виконанні Visual Carbon Fibre.',
        'Розроблено для Audi RSQ8 Pre-Facelift.',
        'Карбоновий акцент для лінії передніх повітрозабірників.',
      ]),
      '<p>Передній спліттер, задній дифузор, задні спойлери, бокові пороги, диски, шини, оновлення салону та роботи з монтажу не входять до цих передніх eyebrow-накладок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-spo-26006234-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Visual Carbon Fibre lower rear lip spoiler gives the Audi RSQ8 Pre-Facelift a sharper lower rear line. It adds a carbon detail beneath the tailgate area and visually tightens the rear bumper without becoming a full rear conversion.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Lower rear lip spoiler in Visual Carbon Fibre.',
        'Urban weave orientation for the RSQ8 rear profile.',
        'Designed for Audi RSQ8 Pre-Facelift models.',
      ]),
      '<p>Upper rear spoiler, rear diffuser, front eyebrow blades, wheels, tyres, interior upgrades, and installation work are not included with this lower rear spoiler.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Нижній задній lip spoiler Urban Visual Carbon Fibre робить Audi RSQ8 Pre-Facelift чіткішим у нижній задній лінії. Він додає карбоновий акцент під зоною кришки багажника та візуально збирає задній бампер без повної задньої конверсії.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Нижній задній lip spoiler у виконанні Visual Carbon Fibre.',
        'Urban weave orientation для заднього профілю RSQ8.',
        'Розроблено для Audi RSQ8 Pre-Facelift.',
      ]),
      '<p>Верхній задній спойлер, задній дифузор, передні eyebrow-накладки, диски, шини, оновлення салону та роботи з монтажу не входять до цього нижнього заднього спойлера.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-spo-25358234-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Satin upper rear lip spoiler gives the Audi RSQ8 a more complete and more deliberate rear silhouette. It is a clean upper rear detail for both RSQ8 Pre-Facelift and Facelift styling directions.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Upper rear lip spoiler with Satin finish.',
        'Compatible styling direction for RSQ8 Pre-Facelift and Facelift applications.',
        'Designed to complete the upper rear profile without replacing the full rear package.',
      ]),
      '<p>Lower rear spoiler, rear diffuser, front eyebrow blades, wheels, tyres, interior upgrades, and installation work are not included with this upper rear spoiler.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Верхній задній lip spoiler Urban Satin робить Audi RSQ8 більш завершеним і впевненим по задньому силуету. Це чиста верхня задня деталь для RSQ8 Pre-Facelift та Facelift.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Верхній задній lip spoiler у виконанні Satin.',
        'Підходить до стилістики RSQ8 Pre-Facelift та Facelift.',
        'Завершує верхній задній профіль без заміни повного заднього пакета.',
      ]),
      '<p>Нижній задній спойлер, задній дифузор, передні eyebrow-накладки, диски, шини, оновлення салону та роботи з монтажу не входять до цього верхнього заднього спойлера.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-dif-25358238-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Visual Carbon Fibre Satin rear diffuser gives the Audi RSQ8 Facelift a stronger and more technical rear finish. It focuses the lower rear section with a satin carbon look and is not compatible with tow hook applications.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Rear diffuser set in Visual Carbon Fibre Satin.',
        'Designed for Audi RSQ8 Facelift models.',
        'Not compatible with tow hook applications.',
      ]),
      '<p>Upper and lower rear spoilers, front eyebrow blades, side sills, wheels, tyres, interior upgrades, and installation work are not included with this rear diffuser.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Задній дифузор Urban Visual Carbon Fibre Satin робить Audi RSQ8 Facelift сильнішим і технічнішим ззаду. Він акцентує нижню задню частину сатиновим карбоновим виглядом і не сумісний з авто з tow hook.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Комплект заднього дифузора у виконанні Visual Carbon Fibre Satin.',
        'Розроблено для Audi RSQ8 Facelift.',
        'Не сумісний з конфігураціями з tow hook.',
      ]),
      '<p>Верхній і нижній задні спойлери, передні eyebrow-накладки, бокові пороги, диски, шини, оновлення салону та роботи з монтажу не входять до цього заднього дифузора.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-fro-25358235-v1') {
    const bodyHtmlEn = [
      '<p>The Urban PU-RIM front eyebrow set sharpens the updated front end of the Audi RSQ8 Facelift. It adds a more defined bumper line in a paint-ready PU-RIM construction rather than a carbon-fibre finish.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Left and right front bumper eyebrow extensions in PU-RIM.',
        'Designed for Audi RSQ8 Facelift models.',
        'Paint-ready construction for a clean exterior integration.',
      ]),
      '<p>Carbon front splitter, rear diffuser, rear spoilers, side sills, wheels, tyres, interior upgrades, and installation work are not included with this front eyebrow set.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Передні eyebrow-накладки Urban PU-RIM роблять оновлену передню частину Audi RSQ8 Facelift чіткішою. Це елемент для формування лінії бампера у виконанні PU-RIM під фарбування, а не карбонова деталь.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Ліва та права передні eyebrow-накладки бампера у виконанні PU-RIM.',
        'Розроблено для Audi RSQ8 Facelift.',
        'Конструкція під фарбування для чистої інтеграції в екстер’єр.',
      ]),
      '<p>Карбоновий передній спліттер, задній дифузор, задні спойлери, бокові пороги, диски, шини, оновлення салону та роботи з монтажу не входять до цього комплекту передніх eyebrow-накладок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-acc-25358162-v1') {
    const bodyHtmlEn = [
      '<p>The Urban black roof rail kit gives the Volkswagen Transporter T6.1 SWB a cleaner, more purposeful roofline while adding the practical base for carrying systems on the van.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Black roof rail kit for Volkswagen Transporter T6.1 short wheelbase models.',
        'Designed to integrate with the Urban T6.1 exterior programme.',
        'Adds a useful mounting base while keeping the van visually clean.',
      ]),
      '<p>Cross bars, roof boxes, roof light bar, wheels, tyres, side tubes, body styling parts, and installation work are not included with this roof rail kit.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Чорні рейлінги Urban роблять Volkswagen Transporter T6.1 SWB більш зібраним і практичним зверху. Вони додають акуратну базу для багажних систем і не перевантажують силует фургона.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Комплект чорних рейлінгів для Volkswagen Transporter T6.1 з короткою базою SWB.',
        'Стилістично поєднується з програмою Urban для T6.1.',
        'Додає практичну основу для кріплень і зберігає чистий зовнішній вигляд автомобіля.',
      ]),
      '<p>Поперечини, бокси на дах, даховий світловий модуль, диски, шини, бокові труби, елементи обвісу та роботи з монтажу не входять до цього комплекту рейлінгів.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-acc-25358163-v1') {
    const bodyHtmlEn = [
      '<p>The Urban detachable towbar with electrics keeps the Volkswagen Transporter T6.1 ready for real work without leaving a permanent towball in view. It is the practical towing upgrade for owners who want function with a clean rear profile.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Detachable towbar assembly for Volkswagen Transporter T6.1.',
        'Supplied with electrics for trailer lighting connection.',
        'Removable design helps preserve the rear appearance when towing is not needed.',
      ]),
      '<p>Trailer, tow accessories, rear styling parts, exhaust finishers, wheels, tyres, and installation work are not included with this detachable towbar kit.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Знімний фаркоп Urban з електрикою залишає Volkswagen Transporter T6.1 готовим до роботи, але без постійного буксирного гака на виду. Це практичне рішення для власників, яким потрібна функція буксирування і чистий задній вигляд автомобіля.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Знімний фаркоп для Volkswagen Transporter T6.1.',
        'Комплект постачається з електрикою для підключення світлотехніки причепа.',
        'Знімна конструкція допомагає зберегти акуратний задній профіль, коли фаркоп не використовується.',
      ]),
      '<p>Причіп, додаткові аксесуари буксирування, задні елементи стайлінгу, насадки вихлопу, диски, шини та роботи з монтажу не входять до цього комплекту фаркопа.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-log-25353014-v1') {
    const bodyHtmlEn = [
      '<p>Urban Automotive branding package for Range Rover Sport L461, designed to add the signature Urban exterior identity with clean OEM-plus fitment.</p>',
      '<h3>Package contents</h3>',
      buildList([
        'Urban icon badge.',
        'Front ABS Urban lettering.',
        'Rear ABS Urban lettering.',
      ]),
      '<h3>Details</h3>',
      buildList([
        'ABS components designed for exterior use.',
        'Direct-fit application for the matching Range Rover Sport L461 configuration.',
        'Adhesive mounting system for professional installation.',
      ]),
      '<p>Confirm final compatibility and installation scope before ordering.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Комплект брендингу Urban Automotive для Range Rover Sport L461 додає фірмову зовнішню ідентичність Urban у стриманому OEM Plus-стилі.</p>',
      '<h3>Склад комплекту</h3>',
      buildList([
        'Емблема Urban Icon.',
        'Передній напис Urban з ABS.',
        'Задній напис Urban з ABS.',
      ]),
      '<h3>Деталі</h3>',
      buildList([
        'ABS-компоненти для зовнішнього використання.',
        'Пряма сумісність із відповідною конфігурацією Range Rover Sport L461.',
        'Клейова система кріплення для професійного монтажу.',
      ]),
      '<p>Перед замовленням підтвердьте фінальну сумісність і склад встановлення.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-dif-26054207-v1') {
    const bodyHtmlEn = [
      '<p>Visual Carbon Fibre rear diffuser assembly for Lamborghini Urus SE, developed as part of the Urban Automotive rear styling programme.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Replacement carbon-fibre rear bumper with integrated double-vented diffuser.',
        'Floating carbon-fibre canards for a more technical rear profile.',
        'Quad billet anodised aluminium exhaust finishers with outer accent detailing.',
      ]),
      '<p>Confirm package scope, finish, and installation requirements before ordering.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Задній дифузор Visual Carbon Fibre для Lamborghini Urus SE, розроблений як частина задньої програми стилізації Urban Automotive.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Карбоновий задній бампер із інтегрованим двоканальним дифузором.',
        'Карбонові канарди для більш технічного й виразного заднього профілю.',
        'Чотири анодовані billet-насадки вихлопу з акцентними зовнішніми деталями.',
      ]),
      '<p>Перед замовленням підтвердьте склад комплекту, оздоблення та вимоги до встановлення.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-fro-26054204-v1') {
    const bodyHtmlEn = [
      '<p>This Urban Visual Carbon Fibre lower front bumper apron gives the Lamborghini Urus SE a sharper and more technical front edge. It is the front lower carbon element from the official Urban Urus SE styling language, focused on the splitter and canard area rather than the full body kit.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Lower front bumper apron in Visual Carbon Fibre.',
        'Three-piece carbon-fibre splitter treatment.',
        'Integrated canard visual detail.',
        'Designed for the Urban Lamborghini Urus SE exterior programme.',
      ]),
      '<p>Bonnet, arch extensions, side vents, rear bumper, diffuser, wheels, tyres, wheel spacers, interior upgrades, and installation work are not included with this front apron.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Нижня накладка переднього бампера Urban Visual Carbon Fibre робить Lamborghini Urus SE гострішим і технічнішим у передній частині. Це нижній карбоновий елемент з офіційної програми Urban для Urus SE, сфокусований на зоні спліттера та канардів, а не на повному комплекті обвісу.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Нижня накладка переднього бампера у виконанні Visual Carbon Fibre.',
        'Трисекційне карбонове оформлення спліттера.',
        'Інтегрована графіка канардів.',
        'Розроблена для зовнішньої програми Urban Lamborghini Urus SE.',
      ]),
      '<p>Капот, розширення арок, бокові вентиляційні елементи, задній бампер, дифузор, диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять до цієї передньої накладки.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-doo-26093237-v1') {
    const bodyHtmlEn = [
      '<p>Urban Visual Carbon Fibre lower door moulding inserts add a cleaner, more performance-led side detail to the Lamborghini Urus SE. They work as a focused side-profile upgrade within the wider Urban Urus SE programme.</p>',
      '<h3>Key details</h3>',
      buildList([
        'Lower door moulding inserts in Visual Carbon Fibre.',
        'Side-profile carbon detail for the Urus SE body line.',
        'Designed to visually connect the lower sill and side styling areas.',
        'Matched to the Urban Urus SE carbon exterior language.',
      ]),
      '<p>Front splitter, bonnet, arch extensions, rear bumper, diffuser, wheels, tyres, wheel spacers, interior upgrades, and installation work are not included with these lower door inserts.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Нижні дверні вставки Urban Visual Carbon Fibre додають Lamborghini Urus SE чистішу й спортивнішу бокову деталь. Це окремий елемент бокового профілю в межах ширшої програми Urban для Urus SE.</p>',
      '<h3>Ключові деталі</h3>',
      buildList([
        'Нижні дверні вставки у виконанні Visual Carbon Fibre.',
        'Карбонова деталь бокового профілю для лінії кузова Urus SE.',
        'Візуально поєднують нижню частину порога та боковий стайлінг.',
        'Виконані в єдиній карбоновій мові Urban Urus SE.',
      ]),
      '<p>Передній спліттер, капот, розширення арок, задній бампер, дифузор, диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять до цих нижніх дверних вставок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-wid-25353015-v1') {
    const bodyHtmlEn = [
      '<p>The Urban PUR Widetrack arch set gives the Range Rover L460 a broader and more individual stance, adding the visual width that makes the latest Range Rover feel more assertive without replacing the full body package.</p>',
      '<h3>Package contents</h3>',
      buildList([
        'PUR Widetrack arch extensions for the Range Rover L460.',
        'Front and rear arch coverage for a wider side profile.',
        'Paintable PUR construction for a clean exterior integration.',
      ]),
      '<p>Front bumper, rear bumper, diffuser, grille, bonnet, side sills, mirror caps, wheels, tyres, wheel spacers, interior upgrades, and installation work are not included with this arch set.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Комплект арок Urban PUR Widetrack робить Range Rover L460 ширшим візуально та більш індивідуальним, додаючи саме ту посадку, яка відрізняє Urban-конфігурацію від стандартного Range Rover.</p>',
      '<h3>Склад комплекту</h3>',
      buildList([
        'Розширення арок PUR Widetrack для Range Rover L460.',
        'Передні та задні арки для ширшого бокового профілю.',
        'PUR-конструкція під фарбування для чистої інтеграції в екстер’єр.',
      ]),
      '<p>Передній бампер, задній бампер, дифузор, решітка, капот, бокові пороги, накладки дзеркал, диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять до цього комплекту арок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-arc-26006219-v1') {
    const bodyHtmlEn = [
      '<p>The Urban PUR Widetrack arch set gives the Range Rover Sport L461 a wider and more purposeful side profile. It is the arch-extension package for the L461 programme, not a full bumper or complete body-kit package.</p>',
      '<h3>Package contents</h3>',
      buildList([
        'PUR Widetrack arch extensions for Range Rover Sport L461.',
        'Front and rear arch treatment for a stronger stance.',
        'Paintable PUR construction for a factory-clean finish.',
      ]),
      '<p>Front bumper, rear bumper, diffuser, grille, bonnet vents, side sills, mirror caps, wheels, tyres, wheel spacers, interior upgrades, and installation work are not included with this arch set.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Комплект арок Urban PUR Widetrack робить Range Rover Sport L461 ширшим і більш зібраним у боковому профілі. Це саме пакет розширення арок для програми L461, а не повний пакет бамперів чи комплект обвісу.</p>',
      '<h3>Склад комплекту</h3>',
      buildList([
        'Розширення арок PUR Widetrack для Range Rover Sport L461.',
        'Передні та задні арки для сильнішої посадки автомобіля.',
        'PUR-конструкція під фарбування для чистого заводського вигляду.',
      ]),
      '<p>Передній бампер, задній бампер, дифузор, решітка, вентиляційні елементи капота, бокові пороги, накладки дзеркал, диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять до цього комплекту арок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-arc-25353085-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Gloss Black Widetrack arch kit gives the Land Rover Defender 90 a wider, more deliberate stance while keeping the short-wheelbase Defender shape clean and purposeful.</p>',
      '<h3>Package contents</h3>',
      buildList([
        'Gloss Black Widetrack arch extensions for Land Rover Defender 90.',
        'Front and rear arch treatment for a broader Defender 90 side profile.',
        'Designed as a focused arch kit, not a complete exterior package.',
      ]),
      '<p>Front bumper components, rear bumper components, side steps, mudflaps, roof light pod, wheels, tyres, wheel spacers, interior upgrades, and installation work are not included with this arch kit.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Комплект арок Urban Widetrack Gloss Black робить Land Rover Defender 90 ширшим і впевненішим, але зберігає чистий короткий силует Defender 90. Це деталь, яка одразу додає автомобілю Urban-посадку без переходу в повний зовнішній пакет.</p>',
      '<h3>Склад комплекту</h3>',
      buildList([
        'Розширення арок Widetrack Gloss Black для Land Rover Defender 90.',
        'Передні та задні арки для ширшого бокового профілю Defender 90.',
        'Окремий комплект арок, а не повний пакет екстер’єру.',
      ]),
      '<p>Елементи переднього бампера, елементи заднього бампера, бокові підніжки, бризковики, даховий світловий модуль, диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять до цього комплекту арок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-arc-25358153-v1') {
    const bodyHtmlEn = [
      '<p>The Urban PUR arch extension set gives the Bentley Continental GT a broader, more planted side profile while keeping the grand tourer shape clean and elegant. It is a focused arch package for the Continental GT programme, made to add width without turning the car into a heavy visual conversion.</p>',
      '<h3>Package contents</h3>',
      buildList([
        'PUR arch extensions for Bentley Continental GT.',
        'Front and rear arch treatment for a wider side profile.',
        'Designed to integrate with the Urban Continental GT exterior programme.',
      ]),
      '<p>Front bumper add-ons, grille, rear diffuser, exhaust system, wheels, tyres, interior upgrades, and installation work are not included with this arch extension set.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Комплект арок Urban PUR робить Bentley Continental GT ширшим і більш зібраним у боковому профілі, але зберігає чисту елегантність grand tourer. Це окремий комплект арок для програми Continental GT: він додає автомобілю ширину й індивідуальність без важкої візуальної перебудови.</p>',
      '<h3>Склад комплекту</h3>',
      buildList([
        'Розширення арок PUR для Bentley Continental GT.',
        'Передні та задні арки для ширшого бокового профілю.',
        'Стилістично поєднується з програмою Urban для Continental GT.',
      ]),
      '<p>Елементи переднього бампера, решітка, задній дифузор, вихлопна система, диски, шини, оновлення салону та роботи з монтажу не входять до цього комплекту арок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-arc-26006231-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Hybrid Widetrack arch kit gives the Land Rover Defender 110 a wider, more commanding stance while keeping the L663 body line clean and purposeful. It is the focused arch package for Defender 110 owners who want the Urban look without changing the full exterior package.</p>',
      '<h3>Package contents</h3>',
      buildList([
        'Hybrid Widetrack arch extensions for Land Rover Defender 110 L663.',
        'Front and rear arch treatment for a broader Defender 110 profile.',
        'Designed to integrate with the Urban Defender 110 exterior programme.',
      ]),
      '<p>Front bumper components, rear bumper components, side steps, roof spoiler, light pod, wheels, tyres, wheel spacers, interior upgrades, and installation work are not included with this arch kit.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Комплект арок Urban Hybrid Widetrack робить Land Rover Defender 110 ширшим, впевненішим і більш виразним, але зберігає чисту геометрію кузова L663. Це окремий комплект арок для Defender 110, який додає автомобілю Urban-посадку без заміни всього зовнішнього пакета.</p>',
      '<h3>Склад комплекту</h3>',
      buildList([
        'Розширення арок Hybrid Widetrack для Land Rover Defender 110 L663.',
        'Передні та задні арки для ширшого профілю Defender 110.',
        'Стилістично поєднується з програмою Urban для Defender 110.',
      ]),
      '<p>Елементи переднього бампера, елементи заднього бампера, бокові підніжки, даховий спойлер, даховий світловий модуль, диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять до цього комплекту арок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-arc-26009359-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Wide Track Arch Kit Non-Hybrid RAW gives the Land Rover Defender 110 a broader, more assertive stance with the raw version of the Urban arch package. It is a focused arch kit for the Defender 110 programme, not a complete exterior conversion.</p>',
      '<h3>Package contents</h3>',
      buildList([
        'Wide Track arch kit Non-Hybrid RAW for Land Rover Defender 110.',
        'Front and rear arch treatment for a wider Defender 110 profile.',
        'Designed for the Urban Defender 110 exterior programme.',
      ]),
      '<p>Front bumper components, rear bumper components, side steps, roof spoiler, light pod, wheels, tyres, wheel spacers, interior upgrades, and installation work are not included with this arch kit.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Комплект арок Urban Wide Track Non-Hybrid RAW робить Land Rover Defender 110 ширшим і більш впевненим, використовуючи RAW-версію арок Urban. Це окремий комплект арок для програми Defender 110, а не повна зовнішня конверсія.</p>',
      '<h3>Склад комплекту</h3>',
      buildList([
        'Комплект арок Wide Track Non-Hybrid RAW для Land Rover Defender 110.',
        'Передні та задні арки для ширшого профілю Defender 110.',
        'Розроблено для зовнішньої програми Urban Defender 110.',
      ]),
      '<p>Елементи переднього бампера, елементи заднього бампера, бокові підніжки, даховий спойлер, даховий світловий модуль, диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять до цього комплекту арок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-can-25353086-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Widetrack front canards give the Land Rover Defender 90/110/130 a sharper and more technical front bumper line. They are a focused front-end detail that adds the Urban Widetrack character without changing the full bumper package.</p>',
      '<h3>Package contents</h3>',
      buildList([
        'Pair of Urban Widetrack front canards.',
        'Designed for Land Rover Defender 90, 110, and 130 applications.',
        'Gloss black visual finish shown in the Urban product imagery.',
      ]),
      '<p>Front bumper, DRL intake kit, arches, side steps, roof light pod, wheels, tyres, interior upgrades, and installation work are not included with these front canards.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Передні канарди Urban Widetrack роблять Land Rover Defender 90/110/130 гострішим і технічнішим у зоні переднього бампера. Це окрема деталь передньої частини, яка додає Defender фірмовий Widetrack-характер без заміни всього бампера.</p>',
      '<h3>Склад комплекту</h3>',
      buildList([
        'Пара передніх канардів Urban Widetrack.',
        'Розроблено для Land Rover Defender 90, 110 та 130.',
        'Глянцевий чорний візуальний фініш показаний на офіційних фото Urban.',
      ]),
      '<p>Передній бампер, комплект DRL-повітрозабірників, арки, бокові підніжки, даховий світловий модуль, диски, шини, оновлення салону та роботи з монтажу не входять до цих передніх канардів.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-bod-25353001-v1') {
    const bodyHtmlEn = [
      '<p>This Urban Replacement Bumper Package gives the Range Rover L460 a sharper, more individual presence without losing the calm luxury that defines the car. It keeps the OEM-plus character, but adds deeper carbon bumpers, Visual Carbon Fibre detail, a stronger rear diffuser treatment, and Urban branding that makes the L460 feel clearly different from a standard Range Rover.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Replacement carbon fibre front bumper.',
        'Gloss black front bumper mouthpiece.',
        'Mouthpiece trim overlay in Visual Carbon Fibre.',
        'Integrated daytime running lights with OEM fog lamp carry-over.',
        'Three-piece front bumper splitter in Visual Carbon Fibre.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Replacement carbon fibre rear bumper.',
        'Rear diffuser with removable skid pan in Visual Carbon Fibre.',
        'Milled billet aluminium exhaust finishers with engraved Urban logo.',
      ]),
      '<h3>Urban identity</h3>',
      buildList([
        'Urban UA icon rear tailgate badge.',
      ]),
      '<p>PU-RIM Widetrack fender arches, vented Powerdome hood, Visual Carbon Fibre matrix front grille, upper rear spoiler, lower side sills, mirror covers, 23-inch or 24-inch Urban wheels, and installation work are not included in this body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей пакет заміни бамперів Urban робить Range Rover L460 виразнішим і більш індивідуальним, але не забирає головне - спокійну преміальність Range Rover. Автомобіль зберігає OEM Plus-характер, проте отримує глибші карбонові бампери, акценти Visual Carbon Fibre, сильнішу задню графіку дифузора та фірмовий Urban branding, який одразу відрізняє L460 від стандартної версії.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер замість штатного.',
        'Центральна вставка переднього бампера у глянцевому чорному виконанні.',
        'Декоративна накладка центральної вставки у виконанні Visual Carbon Fibre.',
        'Інтегровані денні ходові вогні зі збереженням штатних протитуманних фар.',
        'Трисекційний передній спліттер у виконанні Visual Carbon Fibre.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній бампер замість штатного.',
        'Задній дифузор зі знімною нижньою захисною накладкою у виконанні Visual Carbon Fibre.',
        'Фрезеровані алюмінієві насадки вихлопу з гравіюванням Urban.',
      ]),
      '<h3>Фірмова ідентичність Urban</h3>',
      buildList([
        'Задня емблема Urban UA icon на кришці багажника.',
      ]),
      '<p>Розширювачі арок PU-RIM Widetrack, вентильований капот Powerdome, передня решітка Matrix у виконанні Visual Carbon Fibre, верхній задній спойлер, нижні бокові пороги, накладки дзеркал, диски Urban 23 або 24 дюйми та роботи з монтажу не входять у цей комплект обвісу.</p>',
    ].join('');

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

  if (input.slug === 'urb-arc-25353072-v1') {
    const bodyHtmlEn = [
      '<p>The Urban wide arch extension set gives the Range Rover Sport L494 SVR the broader, more planted side profile that defines the Urban look. It is a focused arch package for the SVR, not a full bumper or complete body-kit package.</p>',
      '<h3>Package contents</h3>',
      buildList([
        'Wide arch extension set for Range Rover Sport L494 SVR.',
        'Front and rear arch treatment for a stronger SVR stance.',
        'Designed to work with the Urban L494 SVR exterior programme.',
      ]),
      '<p>Front bumper, rear bumper, diffuser, side vents, side steps, carbon mirror caps, wheels, tyres, wheel spacers, interior upgrades, and installation work are not included with this arch extension set.</p>',
    ].join('');
    const bodyHtmlUa = [
      '<p>Комплект розширення арок Urban робить Range Rover Sport L494 SVR ширшим, нижчим візуально і більш впевненим у боковому профілі. Це окремий комплект арок для SVR, а не повний пакет бамперів чи комплект обвісу.</p>',
      '<h3>Склад комплекту</h3>',
      buildList([
        'Комплект розширення арок для Range Rover Sport L494 SVR.',
        'Передні та задні арки для сильнішої посадки SVR.',
        'Стилістично поєднується з програмою Urban для L494 SVR.',
      ]),
      '<p>Передній бампер, задній бампер, дифузор, бокові вентиляційні вставки, підніжки, карбонові накладки дзеркал, диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять до цього комплекту арок.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-bod-25353030-v1') {
    const bodyHtmlEn = [
      '<p>This Urban body kit gives the Range Rover Sport L461 a sharper, wider and more individual presence. It keeps the clean luxury character of the Sport, but adds the Urban visual language: stronger bumper architecture, Visual Carbon Fibre aero details, integrated light graphics and a more assertive rear profile.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Replacement carbon fibre front bumper.',
        'Front bumper mouthpiece set in Visual Carbon Fibre.',
        'Three-piece front splitter in Visual Carbon Fibre.',
        'Integrated daytime running lights.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Replacement carbon fibre rear bumper.',
        'Rear diffuser in Visual Carbon Fibre.',
        'Rear skid pan in Visual Carbon Fibre.',
        'Milled billet aluminium exhaust finishers.',
      ]),
      '<h3>Urban identity</h3>',
      buildList([
        'Urban exterior branding package.',
        'Urban icon badge for the rear tailgate.',
      ]),
      '<p>PU-RIM Widetrack fender arches, Powerdome hood, matrix front grille, lower side sills, side vent kit, upper rear spoiler, mirror covers, 23-inch or 24-inch Urban wheels, performance exhaust and installation work are not included in this body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей комплект обвісу Urban робить Range Rover Sport L461 більш виразним, ширшим візуально і значно індивідуальнішим. Він зберігає чисту преміальність Range Rover Sport, але додає фірмову мову Urban: сильнішу архітектуру бамперів, аеродинамічні елементи Visual Carbon Fibre, інтегровану світлову графіку та впевненіший задній профіль.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер замість штатного.',
        'Комплект центральних вставок переднього бампера у виконанні Visual Carbon Fibre.',
        'Трисекційний передній спліттер Visual Carbon Fibre.',
        'Інтегровані денні ходові вогні.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній бампер замість штатного.',
        'Задній дифузор у виконанні Visual Carbon Fibre.',
        'Задня нижня захисна накладка у виконанні Visual Carbon Fibre.',
        'Фрезеровані алюмінієві насадки вихлопу.',
      ]),
      '<h3>Фірмова ідентичність Urban</h3>',
      buildList([
        'Пакет зовнішнього брендингу Urban.',
        'Задня емблема Urban icon на кришці багажника.',
      ]),
      '<p>Розширювачі арок PU-RIM Widetrack, капот Powerdome, передня решітка Matrix, нижні бокові пороги, комплект бокових вентиляційних вставок, верхній задній спойлер, накладки дзеркал, диски Urban 23 або 24 дюйми, спортивна вихлопна система та роботи з монтажу не входять у цей комплект обвісу.</p>',
    ].join('');

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

  if (input.slug === 'urb-bod-25353062-v1') {
    const bodyHtmlEn = [
      '<p>This Urban replacement bumper package gives the Range Rover Sport L494 2013-2017 a sharper and more individual Urban look without presenting it as the SVR package. In the GP-products structure, this SKU is the Sport replacement bumper package for the pre-facelift L494, combining the carbon bumper kit with lighting, exhaust, tailpipe and Urban identity components.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon Fibre front replacement bumper for Range Rover Sport L494.',
        'Front bumper mouthpiece and side intake sections.',
        'Front lower splitter.',
        'Nolden integral daytime running light package.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon Fibre rear bumper and diffuser package.',
        'Rear skid pan styling.',
        'Range Rover L494 exhaust system.',
        'Satin Black billet aluminium tailpipe finishers.',
      ]),
      '<h3>Urban identity</h3>',
      buildList([
        'Urban UA branding pack.',
        'Urban bonnet and tailgate identity details.',
        'Urban exterior badging package.',
      ]),
      '<p>Wide arch extensions, side vents, side steps, carbon mirror caps, Urban wheels, tyres, interior upgrades, protection packages and installation work are not included in this Sport bumper package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей пакет заміни бамперів Urban робить Range Rover Sport L494 2013-2017 виразнішим і більш індивідуальним, не змішуючи його з SVR-пакетом. У структурі GP-products це пакет для Sport-версії дорестайлінгового L494: карбонові бампери доповнені світлом, вихлопом, насадками та фірмовою ідентичністю Urban.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер для Range Rover Sport L494.',
        'Центральна вставка та бокові секції повітрозабірників переднього бампера.',
        'Нижній передній спліттер.',
        'Комплект інтегрованих денних ходових вогнів Nolden.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній бампер і дифузор.',
        'Задня нижня захисна накладка у стилі Urban.',
        'Вихлопна система для Range Rover L494.',
        'Фрезеровані алюмінієві насадки вихлопу Satin Black.',
      ]),
      '<h3>Фірмова ідентичність Urban</h3>',
      buildList([
        'Фірмовий пакет брендингу Urban UA.',
        'Елементи ідентичності Urban на капоті та кришці багажника.',
        'Фірмовий пакет зовнішніх емблем Urban.',
      ]),
      '<p>Розширювачі арок, бокові вентиляційні вставки, бокові підніжки, карбонові накладки дзеркал, диски Urban, шини, оновлення салону, захисні пакети та роботи з монтажу не входять у цей пакет заміни бамперів для Sport-версії.</p>',
    ].join('');

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

  if (input.slug === 'urb-bod-25353063-v1') {
    const bodyHtmlEn = [
      '<p>This Urban Carbon Fibre V2 body kit gives the Range Rover Sport L494 2013-2017 a cleaner, more assertive Urban exterior. In the GP-products structure, this is the Sport carbon body kit itself, focused on the main exterior panels and stance details rather than the larger bumper package with lighting, exhaust and branding add-ons.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon Fibre front replacement bumper for the Sport body line.',
        'Front bumper intake and splitter styling.',
        'Visual Carbon Fibre front transformation.',
      ]),
      '<h3>Side and stance</h3>',
      buildList([
        'Urban side profile elements for the Sport exterior.',
        'Carbon Fibre visual details matched to the bumper kit.',
        'Lower, more purposeful Urban stance.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon Fibre rear bumper and diffuser styling.',
        'Rear skid pan visual treatment.',
        'Rear profile matched to the front carbon package.',
      ]),
      '<p>Nolden DRL hardware, exhaust system, Urban UA branding pack, billet tailpipe finishers, wheels, tyres, interior upgrades and installation work are not included in this Carbon Fibre V2 body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей комплект обвісу Urban Carbon Fibre V2 - окрема карбонова позиція для Range Rover Sport L494 2013-2017 у структурі GP-products. Це зовнішній комплект Urban, сфокусований на основних кузовних деталях і посадці, а не більший пакет заміни бамперів зі світлом, вихлопом і брендингом.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер для кузовної лінії Sport.',
        'Стилістика передніх повітрозабірників і спліттера.',
        'Передня трансформація у стилі Visual Carbon Fibre.',
      ]),
      '<h3>Боковий профіль і посадка</h3>',
      buildList([
        'Елементи бокового профілю Urban для Sport-версії.',
        'Карбонові візуальні деталі, узгоджені з пакетом бамперів.',
        'Нижча і більш впевнена посадка в стилі Urban.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Стилістика карбонового заднього бампера і дифузора.',
        'Задня нижня захисна накладка у стилі Urban.',
        'Задній профіль, узгоджений із переднім карбоновим пакетом.',
      ]),
      '<p>Модулі денних ходових вогнів Nolden, вихлопна система, пакет брендингу Urban UA, фрезеровані насадки вихлопу, диски, шини, оновлення салону та роботи з монтажу не входять у цей комплект обвісу Carbon Fibre V2.</p>',
    ].join('');

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

  if (input.slug === 'urb-bod-25353066-v1') {
    const bodyHtmlEn = [
      '<p>This Urban replacement bumper package gives the Range Rover Sport SVR L494 2013-2017 a sharper pre-facelift SVR identity. In the GP-products structure, this SKU is the SVR replacement bumper package, pairing the carbon bumper kit with Nolden lighting, Urban UA branding and Satin Black billet tailpipe finishers.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon Fibre front replacement bumper for the SVR body line.',
        'Front bumper intake and splitter styling.',
        'Nolden integral daytime running light package.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon Fibre rear bumper and diffuser package.',
        'Rear skid pan styling.',
        'Satin Black billet aluminium tailpipe finishers.',
      ]),
      '<h3>Urban identity</h3>',
      buildList([
        'Urban UA branding pack.',
        'Urban exterior badging and identity details.',
        'Pre-facelift SVR-specific package structure from GP-products.',
      ]),
      '<p>Wide arch extensions, side vents, side steps, carbon mirror caps, Urban wheels, tyres, performance exhaust system, interior upgrades and installation work are not included in this SVR bumper package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей пакет заміни бамперів Urban робить Range Rover Sport SVR L494 2013-2017 виразнішим і чітко відділяє дорестайлінговий SVR від стандартної версії. У структурі GP-products це пакет заміни бамперів для SVR: карбонові бампери поєднані зі світлом Nolden, брендингом Urban UA та фрезерованими насадками Satin Black.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер для кузовної лінії SVR.',
        'Стилістика передніх повітрозабірників і спліттера.',
        'Комплект інтегрованих денних ходових вогнів Nolden.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній бампер і дифузор.',
        'Задня нижня захисна накладка у стилі Urban.',
        'Фрезеровані алюмінієві насадки вихлопу Satin Black.',
      ]),
      '<h3>Фірмова ідентичність Urban</h3>',
      buildList([
        'Фірмовий пакет брендингу Urban UA.',
        'Зовнішні емблеми та деталі ідентичності Urban.',
        'Структура GP-products саме для дорестайлінгового SVR.',
      ]),
      '<p>Розширювачі арок, бокові вентиляційні вставки, бокові підніжки, карбонові накладки дзеркал, диски Urban, шини, спортивна вихлопна система, оновлення салону та роботи з монтажу не входять у цей пакет заміни бамперів для SVR.</p>',
    ].join('');

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

  if (input.slug === 'urb-bod-25353067-v1') {
    const bodyHtmlEn = [
      '<p>This Urban Carbon Fibre V2 body kit gives the pre-facelift Range Rover Sport SVR L494 2013-2017 the core Urban carbon exterior transformation. In the GP-products structure, this is the SVR carbon body kit itself, kept separate from the larger bumper package that adds lighting, branding and tailpipe components.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon Fibre front replacement bumper for the SVR body line.',
        'Front bumper intake and splitter styling.',
        'Visual Carbon Fibre front presence.',
      ]),
      '<h3>Side and stance</h3>',
      buildList([
        'SVR-focused Urban side profile.',
        'Carbon visual details matched to the bumper package.',
        'More assertive pre-facelift L494 stance.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon Fibre rear bumper and diffuser styling.',
        'Rear skid pan visual treatment.',
        'Rear profile matched to the front SVR carbon package.',
      ]),
      '<p>Nolden DRL hardware, Urban UA branding pack, billet tailpipe finishers, wheels, tyres, performance exhaust system, interior upgrades and installation work are not included in this Carbon Fibre V2 body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей комплект обвісу Urban Carbon Fibre V2 - окрема карбонова позиція для дорестайлінгового Range Rover Sport SVR L494 2013-2017 у структурі GP-products. Він дає основну зовнішню трансформацію Urban, але відрізняється від більшого пакета заміни бамперів для SVR, де додаються світло, брендинг і насадки вихлопу.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер для кузовної лінії SVR.',
        'Стилістика передніх повітрозабірників і спліттера.',
        'Передня присутність у стилі Visual Carbon Fibre.',
      ]),
      '<h3>Боковий профіль і посадка</h3>',
      buildList([
        'Боковий профіль Urban, сфокусований на SVR.',
        'Карбонові візуальні деталі, узгоджені з пакетом бамперів.',
        'Більш впевнена посадка дорестайлінгового L494.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Стилістика карбонового заднього бампера і дифузора.',
        'Задня нижня захисна накладка у стилі Urban.',
        'Задній профіль, узгоджений із переднім карбоновим пакетом SVR.',
      ]),
      '<p>Модулі денних ходових вогнів Nolden, пакет брендингу Urban UA, фрезеровані насадки вихлопу, диски, шини, спортивна вихлопна система, оновлення салону та роботи з монтажу не входять у цей комплект обвісу Carbon Fibre V2.</p>',
    ].join('');

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

  if (input.slug === 'urb-bod-25353068-v1') {
    const bodyHtmlEn = [
      '<p>This Urban replacement bumper package gives the Range Rover Sport L494 2018-2022 a sharper, more individual exterior without presenting it as the SVR kit. It is the Sport bumper package in the GP-products list, focused on the Urban carbon bumper look, integrated lighting and a cleaner rear diffuser profile.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon Fibre front replacement bumper.',
        'Fitted DRL elements in the front bumper.',
        'Urban front grille and bonnet identity details.',
        'Urban bonnet lettering.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon Fibre replacement rear bumper and diffuser.',
        'Carbon Fibre number plate brow.',
        'Twin billet aluminium exhaust tips.',
        'Urban tailgate lettering.',
      ]),
      '<h3>Urban identity</h3>',
      buildList([
        'Urban front grille badge.',
        'Urban rear quarter crest badge.',
        'Urban tailgate crest badge.',
        'Urban pillar authentication badge.',
      ]),
      '<p>Wide arch extensions, side vents, side steps, carbon mirror caps, Urban wheels, tyres, interior upgrades, protection packages and installation work are not included in this bumper package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей пакет заміни бамперів Urban робить Range Rover Sport L494 2018-2022 виразнішим і більш індивідуальним, але не змішує його з SVR-комплектом. У структурі GP-products це пакет для Sport-версії: акцент на карбоновій графіці бамперів Urban, інтегрованому світлі та чистішому задньому дифузорі.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер замість штатного.',
        'Інтегровані елементи денних ходових вогнів у передньому бампері.',
        'Передня решітка Urban і фірмові акценти на капоті.',
        'Напис Urban на капоті.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній бампер і дифузор замість штатних.',
        'Карбонова накладка під номерний знак.',
        'Подвійні фрезеровані алюмінієві насадки вихлопу.',
        'Напис Urban на кришці багажника.',
      ]),
      '<h3>Фірмова ідентичність Urban</h3>',
      buildList([
        'Емблема Urban на передній решітці.',
        'Емблема Urban Crest на задній чверті кузова.',
        'Емблема Urban Crest на кришці багажника.',
        'Автентифікаційний бейдж Urban на стійці.',
      ]),
      '<p>Розширювачі арок, бокові вентиляційні вставки, бокові підніжки, карбонові накладки дзеркал, диски Urban, шини, оновлення салону, захисні пакети та роботи з монтажу не входять у цей пакет заміни бамперів.</p>',
    ].join('');

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

  if (input.slug === 'urb-bod-25353069-v1') {
    const bodyHtmlEn = [
      '<p>This Urban full body kit gives the Range Rover Sport L494 2018-2022 a much more individual and complete exterior identity. Unlike the bumper package, this SKU is the Sport bodykit in GP-products, so it adds the wider side profile, arch extensions and side details that make the whole car feel more complete.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon Fibre front replacement bumper with fitted DRL elements.',
        'Autograph Carbon front grille with Urban Crest emblem badge.',
        'Urban bonnet lettering.',
      ]),
      '<h3>Side and stance</h3>',
      buildList([
        'Wide arch extensions.',
        'Gloss Black side vents.',
        'Carbon Fibre wing mirror caps.',
        'Black Shadow side steps.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon Fibre replacement rear bumper and diffuser.',
        'Carbon Fibre number plate brow.',
        'Twin billet aluminium exhaust tips.',
        'Urban tailgate lettering.',
      ]),
      '<h3>Urban identity</h3>',
      buildList([
        'Urban front grille badge.',
        'Urban rear quarter crest badge.',
        'Urban tailgate crest badge.',
        'Urban pillar authentication badge.',
      ]),
      '<p>Urban wheels, tyres, interior upgrades, security options, protection packages and installation work are not included in this body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей повний комплект обвісу Urban робить Range Rover Sport L494 2018-2022 значно індивідуальнішим і ціліснішим зовні. На відміну від пакета заміни бамперів, у структурі GP-products це повний обвіс для Sport-версії: він додає ширший боковий профіль, розширювачі арок і бокові деталі, завдяки яким автомобіль виглядає завершено.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер замість штатного з інтегрованими елементами денних ходових вогнів.',
        'Передня решітка Autograph Carbon з емблемою Urban Crest.',
        'Напис Urban на капоті.',
      ]),
      '<h3>Боковий профіль і посадка</h3>',
      buildList([
        'Розширювачі арок.',
        'Бокові вентиляційні вставки Gloss Black.',
        'Карбонові накладки дзеркал.',
        'Бокові підніжки Black Shadow.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній бампер і дифузор замість штатних.',
        'Карбонова накладка під номерний знак.',
        'Подвійні фрезеровані алюмінієві насадки вихлопу.',
        'Напис Urban на кришці багажника.',
      ]),
      '<h3>Фірмова ідентичність Urban</h3>',
      buildList([
        'Емблема Urban на передній решітці.',
        'Емблема Urban Crest на задній чверті кузова.',
        'Емблема Urban Crest на кришці багажника.',
        'Автентифікаційний бейдж Urban на стійці.',
      ]),
      '<p>Диски Urban, шини, оновлення салону, охоронні опції, захисні пакети та роботи з монтажу не входять у цей комплект обвісу.</p>',
    ].join('');

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

  if (input.slug === 'urb-bod-25353070-v1') {
    const bodyHtmlEn = [
      '<p>This Urban replacement bumper package gives the Range Rover Sport SVR L494 2018-2022 a sharper, more purposeful Urban identity without turning the page into a full vehicle build. In the GP-products structure, this SKU is the SVR replacement bumper package, so it focuses on the carbon bumper transformation, integrated lighting, rear diffuser presence and the key Urban branding details that make the SVR look clearly different from stock.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon Fibre front replacement bumper.',
        'Integrated Nolden DRL elements.',
        'Autograph Carbon front grille with Urban Crest emblem badge.',
        'Urban bonnet lettering.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon Fibre replacement rear bumper and diffuser.',
        'Carbon Fibre number plate brow.',
        'Satin Black billet aluminium tailpipe finishers.',
        'Urban tailgate lettering.',
      ]),
      '<h3>Urban identity</h3>',
      buildList([
        'Urban UA branding pack.',
        'Urban front grille badge.',
        'Urban rear quarter crest badge.',
        'Urban tailgate crest badge.',
        'Urban pillar authentication badge.',
      ]),
      '<p>Wide arch extensions, side vents, side steps, carbon mirror caps, Urban wheels, tyres, performance exhaust system, interior upgrades, protection packages and installation work are not included in this bumper package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей пакет заміни бамперів Urban робить Range Rover Sport SVR L494 2018-2022 виразнішим, агресивнішим і більш впізнаваним без перетворення позиції на повну збірку автомобіля. У структурі GP-products це пакет заміни бамперів для SVR, тому акцент тут на карбоновій трансформації бамперів, інтегрованому світлі, виразнішому задньому дифузорі та фірмових деталях Urban, які одразу відрізняють SVR від стандартної версії.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер замість штатного.',
        'Інтегровані елементи денних ходових вогнів Nolden.',
        'Передня решітка Autograph Carbon з емблемою Urban Crest.',
        'Напис Urban на капоті.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній бампер і дифузор замість штатних.',
        'Карбонова накладка під номерний знак.',
        'Фрезеровані алюмінієві насадки вихлопу Satin Black.',
        'Напис Urban на кришці багажника.',
      ]),
      '<h3>Фірмова ідентичність Urban</h3>',
      buildList([
        'Фірмовий пакет брендингу Urban UA.',
        'Емблема Urban на передній решітці.',
        'Емблема Urban Crest на задній чверті кузова.',
        'Емблема Urban Crest на кришці багажника.',
        'Автентифікаційний бейдж Urban на стійці.',
      ]),
      '<p>Розширювачі арок, бокові вентиляційні вставки, бокові підніжки, карбонові накладки дзеркал, диски Urban, шини, спортивна вихлопна система, оновлення салону, захисні пакети та роботи з монтажу не входять у цей пакет заміни бамперів.</p>',
    ].join('');

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

  if (input.slug === 'urb-bod-25353071-v1') {
    const bodyHtmlEn = [
      '<p>This Urban Carbon Fibre V2 body kit gives the Range Rover Sport SVR L494 2018-2022 a lower, wider and more individual Urban presence. In the GP-products structure, this is the SVR carbon body kit itself, focused on the exterior carbon parts rather than a complete vehicle build.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon Fibre front replacement bumper for the SVR body line.',
        'Front bumper layout prepared for the Urban lighting package.',
        'Visual Carbon Fibre front styling elements.',
      ]),
      '<h3>Side and stance</h3>',
      buildList([
        'Wide arch extensions for a stronger SVR stance.',
        'Side vent styling for the Urban exterior profile.',
        'Carbon Fibre wing mirror caps.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon Fibre replacement rear bumper and diffuser for the SVR rear profile.',
        'Carbon Fibre number plate brow styling.',
        'Sharper rear visual balance to match the front bumper package.',
      ]),
      '<p>Nolden DRL hardware, Urban UA branding pack, billet tailpipe finishers, wheels, tyres, performance exhaust system, interior upgrades and installation work are not included in this Carbon Fibre V2 body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей комплект обвісу Urban Carbon Fibre V2 робить Range Rover Sport SVR L494 2018-2022 нижчим візуально, ширшим і значно індивідуальнішим. У структурі GP-products це карбоновий компонент обвісу для SVR-програми, тому ця сторінка сфокусована саме на зовнішніх карбонових деталях, а не на повній збірці автомобіля.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер для кузовної лінії SVR.',
        'Передня геометрія під інтеграцію світлового пакета Urban.',
        'Передні елементи стилю Visual Carbon Fibre.',
      ]),
      '<h3>Боковий профіль і посадка</h3>',
      buildList([
        'Розширювачі арок для сильнішої посадки SVR.',
        'Бокові вентиляційні вставки для фірмового профілю Urban.',
        'Карбонові накладки дзеркал.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній бампер і дифузор для заднього профілю SVR.',
        'Карбонова накладка під номерний знак у стилі Urban.',
        'Виразніший задній баланс, який відповідає передньому пакету бампера.',
      ]),
      '<p>Модулі денних ходових вогнів Nolden, пакет брендингу Urban UA, фрезеровані насадки вихлопу, диски, шини, спортивна вихлопна система, оновлення салону та роботи з монтажу не входять у цей комплект обвісу Carbon Fibre V2.</p>',
    ].join('');

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

  if (input.slug === 'urb-bod-25353138-v1') {
    const bodyHtmlEn = [
      '<p>This Urban full package gives the Land Rover Discovery 5 pre-facelift 2017-2020 a cleaner and more confident Urban identity. In the GP-products structure, this SKU is the full pre-facelift package, pairing the body kit with lighting, exhaust, tailpipe finishers and Urban branding components.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Urban Discovery 5 pre-facelift body kit component.',
        'Front bumper and lower front visual treatment for the 2017-2020 model.',
        'Nolden integral daytime running light package.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Rear bumper and diffuser styling from the Urban body kit.',
        'Discovery 5 axle-back exhaust system.',
        'Satin Black billet aluminium tailpipe finishers.',
      ]),
      '<h3>Urban identity</h3>',
      buildList([
        'Urban UA branding pack in Gloss Black.',
        'Pre-facelift Discovery 5 package structure from GP-products.',
      ]),
      '<p>Wheels, tyres, side steps, roof light bar, interior upgrades, protection packages and installation work are not included in this full package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей повний пакет Urban робить Land Rover Discovery 5 pre-facelift 2017-2020 виразнішим, чистішим і більш впевненим зовні. У структурі GP-products це повний пакет для дорестайлінгового Discovery 5: комплект обвісу поєднаний зі світлом, вихлопом, насадками та фірмовим брендингом Urban.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Компонент обвісу Urban для Discovery 5 pre-facelift.',
        'Передній бампер і нижня передня візуальна графіка для моделі 2017-2020.',
        'Комплект інтегрованих денних ходових вогнів Nolden.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Задній бампер і дифузор у стилі Urban body kit.',
        'Вихлопна система axle-back для Discovery 5.',
        'Фрезеровані алюмінієві насадки вихлопу Satin Black.',
      ]),
      '<h3>Фірмова ідентичність Urban</h3>',
      buildList([
        'Фірмовий пакет брендингу Urban UA у Gloss Black.',
        'Структура GP-products саме для дорестайлінгового Discovery 5.',
      ]),
      '<p>Диски, шини, бокові підніжки, дахова світлова панель, оновлення салону, захисні пакети та роботи з монтажу не входять у цей повний пакет.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-bod-25353139-v1') {
    const bodyHtmlEn = [
      '<p>This Urban body kit gives the Land Rover Discovery 5 pre-facelift 2017-2020 a more distinctive Urban exterior without turning the page into the larger full package. In the GP-products structure, this SKU is the body kit itself, focused on the main exterior styling components.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Urban front bumper styling for Discovery 5 2017-2020.',
        'Lower front visual treatment matched to the pre-facelift body line.',
        'Sharper Urban front presence.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Urban rear bumper and diffuser styling.',
        'Rear visual balance matched to the front kit.',
        'Cleaner Discovery 5 rear profile.',
      ]),
      '<p>Nolden DRL hardware, Urban UA branding pack, axle-back exhaust system, tailpipe finishers, wheels, tyres, side steps, interior upgrades and installation work are not included in this body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей комплект обвісу Urban робить Land Rover Discovery 5 pre-facelift 2017-2020 більш індивідуальним і виразним зовні, але не змішує його з більшим повним пакетом. У структурі GP-products це саме окремий bodykit, сфокусований на основних зовнішніх деталях.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Передня стилістика Urban для Discovery 5 2017-2020.',
        'Нижня передня графіка, узгоджена з дорестайлінговою кузовною лінією.',
        'Виразніша передня присутність Urban.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Задній бампер і дифузор у стилі Urban.',
        'Задній баланс, узгоджений із переднім комплектом.',
        'Чистіший задній профіль Discovery 5.',
      ]),
      '<p>Модулі денних ходових вогнів Nolden, пакет брендингу Urban UA, вихлопна система axle-back, насадки вихлопу, диски, шини, бокові підніжки, оновлення салону та роботи з монтажу не входять у цей комплект обвісу.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-bod-25353141-v1') {
    const bodyHtmlEn = [
      '<p>This Urban full package gives the Land Rover Discovery 5 Facelift 2020+ a sharper, more premium Urban identity while keeping the Discovery character intact. In the GP-products structure, this SKU is the full facelift package, pairing the body kit with Nolden lighting, Urban branding, exhaust and tailpipe components.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Urban body kit component for Discovery 5 Facelift 2020+.',
        'Carbon Fibre replacement front bumper styling from the Urban Discovery 5 programme.',
        'Nolden integral daytime running light package.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Rear bumper and Visual Carbon Fibre diffuser styling.',
        'Discovery 5.5 axle-back exhaust system.',
        'Satin Black billet aluminium tailpipe finishers.',
      ]),
      '<h3>Urban identity</h3>',
      buildList([
        'Urban UA branding pack in Gloss Black.',
        'Facelift 2020+ Discovery 5 package structure from GP-products.',
      ]),
      '<p>Wheels, tyres, fixed side steps, roof light bar, upper rear spoiler, interior upgrades, protection packages and installation work are not included in this full package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей повний пакет Urban робить Land Rover Discovery 5 Facelift 2020+ виразнішим, преміальнішим і значно більш індивідуальним, зберігаючи характер Discovery. У структурі GP-products це повний пакет для facelift-версії: комплект обвісу поєднаний зі світлом Nolden, брендингом Urban, вихлопом і насадками.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Компонент обвісу Urban для Discovery 5 Facelift 2020+.',
        'Стилістика карбонового переднього бампера з програми Urban Discovery 5.',
        'Комплект інтегрованих денних ходових вогнів Nolden.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Задній бампер і дифузор Visual Carbon Fibre у стилі Urban.',
        'Вихлопна система Discovery 5.5 axle-back.',
        'Фрезеровані алюмінієві насадки вихлопу Satin Black.',
      ]),
      '<h3>Фірмова ідентичність Urban</h3>',
      buildList([
        'Фірмовий пакет брендингу Urban UA у Gloss Black.',
        'Структура GP-products саме для Discovery 5 Facelift 2020+.',
      ]),
      '<p>Диски, шини, фіксовані бокові підніжки, дахова світлова панель, верхній задній спойлер, оновлення салону, захисні пакети та роботи з монтажу не входять у цей повний пакет.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-bod-25353142-v1') {
    const bodyHtmlEn = [
      '<p>This Urban body kit gives the Land Rover Discovery 5 Facelift 2020+ the core Urban exterior transformation. In the GP-products structure, this SKU is the facelift body kit itself, focused on the main body styling elements rather than the larger full package with lighting, exhaust and branding components.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Urban Discovery 5 Facelift body kit component.',
        'Carbon Fibre replacement front bumper styling from the official Urban Discovery 5 programme.',
        'Sharper front architecture for the 2020+ facelift body line.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Rear bumper and Visual Carbon Fibre diffuser styling.',
        'Rear profile matched to the front Urban kit.',
        'Cleaner, more planted Discovery 5 stance.',
      ]),
      '<p>Nolden DRL hardware, Urban UA branding pack, axle-back exhaust system, tailpipe finishers, wheels, tyres, side steps, roof light bar, interior upgrades and installation work are not included in this body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей комплект обвісу Urban дає Land Rover Discovery 5 Facelift 2020+ основну зовнішню трансформацію Urban. У структурі GP-products це саме bodykit для facelift-версії, сфокусований на головних кузовних елементах, а не більший повний пакет зі світлом, вихлопом і брендингом.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Компонент обвісу Urban для Discovery 5 Facelift.',
        'Стилістика карбонового переднього бампера з офіційної програми Urban Discovery 5.',
        'Виразніша передня архітектура для кузовної лінії 2020+.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Задній бампер і дифузор Visual Carbon Fibre у стилі Urban.',
        'Задній профіль, узгоджений із переднім комплектом Urban.',
        'Чистіша і більш впевнена посадка Discovery 5.',
      ]),
      '<p>Модулі денних ходових вогнів Nolden, пакет брендингу Urban UA, вихлопна система axle-back, насадки вихлопу, диски, шини, бокові підніжки, дахова світлова панель, оновлення салону та роботи з монтажу не входять у цей комплект обвісу.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-bun-25358207-v1') {
    const bodyHtmlEn = [
      '<p>This Urban Widetrack body kit makes your Mercedes-Benz G-Class W465 unmistakably yours. It takes the familiar G-Wagon silhouette and gives it a wider stance, sharper Visual Carbon Fibre elements, and the kind of road presence that cannot be confused with a standard car.</p>',
      '<p>For owners who want more than a factory G-Class, Urban Automotive gives the W465 a stronger visual identity: broader arches, sculpted bumpers, integrated intake details, and a confident widebody profile that looks purposeful from every angle.</p>',
      '<p>The exterior package brings together the key Urban Widetrack elements: bumpers, arches, sills, splitter, diffuser, intake details, mesh inserts, tow covers, and exhaust finishers.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon-fibre front bumper.',
        'Carbon-fibre upper intake and front centre intake.',
        'Honeycomb front centre mesh insert.',
        'Left and right carbon-fibre front intakes with honeycomb mesh inserts.',
        'Left and right carbon-fibre front grille inserts.',
        'Left and right carbon-fibre front overriders.',
        'Carbon-fibre upper centre, left, right, and lower centre front splitter sections.',
        'Carbon-fibre front tow cover.',
      ]),
      '<h3>Side and widebody section</h3>',
      buildList([
        'Left and right carbon-fibre front wheel arches.',
        'Left and right carbon-fibre rear wheel arches.',
        'Left and right carbon-fibre side skirts.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon-fibre rear bumper.',
        'Carbon-fibre rear diffuser.',
        'Carbon-fibre rear tow cover.',
        'Left and right carbon-fibre rear intakes with honeycomb mesh inserts.',
        'Satin black billet exhaust finishers for W465 G-Wagon.',
      ]),
      '<p>Bonnet, roof light bar, rear spoiler, rear wheel carrier, wheels, interior trim, and performance exhaust are not included in this body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей обвіс Urban Widetrack робить ваш Mercedes-Benz G-Class W465 по-справжньому унікальним. Він залишає впізнавану харизму G-Wagon, але додає ширший силует, агресивніші лінії, елементи з Visual Carbon Fibre та присутність, яку неможливо сплутати зі стандартним автомобілем.</p>',
      '<p>Для власника, якому замало заводського G-Class, Urban Automotive створює інший рівень зовнішності: масивніші арки, скульптурні бампери, інтегровані повітрозабірники та впевнений widebody-профіль, який виглядає цілісно з кожного ракурсу.</p>',
      '<p>Зовнішній пакет об’єднує ключові елементи Urban Widetrack: бампери, арки, пороги, спліттер, дифузор, повітрозабірники, сітки, кришки буксирувальних отворів і насадки вихлопу.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній бампер.',
        'Карбоновий верхній повітрозабірник і центральний передній повітрозабірник.',
        'Центральна передня вставка із honeycomb-сіткою.',
        'Лівий і правий передні карбонові повітрозабірники з honeycomb-вставками.',
        'Ліва та права карбонові передні вставки решітки.',
        'Лівий і правий карбонові передні overrider-елементи.',
        'Карбонові секції переднього спліттера: верхня центральна, ліва, права та нижня центральна.',
        'Карбонова передня кришка буксирувального отвору.',
      ]),
      '<h3>Бокова частина та widebody</h3>',
      buildList([
        'Ліва та права карбонові передні арки.',
        'Ліва та права карбонові задні арки.',
        'Лівий і правий карбонові бокові пороги.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній бампер.',
        'Карбоновий задній дифузор.',
        'Карбонова задня кришка буксирувального отвору.',
        'Лівий і правий задні карбонові повітрозабірники з honeycomb-вставками.',
        'Комплект billet-насадок вихлопу Satin Black для W465 G-Wagon.',
      ]),
      '<p>Капот, дахова LED-панель, задній спойлер, тримач запасного колеса, диски, оздоблення салону та спортивна вихлопна система не входять у цей комплект обвісу.</p>',
    ].join('');

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

  if (input.slug === 'urb-bun-25358150-v1') {
    const bodyHtmlEn = [
      '<p>This Urban Carbon Fibre body kit gives the Bentley Continental GT/GTC a more individual, lower, and more athletic presence while keeping the grand-tourer elegance that defines the car.</p>',
      '<p>The package sharpens the front, side profile, and rear stance with Urban carbon detailing, adding a more technical performance character without turning the Continental GT into something visually excessive.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon fibre front splitter.',
        'Front bumper lower section.',
        'Front lip spoiler.',
        'Grille surround trim.',
      ]),
      '<h3>Side profile</h3>',
      buildList([
        'Carbon fibre side sills.',
        'Carbon mirror caps.',
        'Side vent accents.',
        'Door panel trims.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon fibre rear diffuser.',
        'Boot lid spoiler.',
        'Exhaust finisher trims.',
        'Rear bumper lower section.',
      ]),
      '<p>22-inch forged wheels, tyres, wheel spacers, performance exhaust system, interior upgrades, and installation work are not included in this body kit.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Цей комплект обвісу Urban Carbon Fibre робить Bentley Continental GT/GTC більш індивідуальним, нижчим візуально та спортивнішим, але залишає головне - характер елегантного grand tourer.</p>',
      '<p>Пакет підсилює передню частину, боковий профіль і задню посадку карбоновими деталями Urban. Автомобіль виглядає технічнішим і виразнішим, але без зайвої агресії, яка руйнує стиль Continental GT.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий передній спліттер.',
        'Нижня секція переднього бампера.',
        'Передній lip spoiler.',
        'Окантовка решітки.',
      ]),
      '<h3>Боковий профіль</h3>',
      buildList([
        'Карбонові бокові пороги.',
        'Карбонові накладки дзеркал.',
        'Акценти бокових вентиляційних елементів.',
        'Накладки дверних панелей.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий задній дифузор.',
        'Спойлер кришки багажника.',
        'Накладки насадок вихлопу.',
        'Нижня секція заднього бампера.',
      ]),
      '<p>22-дюймові ковані диски, шини, проставки коліс, спортивна вихлопна система, оновлення салону та роботи з монтажу не входять у цей комплект обвісу.</p>',
    ].join('');

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

  if (input.slug === 'urb-bun-25358144-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Widetrack body package gives the Rolls-Royce Cullinan Series 1 a more individual, more commanding presence without losing the luxury authority that defines the car.</p>',
      '<p>Urban sharpens the Cullinan with full carbon-fibre exterior styling, wider visual stance, additional lighting detail, and black-pack de-chrome treatment. The result is still unmistakably Rolls-Royce, but far more distinctive than a standard SUV.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Carbon-fibre front styling package.',
        'Lower front bumper treatment.',
        'Additional driving-light visual treatment.',
        'Black-pack de-chrome exterior detailing.',
      ]),
      '<h3>Side profile and stance</h3>',
      buildList([
        'Wide arch treatment for a stronger Cullinan stance.',
        'Carbon-fibre exterior vent styling.',
        'Side styling details that visually lower and widen the profile.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon-fibre rear styling package.',
        'Rear lower diffuser treatment.',
        'Urban exterior detailing for a more assertive rear profile.',
      ]),
      '<p>24-inch forged wheels, tyres, wheel spacers, interior upgrades, and installation work are not included in this body package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Пакет обвісу Urban Widetrack робить Rolls-Royce Cullinan Series 1 більш індивідуальним і значно виразнішим, не руйнуючи розкішну присутність, за яку цінують Cullinan.</p>',
      '<p>Urban підсилює Cullinan карбоновим зовнішнім стайлінгом, ширшою візуальною посадкою, додатковою світловою графікою та black-pack de-chrome оздобленням. Автомобіль залишається впізнаваним Rolls-Royce, але вже не виглядає як стандартний SUV.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбоновий пакет стайлінгу передньої частини.',
        'Нижнє оформлення переднього бампера.',
        'Додаткова світлова графіка.',
        'Black-pack de-chrome оздоблення екстер’єру.',
      ]),
      '<h3>Боковий профіль і посадка</h3>',
      buildList([
        'Розширення арок для сильнішої посадки Cullinan.',
        'Карбонове оформлення зовнішніх вентиляційних елементів.',
        'Бокові елементи, які візуально занижують і розширюють профіль.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий пакет стайлінгу задньої частини.',
        'Оформлення нижнього заднього дифузора.',
        'Зовнішні деталі Urban для більш впевненого заднього профілю.',
      ]),
      '<p>24-дюймові ковані диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять у цей пакет обвісу.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-bun-25358147-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Widetrack body package for Rolls-Royce Cullinan Series II takes the newer Cullinan shape and gives it a stronger, more architectural road presence.</p>',
      '<p>The official Urban Series II programme is built around a handcrafted carbon-fibre front bumper treatment, extended grille-and-blade visual language, integrated vertical DRL graphics, and a wider, more assertive exterior stance.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Handcrafted carbon-fibre front bumper treatment.',
        'Extended front grille and blade visual treatment.',
        'Integrated vertical DRL graphic flowing into the headlight area.',
        'Lower front styling that gives the Series II a stronger face.',
      ]),
      '<h3>Side profile and stance</h3>',
      buildList([
        'Widetrack visual stance for a broader Cullinan profile.',
        'Carbon-fibre exterior styling details.',
        'Side treatment that keeps the luxury proportions but adds more presence.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Carbon-fibre rear styling package.',
        'Rear lower diffuser treatment.',
        'Urban exterior details for a cleaner and more imposing rear view.',
      ]),
      '<p>24-inch forged wheels, tyres, wheel spacers, interior upgrades, and installation work are not included in this body package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Пакет обвісу Urban Widetrack для Rolls-Royce Cullinan Series II робить новіший Cullinan ще більш монументальним і впізнаваним на дорозі.</p>',
      '<p>Офіційна програма Urban для Series II побудована навколо карбонового переднього бампера ручної роботи, продовженої графіки решітки та blades, інтегрованих вертикальних DRL і ширшої, впевненішої посадки кузова.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Карбонове оформлення переднього бампера ручної роботи.',
        'Продовжена візуальна лінія передньої решітки та blades.',
        'Інтегрована вертикальна DRL-графіка, що переходить у зону фар.',
        'Нижній передній стайлінг, який робить Series II візуально сильнішим.',
      ]),
      '<h3>Боковий профіль і посадка</h3>',
      buildList([
        'Widetrack-посадка для ширшого профілю Cullinan.',
        'Карбонові зовнішні елементи стайлінгу.',
        'Бокове оформлення, яке зберігає розкішні пропорції, але додає більше присутності.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Карбоновий пакет стайлінгу задньої частини.',
        'Оформлення нижнього заднього дифузора.',
        'Зовнішні деталі Urban для чистішого і більш масивного заднього вигляду.',
      ]),
      '<p>24-дюймові ковані диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять у цей пакет обвісу.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-bun-25358159-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Bodystyling package gives the Volkswagen Transporter T6.1 a sharper, lower, and more individual presence while keeping the practical van character that makes the T6.1 so usable every day.</p>',
      '<p>Urban turns the Transporter from a clean factory van into a more distinctive road car: stronger front graphics, deeper side treatment, a more confident rear profile, and exterior details that make the whole shape feel purpose-built rather than standard.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Front splitter.',
        'Front bumper lower lip.',
        'Grille surround.',
        'LED accent lights.',
      ]),
      '<h3>Side profile</h3>',
      buildList([
        'Side steps.',
        'Side skirt extensions.',
        'Side window trims.',
        'Mirror caps.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Rear bumper diffuser.',
        'Roof spoiler.',
        'Exhaust finishers.',
        'Rear badge surround.',
      ]),
      '<p>20-inch forged wheels, tyres, wheel spacers, roof rails, interior upgrades, and installation work are not included in this bodystyling package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Пакет Urban Bodystyling робить Volkswagen Transporter T6.1 нижчим візуально, виразнішим і більш індивідуальним, але залишає практичний характер T6.1, за який цей автомобіль обирають на кожен день.</p>',
      '<p>Urban перетворює Transporter зі стриманого заводського фургона на автомобіль з власною присутністю: сильніша передня графіка, глибший боковий профіль, впевненіша задня частина та зовнішні деталі, які виглядають як цілісний фірмовий пакет.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Передній спліттер.',
        'Нижня lip-накладка переднього бампера.',
        'Окантовка решітки.',
        'LED-акценти.',
      ]),
      '<h3>Боковий профіль</h3>',
      buildList([
        'Бокові підніжки.',
        'Розширення бокових порогів.',
        'Окантовки бокових вікон.',
        'Накладки дзеркал.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Задній дифузор бампера.',
        'Даховий спойлер.',
        'Насадки вихлопу.',
        'Окантовка заднього бейджа.',
      ]),
      '<p>20-дюймові ковані диски, шини, проставки коліс, рейлінги даху, оновлення салону та роботи з монтажу не входять у цей пакет обвісу.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug === 'urb-bun-25358198-v1') {
    const bodyHtmlEn = [
      '<p>The Urban Soft Kit package gives the Mercedes-Benz G-Wagon W463A a sharper and more individual presence without moving into a full widebody conversion.</p>',
      '<p>It is the cleaner Urban route for owners who want the G-Class to feel more bespoke: carbon-fibre detailing, stronger bumper graphics, rear styling, light-bar character, and the small exterior signatures that separate a Soft Kit G-Wagon from a standard car.</p>',
      '<h3>Front section</h3>',
      buildList([
        'Front lip / splitter treatment.',
        'Front bumper lower styling.',
        'Overrider package for the bumper corners.',
        'Bonnet overlay visual treatment.',
      ]),
      '<h3>Side profile</h3>',
      buildList([
        'Carbon-fibre wing mirror caps.',
        'Side running-board visual treatment.',
        'Exterior trim details that keep the OEM-plus profile clean.',
      ]),
      '<h3>Rear section</h3>',
      buildList([
        'Rear roof spoiler treatment.',
        'Rear air-intake styling.',
        'Rear bumper / diffuser visual treatment.',
        'Spare-wheel cover styling element.',
      ]),
      '<p>Forged wheels, tyres, wheel spacers, full Widetrack arches, interior upgrades, and installation work are not included in this Soft Kit package.</p>',
    ].join('');

    const bodyHtmlUa = [
      '<p>Пакет Urban Soft Kit робить Mercedes-Benz G-Wagon W463A виразнішим і більш індивідуальним, але не перетворює його на повну widebody-конверсію.</p>',
      '<p>Це чистіший шлях Urban для власника, який хоче особливий G-Class: карбонові акценти, сильнішу графіку бамперів, задній стайлінг, характер дахової світлової панелі та дрібні зовнішні деталі, які відрізняють Soft Kit G-Wagon від стандартного автомобіля.</p>',
      '<h3>Передня частина</h3>',
      buildList([
        'Передній lip / splitter.',
        'Нижній стайлінг переднього бампера.',
        'Пакет overrider-елементів для кутів бампера.',
        'Візуальна накладка на капот.',
      ]),
      '<h3>Боковий профіль</h3>',
      buildList([
        'Карбонові накладки дзеркал.',
        'Візуальне оформлення бокових підніжок.',
        'Зовнішні trim-деталі, які зберігають чистий OEM Plus-профіль.',
      ]),
      '<h3>Задня частина</h3>',
      buildList([
        'Оформлення заднього дахового спойлера.',
        'Стайлінг задніх повітрозабірників.',
        'Візуальне оформлення заднього бампера / дифузора.',
        'Стайлінг кришки запасного колеса.',
      ]),
      '<p>Ковані диски, шини, проставки коліс, повні Widetrack-арки, оновлення салону та роботи з монтажу не входять у цей пакет Soft Kit.</p>',
    ].join('');

    return {
      bodyHtml: { en: bodyHtmlEn, ua: bodyHtmlUa },
      longDescription: { en: stripHtml(bodyHtmlEn), ua: stripHtml(bodyHtmlUa) },
      shortDescription: { en: excerpt(bodyHtmlEn, 220), ua: excerpt(bodyHtmlUa, 220) },
      seoDescription: { en: excerpt(bodyHtmlEn, 155), ua: excerpt(bodyHtmlUa, 155) },
    };
  }

  if (input.slug !== 'urb-wid-26084234-v1') {
    return null;
  }

  const bodyHtmlEn = [
    '<p>Urban Automotive Widetrack styling programme for the Lamborghini Urus SE, built around a more aggressive carbon-fibre exterior package while preserving the OEM-plus character of the car.</p>',
    '<h3>Front</h3>',
    buildList([
      'Replacement six-piece carbon-fibre bonnet with functional leading and trailing vents inspired by the Aventador SVJ.',
      'Visual Carbon Fibre dragonscale bonnet vents.',
      'Three-piece carbon-fibre front splitter with canards.',
    ]),
    '<h3>Side profile</h3>',
    buildList([
      'Six-piece carbon-fibre widetrack arch extensions with visible carbon detailing.',
      'Replacement carbon-fibre side vents with Lamborghini hex inlays and Urban icon branding.',
      'Visual Carbon Fibre sill extensions, Miura-inspired sill aero scoop, and carbon-fibre mirror caps.',
    ]),
    '<h3>Rear</h3>',
    buildList([
      'Double-stacked roof spoiler in Visual Carbon Fibre with Urban icon endplates.',
      'Replacement carbon-fibre rear bumper with integrated double-vented diffuser and floating carbon-fibre canards.',
      'Quad billet anodised aluminium exhaust finishers with outer accent detailing.',
    ]),
    '<p>24-inch forged wheels, tyres, wheel spacers, interior upgrades, and installation work are not included in this body kit.</p>',
  ].join('');

  const bodyHtmlUa = [
    '<p>Widetrack-програма Urban Automotive для Lamborghini Urus SE: виразний карбоновий пакет кузова, який підсилює ширину, посадку й характер автомобіля без втрати заводської логіки OEM Plus.</p>',
    '<h3>Передня частина</h3>',
    buildList([
      'Заміна штатного капота на шестисекційний карбоновий капот із функціональними передніми та задніми вентиляційними каналами у стилі Aventador SVJ.',
      'Вентиляційні вставки капота Dragonscale у виконанні Visual Carbon Fibre.',
      'Трисекційний карбоновий передній спліттер із канардами.',
    ]),
    '<h3>Боковий профіль</h3>',
    buildList([
      'Шестисекційні карбонові розширення арок Widetrack з видимою карбоновою фактурою.',
      'Карбонові бокові вентиляційні елементи з шестикутними вставками Lamborghini та фірмовим знаком Urban.',
      'Пороги Visual Carbon Fibre, аеродинамічний елемент у стилі Miura та карбонові накладки дзеркал.',
    ]),
    '<h3>Задня частина</h3>',
    buildList([
      'Дворівневий даховий спойлер Visual Carbon Fibre з торцевими пластинами Urban.',
      'Карбоновий задній бампер з інтегрованим двоканальним дифузором і карбоновими канардами.',
      'Чотири анодовані billet-насадки вихлопу з акцентними зовнішніми деталями.',
    ]),
    '<p>24-дюймові ковані диски, шини, проставки коліс, оновлення салону та роботи з монтажу не входять у цей комплект обвісу.</p>',
  ].join('');

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
