# Аудит пошуку та фільтрації каталогу — 2026-10-06

Об'єкт: `https://onecompany.global/ua/shop/catalog` (UA; EN має той самий шлях виконання).
Код: `origin/master` `1ea52922` (PR #153) — версія, що обслуговувала прод під час перевірки.
Номери рядків нижче відносяться саме до цього коміту.

Метод: read-only GET-запити до продакшну (HTML, `/api/shop/stock/search`, `/suggest`,
`/fitment`), взаємодія з UI у браузері та читання коду. Не виконувались: міграції,
імпорти, записи в БД, checkout, деплой.

Зв'язок з попередніми звітами: [аудит текстового пошуку 2026-09-14](../operations/catalog-search-audit-2026-09-14.md)
перевіряв відбір власного товару за назвою/SKU, опечатки й псевдоніми; цей звіт доповнює його
швидкодією, фільтрами, даними сумісності, UX та архітектурою.
[Аудит селекторів 2026-09-23](PRODUCTION_SELECTOR_AUDIT_2026-09-23.md) — попередній зріз
опцій марка/модель/кузов.

Застереження щодо вимірювань: це діагностична вибірка з однієї робочої станції
(edge `arn1`, функції `fra1`), а не перцентилі. Час клієнта включає мережу;
`Server-Timing` — час обробки на origin. Більшість проб робилась з
`cache: "no-store"` або на унікальних URL, тому це **некешовані** запити (`x-vercel-cache: MISS`).
Повторний запит того самого URL протягом 60 с зазвичай віддає CDN за 60–90 мс — це не швидкість бекенду.

## 1. Як це працює зараз

1. `next.config.ts` (`shouldRewriteCatalogV2ToLegacy`) переписує `/:locale/shop/catalog` на
   `/:locale/shop/stock`, бо `SHOP_CATALOG_V2_SSR_UI` не ввімкнено. Затверджений UI —
   клієнтський `src/app/[locale]/shop/stock/StockCatalogClient.tsx` (4 785 рядків).
   `stock/page.tsx` рендерить його без `initialData`: SSR першої сторінки додали в
   `8e87c251` і прибрали в `f2253c3e`, бо повільний пошук гальмував TTFB.
2. Після гідрації клієнт робить запити: карусель
   (`/api/shop/stock/search?stock=inStock&carousel=1&limit=96`), марки
   (`/api/shop/stock/fitment?scope=auto`) і сторінку результатів
   (`/api/shop/stock/search?...&page=1`).
3. `searchShopStock` (`src/lib/shopStockSearch.server.ts`) за
   `SHOP_CATALOG_V2_READER_MODE=ssr` віддає запит у V2 projection
   (`queryPremiumCatalogProjection` → `shopCatalogProjectionQuery.server.ts`). Але при `productKind`,
   `productType`, `strict=1`, кількох брендах або `facetMode`
   (`shopCatalogPremiumEligibility.ts`) запит іде в **legacy-шлях**: завантаження всього
   каталогу з фітментом у пам'ять функції та фільтрація/ранжування в JS.
4. Вибір авто в результатах (premium-адаптер) іде через `resolveLegacyVehicleProductIds`:
   текстовий фітмент + `ShopVehicleApplication` + clauses projection + BMC-виняток, кеш
   у пам'яті функції 5 хв / 60 с. Опції селекторів формує інше джерело —
   `getCanonicalFitmentOptions` (лише VERIFIED clauses projection) +
   `supplementBmcSupplierFitment`.
5. Підказки: `queryShopCatalogSuggestions` (`shopCatalogSuggestion.server.ts`).
6. Кешування: пошук — `public, s-maxage=60, stale-while-revalidate=300` для анонімів і
   `private, no-store` для сесії; селектори — `public, max-age=30, s-maxage=60,
stale-while-revalidate=60`; HTML каталогу — `private, no-store`.

Розмір каталогу: 17 782 товари у вкладці «Авто» (вона не фільтрує scope), 368 у «Мото», 26 брендів.

## 2. Baseline-вимірювання

### 2.1 Завантаження сторінки

| Показник          | Значення                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| HTML              | 200, TTFB 118 мс, 175 КБ (28 КБ transfer), `private, no-store`, `MISS`, `x-matched-path: /[locale]/shop/stock` |
| Товари в HTML     | 0 посилань на товари, немає `h1`; видимий текст закінчується на «Loading catalog…» (англійською на UA)         |
| JS                | перший візит: 53 чанки, 709 КБ transfer / 2,17 МБ decoded; повторний: 31 чанк, 1,13 МБ decoded                 |
| Старт API-запитів | ~0,9 с від початку навігації (десктоп, швидка мережа)                                                          |
| Фонові запити     | 42 RSC-prefetch (~150 КБ), 3× `/api/auth/session`                                                              |

### 2.2 Пошук `/api/shop/stock/search` (некешовано)

| Запит                                            |    Клієнт, мс | Server-Timing                                               | Результат                |
| ------------------------------------------------ | ------------: | ----------------------------------------------------------- | ------------------------ |
| без фільтрів, стор. 1                            |         1 802 | products 1 306, facets 1 416, count 1 642, total 1 665      | 17 782                   |
| без фільтрів, стор. 50                           |         1 039 | total 890                                                   | —                        |
| `sort=price_asc`                                 |           722 | total 605                                                   | —                        |
| `scope=moto`                                     |           196 | total 74                                                    | 368                      |
| `brand=KW Suspensions`                           |           383 | total 257                                                   | 1 999                    |
| `q=akrapovic`                                    |           318 | total 200                                                   | 376 (спершу мото-товари) |
| `q=exhaust` / `q=вихлоп`                         | 2 114 / 2 139 | —                                                           | спершу лише Fi EXHAUST   |
| `q=BMW M3 G80`                                   |         2 534 | —                                                           | —                        |
| `q=kw suspensions`                               |         2 633 | products 816                                                | 2 131, спершу WheelForce |
| `make=BMW`                                       |         2 336 | **vehicle 1 679**, total 2 222                              | 2 439                    |
| `make=BMW&model=M3&chassis=G80`                  |         2 284 | **vehicle 2 097**, total 2 163                              | 171                      |
| `make=BMW&model=3`                               |     **7 699** | —                                                           | 30 (лише BMC)            |
| `brand=AKRAPOVIC&productKind=exhaust` (холодний) |    **35 511** | `source=local`, **catalog 31 952**, filter_rank_price 3 411 | 340                      |
| те саме, стор. 2 (теплий)                        |           368 | catalog 60, filter 122                                      | 340                      |
| `make=BMW&model=M3&strict=1`                     |         2 612 | `source=local`, context 1 332, catalog 948                  | 456                      |

### 2.3 Селектори `/api/shop/stock/fitment` (некешовано)

| Крок              |             Клієнт, мс | Відповідь                         |
| ----------------- | ---------------------: | --------------------------------- |
| марки (auto)      |                509–732 | 135 марок (2026-09-23 було 40)    |
| моделі BMW        | 737 (2 437 в UI-сесії) | 99 «моделей» (2026-09-23 було 31) |
| кузови BMW M3     |                  2 122 | 7                                 |
| деталі BMW M3     |                  2 104 | роки 2007–2013, двигунів немає    |
| деталі BMW M3 G80 |                  2 394 | `years: []`, `engines: []`        |

### 2.4 Підказки `/api/shop/stock/suggest`

Типово 150–470 мс; `eventuri m3` — 1 305 мс; `акрапович m3` в UI-сесії — 1 740 мс.

### 2.5 UI-сценарії

| Сценарій                | Що відбувається                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Введення `акрапович m3` | suggest 1 740 мс + search 2 484 мс → 32 товари                                                                                             |
| Вибір BMW у пікері      | fitment 2 437 мс + search 3 101 мс; поки чекаємо, старі картки (Ferrari 296 GTB, Lamborghini Urus) мають бейдж «Підібрано для вашого авто» |
| Перший символ у пошуку  | поле пошуку top 609 → 20 px (під фіксованою шапкою), scrollY 0 → 114, висота документа −418 px (зникає hero)                               |

## 3. Знахідки

### A. Швидкодія

- **A1. Немає SSR.** Каталог відмальовується лише після JS, гідрації та API-запиту. Для пошукових
  систем без виконання JS сторінка порожня, внутрішніх посилань на товари в HTML немає.
- **A2. Важкі запити до projection на кожен запит.** Дефолтна видача рахує `brand_interleave`
  (`row_number() OVER (PARTITION BY canonical brand …)`) і ефективну ціну корельованими
  підзапитами до `ShopProduct`/`ShopProductVariant` для всіх 17 782 рядків; `count` додатково рахує
  мін./макс. ефективну ціну для всіх рядків. Ранжування тексту обчислює `to_tsvector` на льоту.
- **A3. Каскад авто.** Кожен крок селектора — 0,5–2,4 с важкого SQL (`getBoundedPublishedFitmentOptions`:
  joins + EXISTS по `lower(textValue)`), а пошук із вибраним авто додає 1,6–2,1 с
  `resolveLegacyVehicleProductIds` на холодному інстансі.
- **A4. Legacy-шлях.** Холодний запит із `productKind` — 35,4 с (завантаження каталогу 32 с), і ця
  відповідь потім кешується на CDN. На цей шлях ведуть, зокрема, посилання ONE AI
  (`productKind`/`strict`, перехід через `window.location.assign`).
- **A5. Короткий кеш.** `s-maxage=60` для пошуку та селекторів → більшість реальних запитів — MISS.
  Залогінені користувачі завжди йдуть повз кеш.
- **A6. Дрібне.** 3× `/api/auth/session`, 42 RSC-prefetch, карусель тягне 96 товарів.

### B. Релевантність

- **B1. Баг підказок на кирилиці.** `compactShopCode()` прибирає все, крім `[a-z0-9]`, тож для
  `гальм`, `колодки`, `пружини`, `гольф`, `щось`, `шумоізоляція` SKU стає `""`. Умова
  `lower(coalesce(projection."normalizedSku", '')) = ''` (`shopCatalogSuggestion.server.ts:251`,
  ORDER BY — `:289`) збігається з кожним товаром без SKU, і всі ці запити повертають однакові
  6 підказок (iPE Porsche 911 + STOPFLEX).
- **B2. Ваги ранжування.** У `projectionSearchRelevanceSql` внесок
  `ts_rank_cd(...) * 1000` (до ~1000) перекриває збіг токена в назві (60) і в бренді (35).
  Через «kW» у текстах фітменту запит `KW` / `kw suspensions` ставить диски WheelForce вище
  за 1 999 товарів KW; `exhaust` / `вихлоп` — спершу лише Fi EXHAUST.
- **B3. Українська лексика.** `гальма` → 0, `гольф` → 0, `интейк` → 0. `тормоз` знаходить
  товари лише тому, що частина назв GiroDisc російською («Тормозные колодки»).
  Немає морфології: `диски` не знаходить `дисків`.
- **B4. «Авто» — не розділ.** `shopCatalogPremiumProjection.server.ts:172` передає `scope=null`
  для auto, тож на вкладці «Авто» за запитом `akrapovic` першими йдуть BMW M 1000 RR / S 1000 XR.
- **B5. Авто в підказках** беруться лише з constraint-рядків топ-6 товарів: `бмв` → «BMW (4)»,
  а для `бмв м3` підказки «BMW M3» немає.

### C. Фільтри та дані

- **C1. Категорія лише у ~20 % каталогу.** Фасет «Група товарів» бере `ShopCategory`-зв'язок
  (`buildShopCatalogProjectionSourceFromAdminRecord`), а не таксономію `shopStockTaxonomy.ts`,
  якою користувався legacy-шлях.

  | Бренд     | Товарів | З категорією |
  | --------- | ------: | -----------: |
  | RaceChip  |   5 181 |            0 |
  | Remus     |   3 849 |            0 |
  | Brabus    |     977 |            0 |
  | GiroDisc  |     958 |            0 |
  | BMC       |     761 |          761 |
  | AKRAPOVIC |     369 |            0 |

  Разом із категорією 3 654 з 17 782 товарів. «Вихлопні системи (217)» приховують 3 849 вихлопів
  Remus і ~340 Akrapovič. Назви брендів показуються як категорії
  («Ilmberger Carbon», «Аксесуари WheelForce»).

- **C2. Роздроблена таксономія моделей.** BMW має 99 «моделей», серед яких коди кузовів
  (`G80`, `G87`), склейки (`G80 G81 M3 G82 G83 M4`, `X5M X6M F95 F96 LCI`), дублікати
  (`3` / `3 Series` / `3 [american Market]`) і назва товару
  (`2025 Bmw G99 M5 Wagon Revozport Dry Carbon Spoiler`). Видача:

  | Модель BMW         |       Товарів |
  | ------------------ | ------------: |
  | `M3`               |           456 |
  | `M3` + кузов `G80` |           171 |
  | `G80 M3`           |             4 |
  | `G80`              |             2 |
  | `3 Series`         | 382 (без BMC) |
  | `3`                | 30 (лише BMC) |

- **C3. Низький recall за авто.** Porsche → 911 → 992 через селектори — 10 товарів; текстовий запит
  `992` — 125 (GiroDisc 39, Akrapovič 15, KW 13, ADRO 12, DO88 11 …). Товари без структурованого
  фітменту під фільтр авто не потрапляють.
- **C4. Роки/двигуни.** Для BMW M3 G80 списки років і двигунів порожні; для M3 без кузова — лише 2007–2013.
- **C5. Різні джерела.** Опції селекторів (verified clauses + BMC) і видача (legacy fitment IDs)
  формуються різними механізмами, тож опція може не відповідати результатам.
- **C6. Пікер марок** — 135 марок (Barkas, Aro, Autobianchi з даних BMC) без лічильників товарів.

### D. UX

- **D1. Хибний бейдж сумісності.** `FitmentExplanation` бере поточні `make/model/chassis`, а не
  ті, з якими завантажено `items`; під час завантаження старі картки стверджують сумісність.
  Товари з V2 не мають `fitments`, тож бейдж «Підібрано» стоїть без доказу для конкретного товару.
- **D2. Стрибок layout.** Перший символ ховає hero (`showWarehouseHero=false`) — поле пошуку
  опиняється під шапкою, список підказок частково перекрито.
- **D3. Історія та навігація.** Фільтри пишуться через `history.replaceState` — Back не скасовує
  фільтр; клік по підказці-товару — `window.location.assign` (повне перезавантаження).
- **D4.** Кнопка «Застосувати» дублює автозастосування; під час завантаження видно старі лічильники.

### E. Архітектура

- **E1. Дублювання.** Два движки (legacy in-memory і projection), два резолвери авто + BMC-патч,
  два UI (`StockCatalogClient` і вимкнений `CatalogV2Server`), дві реалізації підказок.
  ~12 тис. рядків у ланцюжку пошуку, ~190 брендових винятків (BMC, Eventuri, WheelForce,
  KW RS5 B9→B8, Urban, AMG G63 …).
- **E2. Обчислення не на тому етапі.** Ефективна ціна, brand interleave, ID товарів для авто,
  агрегація селекторів і BMC-доповнення рахуються на кожен запит, хоча можуть рахуватися під час публікації.
- **E3. Ризик (перевірити на тестовому B2B-акаунті).** Ціни у відповіді пошуку залежать від сесії,
  а ключ кешу CDN — лише URL, `Vary` не виставлено. Публічна відповідь з роздрібними цінами
  потенційно може дістатися залогіненому B2B-клієнту.

## 4. Що працює добре

- Debounce (220–250 мс), AbortController, клієнтський кеш відповідей (45 с / 120 с).
- Транслітерація, псевдоніми й опечатки брендів/марок: `акрапович`, `akrapovik`, `бмв`.
- Точний SKU: `S-BM/T/38` і `sbmt38` → один правильний товар.
- Диз'юнктивні фасети бренду/категорії; передраховані BRAND/MAKE-лічильники
  (`ShopCatalogProjectionFacetCount`) з delta-механізмом при публікації.
- Наявні shadow/parity-інструменти та широка база unit-тестів.

## 5. Дорожня карта

| PR   | Зміст                                                                                                                   | Побічні ефекти                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| PR-0 | Цей звіт                                                                                                                | немає                            |
| PR-1 | Швидкі виправлення: B1, D1, D2, кеш селекторів, вкладка «Авто» без мото, ваги ранжування, UA-синоніми                   | немає (без схеми і даних)        |
| PR-2 | `categoryGroupKey` з таксономії для 100 % товарів, фасет групи                                                          | rebuild projection (за дозволом) |
| PR-3 | Канонізація MODEL/CHASSIS при записі, виправлення імпортерів BMC/Revozport, звіт аномалій                               | rebuild projection (за дозволом) |
| PR-4 | Одне джерело сумісності при публікації: VERIFIED + INFERRED clauses; прибрати legacy-резолвер і BMC-патч з request path | rebuild projection (за дозволом) |
| PR-5 | `productKind`/`productType`/`strict`/мультибренд на projection; legacy full-scan лише для local snapshot                | немає                            |
| PR-6 | `tsvector` + індекси, ціни/`browseRank` з колонок projection, селектори з лічильниками, кеш за аудиторією               | міграція (за дозволом)           |
| PR-7 | SSR першої сторінки (streaming), `pushState`, лічильники в пікерах, згруповані підказки                                 | немає                            |
| PR-8 | Golden-запити, метаморфні тести авто, звіт покриття, бюджет латентності                                                 | немає                            |

Цілі після PR-6: пошук p95 ≤ 300 мс без кешу, дефолтна видача ≤ 150 мс, селектори ≤ 100 мс,
жоден прод-запит не вантажить каталог у пам'ять.

## 6. Як повторити вимірювання

У консолі браузера на `https://onecompany.global/ua/shop/catalog` (лише GET):

```js
async function probe(path, params) {
  const t0 = performance.now();
  const r = await fetch(`${path}?${new URLSearchParams(params)}`, { cache: "no-store" });
  const j = await r.json();
  return {
    params: JSON.stringify(params),
    ms: Math.round(performance.now() - t0),
    cache: r.headers.get("x-vercel-cache"),
    timing: r.headers.get("server-timing"),
    total: j.meta?.totalItems,
    top: (j.data ?? []).slice(0, 3).map((i) => i.brand ?? i.label),
  };
}
const base = { currency: "UAH", locale: "ua", country: "Ukraine", scope: "auto", page: "1" };
await probe("/api/shop/stock/search", base);
await probe("/api/shop/stock/search", { ...base, q: "KW" });
await probe("/api/shop/stock/search", { ...base, make: "BMW", model: "M3", chassis: "G80" });
await probe("/api/shop/stock/suggest", { q: "гальм", locale: "ua", v: "4", scope: "auto" });
await probe("/api/shop/stock/fitment", { scope: "auto", make: "BMW", model: "M3" });
```

Для порівняння «до/після» запускати на однаковому deployment, на унікальних (некешованих) URL,
і окремо фіксувати час клієнта та `Server-Timing`.
