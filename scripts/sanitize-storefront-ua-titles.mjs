#!/usr/bin/env node

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const COMMIT = args.has('--commit');
const DRY_RUN = !COMMIT || args.has('--dry-run');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : null;
const BURGER_BATCH_SIZE = 24;
const GOOGLE_TRANSLATE_DELAY_MS = 140;

const BURGER_SUSPICIOUS_PATTERNS = [
  /\bfor\b/i,
  /\bkit\b/i,
  /\bpackage\b/i,
  /\bпакет\b/i,
  /\bperformance\b/i,
  /\bintake\b/i,
  /\bwheel spacers?\b/i,
  /\bcold air\b/i,
  /\bcharger pipe\b/i,
  /\boil catch can\b/i,
  /\btuner\b/i,
  /\bwater\/methanol\b/i,
  /\bdual\b/i,
  /\bupgrade\b/i,
  /\bport injection\b/i,
  /\bexhaust tips?\b/i,
  /\bair filters?\b/i,
  /\bbov\b/i,
  /\bsensors?\b/i,
  /\badapters?\b/i,
  /\bcap(?:s)?\b/i,
  /\bcover\b/i,
  /\bmount\b/i,
  /\bbrace\b/i,
  /\bbraces\b/i,
  /\bdownshift blocker\b/i,
  /\bthe\b/i,
];

const OHLINS_SUSPICIOUS_PATTERNS = [
  /\bfront left\b/i,
  /\bfront right\b/i,
  /\brear left\b/i,
  /\brear right\b/i,
  /\bfront\b/i,
  /\brear\b/i,
  /\bgravel\b/i,
  /\btarmac\b/i,
  /\bmotorsport\b/i,
  /\bдо-т\b/i,
];

const AKRAPOVIC_REPLACEMENTS = [
  [/\bSound Kit\b/gi, 'звуковий комплект'],
  [/\bSlip-On Race Line\b/gi, 'Slip-On Race Line'],
  [/\bEvolution Link Pipe Set\b/gi, 'комплект Evolution link-pipe'],
  [/\bLink Pipe Set\b/gi, 'комплект link-pipe'],
];

const URBAN_TITLE_OVERRIDES = new Map([
  ['urb-bod-25353138-v1', 'Land Rover Discovery 5 URBAN пакет переднього фейсліфтингу (2017-2020)'],
  ['urb-bod-25353141-v1', 'Land Rover Discovery 5 URBAN facelift-пакет (2020+)'],
  ['urb-sid-25353020-v1', 'Range Rover L460 Visual Carbon Fibre комплект нижніх бокових панелей (LWB)'],
  ['urb-tai-25353065-v1', 'Насадка з billet-алюмінію для вихлопної труби Range Rover L494 Satin Black'],
  ['urb-arc-25358153-v1', 'Комплект колісних арок Bentley Continental GT PUR'],
  ['urb-arc-26009359-v1', 'Defender 110 Wide Track Arch Kit (не гібрид) RAW'],
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sentenceCase(text) {
  const value = String(text ?? '').trim();
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeBurgerFitmentText(text) {
  return String(text ?? '')
    .replace(/\bG Chassis\b/gi, 'G chassis')
    .replace(/\bF Chassis\b/gi, 'F chassis')
    .replace(/\bE Chassis\b/gi, 'E chassis')
    .replace(/\bR Chassis\b/gi, 'R chassis')
    .replace(/\bTransverse Engines\b/gi, 'поперечні двигуни')
    .replace(/\bset of (\d+)\b/gi, 'комплект з $1 шт.')
    .replace(/\bPAIR\b/gi, 'пара')
    .replace(/\bPair\b/gi, 'пара')
    .replace(/\s*&\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

function postProcessBurgerTitle(text, sourceEn = '') {
  if (!text) return text;
  let t = String(text).trim();

  t = t.replace(/Бургер Моторспортс?/gi, 'Burger Motorsports');
  t = t.replace(/Бі-Ем-Ес/gi, 'BMS');
  t = t.replace(/Ф'юел-Іт!/gi, 'Fuel-It!');
  t = t.replace(/Паливо-Іт!/gi, 'Fuel-It!');
  t = t.replace(/Паливо-Це!/gi, 'Fuel-It!');
  t = t.replace(/ДжейБі4/gi, 'JB4');
  t = t.replace(/ДжейБі\+/gi, 'JB+');

  t = t.replace(/\bJB4PRO for\b/gi, 'JB4PRO для');
  t = t.replace(/\bJB4 for\b/gi, 'JB4 для');
  t = t.replace(/\bWheel Spacer Kit\b/gi, 'комплект колісних проставок');
  t = t.replace(/\bWheel Spacers\b/gi, 'колісні проставки');
  t = t.replace(/\bExtended Wheel Bolts\b/gi, 'подовжені колісні болти');
  t = t.replace(/\bOil Catch Can System\b/gi, 'система масловловлювача');
  t = t.replace(/\bDual Oil Catch Can System\b/gi, 'подвійна система масловловлювачів');
  t = t.replace(/\bOil Catch Can Kit\b/gi, 'комплект масловловлювача');
  t = t.replace(/\bOil Catch Can\b/gi, 'масловловлювач');
  t = t.replace(/\bCold Air Intake\b/gi, 'система холодного впуску');
  t = t.replace(/\bDual Cone Performance Intake\b/gi, 'подвійна конусна система впуску');
  t = t.replace(/\bPerformance Intake\b/gi, 'система впуску');
  t = t.replace(/\bBillet Intake\b/gi, 'billet-впуск');
  t = t.replace(/\bDual Intakes?\b/gi, 'подвійна система впуску');
  t = t.replace(/\bIntake\b/gi, 'впуск');
  t = t.replace(/\bFlex Fuel Kits?\b/gi, 'комплект Flex Fuel');
  t = t.replace(/\bFlex Fuel Analyzer\b/gi, 'аналізатор Flex Fuel');
  t = t.replace(/\bFuel Pump Upgrade Kit\b/gi, 'комплект апгрейду паливного насоса');
  t = t.replace(/\bPort Injection Intake Manifold\b/gi, 'впускний колектор портового впорскування');
  t = t.replace(/\bPort Injection\b/gi, 'портове впорскування');
  t = t.replace(/\bCharge Pipe Injection\b/gi, 'Charge Pipe Injection');
  t = t.replace(/\bCharge Pipe Coupler\b/gi, 'муфта пайпа наддуву');
  t = t.replace(/\bCharge Pipe\b/gi, 'пайп наддуву');
  t = t.replace(/\bBoost Tap Adapter\b/gi, 'адаптер Boost Tap');
  t = t.replace(/\bKit\b/gi, 'комплект');
  t = t.replace(/\bAdapters\b/gi, 'адаптери');
  t = t.replace(/\bAdapter\b/gi, 'адаптер');
  t = t.replace(/\bUpgrade\b/gi, 'апгрейд');
  t = t.replace(/\bMount Kit\b/gi, 'комплект кріплення');
  t = t.replace(/\bMount\b/gi, 'кріплення');
  t = t.replace(/\bTransmission Oil Cooler\b/gi, 'трансмісійний маслокулер');
  t = t.replace(/\bEngine Cover Set\b/gi, 'комплект кришок двигуна');
  t = t.replace(/\bTMAP Sensors?\b/gi, 'TMAP-сенсори');
  t = t.replace(/\bPNP Adapters?\b/gi, 'PNP-адаптери');
  t = t.replace(/\bAir Filters?\b/gi, 'повітряні фільтри');
  t = t.replace(/\bDrop-In Performance Air Filters?\b/gi, 'вставні повітряні фільтри');
  t = t.replace(/\bPerformance Air Filters?\b/gi, 'високопродуктивні повітряні фільтри');
  t = t.replace(/\bExhaust Tips?\b/gi, 'насадки на вихлоп');
  t = t.replace(/\bLug Nuts?\b/gi, 'гайки коліс');
  t = t.replace(/\bOil Filter Cap\b/gi, 'кришка масляного фільтра');
  t = t.replace(/\bOil Filter Cover\b/gi, 'кришка масляного фільтра');
  t = t.replace(/\bOil Fill Cap\b/gi, 'кришка маслозаливної горловини');
  t = t.replace(/\bRadiator Cap Cover\b/gi, 'накладка на кришку радіатора');
  t = t.replace(/\bExpansion Tank Cap\b/gi, 'кришка розширювального бачка');
  t = t.replace(/\bBattery Tie Down\b/gi, 'притиск акумулятора');
  t = t.replace(/\bBelt Cover\b/gi, 'кришка ременя');
  t = t.replace(/\bNozzle Adapter\b/gi, 'адаптер форсунки');
  t = t.replace(/\bBlow Off Valve\b/gi, 'Blow-Off Valve');
  t = t.replace(/\bBOV Spacer\b/gi, 'проставка BOV');
  t = t.replace(/\bTuner\b/gi, 'тюнер');
  t = t.replace(/\bPerformance Tuner\b/gi, 'performance-тюнер');

  t = t.replace(/\bAluminium\b/gi, 'алюмінієвий');
  t = t.replace(/\bAluminum\b/gi, 'алюмінієвий');
  t = t.replace(/\bHigh Performance\b/gi, 'високопродуктивний');
  t = t.replace(/\bDrop-In Performance\b/gi, 'вставний');
  t = t.replace(/\bPerformance Drop-In\b/gi, 'вставний');
  t = t.replace(/\bthe\b/gi, ' ');
  t = t.replace(/забір холодного повітря/gi, 'система холодного впуску');
  t = t.replace(/\bBluetooth комплект\b/gi, 'Bluetooth-комплект');
  t = t.replace(/\bSupercharged\b/gi, 'компресорний');
  t = t.replace(/вприскування води\/метанолу/gi, 'впорскування води/метанолу');
  t = t.replace(/бак для система впорскування води\/метанолу/gi, 'бак для системи впорскування води/метанолу');
  t = t.replace(/маслян(?:ої|их) бак(?:а|ів)/gi, (match) => (match.toLowerCase().includes('их') ? 'масловловлювачів' : 'масловловлювача'));
  t = t.replace(/масляної ємності/gi, 'масловловлювача');
  t = t.replace(/oil catch system/gi, 'система масловловлювача');
  t = t.replace(/зарядної труби/gi, 'пайпа наддуву');
  t = t.replace(/з двома пробками/gi, 'з двома бонками');
  t = t.replace(/внутрішнім діаметром ([\d.,"]+)/gi, 'внутрішній діаметр $1');
  t = t.replace(/лінійні ковпачки кондиціонера/gi, 'ковпачки ліній кондиціонера');
  t = t.replace(/кронштейн опорного кронштейна диференціала/gi, 'підсилювач кронштейна опори диференціала');
  t = t.replace(/компактний комплект масловловлювача BMS для (.+?) (\d{4}\+)/i, 'Компактний комплект масловловлювача BMS для $2 $1');
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*кінських сил на колесах/gi, '$1 whp');
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*кінських сил/gi, '$1 hp');
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*галона?/gi, '$1 галон');
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*Gallon/gi, '$1 галон');
  t = t.replace(/\bG Шасі\b/gi, 'G chassis');
  t = t.replace(/\bF Шасі\b/gi, 'F chassis');
  t = t.replace(/\bE Шасі\b/gi, 'E chassis');
  t = t.replace(/\bR Шасі\b/gi, 'R chassis');
  t = t.replace(/\bШасі ([EFGR])\b/gi, '$1 chassis');
  t = t.replace(/\b(\d+)\s+Series\b/gi, '$1 серії');
  t = t.replace(/\bfor\b/gi, 'для');
  t = t.replace(/\bwith\b/gi, 'з');
  t = t.replace(/\band\b/gi, 'та');
  t = t.replace(/\bset of (\d+)\b/gi, 'комплект з $1 шт.');
  t = t.replace(/\((?:набір|комплект) з (\d+)\)/gi, '(комплект з $1 шт.)');
  t = t.replace(/\(\s*пара\s*,\s*2 колеса\s*\)/gi, '(пара, 2 колеса)');
  t = t.replace(/\bpair\b/gi, 'пара');
  t = t.replace(/\bplug & play\b/gi, 'підключи і працюй');

  if (/^\d+(?:\s+Wheel)?\s+Horsepower\s+.+\s+Package$/i.test(sourceEn)) {
    const vehicle = sourceEn.replace(/^\d+(?:\s+Wheel)?\s+Horsepower\s+/i, '').replace(/\s+Package$/i, '');
    const unit = /\bWheel Horsepower\b/i.test(sourceEn) ? 'whp' : 'hp';
    t = `комплект на ${sourceEn.match(/^\d+/)?.[0]} ${unit} для ${normalizeBurgerFitmentText(vehicle)}`;
  }

  if (/^\d+hp\s+Package\s+for\s+.+$/i.test(sourceEn)) {
    const vehicle = sourceEn.replace(/^\d+hp\s+Package\s+for\s+/i, '');
    t = `комплект на ${sourceEn.match(/^\d+/)?.[0]} hp для ${normalizeBurgerFitmentText(vehicle)}`;
  }

  if (/^JB4 Tuner for /i.test(sourceEn)) {
    t = `JB4 тюнер для ${normalizeBurgerFitmentText(sourceEn.replace(/^JB4 Tuner for /i, ''))}`;
  }

  if (/^BMS Billet Intake for /i.test(sourceEn)) {
    t = `BMS billet-впуск для ${normalizeBurgerFitmentText(sourceEn.replace(/^BMS Billet Intake for /i, ''))}`;
  }

  if (/^BMS Cold Air Intake for /i.test(sourceEn)) {
    t = `BMS система холодного впуску для ${normalizeBurgerFitmentText(sourceEn.replace(/^BMS Cold Air Intake for /i, ''))}`;
  }

  if (/^BMS Downshift Blocker for /i.test(sourceEn)) {
    t = `BMS блокатор пониження передачі для ${normalizeBurgerFitmentText(sourceEn.replace(/^BMS Downshift Blocker for /i, ''))}`;
  }

  if (/^BMS BMW Boost Tap Adapter$/i.test(sourceEn)) {
    t = 'BMS адаптер Boost Tap для BMW';
  }

  if (/^BMS Compact Universal Oil Catch Can \(CAN ONLY\)$/i.test(sourceEn)) {
    t = 'BMS компактний універсальний масловловлювач (лише бачок)';
  }

  if (/\bDual Oil Catch Can System\b/i.test(sourceEn)) {
    t = postProcessBurgerTitle(
      String(sourceEn)
        .replace(/\bDual Oil Catch Can System\b/i, 'подвійна система масловловлювачів')
        .replace(/\bfor\b/i, 'для'),
      ''
    );
  }

  if (/^BMS Dual Oil Catch Can System for /i.test(sourceEn)) {
    t = `BMS подвійна система масловловлювачів для ${normalizeBurgerFitmentText(sourceEn.replace(/^BMS Dual Oil Catch Can System for /i, ''))}`;
  }

  if (/^BMS Compact Oil Catch Can Kit for /i.test(sourceEn)) {
    t = `BMS компактний комплект масловловлювача для ${normalizeBurgerFitmentText(sourceEn.replace(/^BMS Compact Oil Catch Can Kit for /i, ''))}`;
  }

  if (/ Wheel Spacers?$/i.test(sourceEn)) {
    t = `${normalizeBurgerFitmentText(sourceEn.replace(/\s+Wheel Spacers?$/i, ''))} колісні проставки`;
  }

  if (/^Fuel-It! Bluetooth Flex Fuel Analyzer$/i.test(sourceEn)) {
    t = 'Fuel-It! Bluetooth-аналізатор Flex Fuel';
  }

  if (/^.+ Charge Pipe Injection \(CPI\) Kit$/i.test(sourceEn)) {
    const fitment = sourceEn.replace(/\s+Charge Pipe Injection \(CPI\) Kit$/i, '');
    t = `${normalizeBurgerFitmentText(fitment)} комплект впорскування в пайп наддуву (CPI)`;
  }

  if (/^.+ Water\/Methanol Injection \(WMI\) Nozzle Adapter$/i.test(sourceEn)) {
    const fitment = sourceEn.replace(/\s+Water\/Methanol Injection \(WMI\) Nozzle Adapter$/i, '');
    t = `${normalizeBurgerFitmentText(fitment)} адаптер форсунки системи впорскування води/метанолу (WMI)`;
  }

  if (/^.+ Quick Install Tuner for .+$/i.test(sourceEn)) {
    const [product, fitment] = sourceEn.split(/\s+for\s+/i);
    t = `${normalizeBurgerFitmentText(product.replace(/\bQuick Install Tuner\b/i, 'тюнер швидкого встановлення'))} для ${normalizeBurgerFitmentText(fitment)}`;
  }

  if (/^BMS Drop-In Performance Air Filters? for /i.test(sourceEn)) {
    t = `BMS вставні повітряні фільтри для ${normalizeBurgerFitmentText(sourceEn.replace(/^BMS Drop-In Performance Air Filters? for /i, ''))}`;
  }

  if (/^BMS Performance Air Filters? for /i.test(sourceEn)) {
    t = `BMS високопродуктивні повітряні фільтри для ${normalizeBurgerFitmentText(sourceEn.replace(/^BMS Performance Air Filters? for /i, ''))}`;
  }

  if (/Bluetooth Flex Fuel Kit/i.test(sourceEn)) {
    const fitment = sourceEn
      .replace(/^Fuel-It!\s+/i, '')
      .replace(/\s*Bluetooth Flex Fuel Kit(?:s)?\s+for\s+/i, '')
      .replace(/\s*Bluetooth Flex Fuel Kit(?:s)?$/i, '')
      .replace(/^.*?Bluetooth Flex Fuel Kit(?:s)?\s+for\s+/i, '');
    if (fitment) {
      t = `${normalizeBurgerFitmentText(fitment)} Bluetooth-комплект Flex Fuel`;
    }
  }

  if (/Bluetooth Flex Fuel Analyzer/i.test(sourceEn)) {
    t = 'Fuel-It! Bluetooth-аналізатор Flex Fuel';
  }

  if (/Billet Water\/Methanol Injection \(WMI\) Spacer/i.test(sourceEn)) {
    const fitment = sourceEn.replace(/\s*Billet Water\/Methanol Injection \(WMI\) Spacer$/i, '');
    t = `${normalizeBurgerFitmentText(fitment)} billet-проставка для впорскування води/метанолу (WMI)`;
  }

  if (/^.*Fuel Pump Retrofit Extension Harness(?: by Fuel-It)?$/i.test(sourceEn)) {
    const fitment = sourceEn.replace(/\s*Fuel Pump Retrofit Extension Harness(?: by Fuel-It)?$/i, '');
    t = `${normalizeBurgerFitmentText(fitment)} подовжувальний джгут retrofit паливного насоса`;
  }

  if (/^BMS .* Stealth Water\/Methanol Injection \(WMI\) Tank for /i.test(sourceEn)) {
    const prefix = sourceEn.match(/^BMS\s+([\d.]+\s+Gallon)\s+Stealth/i)?.[1] ?? '';
    const fitment = sourceEn.replace(/^BMS\s+[\d.]+\s+Gallon\s+Stealth Water\/Methanol Injection \(WMI\) Tank for /i, '');
    t = `BMS Stealth-бак для впорскування води/метанолу (WMI) ${prefix ? `об'ємом ${prefix.replace(/\s+Gallon/i, ' галон')}` : ''} для ${normalizeBurgerFitmentText(fitment)}`.replace(/\s+/g, ' ').trim();
  }

  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/\s+,/g, ',');
  t = t.replace(/\s+\/\s+/g, ' / ');
  t = sentenceCase(t);

  return t;
}

const BURGER_FALLBACK_REPLACEMENTS = [
  [/\bPort Injection Intake Manifold and Intercooler\b/gi, 'впускний колектор портового впорскування та інтеркулер'],
  [/\bPort Injection Intake Manifold\b/gi, 'впускний колектор портового впорскування'],
  [/\bFuel Pump Upgrade Kit\b/gi, 'комплект апгрейду паливного насоса'],
  [/\bWheel Spacer Kit\b/gi, 'комплект колісних проставок'],
  [/\bWheel Spacers\b/gi, 'колісні проставки'],
  [/\bExtended Wheel Bolts\b/gi, 'подовжені колісні болти'],
  [/\bCharge Pipe Coupler\b/gi, 'муфта пайпа наддуву'],
  [/\bCharge Pipe\b/gi, 'пайп наддуву'],
  [/\bOil Catch Can\b/gi, 'масловловлювач'],
  [/\bCold Air Intake\b/gi, 'система холодного впуску'],
  [/\bPerformance Intake\b/gi, 'продуктивна система впуску'],
  [/\bDual Intakes\b/gi, 'подвійна система впуску'],
  [/\bDual Intake\b/gi, 'подвійна система впуску'],
  [/\bWater\/Methanol Injection \(WMI\) Tank\b/gi, 'бак для Water/Methanol Injection (WMI)'],
  [/\bWater\/Methanol Injection \(WMI\)\b/gi, 'Water/Methanol Injection (WMI)'],
  [/\bWater\/Methanol Injection\b/gi, 'Water/Methanol Injection'],
  [/\bFlex Fuel Kits\b/gi, 'комплекти Flex Fuel'],
  [/\bFlex Fuel Kit\b/gi, 'комплект Flex Fuel'],
  [/\bFlex Fuel Reader Kit\b/gi, 'комплект Flex Fuel Reader'],
  [/\bIntake Manifold\b/gi, 'впускний колектор'],
  [/\bIntercooler Core\b/gi, 'серцевина інтеркулера'],
  [/\bIntercooler\b/gi, 'інтеркулер'],
  [/\bIntake\b/gi, 'система впуску'],
  [/\bTuner\b/gi, 'тюнер'],
  [/\bBung Plugs\b/gi, 'заглушки під бонку'],
  [/\bThread Sealer\b/gi, 'герметик різьби'],
  [/\bCorrugated Fuel Line\b/gi, 'гофрована паливна лінія'],
  [/\bLow Profile\b/gi, 'низькопрофільний'],
  [/\bUniversal\b/gi, 'універсальний'],
  [/\bReplacement\b/gi, 'змінний'],
  [/\bKit\b/gi, 'комплект'],
  [/\bTank\b/gi, 'бак'],
  [/\bSensor\b/gi, 'сенсор'],
  [/\bBillet\b/gi, 'billet'],
];

function translateBurgerTitleFallback(titleEn) {
  let t = String(titleEn ?? '').trim();

  for (const [pattern, replacement] of BURGER_FALLBACK_REPLACEMENTS) {
    t = t.replace(pattern, replacement);
  }

  t = t.replace(/\bw\/(\d+)\b/gi, 'з $1');
  t = t.replace(/\((\d+)\s*Pack\)/gi, '($1 шт.)');
  t = t.replace(/\b(\d+)\s*Pack\b/gi, '$1 шт.');
  t = t.replace(/\bPair,\s*2 Wheels\b/gi, 'пара, 2 колеса');
  t = t.replace(/\bPair\b/gi, 'пара');
  t = t.replace(/\bwith\b/gi, 'з');
  t = t.replace(/\band\b/gi, 'та');
  t = t.replace(/\bfor\b/gi, 'для');
  t = t.replace(/\bby\b/gi, 'від');
  t = t.replace(/\bBlack\b/gi, 'чорний');
  t = t.replace(/\bFront\b/gi, 'передній');
  t = t.replace(/\bRear\b/gi, 'задній');
  t = t.replace(/\s+\/\s+/g, ' / ');
  t = t.replace(/\s+/g, ' ').trim();

  return postProcessBurgerTitle(t, titleEn);
}

async function translateBurgerBatch(batch) {
  const translated = [];
  for (const item of batch) {
    let titleUa = '';
    try {
      const url =
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=uk&dt=t&q=' +
        encodeURIComponent(item.titleEn);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Translate HTTP ${response.status}`);
      }
      const payload = await response.json();
      titleUa = Array.isArray(payload?.[0]) ? payload[0].map((part) => part?.[0] ?? '').join('') : '';
    } catch (error) {
      console.warn(`Google title translation failed for ${item.slug}, using deterministic fallback: ${error.message}`);
      titleUa = translateBurgerTitleFallback(item.titleEn);
    }

    translated.push({
      slug: item.slug,
      titleUa: postProcessBurgerTitle(titleUa, item.titleEn),
    });

    await sleep(GOOGLE_TRANSLATE_DELAY_MS);
  }

  return translated;
}

function normalizeOhlinsTitle(title) {
  let t = String(title ?? '').trim();
  const feminine = /опора/i.test(t);
  const front = feminine ? 'передня' : 'передній';
  const rear = feminine ? 'задня' : 'задній';
  const frontLeft = feminine ? 'передня ліва' : 'передній лівий';
  const frontRight = feminine ? 'передня права' : 'передній правий';
  const rearLeft = feminine ? 'задня ліва' : 'задній лівий';
  const rearRight = feminine ? 'задня права' : 'задній правий';

  t = t.replace(/\bдо-т\b/gi, 'комплект');
  t = t.replace(/\bкомплект підвіски Motorsport\b/gi, 'комплект підвіски для мотоспорту');
  t = t.replace(/\bMotorsport\b/gi, 'для мотоспорту');
  t = t.replace(/\bfront left\b/gi, frontLeft);
  t = t.replace(/\bfront right\b/gi, frontRight);
  t = t.replace(/\brear left\b/gi, rearLeft);
  t = t.replace(/\brear right\b/gi, rearRight);
  t = t.replace(/\bfront\b/gi, front);
  t = t.replace(/\brear\b/gi, rear);
  t = t.replace(/\bgravel\b/gi, 'гравій');
  t = t.replace(/\btarmac\b/gi, 'асфальт');
  t = t.replace(/\s+,/g, ',');
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/\bOhlins\b/g, 'OHLINS');
  return t;
}

function applySimpleReplacements(title, replacements) {
  let t = String(title ?? '').trim();
  for (const [pattern, replacement] of replacements) {
    t = t.replace(pattern, replacement);
  }
  return t.replace(/\s+/g, ' ').trim();
}

function hasCyrillic(value) {
  return /[а-яіїєґ]/i.test(String(value ?? ''));
}

function isBurgerSuspicious(row) {
  const value = String(row.titleUa ?? '');
  return !hasCyrillic(value) || BURGER_SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(value));
}

function isOhlinsSuspicious(row) {
  return OHLINS_SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(String(row.titleUa ?? '')));
}

async function main() {
  const rows = await prisma.shopProduct.findMany({
    where: { isPublished: true },
    orderBy: [{ brand: 'asc' }, { slug: 'asc' }],
    select: {
      id: true,
      slug: true,
      brand: true,
      titleEn: true,
      titleUa: true,
    },
  });

  const burgerTargets = rows
    .filter((row) => row.brand === 'Burger Motorsports')
    .filter(isBurgerSuspicious)
    .slice(0, LIMIT && LIMIT > 0 ? LIMIT : undefined);

  const ohlinsTargets = rows
    .filter((row) => row.brand === 'OHLINS')
    .filter(isOhlinsSuspicious)
    .map((row) => ({
      ...row,
      nextTitleUa: normalizeOhlinsTitle(row.titleUa || row.titleEn),
    }))
    .filter((row) => row.nextTitleUa && row.nextTitleUa !== row.titleUa);

  const akrapovicTargets = rows
    .filter((row) => row.brand === 'AKRAPOVIC' && /\bSound Kit\b|\bSlip-On Race Line\b|\bLink Pipe Set\b/i.test(row.titleUa || ''))
    .map((row) => ({
      ...row,
      nextTitleUa: applySimpleReplacements(row.titleUa || row.titleEn, AKRAPOVIC_REPLACEMENTS),
    }))
    .filter((row) => row.nextTitleUa !== row.titleUa);

  const urbanTargets = rows
    .filter((row) => URBAN_TITLE_OVERRIDES.has(row.slug))
    .map((row) => ({
      ...row,
      nextTitleUa: URBAN_TITLE_OVERRIDES.get(row.slug),
    }))
    .filter((row) => row.nextTitleUa !== row.titleUa);

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'commit',
        burgerTargets: burgerTargets.length,
        ohlinsTargets: ohlinsTargets.length,
        akrapovicTargets: akrapovicTargets.length,
        urbanTargets: urbanTargets.length,
        burgerSample: burgerTargets.slice(0, 8).map((row) => ({
          slug: row.slug,
          titleEn: row.titleEn,
          titleUa: row.titleUa,
        })),
        deterministicSample: [
          ...ohlinsTargets.slice(0, 4),
          ...akrapovicTargets.slice(0, 3),
          ...urbanTargets.slice(0, 3),
        ].map((row) => ({
          slug: row.slug,
          brand: row.brand,
          titleUa: row.titleUa,
          nextTitleUa: row.nextTitleUa,
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

  let burgerUpdated = 0;
  for (let i = 0; i < burgerTargets.length; i += BURGER_BATCH_SIZE) {
    const batch = burgerTargets.slice(i, i + BURGER_BATCH_SIZE);
    const translated = await translateBurgerBatch(batch);
    for (const item of translated) {
      const row = batch.find((entry) => entry.slug === item.slug);
      if (!row || !item.titleUa || item.titleUa === row.titleUa) continue;
      await prisma.shopProduct.update({
        where: { id: row.id },
        data: { titleUa: item.titleUa },
      });
      burgerUpdated += 1;
    }
  }

  let deterministicUpdated = 0;
  for (const row of [...ohlinsTargets, ...akrapovicTargets, ...urbanTargets]) {
    await prisma.shopProduct.update({
      where: { id: row.id },
      data: { titleUa: row.nextTitleUa },
    });
    deterministicUpdated += 1;
  }

  console.log(
    JSON.stringify(
      {
        burgerUpdated,
        deterministicUpdated,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
