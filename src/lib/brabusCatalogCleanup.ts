type Locale = 'ua' | 'en';

type BrabusProductLike = {
  sku?: string | null;
  slug?: string | null;
  titleEn?: string | null;
  titleUa?: string | null;
  priceEur?: number | string | null;
  priceUsd?: number | string | null;
  priceUah?: number | string | null;
  image?: string | null;
  gallery?: string[] | null;
};

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  nbsp: ' ',
  quot: '"',
  '#39': "'",
  '#x27': "'",
  '#34': '"',
  '#x22': '"',
  '#38': '&',
  '#x26': '&',
  '#160': ' ',
  '#xa0': ' ',
  '#8217': '’',
  '#x2019': '’',
};

const TITLE_GERMAN_RESIDUAL = /\b(diffusor|interieur|accessoires|spoilerlippe|schaltgetriebe|sitzen)\b/i;
const DESCRIPTION_GERMAN_RESIDUAL = /\b(diffusor|interieur|spoilerlippe|schaltgetriebe|sitzen|beratungsintensiv|lieferumfang|hinweis)\b/i;
const DESCRIPTION_ARTIFACT = /we use cookies|ми використовуємо файли cookie|brabus gmbh|privacy policy|data protection|google analytics|facebook pixel|youtube videos|inquiry item|consultant brabus|bottrop|karl-legien|46238|info@brabus|www\.brabus|brabus\.com|we create modern, individual luxury|ми створюємо сучасний, індивідуальний розкіш|currently not available for direct purchase|недоступний для безпосередньої купівлі|requires extensive consultation|вимагає детальної консультації|purchase and installation|придбання та встановлення|installation must be performed|монтаж повинен виконуватися|after internal verification|після внутрішньої перевірки/i;

const TITLE_FIXES_EN: Array<[RegExp, string]> = [
  [/\bFrontgrillInserts Carbon\b/gi, 'Carbon Front Grille Inserts'],
  [/\bRear diffusor\b/gi, 'Rear diffuser'],
  [/\bdiffusor\b/gi, 'diffuser'],
  [/\bInterieur Accessoires Package\b/gi, 'Interior Accessories Package'],
  [/\bInterieur\b/gi, 'Interior'],
  [/\bAccessoires\b/gi, 'Accessories'],
  [/\bFussbodenschoner\b/gi, 'Floor Mats'],
  [/\bSpoilerlippe\b/gi, 'Spoiler Lip'],
  [/\bSchaltgetriebe\b/gi, ''],
  [/\bArmaturenbrett\b/gi, 'Dashboard'],
  [/\bLenkradkranz\b/gi, 'Steering Wheel Rim'],
  [/\bLenkradairbag\b/gi, 'Steering Wheel Airbag'],
  [/\bUnterteil\b/gi, 'Lower Part'],
  [/\bOberteil\b/gi, 'Upper Part'],
  [/\binkl\.\s*Zentralkonsole\b/gi, 'incl. Center Console'],
  [/\bZentralkonsole\b/gi, 'Center Console'],
  [/\bExecutive Sitzen\b/gi, 'Executive Seats'],
  [/\bPedal Covers Aluminum\b/gi, 'Aluminum Pedal Covers'],
  [/\bSterlingsilber\b/gi, 'Sterling Silver'],
  [/\bSilber\b/gi, 'Silver'],
  [/\bNubuk\b/gi, 'Nubuck'],
  [/\bEinsatz\b/gi, 'Insert'],
  [/\bbeleuchtet\b/gi, 'illuminated'],
  [/\bchrom\b/gi, 'chrome'],
  [/\bLasur Zierteile Innenraum\b/gi, 'Lacquered Interior Trim Elements'],
  [/Monoblock Z "Platinum Edition$/gi, 'Monoblock Z "Platinum Edition"'],
  [/Steering Wheel Rim Leather/gi, 'Steering Wheel Rim Leather'],
  [/Dashboard (Upper|Lower) Part Leather/gi, 'Dashboard $1 Part Leather'],
  [/Dashboard Lower Part incl\. Center Console Leather/gi, 'Dashboard Lower Part incl. Center Console Leather'],
  [/Exhaust Tip Covers – Insert/gi, 'Exhaust Tip Inserts'],
  [/\bBRABUS Masterpiece Interior BRABUS based on\b/gi, 'BRABUS Masterpiece Interior based on'],
  [/\bSignature Carbon Package Interior I BRABUS based on\b/gi, 'BRABUS Signature Carbon Interior Package I based on'],
  [/\bSignature Carbon Package Interior II BRABUS based on\b/gi, 'BRABUS Signature Carbon Interior Package II based on'],
  [/\bSignature Carbon Package Interior\s*[–—-]\s*Series II BRABUS based on\b/gi, 'BRABUS Signature Carbon Interior Package Series II based on'],
  [/\bCarbon Package Interior I\b/gi, 'Carbon Interior Package I'],
  [/\bCarbon Package Interior II\b/gi, 'Carbon Interior Package II'],
  [/\bCarbon Package Interior III\b/gi, 'Carbon Interior Package III'],
  [/\bCarbon Package Interior BRABUS based on\b/gi, 'BRABUS Carbon Interior Package based on'],
  [/\bBRABUS WIDESTAR Package with Zusatzverbreiterung\b/gi, 'BRABUS WIDESTAR Package with Additional Fender Extensions'],
  [/\bEngineered Rocket 1000\b/gi, 'BRABUS Rocket 1000 Engine Conversion'],
  [/\brear skirt PUR\b/gi, 'Rear skirt in PUR'],
];

const TITLE_FIXES_UA: Array<[RegExp, string]> = [
  [/BRABUS комплект карбонових деталей та аудіосистеми/gi, 'Карбоновий пакет кузова та звуку BRABUS'],
  [/FrontgrillВставки Carbon/gi, 'Карбонові вставки решітки радіатора'],
  [/BRABUS Sound Package/gi, 'Звуковий пакет BRABUS'],
  [/BRABUS Body & Sound Package/gi, 'Пакет BRABUS «Кузов і звук»'],
  [/Пакет\s*[«"]?BRABUS CARBON BODY & SOUND[»"]?/gi, 'Карбоновий пакет кузова та звуку BRABUS'],
  [/Інтер'єр Carbon Package I/gi, "Карбоновий пакет інтер'єру I"],
  [/Інтер'єр Carbon Package II/gi, "Карбоновий пакет інтер'єру II"],
  [/Інтер'єр Carbon Package III/gi, "Карбоновий пакет інтер'єру III"],
  [/WIDESTAR Carbon Package I/gi, 'Карбоновий пакет WIDESTAR I'],
  [/WIDESTAR Carbon Package II/gi, 'Карбоновий пакет WIDESTAR II'],
  [/WIDESTAR Carbon Package III/gi, 'Карбоновий пакет WIDESTAR III'],
  [/Інтер'єр у комплектації «Signature Carbon» від BRABUS на базі/gi, "Пакет інтер'єру Signature Carbon I від BRABUS на базі"],
  [/Інтер'єр «Signature Carbon Package II» від BRABUS на базі/gi, "Пакет інтер'єру Signature Carbon II від BRABUS на базі"],
  [/Інтер'єр Carbon Package від BRABUS на базі/gi, "Карбоновий пакет інтер'єру від BRABUS на базі"],
  [/Інтер'єр у комплектації «Signature Carbon»\s*[–—-]\s*BRABUS серії II на базі/gi, "Пакет інтер'єру Signature Carbon, серія II, від BRABUS на базі"],
  [/BRABUS WIDESTAR Package з Zusatzverbreiterung/gi, 'Пакет BRABUS WIDESTAR з додатковими розширювачами кузова'],
  [/Розроблений Rocket 1000/gi, 'Конверсія двигуна BRABUS Rocket 1000'],
  [/Business Перегородка/gi, 'Бізнес-перегородка'],
  [/\bdiffusor\b/gi, 'дифузор'],
  [/\bInterieur Accessoires Package\b/gi, "Пакет аксесуарів інтер'єру"],
  [/\bInterieur\b/gi, "Інтер'єр"],
  [/\bAccessoires\b/gi, 'аксесуарів'],
  [/\bFussbodenschoner\b/gi, 'килимки'],
  [/\bSpoilerlippe\b/gi, 'спойлер-губа'],
  [/\bSchaltgetriebe\b/gi, ''],
  [/\bArmaturenbrett\b/gi, 'панель приладів'],
  [/\bLenkradkranz\b/gi, 'обід керма'],
  [/\bLenkradairbag\b/gi, 'подушка безпеки керма'],
  [/\bUnterteil\b/gi, 'нижня частина'],
  [/\bOberteil\b/gi, 'верхня частина'],
  [/\binkl\.\s*Zentralkonsole\b/gi, 'вкл. центральну консоль'],
  [/\bZentralkonsole\b/gi, 'центральна консоль'],
  [/\bExecutive Sitzen\b/gi, 'сидіння Executive'],
  [/\bНакладки на педалі Алюміній\b/gi, 'Алюмінієві накладки на педалі'],
  [/\bSterlingsilber\b/gi, 'Sterling Silver'],
  [/\bSilber\b/gi, 'Silver'],
  [/\bNubuk\b/gi, 'нубук'],
  [/\bEinsatz\b/gi, 'вставки'],
  [/\bbeleuchtet\b/gi, 'з підсвіткою'],
  [/\bchrom\b/gi, 'хром'],
  [/\bLasur Zierteile Innenraum\b/gi, "Лаковані декоративні елементи інтер'єру"],
  [/Monoblock Z "Platinum Edition$/gi, 'Monoblock Z "Platinum Edition"'],
  [/Панель приладів верхня частина Leather/gi, 'верхня частина панелі приладів зі шкіри'],
  [/Панель приладів нижня частина Leather/gi, 'нижня частина панелі приладів зі шкіри'],
  [/Панель приладів нижня частина вкл\. центральну консоль Leather/gi, 'нижня частина панелі приладів зі шкіри з центральною консоллю'],
  [/обід керма Шкіра/gi, 'обід керма зі шкіри'],
  [/Передній підлокітник Leather/gi, 'передній підлокітник зі шкіри'],
  [/Задній підлокітник Leather/gi, 'задній підлокітник зі шкіри'],
  [/Бізнес\s*[-–—]?\s*консоль з підлокітником Leather/gi, 'бізнес-консоль з підлокітником зі шкіри'],
  [/панель приладів верхня частина Шкіра/gi, 'верхня частина панелі приладів зі шкіри'],
  [/панель приладів нижня частина Шкіра/gi, 'нижня частина панелі приладів зі шкіри'],
  [/панель приладів нижня частина вкл\. центральну консоль Шкіра/gi, 'нижня частина панелі приладів зі шкіри з центральною консоллю'],
  [/Накладки на патрубки – вставки/gi, 'Накладки на патрубки'],
];

const TEXT_FIXES_EN: Array<[RegExp, string]> = [
  ...TITLE_FIXES_EN,
  [/For the consummate interior ambiance:/gi, 'For a consummate interior ambiance:'],
  [/high\s*[–—-]\s*grad glossy Signature Carbon/gi, 'high-grade glossy Signature Carbon'],
  [/hands\s*[–—-]\s*free/gi, 'hands-free'],
  [/\bHinweis:\s*/gi, 'Note: '],
  [/Dieser Artikel ist exclusively for den smart #1 und #3 BRABUS geeignet und somit nicht passend for andere smart #1 und #3 Modelle\./gi, 'This item is designed exclusively for the smart #1 and #3 BRABUS models and is not compatible with other smart #1 or #3 variants.'],
  [/Dieser Artikel ist [^.]*smart #1 und #3 BRABUS[^.]*andere smart #1 und #3 Modelle\./gi, 'This item is designed exclusively for the smart #1 and #3 BRABUS models and is not compatible with other smart #1 or #3 variants.'],
  [/BRABUS Carbon Package Sound/gi, 'BRABUS Carbon Sound Package'],
  [/Carbon Package Body & Sound/gi, 'Carbon Body & Sound Package'],
  [/BRABUS PUR\s*[–—-]?\s*R\s*[–—-]?\s*RIM Package Body & Sound/gi, 'BRABUS PUR-R-RIM Body & Sound Package'],
  [/Nur in Verbindung mit WIDESTAR available\./gi, 'Available only in combination with WIDESTAR.'],
  [/Black Vollpoliert \(black fully polished\)/gi, 'black fully polished'],
  [/\bVollpoliert\b/gi, 'fully polished'],
  [/\bNubuk\b/gi, 'Nubuck'],
  [/\bLasur Zierteile Innenraum\b/gi, 'Lacquered Interior Trim Elements'],
  [/\bLenkradkranz\b/gi, 'Steering Wheel Rim'],
  [/\bUnterteil\b/gi, 'Lower Part'],
  [/\bOberteil\b/gi, 'Upper Part'],
  [/\bEinsatz\b/gi, 'Insert'],
  [/\bbeleuchtet\b/gi, 'illuminated'],
  [/\bchrom\b/gi, 'chrome'],
  [/Bei Kauf und Einbau kann eine Testing der ausreichenden clearance der kompletten Rad\s*[-–—]?\s*\/Reifenkombination in allen Belastungs\s*[-–—]?\s*und operating conditions erforderlich sein\./gi, 'When purchasing and installing this item, the full wheel and tire combination may require clearance verification under all load and operating conditions.'],
  [/Die TÜV\s*[-–—]?\s*certified technical Arbeiten erfolgen gegen Aufpreis\./gi, 'TUV-certified technical work is available at an additional cost.'],
  [/German Beschussamt Ulm/gi, 'German testing authority Beschussamt Ulm'],
  [/\btailpipe-inserts\b/gi, 'tailpipe inserts'],
  [/\bscuff plates RGB\b/gi, 'RGB scuff plates'],
  [/\bmatt anodized\b/gi, 'matte anodized'],
];

const TEXT_FIXES_UA: Array<[RegExp, string]> = [
  ...TITLE_FIXES_UA,
  [/BRABUS Carbon Package Sound/gi, 'карбоновий пакет звуку BRABUS'],
  [/Carbon Package Body & Sound/gi, 'карбоновий пакет кузова та звуку'],
  [/BRABUS PUR\s*[–—-]?\s*R\s*[–—-]?\s*RIM Package Body & Sound/gi, 'пакет BRABUS PUR-R-RIM «Кузов і звук»'],
  [/з активно керованими заслінки/gi, 'з активно керованими клапанами'],
  [/активно керованими заслінки/gi, 'активно керованими клапанами'],
  [/аксесуари з пакету пакета пакета пакета BRABUS Interior Package/gi, 'аксесуари пакета BRABUS Interior Package'],
  [/Комплект «Completion Package: шкіряна підлога»/gi, 'Комплект дооснащення зі шкіряною підлогою'],
  [/Completion Package: шкіряна підлога/gi, 'комплект дооснащення зі шкіряною підлогою'],
  [/Комплект «Completion Package» зі шкіряним кермом та приладовою панеллю/gi, 'Комплект дооснащення зі шкіряним кермом та приладовою панеллю'],
  [/пакет BRABUS Carbon Package I/gi, "карбоновий пакет інтер'єру BRABUS I"],
  [/пакет BRABUS Carbon Package II/gi, "карбоновий пакет інтер'єру BRABUS II"],
  [/пакет BRABUS Carbon Package III/gi, "карбоновий пакет інтер'єру BRABUS III"],
  [/цей пакет BRABUS Signature Carbon/gi, 'цей пакет оздоблення BRABUS Signature Carbon'],
  [/пакет BRABUS Carbon доповнить/gi, 'карбоновий пакет BRABUS доповнить'],
  [/з високоякісного глянцевого Signature Carbon/gi, 'з високоякісного глянцевого карбону Signature Carbon'],
  [/зі сталі\s*[–—-]\s*карбону/gi, 'з нержавіючої сталі та карбону'],
  [/\bHinweis:\s*/gi, 'Примітка: '],
  [/Dieser Artikel ist exclusively for den smart #1 und #3 BRABUS geeignet und somit nicht passend для andere smart #1 und #3 Modelle\./gi, 'Цей товар призначений виключно для smart #1 та #3 BRABUS і не сумісний з іншими версіями smart #1 або #3.'],
  [/Dieser Artikel ist [^.]*smart #1 und #3 BRABUS[^.]*andere smart #1 und #3 Modelle\./gi, 'Цей товар призначений виключно для smart #1 та #3 BRABUS і не сумісний з іншими версіями smart #1 або #3.'],
  [/Nur in Verbindung mit WIDESTAR доступно\./gi, 'Доступно лише в поєднанні з WIDESTAR.'],
  [/чорний Vollpoliert \(чорний повністю полірований\)/gi, 'чорний повністю полірований'],
  [/\bVollpoliert\b/gi, 'повністю полірований'],
  [/\bNubuk\b/gi, 'нубук'],
  [/\bLasur Zierteile Innenraum\b/gi, "Лаковані декоративні елементи інтер'єру"],
  [/\bLenkradkranz\b/gi, 'обід керма'],
  [/\bUnterteil\b/gi, 'нижня частина'],
  [/\bOberteil\b/gi, 'верхня частина'],
  [/\bEinsatz\b/gi, 'вставки'],
  [/\bbeleuchtet\b/gi, 'з підсвіткою'],
  [/\bchrom\b/gi, 'хром'],
  [/Bei Kauf und Einbau kann eine перевірка der ausreichenden кліренс der kompletten Rad\s*[-–—]?\s*\/Reifenkombination in allen Belastungs\s*[-–—]?\s*und робочих умовах erforderlich sein\./gi, 'Під час купівлі та встановлення може знадобитися перевірка достатнього кліренсу повної колісно-шинної комбінації в усіх режимах навантаження та експлуатації.'],
  [/Die сертифікованих TÜV технічних Arbeiten erfolgen gegen Aufpreis\./gi, 'Сертифіковані TÜV технічні роботи виконуються за додаткову плату.'],
  [/німецьким Beschussamt Ulm/gi, 'німецьким випробувальним відомством Beschussamt Ulm'],
  [/BRABUS Fine Leather/gi, 'фірмове шкіряне оздоблення BRABUS'],
  [/шкіряному виконанні фірмове шкіряне оздоблення BRABUS/gi, 'у фірмовому шкіряному оздобленні BRABUS'],
  [/у у фірмовому шкіряному оздобленні BRABUS/gi, 'у фірмовому шкіряному оздобленні BRABUS'],
  [/\bу\s+у\b/gi, 'у'],
  [/Completion Package Leather Floor/gi, 'Completion Package: шкіряна підлога'],
  [/Armlehne vorne/gi, 'передній підлокітник'],
  [/Armlehne hinten/gi, 'задній підлокітник'],
  [/Business\s*[-–—]?\s*Konsole inkl\.\s*Armlehne/gi, 'бізнес-консоль з підлокітником'],
  [/Панель приладів верхня частина Leather/gi, 'верхня частина панелі приладів зі шкіри'],
  [/Панель приладів нижня частина Leather/gi, 'нижня частина панелі приладів зі шкіри'],
  [/Панель приладів нижня частина вкл\. центральну консоль Leather/gi, 'нижня частина панелі приладів зі шкіри з центральною консоллю'],
  [/Lenkradkranz Шкіра/gi, 'обід керма зі шкіри'],
  [/передній підлокітник Шкіра/gi, 'передній підлокітник зі шкіри'],
  [/задній підлокітник Шкіра/gi, 'задній підлокітник зі шкіри'],
  [/бізнес\s*[-–—]?\s*консоль з підлокітником Шкіра/gi, 'бізнес-консоль з підлокітником зі шкіри'],
  [/Накладки на патрубки – вставки/gi, 'Накладки на патрубки'],
  [/Накладки на патрубки – вставки чорний хром/gi, 'Накладки на патрубки чорний хром'],
  [/Підставка для ніг з підсвіткою .*Підставка для ніг з підсвіткою/gi, 'Підставка для ніг з підсвіткою'],
  [/\btailpipe-inserts\b/gi, 'вставки для вихлопних патрубків'],
  [/\bscuff plates RGB\b/gi, 'RGB накладки на пороги'],
  [/\bBRABUS Interior Package Accessories\b/gi, 'аксесуари пакета BRABUS Interior Package'],
  [/\bBRABUS Interior Package\b/gi, 'пакета BRABUS Interior Package'],
  [/індивідуальний розкіш/gi, 'індивідуальну розкіш'],
];

const REMOVABLE_DESCRIPTION_BLOCKS: RegExp[] = [
  /we create modern, individual luxury/i,
  /ми створюємо сучасний/i,
  /we use cookies/i,
  /ми використовуємо файли cookie/i,
  /brabus gmbh/i,
  /privacy policy|data protection|google analytics|facebook pixel|youtube videos/i,
  /захисту даних|політики конфіденційності/i,
  /inquiry item|consultant brabus|shopping basket as an inquiry/i,
  /товар за запитом|консультант brabus/i,
  /bottrop|karl-legien|46238|info@brabus|www\.brabus|brabus\.com|\+49\s*\(?0\)?/i,
  /currently not available for direct purchase/i,
  /недоступний для безпосередньої купівлі/i,
  /requires extensive consultation/i,
  /вимагає детальної консультації/i,
  /purchase and installation/i,
  /придбання та встановлення/i,
  /installation must be performed/i,
  /монтаж повинен виконуватися/i,
  /after internal verification/i,
  /після внутрішньої перевірки/i,
];

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function applyReplacements(input: string, replacements: Array<[RegExp, string]>) {
  let next = input;
  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function normalizeWhitespace(value: string | null | undefined) {
  return decodeBrabusHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

function normalizeDashSpacing(value: string) {
  return value.replace(/\s*[–—-]\s*/g, ' – ').replace(/\s+/g, ' ').trim();
}

function balanceQuotedText(value: string) {
  let next = value;
  const asciiQuotes = next.match(/"/g)?.length ?? 0;
  if (asciiQuotes % 2 === 1) {
    next += '"';
  }
  const uaOpenQuotes = next.match(/«/g)?.length ?? 0;
  const uaCloseQuotes = next.match(/»/g)?.length ?? 0;
  if (uaOpenQuotes > uaCloseQuotes) {
    next += '»'.repeat(uaOpenQuotes - uaCloseQuotes);
  }
  return next;
}

function normalizeText(value: string, locale: Locale) {
  const replacements = locale === 'ua' ? TEXT_FIXES_UA : TEXT_FIXES_EN;
  return normalizeDashSpacing(
    applyReplacements(value, replacements)
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

export function decodeBrabusHtmlEntities(value: string | null | undefined) {
  return String(value ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = String(entity).toLowerCase();
    return HTML_ENTITY_MAP[normalized] ?? match;
  });
}

export function stripHtmlTags(value: string | null | undefined) {
  return decodeBrabusHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildBrabusProductSlug(sku: string | null | undefined) {
  return `brabus-${String(sku ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

export function isLikelyBrabusOverviewProductLike(product: BrabusProductLike) {
  const hasPrice =
    toNumber(product.priceEur) > 0 ||
    toNumber(product.priceUsd) > 0 ||
    toNumber(product.priceUah) > 0;

  if (hasPrice) {
    return false;
  }

  const titleEn = normalizeWhitespace(product.titleEn);
  const sku = normalizeWhitespace(product.sku);

  return (
    /^tuning based on\b/i.test(titleEn) ||
    /^brabus based on\b/i.test(titleEn) ||
    /^[A-Z-]+$/.test(sku) ||
    /^[A-Z]-\d{3}$/.test(sku) ||
    /^[0-9A-Z]-[A-Z]-\d{3}$/.test(sku)
  );
}

export function scoreBrabusProductCandidateLike(product: BrabusProductLike) {
  let score = 0;
  const image = normalizeWhitespace(product.image);
  const titleEn = normalizeWhitespace(product.titleEn);
  const titleUa = normalizeWhitespace(product.titleUa);
  const galleryLength = Array.isArray(product.gallery) ? product.gallery.length : 0;

  if (image.startsWith('http')) score += 100;
  else if (image.startsWith('/brabus-images/')) score += 35;
  else if (image.startsWith('/')) score += 20;

  if (image && !/420x|540x/i.test(image)) score += 20;
  if (galleryLength) score += Math.min(galleryLength, 8);
  if (toNumber(product.priceEur) > 0 || toNumber(product.priceUsd) > 0 || toNumber(product.priceUah) > 0) score += 10;
  if (titleEn.length > 0) score += Math.min(titleEn.length, 120) / 4;
  if (titleUa.length > 0) score += Math.min(titleUa.length, 120) / 6;
  if (hasBrabusHtmlEntities(titleEn) || hasBrabusHtmlEntities(titleUa)) score -= 15;
  if (product.slug && normalizeWhitespace(product.slug) === buildBrabusProductSlug(product.sku)) {
    score += 5;
  }

  return score;
}

function shouldDropDescriptionBlock(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return true;
  return REMOVABLE_DESCRIPTION_BLOCKS.some((pattern) => pattern.test(normalized));
}

function cleanupEmptyParagraphs(value: string) {
  return value
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/(<p>\s*){2,}/gi, '<p>')
    .replace(/(<\/p>\s*){2,}/gi, '</p>')
    .trim();
}

export function cleanBrabusTitle(locale: Locale, value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';

  const replacements = locale === 'ua' ? TITLE_FIXES_UA : TITLE_FIXES_EN;
  return balanceQuotedText(normalizeDashSpacing(
    applyReplacements(normalized, replacements)
      .replace(/\s{2,}/g, ' ')
      .trim()
  ));
}

export function cleanBrabusPlainText(locale: Locale, value: string | null | undefined) {
  const normalized = normalizeWhitespace(stripHtmlTags(value));
  if (!normalized) return '';
  if (DESCRIPTION_ARTIFACT.test(normalized)) {
    const firstHit = normalized.search(DESCRIPTION_ARTIFACT);
    if (firstHit === 0) {
      return '';
    }
    return normalizeText(normalized.slice(0, firstHit), locale);
  }
  return normalizeText(normalized, locale);
}

export function cleanBrabusHtmlDescription(locale: Locale, value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  let next = decodeBrabusHtmlEntities(raw);
  const paragraphs = next.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi);

  if (paragraphs && paragraphs.length > 0) {
    next = paragraphs
      .filter((paragraph) => !shouldDropDescriptionBlock(stripHtmlTags(paragraph)))
      .map((paragraph) => normalizeText(paragraph, locale))
      .join('');
  } else {
    const plain = stripHtmlTags(next);
    if (shouldDropDescriptionBlock(plain)) {
      return '';
    }
    next = normalizeText(next, locale);
  }

  return cleanupEmptyParagraphs(next);
}

export function buildBrabusSeoDescription(locale: Locale, input: {
  longHtml?: string | null;
  shortText?: string | null;
  title?: string | null;
}) {
  const fromLong = cleanBrabusPlainText(locale, stripHtmlTags(input.longHtml));
  const fromShort = cleanBrabusPlainText(locale, input.shortText);
  const fromTitle = cleanBrabusPlainText(locale, input.title);
  const source = fromLong || fromShort || fromTitle;
  return source.slice(0, 300);
}

export function hasBrabusHtmlEntities(value: string | null | undefined) {
  return /&(?:#x?[0-9a-f]+|[a-z]+);/i.test(String(value ?? ''));
}

export function hasBrabusGermanResidualInTitle(value: string | null | undefined) {
  return TITLE_GERMAN_RESIDUAL.test(String(value ?? ''));
}

export function hasBrabusGermanResidualInDescription(value: string | null | undefined) {
  return DESCRIPTION_GERMAN_RESIDUAL.test(String(value ?? ''));
}

export function hasBrabusDescriptionArtifacts(value: string | null | undefined) {
  return DESCRIPTION_ARTIFACT.test(String(value ?? ''));
}
