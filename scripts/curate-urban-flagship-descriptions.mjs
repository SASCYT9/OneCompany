#!/usr/bin/env node
/**
 * Curated Urban flagship descriptions sourced from official Urban channels.
 *
 * Scope:
 * - Updates only a small set of flagship Urban programmes / parts where we have
 *   direct official source material with reliable package scope.
 * - Replaces weak generic copy and malformed placeholder text with structured
 *   EN / UA descriptions that parse into:
 *   - What is included
 *   - What is not included
 *   - Key features
 *
 * Sources used:
 * - House of Urban product pages
 * - Frijns Unlimited official Urban PDF price lists / news posts
 *
 * Usage:
 *   node scripts/curate-urban-flagship-descriptions.mjs --dry-run
 *   node scripts/curate-urban-flagship-descriptions.mjs --commit
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DRY_RUN = !COMMIT || args.has('--dry-run');

function buildHtml({ intro, included = [], excluded = [], features = [] }) {
  const blocks = [];
  for (const paragraph of intro) {
    blocks.push(`<p>${paragraph}</p>`);
  }
  if (included.length) {
    blocks.push('<h3>What is included</h3>');
    blocks.push(`<ul>${included.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }
  if (excluded.length) {
    blocks.push('<h3>What is not included</h3>');
    blocks.push(`<ul>${excluded.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }
  if (features.length) {
    blocks.push('<h3>Key features</h3>');
    blocks.push(`<ul>${features.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }
  return blocks.join('');
}

function buildHtmlUa({ intro, included = [], excluded = [], features = [] }) {
  const blocks = [];
  for (const paragraph of intro) {
    blocks.push(`<p>${paragraph}</p>`);
  }
  if (included.length) {
    blocks.push('<h3>Що входить</h3>');
    blocks.push(`<ul>${included.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }
  if (excluded.length) {
    blocks.push('<h3>Що не входить</h3>');
    blocks.push(`<ul>${excluded.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }
  if (features.length) {
    blocks.push('<h3>Ключові характеристики</h3>');
    blocks.push(`<ul>${features.map((item) => `<li>${item}</li>`).join('')}</ul>`);
  }
  return blocks.join('');
}

const curated = [
  {
    slug: 'urban-defender-110-aerokit',
    source:
      'House of Urban: Urban Design Pack - New Defender https://houseofurban.co.uk/products/urban-design-pack-new-defender',
    shortDescEn:
      'Official Urban Design Pack for Defender 110 with side steps, extended arches, roof light bar, wheel package and signature Urban branding.',
    shortDescUa:
      'Офіційний Urban Design Pack для Defender 110 з Black Shadow side steps, розширеними арками, даховим light bar, колісним пакетом і фірмовим брендингом Urban.',
    htmlEn: buildHtml({
      intro: [
        'Official Urban Design Pack for the new Defender 110 from House of Urban.',
        'This package is built around the Urban styling programme for Defender 110 and combines the key exterior parts shown on the official Urban store.',
      ],
      included: [
        'Urban Black Shadow side steps (Hex or Chequer design)',
        'Painted extended wheel arches for Defender 110',
        'URBAN mudflap kit',
        'Urban rear spoiler',
        'Urban quad pod roof light bar',
        '22" Urban WX wheel and tyre package',
        'Urban wheel cover',
        'Urban branding pack',
      ],
      excluded: [
        'Installation / fitting work',
        'Best of British top and side vents shown as optional add-ons on the official Urban listing',
        'Full extended colour coding package for Supply Only orders',
      ],
      features: [
        'Official House of Urban product for Defender 110 (L663)',
        'Supply Only package on the official store',
        'Core Urban styling programme rather than a single trim component',
      ],
    }),
    htmlUa: buildHtmlUa({
      intro: [
        'Офіційний Urban Design Pack для нового Defender 110 з House of Urban.',
        'Пакет зібраний навколо фірмової Urban styling programme для Defender 110 і об’єднує ключові зовнішні елементи, показані на офіційному магазині Urban.',
      ],
      included: [
        'Urban Black Shadow side steps у виконанні Hex або Chequer',
        'Фарбовані розширені колісні арки для Defender 110',
        'Комплект бризковиків URBAN',
        'Задній спойлер Urban',
        'Даховий light bar у стилі Urban quad pod',
        'Колісний пакет 22" Urban WX з шинами',
        'Фірмовий Urban wheel cover',
        'Комплект брендингу Urban',
      ],
      excluded: [
        'Роботи з монтажу / встановлення',
        'Best of British top vents і side vents, які на офіційному сайті йдуть як опція',
        'Повний пакет extended colour coding для конфігурації Supply Only',
      ],
      features: [
        'Офіційний продукт House of Urban для Defender 110 (L663)',
        'На офіційному магазині продається як Supply Only',
        'Це базовий Urban styling programme, а не окремий дрібний аксесуар',
      ],
    }),
  },
  {
    slug: 'urban-defender-110-wide-arches',
    source:
      'House of Urban: New Defender 110 Urban Widetrack Arch Kit https://houseofurban.co.uk/products/new-defender-110-urban-widetrack-arch-kit',
    shortDescEn:
      'Official Urban Widetrack arch kit for Defender 110, created to give the New Defender a more purposeful stance and more aggressive road presence.',
    shortDescUa:
      'Офіційний Urban Widetrack arch kit для Defender 110, створений щоб дати New Defender більш виразну stance і агресивнішу road presence.',
    htmlEn: buildHtml({
      intro: [
        'Official Urban Widetrack arch kit for the New Defender 110.',
        'House of Urban describes this kit as the part that gives the Defender a more purposeful stance and a more aggressive appearance.',
      ],
      included: [
        'Urban Widetrack arch kit for Defender 110',
        'Defender 110-specific fitment',
        'P400E Hybrid-specific variant when that option is selected',
      ],
      excluded: [
        'Installation / fitting work',
        'Other Defender Widetrack parts such as front canards, light bar, wheels or wheel cover',
        'Additional painting work outside the selected official configuration',
      ],
      features: [
        'Official House of Urban item for the New Defender platform',
        'Focused on stance and visual width rather than a full programme package',
      ],
    }),
    htmlUa: buildHtmlUa({
      intro: [
        'Офіційний Urban Widetrack arch kit для New Defender 110.',
        'На House of Urban цей комплект описується як рішення, що додає Defender більш виразну посадку та агресивніший зовнішній вигляд.',
      ],
      included: [
        'Urban Widetrack arch kit для Defender 110',
        'Посадка саме під Defender 110',
        'Окрема сумісна версія для P400E Hybrid, якщо обрана відповідна опція',
      ],
      excluded: [
        'Роботи з монтажу / встановлення',
        'Інші елементи Defender Widetrack: front canards, light bar, колеса або wheel cover',
        'Додаткові малярні роботи поза межами вибраної офіційної конфігурації',
      ],
      features: [
        'Офіційна позиція House of Urban для платформи New Defender',
        'Фокус саме на ширині кузова і stance, а не на повній програмі обвісу',
      ],
    }),
  },
  {
    slug: 'urban-defender-110-roof-lightbar',
    source:
      'House of Urban: Urban High Power Carbon Fibre Light Bar for Land Rover Defender (L663) https://houseofurban.co.uk/products/urban-defender-2020-roof-light-pod',
    shortDescEn:
      'Official Urban high-power carbon fibre light bar for Defender L663 with integrated Hi-Power Lazer lights and a choice of end plaque.',
    shortDescUa:
      'Офіційний Urban high-power carbon fibre light bar для Defender L663 з інтегрованими Hi-Power Lazer lights і вибором дизайну end plaque.',
    htmlEn: buildHtml({
      intro: [
        'Official Urban high-power carbon fibre light bar for the Land Rover Defender (L663).',
        'House of Urban specifies integrated Hi-Power Lazer lights and a choice of end plaque designs on the official product page.',
      ],
      included: [
        'Carbon fibre roof light bar assembly',
        'Integrated Hi-Power Lazer lights',
        'Choice of end plaque / badge style from the official Urban options',
      ],
      excluded: [
        'Installation / fitting work',
        'Any extra body kit parts outside the light bar assembly itself',
      ],
      features: [
        'Official fitment for Defender L663',
        'Multiple end plaque / badge finishes on the official Urban page',
        'Supply Only product on the official store',
      ],
    }),
    htmlUa: buildHtmlUa({
      intro: [
        'Офіційний Urban high-power carbon fibre light bar для Land Rover Defender (L663).',
        'На офіційній сторінці House of Urban зазначені інтегровані Hi-Power Lazer lights і вибір дизайну end plaque.',
      ],
      included: [
        'Даховий light bar з карбону',
        'Інтегровані Hi-Power Lazer lights',
        'Вибір стилю end plaque / badge з офіційних опцій Urban',
      ],
      excluded: [
        'Роботи з монтажу / встановлення',
        'Будь-які інші елементи body kit поза самим блоком light bar',
      ],
      features: [
        'Офіційна сумісність із Defender L663',
        'На сторінці Urban доступно кілька варіантів end plaque / badge',
        'На офіційному магазині продається як Supply Only',
      ],
    }),
  },
  {
    slug: 'urban-audi-rs6-avant-aerokit',
    source:
      'House of Urban: Urban Carbon Fibre Bodykit for Audi RS6 https://houseofurban.co.uk/products/audi-rs6-urban-carbon-fibre-bodykit',
    shortDescEn:
      'Official Urban carbon fibre aero programme for Audi RS6 C8 with front bumper apron, side sills, two-piece rear spoiler set and replacement rear diffuser.',
    shortDescUa:
      'Офіційна Urban carbon fibre aero programme для Audi RS6 C8 з front bumper apron, side sills, двокомпонентним rear spoiler set і replacement rear diffuser.',
    htmlEn: buildHtml({
      intro: [
        'Official Urban Automotive carbon fibre aero programme bodykit for the Audi RS6 (C8).',
        'House of Urban states that the kit is designed and manufactured in-house from high-quality carbon and is intended for the C8 platform from 2020 onwards.',
      ],
      included: [
        'Carbon fibre front bumper apron',
        'Carbon fibre lower side sill extensions',
        'Carbon fibre upper rear wing assembly',
        'Carbon fibre lower deck lid spoiler',
        'Replacement carbon fibre rear diffuser',
      ],
      excluded: [
        'Optional wheel package',
        'Optional Milltek performance exhaust package',
        'Installation / fitting work',
      ],
      features: [
        'Fits Audi RS6 C8 (2020 onwards)',
        'Official House of Urban programme description',
        'Two-piece rear spoiler setup is part of the official Urban package language',
      ],
    }),
    htmlUa: buildHtmlUa({
      intro: [
        'Офіційна Urban Automotive carbon fibre aero programme bodykit для Audi RS6 (C8).',
        'На House of Urban зазначено, що комплект розроблений і виготовлений in-house з високоякісного карбону та призначений для платформи C8 з 2020 року.',
      ],
      included: [
        'Carbon fibre front bumper apron',
        'Carbon fibre lower side sill extensions',
        'Carbon fibre upper rear wing assembly',
        'Carbon fibre lower deck lid spoiler',
        'Replacement carbon fibre rear diffuser',
      ],
      excluded: [
        'Опціональний wheel package',
        'Опціональний Milltek performance exhaust package',
        'Роботи з монтажу / встановлення',
      ],
      features: [
        'Сумісність з Audi RS6 C8 (2020+)',
        'Офіційний опис програми з House of Urban',
        'Фірмова двокомпонентна rear spoiler конфігурація входить у мову офіційного Urban пакета',
      ],
    }),
  },
  {
    slugs: ['urban-range-rover-l460-aerokit', 'urb-bod-25353001-v1', 'urban-050-1056-57'],
    source:
      'Frijns Unlimited official Urban product page + Urban PDF: https://www.frijnsunlimited.com/products/urban/range-rover-1214/ranger-rover-l460-2022--1215 ; https://www.frijnsunlimited.com/upload/documents/Urban/Urban%202025-1%20Range%20Rover%20L460.pdf',
    shortDescEn:
      'Official Urban L460 programme built around the replacement bumper package with front and rear carbon components, diffuser package, DRL kit and signature Urban branding.',
    shortDescUa:
      'Офіційна Urban L460 programme, побудована навколо replacement bumper package з передніми та задніми карбоновими елементами, diffuser package, DRL kit і фірмовим Urban branding.',
    htmlEn: buildHtml({
      intro: [
        'Official Urban programme reference for the Range Rover L460 based on the current Urban price list published by Frijns Unlimited.',
        'The package basis is the Urban Replacement Bumper Package, with additional spoiler, arch, grille and sill elements depending on whether the build remains standard body or moves to the widebody specification.',
      ],
      included: [
        'Carbon fibre front bumper',
        'Visual carbon fibre front bumper mouthpiece',
        'Visual carbon fibre front bumper mouthpiece overlay bar',
        'Visual carbon fibre front splitter (3-piece)',
        'Nolden daytime running light kit',
        'Carbon fibre rear bumper',
        'Visual carbon fibre rear diffuser and skid pan',
        'Exhaust pipe adjuster (pair)',
        'Billet aluminium tailpipe finishers (pair)',
        'URBAN branding package',
      ],
      excluded: [
        'PUR Widetrack arch set, matrix grille, lower side sill kit and carbon rear spoiler unless the build is specified as widebody',
        'Wheel and tyre package when not selected as part of the configured Urban package',
        'Installation / fitting work',
      ],
      features: [
        'Official package basis taken from the Urban L460 price list',
        'Covers the core bumper / diffuser / tailpipe / branding package for the new Range Rover',
        'Widebody extras are listed separately by Urban and are configuration-dependent',
      ],
    }),
    htmlUa: buildHtmlUa({
      intro: [
        'Офіційна Urban programme для Range Rover L460 на основі актуального Urban price list, опублікованого Frijns Unlimited.',
        'Базою пакета є Urban Replacement Bumper Package, а спойлер, арки, grille та side sill елементи додаються залежно від того, чи це standard body, чи widebody конфігурація.',
      ],
      included: [
        'Carbon fibre front bumper',
        'Visual carbon fibre front bumper mouthpiece',
        'Visual carbon fibre front bumper mouthpiece overlay bar',
        'Visual carbon fibre front splitter (3-piece)',
        'Nolden daytime running light kit',
        'Carbon fibre rear bumper',
        'Visual carbon fibre rear diffuser and skid pan',
        'Exhaust pipe adjuster (pair)',
        'Billet aluminium tailpipe finishers (pair)',
        'URBAN branding package',
      ],
      excluded: [
        'PUR Widetrack arch set, matrix grille, lower side sill kit і carbon rear spoiler, якщо конфігурація не замовлена як widebody',
        'Wheel and tyre package, якщо він не обраний у складі конкретного Urban пакета',
        'Роботи з монтажу / встановлення',
      ],
      features: [
        'Офіційна основа пакета з Urban L460 price list',
        'Охоплює ядро пакета: бампери, diffuser, tailpipe finishers, DRL kit і branding',
        'Widebody-доповнення Urban виносить окремо і вони залежать від конфігурації',
      ],
    }),
  },
  {
    slugs: ['urban-l461-1000', 'urb-bod-25353030-v1'],
    source:
      'Frijns Unlimited official Urban product page + Urban PDF + Urban L461 launch note: https://www.frijnsunlimited.com/products/urban/range-rover-1214/range-rover-sport-l461-1223 ; https://www.frijnsunlimited.com/upload/documents/Urban/Urban%202025-1%20Range%20Rover%20L461.pdf ; https://www.frijnsunlimited.com/en-gb/newsitem/59-urban-automotive-launches-l461-aero-kit',
    shortDescEn:
      'Official Urban Aero Kit for Range Rover Sport L461 with the replacement bumper package, matrix grille, rear spoiler, fixed side steps and the OEM-plus L461 package logic from the current Urban price list.',
    shortDescUa:
      'Офіційний Urban Aero Kit для Range Rover Sport L461 з replacement bumper package, matrix grille, rear spoiler, fixed side steps і OEM-plus логікою пакета з актуального Urban price list.',
    htmlEn: buildHtml({
      intro: [
        'Official Urban Aero Kit reference for the Range Rover Sport L461.',
        'Urban describes the L461 programme as an OEM-plus package built around the replacement bumper package, with extra vent, bonnet, arch and forged wheel elements reserved for the widebody configuration.',
      ],
      included: [
        'Urban replacement bumper package',
        'Visual carbon fibre matrix front grille',
        'Rear spoiler including rear tablet emblem badge',
        'Matrix or Linear Black Shadow fixed side steps',
        '24" cast alloy package',
      ],
      excluded: [
        'PUR Widetrack arch set unless the build is configured as widebody',
        'Lower canard pack, side vent kit, bonnet vents / bonnet assembly and forged wheel package unless selected as upgrades',
        'Installation / fitting work',
      ],
      features: [
        'Official L461 narrow-body package basis from the current Urban price list',
        'Urban launch note describes the L461 Aero Kit as a more subtle OEM-plus upgrade',
        'Widebody-specific parts are separate configuration items in the official package structure',
      ],
    }),
    htmlUa: buildHtmlUa({
      intro: [
        'Офіційна Urban Aero Kit reference для Range Rover Sport L461.',
        'Urban описує L461 programme як OEM-plus пакет, побудований навколо replacement bumper package, а vent, bonnet, arch і forged wheel елементи відносить до widebody-конфігурації.',
      ],
      included: [
        'Urban replacement bumper package',
        'Visual carbon fibre matrix front grille',
        'Rear spoiler з rear tablet emblem badge',
        'Matrix або Linear Black Shadow fixed side steps',
        '24" cast alloy package',
      ],
      excluded: [
        'PUR Widetrack arch set, якщо збірка не замовлена як widebody',
        'Lower canard pack, side vent kit, bonnet vents / bonnet assembly і forged wheel package, якщо ці апгрейди не вибрані окремо',
        'Роботи з монтажу / встановлення',
      ],
      features: [
        'Офіційна основа narrow-body пакета з актуального Urban price list для L461',
        'У launch note Urban прямо позиціонує L461 Aero Kit як більш стриманий OEM-plus апгрейд',
        'Widebody-деталі в офіційній структурі пакета винесені окремими позиціями',
      ],
    }),
  },
  {
    slugs: [
      'urb-bod-25353062-v1',
      'urb-bod-25353068-v1',
      'urb-bod-25353066-v1',
      'urb-bod-25353070-v1',
      'urb-bod-25353067-v1',
      'urb-bod-25353063-v1',
      'urb-bod-25353071-v1',
      'urb-bod-25353069-v1',
      'urban-250-1002',
    ],
    source:
      'Frijns Unlimited official Urban product pages + House of Urban official component page: https://www.frijnsunlimited.com/products/urban/range-rover-1214/range-rover-sport-2018--1216 ; https://www.frijnsunlimited.com/products/urban/range-rover-1214/range-rover-svr-2018--1217 ; https://houseofurban.co.uk/products/carbon-fibre-urban-autograph-grille-rr-sport',
    shortDescEn:
      'Official Urban V2 package basis for Range Rover Sport L494 / SVR with replacement carbon bumpers, Nolden DRLs, splitter, diffuser, billet tailpipes and signature Urban branding.',
    shortDescUa:
      'Офіційна база Urban V2 для Range Rover Sport L494 / SVR з replacement carbon bumpers, Nolden DRLs, splitter, diffuser, billet tailpipes і фірмовим Urban branding.',
    htmlEn: buildHtml({
      intro: [
        'Official Urban package basis for the Range Rover Sport L494 / SVR platform.',
        'Frijns Unlimited documents the current L494 and SVR conversion around the replacement bumper package, while House of Urban confirms the same Urban V2 package language across both 2013-2017 and 2018+ fitments through the official Autograph grille listing.',
      ],
      included: [
        'Replacement carbon fibre front bumper',
        'Replacement carbon fibre rear bumper',
        'Integrated Nolden daytime running lights',
        'Twin billet aluminium exhaust tips',
        'Black styling pack to grille and side vents',
        'Front bumper mouthpiece (ACC compatible)',
        'Front bumper side air intakes',
        'Front bumper lower splitter',
        'Rear diffuser',
        'Removable skid pan',
        'Urban bonnet lettering',
        'Urban tailgate lettering',
        'Urban crest / authentication badging package',
      ],
      excluded: [
        'Carbon fibre tailgate trim unless selected separately',
        'Carbon fibre wing mirrors unless selected separately',
        'Urban Autograph grille unless selected separately',
        'Wheel and tyre package unless configured as part of the full build',
        'Interior quilting / rear entertainment / protection add-ons',
        'Installation / fitting work',
      ],
      features: [
        'Official Urban V2 styling package language for the L494 platform',
        'Gloss black or exposed carbon finish options on the official Frijns page',
        'Works for both Range Rover Sport and SVR variants within the L494 family',
      ],
    }),
    htmlUa: buildHtmlUa({
      intro: [
        'Офіційна база Urban package для платформи Range Rover Sport L494 / SVR.',
        'Frijns Unlimited описує актуальну L494 / SVR конверсію навколо replacement bumper package, а House of Urban підтверджує ту ж логіку Urban V2 для обох fitment-версій 2013-2017 і 2018+ через офіційний Autograph grille listing.',
      ],
      included: [
        'Replacement carbon fibre front bumper',
        'Replacement carbon fibre rear bumper',
        'Інтегровані Nolden daytime running lights',
        'Twin billet aluminium exhaust tips',
        'Black styling pack для grille та side vents',
        'Front bumper mouthpiece з ACC compatibility',
        'Front bumper side air intakes',
        'Front bumper lower splitter',
        'Rear diffuser',
        'Removable skid pan',
        'Urban bonnet lettering',
        'Urban tailgate lettering',
        'Urban crest / authentication badging package',
      ],
      excluded: [
        'Carbon fibre tailgate trim, якщо він не обраний окремо',
        'Carbon fibre wing mirrors, якщо вони не обрані окремо',
        'Urban Autograph grille, якщо він не обраний окремо',
        'Wheel and tyre package, якщо він не входить до конкретної конфігурації',
        'Interior quilting / rear entertainment / protection add-ons',
        'Роботи з монтажу / встановлення',
      ],
      features: [
        'Офіційна Urban V2 package logic для платформи L494',
        'На офіційній сторінці Frijns доступні finish-варіанти gloss black або exposed carbon',
        'Опис покриває як Range Rover Sport, так і SVR у межах сімейства L494',
      ],
    }),
  },
  {
    slugs: ['urb-bun-25358198-v1'],
    source:
      'Frijns Unlimited official Urban product page: https://www.frijnsunlimited.com/products/urban/mercedes-1232/g-wagon-soft-kit-2018--1233',
    shortDescEn:
      'Official Urban Soft Kit for Mercedes-Benz G-Wagon W463A with the signature OEM Plus look, carbon front splitter package, rear over-rider kit and in-house carbon accessories.',
    shortDescUa:
      'Офіційний Urban Soft Kit для Mercedes-Benz G-Wagon W463A з фірмовим OEM Plus look, carbon front splitter package, rear over-rider kit і фірмовими in-house carbon accessories.',
    htmlEn: buildHtml({
      intro: [
        'Official Urban G-Wagon Soft Kit reference for the 2018+ W463A platform.',
        'Frijns Unlimited describes the Soft Kit as one of Urban’s most popular builds, combining subtle OEM Plus styling with handcrafted carbon fibre parts and forged wheel options.',
      ],
      included: [
        'Replacement carbon fibre front bonnet',
        'Exposed carbon bumper splitter with integral DRLs',
        'Carbon fibre rear bumper over-rider kit',
      ],
      excluded: [
        'Indicator surrounds, bullnose bonnet, C-pillar vents, rear wheel cover, roof light pod, upper rear wing and wing mirrors unless selected separately',
        '23" forged alloy wheels unless selected separately',
        'Installation / fitting work',
      ],
      features: [
        'Official Soft Kit package language from Frijns Unlimited',
        'Design finishes available in satin or gloss exposed carbon fibre',
        'Built for customers who want a more restrained Urban OEM Plus conversion than Widetrack',
      ],
    }),
    htmlUa: buildHtmlUa({
      intro: [
        'Офіційна reference для Urban G-Wagon Soft Kit на платформі W463A 2018+.',
        'Frijns Unlimited описує Soft Kit як одну з найпопулярніших Urban builds: стриманіший OEM Plus look у поєднанні з handcrafted carbon fibre parts і forged wheel options.',
      ],
      included: [
        'Replacement carbon fibre front bonnet',
        'Exposed carbon bumper splitter з integral DRLs',
        'Carbon fibre rear bumper over-rider kit',
      ],
      excluded: [
        'Indicator surrounds, bullnose bonnet, C-pillar vents, rear wheel cover, roof light pod, upper rear wing і wing mirrors, якщо вони не вибрані окремо',
        '23" forged alloy wheels, якщо вони не вибрані окремо',
        'Роботи з монтажу / встановлення',
      ],
      features: [
        'Офіційна Soft Kit package logic з Frijns Unlimited',
        'Доступні finish-варіанти satin або gloss exposed carbon fibre',
        'Пакет для клієнтів, які хочуть більш стриману Urban OEM Plus конверсію, ніж Widetrack',
      ],
    }),
  },
  {
    slugs: ['urban-g-wagon-w465-widetrack', 'urb-bun-25358207-v1', 'urban-050-2000', 'urban-050-0170'],
    source:
      'Frijns Unlimited official Urban product page: https://www.frijnsunlimited.com/products/urban/mercedes-1232/g-wagon-widetrack--1234',
    shortDescEn:
      'Official Urban Widetrack package for Mercedes-Benz G-Wagon W465 with wide-track arches, exposed carbon bonnet, splitter, rear bumper, diffuser and the full Urban widebody presence.',
    shortDescUa:
      'Офіційний Urban Widetrack package для Mercedes-Benz G-Wagon W465 з wide-track arches, exposed carbon bonnet, splitter, rear bumper, diffuser і повною Urban widebody presence.',
    htmlEn: buildHtml({
      intro: [
        'Official Urban Widetrack package reference for the Mercedes-Benz G-Wagon W465.',
        'Frijns Unlimited describes this conversion as the most complete and aggressive G-Wagon styling package to date, built around a multi-part carbon package and the trademark Urban widened stance.',
      ],
      included: [
        'Replacement carbon fibre front bonnet',
        'Exposed carbon bumper splitter with integral DRLs',
        'Replacement carbon fibre rear bumper',
        'Exposed carbon rear diffuser',
        'Wide track arch kit',
        'Exposed carbon fibre arches',
        'Exposed carbon fibre lower sills',
        'Exposed carbon fibre step end caps',
      ],
      excluded: [
        'Indicator surrounds, bullnose bonnet, C-pillar vents, rear wheel cover, roof light pod, upper rear wing and wing mirrors unless selected separately',
        '23" forged alloy wheels unless selected separately',
        'Installation / fitting work',
      ],
      features: [
        'Frijns Unlimited describes the Widetrack conversion as a 52-component carbon-fibre package',
        'Official Urban widebody presentation for the W465 platform',
        'Finish options include satin black, gloss black and exposed carbon themes',
      ],
    }),
    htmlUa: buildHtmlUa({
      intro: [
        'Офіційна reference для Urban Widetrack package на Mercedes-Benz G-Wagon W465.',
        'Frijns Unlimited описує цю конверсію як найповніший і найагресивніший G-Wagon styling package Urban, побудований навколо багатокомпонентного carbon package і фірмової widened stance.',
      ],
      included: [
        'Replacement carbon fibre front bonnet',
        'Exposed carbon bumper splitter з integral DRLs',
        'Replacement carbon fibre rear bumper',
        'Exposed carbon rear diffuser',
        'Wide track arch kit',
        'Exposed carbon fibre arches',
        'Exposed carbon fibre lower sills',
        'Exposed carbon fibre step end caps',
      ],
      excluded: [
        'Indicator surrounds, bullnose bonnet, C-pillar vents, rear wheel cover, roof light pod, upper rear wing і wing mirrors, якщо вони не обрані окремо',
        '23" forged alloy wheels, якщо вони не обрані окремо',
        'Роботи з монтажу / встановлення',
      ],
      features: [
        'Frijns Unlimited описує Widetrack як 52-компонентний carbon-fibre package',
        'Офіційна Urban widebody presentation для платформи W465',
        'Доступні finish-варіанти satin black, gloss black і exposed carbon',
      ],
    }),
  },
];

async function main() {
  const updates = [];

  for (const entry of curated) {
    const targetSlugs = entry.slugs ?? [entry.slug];

    for (const slug of targetSlugs) {
      const product = await prisma.shopProduct.findUnique({
        where: { slug },
        select: { id: true, slug: true, titleEn: true },
      });

      if (!product) {
        console.warn(`[missing] ${slug}`);
        continue;
      }

      updates.push({
        id: product.id,
        slug: product.slug,
        data: {
          shortDescEn: entry.shortDescEn,
          shortDescUa: entry.shortDescUa,
          longDescEn: entry.htmlEn,
          longDescUa: entry.htmlUa,
          bodyHtmlEn: entry.htmlEn,
          bodyHtmlUa: entry.htmlUa,
        },
        source: entry.source,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'commit',
        updates: updates.map((item) => ({
          slug: item.slug,
          source: item.source,
          keys: Object.keys(item.data),
        })),
      },
      null,
      2
    )
  );

  if (DRY_RUN) {
    await prisma.$disconnect();
    return;
  }

  for (const update of updates) {
    await prisma.shopProduct.update({
      where: { id: update.id },
      data: update.data,
    });
    console.log(`[updated] ${update.slug}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
