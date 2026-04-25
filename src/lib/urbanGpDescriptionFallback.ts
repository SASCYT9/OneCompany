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
    '<p>Final package scope, finish, and compatibility should be confirmed before ordering.</p>',
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
    '<p>Точний склад комплекту, оздоблення та сумісність потрібно підтвердити перед замовленням.</p>',
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
