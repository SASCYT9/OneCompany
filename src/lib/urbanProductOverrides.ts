const URBAN_CANONICAL_COLLECTION_HANDLE_OVERRIDES: Record<string, string> = {
  'urb-bun-25358198-v1': 'mercedes-g-wagon-softkit',
  'urb-bun-25358207-v1': 'mercedes-g-wagon-w465-widetrack',
  'urb-dec-25358200-v1': 'mercedes-g-wagon-w465-aerokit',
  'urb-hoo-25358201-v1': 'mercedes-g-wagon-w465-aerokit',
  'urb-roo-25358202-v1': 'mercedes-g-wagon-w465-aerokit',
  'urb-spo-25358203-v1': 'mercedes-g-wagon-w465-aerokit',
  'urb-cov-25358204-v1': 'mercedes-g-wagon-w465-aerokit',
  'urb-tri-25358205-v1': 'mercedes-g-wagon-w465-aerokit',
  'urb-tri-25358206-v1': 'mercedes-g-wagon-w465-aerokit',
  'urb-spl-25358199-v1': 'mercedes-g-wagon-w465-aerokit',
};

const URBAN_PRODUCT_TITLE_OVERRIDES: Record<string, { ua: string; en: string }> = {
  'urb-dif-25358211-v1': {
    ua: 'Задній дифузор Urban Visual Carbon Fibre для Audi RS3 8Y Hatchback',
    en: 'Urban Visual Carbon Fibre Rear Diffuser for Audi RS3 8Y Hatchback',
  },
  'urb-fro-25358209-v1': {
    ua: 'Передні накладки повітрозабірників Urban Visual Carbon Fibre для Audi RS3 8Y',
    en: 'Urban Visual Carbon Fibre Front Bumper Intake Trims for Audi RS3 8Y',
  },
  'urb-sil-25358218-v1': {
    ua: 'Задні нижні накладки Urban Visual Carbon Fibre для Audi RS4 B9/B9.5',
    en: 'Urban Visual Carbon Fibre Rear Quarter Sills for Audi RS4 B9/B9.5',
  },
  'urb-spl-25358221-v1': {
    ua: 'Передній спліттер Urban Visual Carbon Fibre для Audi RS4 B9.5',
    en: 'Urban Visual Carbon Fibre Front Splitter for Audi RS4 B9.5',
  },
  'urb-spo-25358219-v1': {
    ua: 'Нижній задній lip spoiler Urban Visual Carbon Fibre для Audi RS4 B9/B9.5',
    en: 'Urban Visual Carbon Fibre Lower Rear Lip Spoiler for Audi RS4 B9/B9.5',
  },
  'urb-spo-25358220-v1': {
    ua: 'Верхній задній lip spoiler Urban Visual Carbon Fibre для Audi RS4 B9/B9.5',
    en: 'Urban Visual Carbon Fibre Upper Rear Lip Spoiler for Audi RS4 B9/B9.5',
  },
  'urb-dif-25358226-v1': {
    ua: 'Задній дифузор Urban Visual Carbon Fibre для Audi C8 RS6 / RS7',
    en: 'Urban Visual Carbon Fibre Rear Diffuser for Audi C8 RS6 / RS7',
  },
  'urb-spo-25358227-v1': {
    ua: 'Нижній задній lip spoiler Urban Visual Carbon Fibre для Audi C8 RS6 / RS7',
    en: 'Urban Visual Carbon Fibre Lower Rear Lip Spoiler for Audi C8 RS6 / RS7',
  },
  'urb-fro-25358230-v1': {
    ua: 'Передні eyebrow-накладки Urban Visual Carbon Fibre для Audi RSQ8 Pre-Facelift',
    en: 'Urban Visual Carbon Fibre Front Eyebrow Set for Audi RSQ8 Pre-Facelift',
  },
  'urb-spo-26006234-v1': {
    ua: 'Нижній задній lip spoiler Urban Visual Carbon Fibre для Audi RSQ8 Pre-Facelift',
    en: 'Urban Visual Carbon Fibre Lower Rear Lip Spoiler for Audi RSQ8 Pre-Facelift',
  },
  'urb-spo-25358234-v1': {
    ua: 'Верхній задній lip spoiler Urban Satin для Audi RSQ8',
    en: 'Urban Satin Upper Rear Lip Spoiler for Audi RSQ8',
  },
  'urb-dif-25358238-v1': {
    ua: 'Задній дифузор Urban Visual Carbon Fibre Satin для Audi RSQ8 Facelift',
    en: 'Urban Visual Carbon Fibre Satin Rear Diffuser for Audi RSQ8 Facelift',
  },
  'urb-fro-25358235-v1': {
    ua: 'Передні eyebrow-накладки Urban PU-RIM для Audi RSQ8 Facelift',
    en: 'Urban PU-RIM Front Eyebrow Set for Audi RSQ8 Facelift',
  },
  'urb-acc-25358162-v1': {
    ua: 'Чорні рейлінги Urban для Volkswagen Transporter T6.1 SWB',
    en: 'Urban Black Roof Rail Kit for Volkswagen Transporter T6.1 SWB',
  },
  'urb-acc-25358163-v1': {
    ua: 'Знімний фаркоп Urban з електрикою для Volkswagen Transporter T6.1',
    en: 'Urban Detachable Towbar with Electrics for Volkswagen Transporter T6.1',
  },
  'urb-arc-25353072-v1': {
    ua: 'Комплект розширення арок Urban для Range Rover Sport L494 SVR',
    en: 'Urban Wide Arch Extension Set for Range Rover Sport L494 SVR',
  },
  'urb-arc-25353085-v1': {
    ua: 'Комплект арок Urban Widetrack Gloss Black для Land Rover Defender 90',
    en: 'Urban Gloss Black Widetrack Arch Kit for Land Rover Defender 90',
  },
  'urb-arc-25358153-v1': {
    ua: 'Комплект арок Urban PUR для Bentley Continental GT',
    en: 'Urban PUR Arch Extension Set for Bentley Continental GT',
  },
  'urb-arc-26006231-v1': {
    ua: 'Комплект арок Urban Hybrid Widetrack для Land Rover Defender 110',
    en: 'Urban Hybrid Widetrack Arch Kit for Land Rover Defender 110',
  },
  'urb-arc-26009359-v1': {
    ua: 'Комплект арок Urban Wide Track Non-Hybrid RAW для Land Rover Defender 110',
    en: 'Urban Wide Track Arch Kit Non-Hybrid RAW for Land Rover Defender 110',
  },
  'urb-can-25353086-v1': {
    ua: 'Передні канарди Urban Widetrack для Land Rover Defender 90/110/130',
    en: 'Urban Widetrack Front Canards for Land Rover Defender 90/110/130',
  },
  'urb-bod-25353001-v1': {
    ua: 'Пакет заміни бамперів Urban для Range Rover L460',
    en: 'Urban Replacement Bumper Package for Range Rover L460',
  },
  'urb-bod-25353030-v1': {
    ua: 'Комплект обвісу Urban для Range Rover Sport L461',
    en: 'Urban Body Kit for Range Rover Sport L461',
  },
  'urb-bod-25353062-v1': {
    ua: 'Пакет заміни бамперів Urban для Range Rover Sport L494 2013-2017',
    en: 'Urban Replacement Bumper Package for Range Rover Sport L494 2013-2017',
  },
  'urb-bod-25353063-v1': {
    ua: 'Комплект обвісу Urban Carbon Fibre V2 для Range Rover Sport L494 2013-2017',
    en: 'Urban Carbon Fibre V2 Body Kit for Range Rover Sport L494 2013-2017',
  },
  'urb-bod-25353066-v1': {
    ua: 'Пакет заміни бамперів Urban для Range Rover Sport SVR L494 2013-2017',
    en: 'Urban Replacement Bumper Package for Range Rover Sport SVR L494 2013-2017',
  },
  'urb-bod-25353067-v1': {
    ua: 'Комплект обвісу Urban Carbon Fibre V2 для Range Rover Sport SVR L494 2013-2017',
    en: 'Urban Carbon Fibre V2 Body Kit for Range Rover Sport SVR L494 2013-2017',
  },
  'urb-bod-25353068-v1': {
    ua: 'Пакет заміни бамперів Urban для Range Rover Sport L494 2018-2022',
    en: 'Urban Replacement Bumper Package for Range Rover Sport L494 2018-2022',
  },
  'urb-bod-25353069-v1': {
    ua: 'Повний комплект обвісу Urban для Range Rover Sport L494 2018-2022',
    en: 'Urban Full Body Kit for Range Rover Sport L494 2018-2022',
  },
  'urb-bod-25353070-v1': {
    ua: 'Пакет заміни бамперів Urban для Range Rover Sport SVR L494 2018-2022',
    en: 'Urban Replacement Bumper Package for Range Rover Sport SVR L494 2018-2022',
  },
  'urb-bod-25353071-v1': {
    ua: 'Комплект обвісу Urban Carbon Fibre V2 для Range Rover Sport SVR L494 2018-2022',
    en: 'Urban Carbon Fibre V2 Body Kit for Range Rover Sport SVR L494 2018-2022',
  },
  'urb-bun-25358198-v1': {
    ua: 'Пакет Urban Soft Kit для Mercedes-Benz G-Wagon W463A',
    en: 'Urban Soft Kit Package for Mercedes-Benz G-Wagon W463A',
  },
  'urb-bun-25358207-v1': {
    ua: 'Комплект обвісу Urban Widetrack для Mercedes-Benz G-Wagon W465',
    en: 'Urban Widetrack Body Kit for Mercedes-Benz G-Wagon W465',
  },
  'urb-bod-25353141-v1': {
    ua: 'Повний пакет Urban для Land Rover Discovery 5 Facelift 2020+',
    en: 'Urban Full Package for Land Rover Discovery 5 Facelift 2020+',
  },
  'urb-bod-25353142-v1': {
    ua: 'Комплект обвісу Urban для Land Rover Discovery 5 Facelift 2020+',
    en: 'Urban Body Kit for Land Rover Discovery 5 Facelift 2020+',
  },
  'urb-bod-25353138-v1': {
    ua: 'Повний пакет Urban для Land Rover Discovery 5 Pre-Facelift 2017-2020',
    en: 'Urban Full Package for Land Rover Discovery 5 Pre-Facelift 2017-2020',
  },
  'urb-bod-25353139-v1': {
    ua: 'Комплект обвісу Urban для Land Rover Discovery 5 Pre-Facelift 2017-2020',
    en: 'Urban Body Kit for Land Rover Discovery 5 Pre-Facelift 2017-2020',
  },
  'urb-bun-25358150-v1': {
    ua: 'Комплект обвісу Urban Carbon Fibre для Bentley Continental GT/GTC',
    en: 'Urban Carbon Fibre Body Kit for Bentley Continental GT/GTC',
  },
  'urb-wid-26084234-v1': {
    ua: 'Комплект обвісу Urban Widetrack для Lamborghini Urus SE',
    en: 'Urban Widetrack Body Kit for Lamborghini Urus SE',
  },
  'urb-fro-26054204-v1': {
    ua: 'Нижня накладка переднього бампера Urban Visual Carbon Fibre для Lamborghini Urus SE',
    en: 'Urban Visual Carbon Fibre Lower Front Bumper Apron for Lamborghini Urus SE',
  },
  'urb-doo-26093237-v1': {
    ua: 'Нижні дверні вставки Urban Visual Carbon Fibre для Lamborghini Urus SE',
    en: 'Urban Visual Carbon Fibre Lower Door Moulding Inserts for Lamborghini Urus SE',
  },
  'urb-wid-25353015-v1': {
    ua: 'Комплект арок Urban Widetrack PUR для Range Rover L460',
    en: 'Urban PUR Widetrack Arch Set for Range Rover L460',
  },
  'urb-arc-26006219-v1': {
    ua: 'Комплект арок Urban Widetrack PUR для Range Rover Sport L461',
    en: 'Urban PUR Widetrack Arch Set for Range Rover Sport L461',
  },
  'urb-bun-25358144-v1': {
    ua: 'Пакет обвісу Urban Widetrack для Rolls-Royce Cullinan Series 1',
    en: 'Urban Widetrack Body Package for Rolls-Royce Cullinan Series 1',
  },
  'urb-bun-25358147-v1': {
    ua: 'Пакет обвісу Urban Widetrack для Rolls-Royce Cullinan Series II',
    en: 'Urban Widetrack Body Package for Rolls-Royce Cullinan Series II',
  },
  'urb-bun-25358159-v1': {
    ua: 'Пакет обвісу Urban Bodystyling для Volkswagen Transporter T6.1',
    en: 'Urban Bodystyling Package for Volkswagen Transporter T6.1',
  },
};

const URBAN_PROGRAM_FALLBACK_IMAGES: Record<string, string> = {
  'mercedes-g-wagon-softkit': '/images/shop/urban/carousel/models/gwagonSoftKit/carousel-1-1920.jpg',
  'mercedes-g-wagon-w465-aerokit':
    '/images/shop/urban/carousel/models/gwagonAeroKit2024/webp/urban-automotive-g-wagon-g63-w465-aerokit-1-2560.webp',
  'mercedes-g-wagon-w465-widetrack':
    '/images/shop/urban/carousel/models/gwagonWidetrack2024/webp/urban-automotive-g-wagon-g63-w465-widetrack-5-2560.webp',
};
const URBAN_COLLECTION_MEDIA_ROLE_OVERRIDES: Record<string, Partial<Record<string, string[]>>> = {};

export function getUrbanCanonicalCollectionHandleOverride(slug: string | null | undefined) {
  return slug ? (URBAN_CANONICAL_COLLECTION_HANDLE_OVERRIDES[slug] ?? null) : null;
}

export function getUrbanProductTitleOverrides(slug: string | null | undefined) {
  return slug ? (URBAN_PRODUCT_TITLE_OVERRIDES[slug] ?? null) : null;
}

export function getUrbanProductTitleOverrideForLocale(
  slug: string | null | undefined,
  locale: 'ua' | 'en'
) {
  const overrides = getUrbanProductTitleOverrides(slug);
  return overrides ? overrides[locale] : null;
}

export function getUrbanProgramFallbackImage(handle: string | null | undefined) {
  return handle ? (URBAN_PROGRAM_FALLBACK_IMAGES[handle] ?? null) : null;
}

export function getUrbanCollectionMediaRoleOverrides(handle: string | null | undefined) {
  return handle ? (URBAN_COLLECTION_MEDIA_ROLE_OVERRIDES[handle] ?? null) : null;
}
