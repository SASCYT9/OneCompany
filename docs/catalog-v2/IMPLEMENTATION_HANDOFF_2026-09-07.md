# Передача реалізації: весь залишок оптимізації OneCompany

Дата: 07.09.2026. Автор: головний агент поточної задачі.
Базовий коміт коду: `7077a0c1`.
Гілка: `codex/storefront-cost-optimization`.

Цей документ — порядок продовження після переходу на простішу модель.
Він не оголошує весь план завершеним. Ідентифікатори R01–R12 нижче — кроки
передачі, а не нові статуси старих пакетів T/L: у старих нотатках T4 також
використовували для coverage, хоча в початковому плані T4 означає PDP.
Не покладатися лише на ці старі позначення.

## 1. Як почати без повторної великої діагностики

Справжній репозиторій:
`C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany`.
Каталог задачі `One Company 2` не є цим репозиторієм. У shell-командах задавати
правильний workdir; використовувати PowerShell, а не Bash-синтаксис.

1. Прочитати `AGENTS.md`, `.agents/PROJECT_CONTEXT.md`,
   `.agents/workflows/catalog-v2-execution.md`.
2. Перевірити `git status --short --branch` і останні коміти.
3. Прочитати цей документ і верхні розділи `docs/catalog-v2/STATUS.md`.
4. Для конкретної задачі відкрити її файли-власники. Не перечитувати весь
   репозиторій і всі старі аудити перед кожним маленьким виправленням.
5. Зіставити реалізацію з `PERFORMANCE_EXECUTION_PLAN.md`,
   `CATALOG_SEARCH_CORRECTNESS_PLAN.md` і `docs/catalog-v2/MASTER_PLAN.md`.
   Код і поточні конфігурації мають пріоритет над застарілими описами.

На момент передачі tracked worktree чистий; останній код закомічено.
Тимчасові PostgreSQL-контейнери хвиль 6/7 уже видалені. Порти 52887 і 58081
більше не є адресами робочої тестової бази. Не використовувати їх повторно
без створення й перевірки нового контейнера.
Локальний браузер був на `/ua/shop/catalog?make=BMW&model=M5&chassis=G90`.
Стан dev server перевірити; не запускати другий сервер на 3000.

## 2. Межі дозволу і незмінні вимоги

- Дозволено реалізацію, локальні коміти в цій гілці, disposable PostgreSQL,
  локальні міграції/fixtures і перевірки. Коміт — checkpoint, не причина
  завершувати роботу, якщо наступний дозволений крок зрозумілий.
- Push, merge у master, deploy, production backfill/migration, перемикання
  production flags і `vercel env pull` не дозволені. Підготувати конкретний
  пакет релізу; зовнішнє застосування — окремий фінальний крок.
- Не змінювати підписки, білінг, платні сервіси або налаштування dashboard.
  Не активувати доступне скидання лімітів без прямого прохання.
- Користувач раніше дозволив Luna/Terra. Для економії лімітів за замовчуванням
  одна модель виконує один пакет; додатковий агент лише для незалежного
  конкретного завдання. Не запускати кілька однакових аудитів.
- Зберегти футер, GlobalPresence, глобальні стилі, переклади та попередні
  оптимізації. Не робити попутний редизайн.
- Не редагувати generated snapshots/indexes вручну. Не підміняти production
  дані локальним fallback. Не вважати старі DB rows виправленими після deploy коду.
- Не відключати retention/ownership/activation guards, щоб тест став зеленим.
  Історію джерел не можна видаляти; disposable fixtures прибираються разом
  з точно ідентифікованим власним контейнером, не SQL DELETE історичних рядків.
- Немає обіцянки «100×», 100% production-ready або відсотка готовності за
  кількістю товарів. Реальні production швидкість і економія ще не підтверджені.

## 3. Що вже зроблено — не реалізовувати заново

| Ділянка        | Готове локально                                                                                                                        | Межа доказів                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Дані 14 джерел | Повне збереження 15 163 записів, replay, 666 469 provenance leaves; обмежене читання великих policy graphs                             | Це fixture, не поточна production БД                                                           |
| Coverage       | Порівняння цілих normalized clauses → canonical policies → справжній in-memory projection builder                                      | Не перевіряє весь шлях до public API і не покриває KW/FI                                       |
| Ilmberger      | Чотири unresolved товари зберігають moto scope; локально перевірено нові ревізії й replay                                              | Production старих політик не ремонтували                                                       |
| FI status      | Review/unknown/empty/incomplete fitment не стає VERIFIED                                                                               | Повні нинішні 223 коректні чернетки не змінилися у цій попередній правці                       |
| KW/FI evidence | Нові імпорти зберігають raw product + KW normalization або FI fitment entry; хеш включає докази; stale/conflicting replay відхиляється | Канонічні політики для цих джерел ще не публікуються                                           |
| Provenance     | Вкладені поля варіантів прив'язуються через external variant ID і occurrence конкретного поля                                          | Не через ordinal як індекс у variants                                                          |
| Запити         | SQL GROUP BY для options/year pairs; selected year звужує engine choices; чинні списки не обрізаються                                  | Неповні canonical options досі можуть сховати legacy-only options                              |
| Ціни/фасети    | Спільні правила audience/B2B/Europe; повторні price computations зменшені; stock/fuel/OPF регресії закриті локально                    | Global/filtered facets, широкі цінові запити та всі контракти ще мають gates                   |
| Native reader  | Реалізовано opt-in projection шлях і activation guard                                                                                  | `SHOP_CATALOG_V2_VEHICLE_READER_MODE` за замовчуванням legacy; не вмикати без повного evidence |
| UI/PDP         | Race guards, URL restore, loading/error states, Burger responsive images/mobile layout; lazy recommendations; shop intro bypass        | Не весь device/PDP/SSR набір прийнятий                                                         |
| Витрати        | Є аудит rebuild/cron; прибрано частину широких invalidations                                                                           | Немає виміряної економії рахунку і готового artifact reuse                                     |

Останній результат: **363 selected unit tests, 2 PostgreSQL integrations,
44 migrations, TypeScript — pass; full lint: 0 errors / 550 existing warnings**.
Останні 2 DB tests — про імпорти. Не подавати це як повний e2e suite.
Хвиля 6 окремо мала 352 unit + 3 DB tests.

Корисні коміти: `13f59354` prices/stock/fuel; `5f140cb9` facets/year;
`0e413229` coverage gate; `1a4ef094` unsupported sources;
`e268b4d1` FI review status; `114b918c` bounded coverage reads;
`2a207f69` GROUP BY + Ilmberger; `7077a0c1` KW/FI evidence/import safety.

## 4. Реальний залишок і залежності

Основна послідовність: **R01 → R02 → R03 → R04 → R05 → R06 → R11 → R12**.
R07–R10 можна виконувати незалежними частинами після узгодження спільних файлів.
R11 інтегрує всі зміни, а не лише основну послідовність.

| Крок | Результат                                                             | Пріоритет                   |
| ---- | --------------------------------------------------------------------- | --------------------------- |
| R01  | Lossless canonical persistence для KW/FI                              | P0                          |
| R02  | Версійна перебудова, публікація й coverage усіх джерел                | P0                          |
| R03  | Повні каскадні селектори без full-catalog fallback на основному шляху | P0                          |
| R04  | Єдиний швидкий query contract, ціни/stock/facets/category/scope       | P0                          |
| R05  | Розумний пошук, canonical engine aliases і bounded suggestions        | P0                          |
| R06  | UI, SSR/hydration, URL та взаємодія з повними фільтрами               | P0                          |
| R07  | Швидкі PDP, рекомендації, переходи                                    | P0                          |
| R08  | Freshness, кеші, publication та rollback semantics                    | P0 перед релізом            |
| R09  | Зображення й JS поза вже виправленим Burger                           | P1                          |
| R10  | Дешевші білди, фонові роботи, модель витрат                           | P1                          |
| R11  | Підтримуваний Node, scale, HTTP/browser/device acceptance             | P0 перед релізом            |
| R12  | Окремі code/data release packages і post-release виміри               | Після дозволу на production |

Попередня оцінка 12–24 годин була грубим орієнтиром активної роботи з
паралельними агентами, не гарантією для простішої моделі. Перерахувати після
R01: саме невизначена семантика KW може змінити обсяг. Не переводити години
у відсоток підписки. На останньому замірі було 85% використано / 15% залишку;
цей показник застаріває, його треба читати інструментом, а не копіювати.

## R01. Канонічні політики KW/FI

**Прочитати:** `src/lib/shopCatalogKwNormalization.ts`, `shopCatalogKwPolicyEvidence.ts`,
`shopCatalogFiDraft.ts`, `shopCatalogFiPolicyEvidence.ts`, обидва `*ImportWriter.server.ts`,
`shopCatalogVehicleCompatibilityPersistence.server.ts`, `shopCatalogV2Compatibility.ts`,
`shopCatalogCanonicalPolicyProjection.ts`, `shopCatalogAdminSnapshot.server.ts`,
`prisma/schema.prisma` і SQL constraints/triggers відповідних моделей.

**Відомі пастки:**

- Shared VehiclePolicyApplication вимагає make:string; KW може мати make:null,
  але відомі model/chassis/year. Shared writer також має одне generation значення
  та policy-level verification; KW має кілька значень і clause-level INFERRED.
  Простий adapter втрачає факти або створює вигадану точність.
- Не підставляти `Unknown` як марку. Не відкидати application. Не перетворювати
  кілька незалежних вимірів на довільний Cartesian product.
- ENGINE exact raw text дозволений canonical mapper лише для NEEDS_REVIEW;
  verified engine потребує реального powertrainId/code. Конфігураційний slug
  RaceChip не є автоматично кодом S58/S68.
- `compatibilityPolicyFromNormalizedFitment` будує projection policy з metafield;
  це не writer durable canonical policy. Snapshot/activation сам по собі не
  створює відсутніх canonical rows.
- FI має raw brand/model/body, але не підтверджені engine/year/fuel. Не робити
  ці відсутні виміри EXACT або ANY без окремих доказів.

**Зробити:**

1. Написати короткий contract у коді/документі для resolved, inferred,
   unresolved, multi-value applications та product/variant ownership.
2. Реалізувати writer, який зберігає цю семантику повністю. Використати наявні
   таблиці й locks, якщо вони це дозволяють. Якщо потрібна additive migration,
   спочатку довести конкретну прогалину fixtures і перевірити всі її consumers.
   Не послаблювати verified/FK checks глобально для зручності імпорту.
3. Зберігати requiredDimensions, dimensionDefaults, verification, sourceRef,
   evidenceHash, policy revision і всі значення в межах вихідної clause.
4. Політики будувати з повних source evidence: KW snapshot і correlations;
   FI — product + відповідний fitment entry. Fallback generic shard їх не містить.
5. Підключити transaction/publication ownership. Нові draft imports залишаються
   неопублікованими; активація проходить чинний mutation coordinator/outbox.

**Прийнято:** реальний PostgreSQL round-trip policy → AdminSnapshot → immutable
revision → projection без втрат; null make, multichassis, INFERRED, unresolved
engine, review FI, кілька variants, negative cross-clause cases; повторна
операція не створює дублікати. Жодного production запису.

## R02. Версійна перебудова і повне source coverage

**Файли:** `shopCatalogSourceBackfill.server.ts`, source-specific backfill/writers,
`shopCatalogMutationCoordinator.server.ts`, `shopCatalogProjectionPersistence.server.ts`,
`shopCatalogSelectorCoverageAudit.server.ts`, `shopCatalogNormalizationCoverage.ts`,
`scripts/verify-catalog-v2-all-source-backfill.ts`, `scripts/audit-catalog-v2-*`,
`scripts/collect-catalog-v2-release-evidence.ts`.

1. Додати KW/FI до lossless coverage gate з повними evidence, а не синтетичними
   даними з generic fallback. Оновити hardcoded переліки 14 джерел у gates,
   release evidence та readiness там, де вони реально визначають completeness.
2. Прив'язати Shopify external IDs до наявних canonical IDs через bindings;
   не створювати вдруге ті самі 2 222 товари й не покладатися лише на SKU.
3. Підготувати bounded resumable dry-run-first promotion для старих records:
   reviewedById, нова source revision, supersedes chain, старі політики retired,
   product/variant IDs і raw hashes збережені. Code-only deploy цього не робить.
4. Нинішній replay fast-path перевіряє незмінні докази і пропускає mapper.
   Для виправленої нормалізації потрібна нова явна ревізія, не повтор старої.
   Нові KW/FI імпортери навмисно відмовляють старому pre-envelope replay.
5. Покрити всі 17 385 поточних manifest records: 15 163 старих + 1 999 KW +
   223 FI. Якщо manifest змінився, перерахувати знаменник, а не змінювати
   expectedCount тільки для проходження тесту.
6. Перевірити не лише in-memory build: збережені UA/EN projections, current
   versions, visibility, active source heads, publication receipts/outbox lag.
7. Окремо показати verified / inferred / review / unsupported. Збережений
   review товар не означає verified match; непідтверджені факти потребують джерела.

**Прийнято:** всі джерела враховані; нуль нез'ясованих втрат/зайвих clauses;
повна commerce/localization/media/provenance parity, immutable replay та
promotion/concurrency tests. Readiness чесно блокується на справжній прогалині.

## R03. Повні й швидкі селектори

**Файли:** `src/app/api/shop/stock/fitment/route.ts`,
`src/lib/shopCanonicalFitmentOptions.server.ts`, `shopCatalogProjectionQuery.server.ts`,
`shopVehicleTaxonomy.ts`, актуальні option consumers.

Поточна помилка: `if (canonical) return ...` приймає часткову відповідь за повну.
Приклад: canonical Audi A4 + legacy-only Audi Q5 → Q5 зникає зі списку.
Існуючий fallback `getShopProductsWithFitments()` читає весь каталог;
готового повного bounded selector-only індексу наразі немає.

1. Після R02 забезпечити complete/versioned джерело options для активного
   набору товарів. Не зливати два full-catalog масиви на кожен request.
2. Довести completeness для scope/visibility/current filters, а не за умовою
   «є хоча б один canonical рядок» чи загальним порогом 95%.
3. Results, options, counts і suggestions використовують ті самі identities
   та application correlation. Brand деталі не обов'язковий для вибору авто.
4. Зберегти SQL GROUP BY і selected-year engine correlation. Обмеження
   returned size можливе лише з явним searchable continuation, не top-100 cutoff.
5. Розрізняти empty results, missing evidence, failed request і review-only.
   Застарілі/неповні projections не позначати успішною повною відповіддю.

**Прийнято:** actual endpoint знаходить усі підтверджені options; regression
A4/Q5 та кількох джерел одного авто; auto/moto, year/engine/chassis,
порожні/невідомі значення, brand optional. Query count/returned rows bounded,
основний шлях не завантажує повний каталог.

## R04. Єдиний query contract і вартість SQL

**Файли:** `shopCatalogPremiumProjection.server.ts`, `shopCatalogProjectionQuery.server.ts`,
`shopCatalogEffectivePrice.server.ts`, `shopCatalogLegacyVehicleIds.server.ts`,
`shopPricingAudience.ts`, `shopPricingContext.server.ts`, stock/search route.

1. Перевірити native projection шлях без legacy IDs resolver після R02/R03.
   Зберегти всі make/model/chassis/year/engine/fuel/OPF виміри в одній clause.
2. Завершити контракт `productType`, `productKind`, `strict`, multi-brand.
   Нині частина цих запитів навмисно йде legacy. Не прибирати цей захист до
   еквівалентної реалізації. Не ігнорувати UI-параметри мовчки.
3. Category slug не рівнозначний fine-grained product kind: `downpipe`,
   `tips`, `coilover_kit`, `intercooler` потребують versioned normalization.
   Перевірити canonical scope і всі category groups; не підставляти wildcard.
4. Визначити globalFilterStats проти filteredFilterStats; self-excluding facets,
   total/count, pagination і stock summary мають узгоджуватися.
5. Перевірити effective-price filtering/sort/facets для B2C/B2B, brand/customer
   discounts, UA/Europe, EUR/USD/UAH, zero/null і варіантів без власної ціни.
6. EXPLAIN ANALYZE для broad price queries. Попередні 10k warm single samples
   ~0.4 с не є p95 або доказом 100k/500k. Прибирати зайві full candidate price
   calculations, не замінюючи реальну ціну застарілим projection minimum.
7. Для sort-specific cursor зберегти tie-breakers/query-version identity;
   не застосовувати rank cursor до price sort. Не додавати deep OFFSET.

**Прийнято:** однакові правильні IDs/counts/facets/ціни; actual SQL без
необмеженого Node ID списку; 100k scale proof, 500k якщо вимагає чинний gate.
Індекси додавати лише за query plan; не дублювати наявні.

## R05. Розумний пошук і підказки

**Файли:** `shopVehicleSearch.ts`, `shopVehicleTaxonomy.ts`,
`shopCatalogSuggestion.server.ts`, `shopStockSuggestion.ts`,
`src/app/api/shop/{stock,catalog}/suggest/route.ts` і реальні UI consumers.

1. Простежити, який endpoint реально використовує UI. Сам факт існування
   bounded catalog/suggest не прибирає full scan stock/suggest.
2. Єдиний parser/query interpretation: exact SKU має пріоритет; vehicle,
   generation, engine/configuration і category aliases — тільки за доказами.
3. Підтримати UA/EN, пробіли, регістр, погоджені aliases; typo може дати
   підказку, але не послабити фінальну compatibility перевірку.
4. Не прирівнювати S68 до будь-якого M5. Engine family/code/configuration slug
   розрізняти; неоднозначність повертає варіанти уточнення.
5. Показувати interpreted constraints і невпізнані tokens. При zero exact
   не підмішувати ширші результати без явного пояснення/окремої секції.
6. Не додавати LLM/vector service чи платний пошук на кожне введення.

**Прийнято:** golden exact/SKU/alias/typo/ambiguous/negative cases всіх джерел,
search/suggest/selector parity, bounded DB queries і typing-session cost.
Окремо протестувати BMW M5 G90 + S68, M3 G80 + S58, Audi покоління/тип-коди,
moto і універсальні товари без вигадування відсутніх engine facts.

## R06. Клієнт, SSR і переходи фільтрів

**Файли:** `src/app/[locale]/shop/catalog/page.tsx`, stock/page.tsx,
`shopCatalogFilterTransitions.ts`, `shopStockSearchParams.ts`,
`shopStockSearchTiming.ts`, фактичні Catalog V2 filter/list компоненти.

1. Узгодити один parsed query/DTO/cache key з R04 до зміни consumers.
2. Зберегти вже готові cancellation/latest-request-wins та URL restore.
   Швидке BMW → Audi → BMW не може показати пізню Audi-відповідь.
3. Direct URL і перший HTML мають однакові 24 картки там, де це контракт SSR;
   hydration не дублює search. Public/personalized дані не змішувати.
4. Loading реагує до 100 мс, старі картки позначені як такі, що оновлюються;
   error/retry відрізняється від zero/missing/review. Не збільшувати debounce
   лише заради рахунку і не показувати фальшиву миттєву видачу.
5. Grouped suggestions: авто/двигун/товар/артикул; зрозумілі selected chips;
   коли engine невідомий, не пропонувати незрозумілий exact slug input.
6. Зберегти Back/Forward, scroll, deep links/aliases, reset/clear, locale,
   keyboard і mobile modal focus. Не вантажити весь довідник у initial JS.

**Прийнято:** UA/EN, mobile/desktop, rapid changes, slow/error/non-JSON,
no-JS основний контент, правильна початкова видача й відсутність duplicate fetch.

## R07. PDP і рекомендації

**Файли:** `shopCatalogServer.ts`, `crossShopFitment.server.ts`,
`crossShopRecommendationCard.ts`, recommendations route,
`DeferredCrossShopFitment.tsx`, strict-http PDP entries і brand layouts.

1. Виміряти cold/warm click-to-content Burger, iPE, RaceChip, Brabus, Öhlins,
   generic Eventuri. Основний PDP не чекає related-product pool.
2. Перевірити metadata/render deduplication та bounded lookup одного товару.
   Не маскувати справжні 404/redirect/outage верхнім loading.tsx або HTTP 200 shell.
3. Перевести recommendation candidates на bounded canonical query після R02;
   старий кеш повного fitment pool — тимчасовий борг, не остаточна оптимізація.
4. Зберегти lazy viewport trigger, cancellation при зміні slug, fallback без
   IntersectionObserver; optional failure не блокує покупку і не створює CLS.
5. Перевірити pricing audience/privacy у recommendation DTO/cache. Hover/focus
   prefetch лише за виміряною потребою, без запитів усіх карток наперед;
   врахувати touch/Save-Data і справжні links/open-in-new-tab.

**Прийнято:** content не чекає рекомендацій, strict HTTP contracts пройдено,
немає запиту всього бренду/каталогу, коректні ціни, limited request count.

## R08. Freshness і кеші

**Файли:** `shopStorefrontRevalidation*`, `shopPublicSettings.ts`,
`shopCatalogMutationCoordinator.server.ts`, `shopCatalogGlobalMutationCoordinator.server.ts`,
`shopCatalogPublication*`, `shopCatalogProjectionPersistence.server.ts`, outbox workers.

1. Скласти компактну таблицю для HTML/RSC/search/facets/suggestions/recommendations:
   key, audience/currency/country/locale, canonical/projection version, TTL, invalidator.
2. Перевірити edit/import → transaction/revision/outbox → projection → cache
   на price, stock, visibility, fitment, settings/discount edits окремо.
3. Нові канонічні політики KW/FI повинні потрапляти в цю саму публікацію;
   не залишити source record новим, а active policy/projection старою.
4. Out-of-order/retry/concurrent events не затирають нову версію. TTL не
   замінює необхідної інвалідації. Checkout читає актуальну canonical ціну.
5. Зберегти усунення root-layout/global invalidation. Зафіксувати backlog,
   retries, publication lag і точний спосіб відкату reader без видалення даних.

**Прийнято:** чинні freshness SLA/gates; shared cache без B2B/customer витоку;
rollback реально перевірено на цій версії, його обмеження описані.

## R09. Зображення, JS і доступність

**Файли:** `ShopProductImage.tsx`, image/gallery wrappers, brand layouts,
`BrandedIntro.tsx`, локалізовані layouts, `HeroVideoWrapper.tsx` лише за evidence.

- Перевірити інші бренди після вже виправленого Burger: rendered/intrinsic size,
  srcset/sizes, bytes, priority/lazy, zoom, reserved dimensions.
- Не вмикати Next image optimization для всіх remote URLs: перевірити source
  CDN capabilities, signed URLs, кількість transformations і модель витрат.
- Виміряти route bundle/long tasks; відкладати необов'язкові widgets за фактичним
  використанням. Intro вже bypass для shop, не повторювати цю роботу.
- Зберегти навігацію, consent/theme, modal, reduced-motion, footer/GlobalPresence.

**Прийнято:** менше transfer/long tasks на тому самому сценарії; відсутні нові
404/CLS, zoom працює, перша видима картинка не чекає зайвого JS.

## R10. Білди, фонова робота і вартість

**Прочитати:** `docs/operations/catalog-build-cost-audit-2026-09-07.md`.
**Файли:** `scripts/build-site.mjs`, `prebuild-shop-snapshot.ts`,
`generate-shop-filter-indexes.ts`, `predeploy-check.js`, `next.config.ts`,
`vercel.json`, відповідні cron/workflow scripts.

1. Актуально перевірити build path: аудит описував повну генерацію snapshots
   та indexes на кожен build. Не копіювати давні рядки без перевірки коду.
2. Реалізувати artifact reuse лише з authoritative catalog/settings/routing/
   mapper version key і hash-validated manifest; не file mtime чи Git SHA сам по собі.
3. Unchanged inputs → без повного DB read; changed inputs → regeneration;
   missing/corrupt/stale artifacts → відновлення або fail-closed build.
4. Зберегти signed activation check ДО дорогої генерації. Узгодити direct
   predeploy Next path і wrapper, не додавши другий повний build на кожен deploy.
5. `cpus:1`, tracing exclusions, branch ignoreCommand і SEO/strict HTTP controls
   не змінювати без конкретного виміру. Дешевша machine не завжди дешевша за весь build.
6. Перевірити п'ять cron schedules, порожні polling reads, outbox recovery,
   retries/warmup. Не відключати recovery й не збільшувати freshness lag наосліп.
7. Розділити базову абонплату БД/Vercel від build compute, DB operations,
   function CPU/memory, ISR writes, image transforms, bandwidth. Прайси перевірити
   перед розрахунком; не обіцяти, що оптимізація прибере фіксовані $20.

**Прийнято:** однаковий catalog/patch, unchanged та changed build, actual duration,
DB query count/peak connections, sizes; прогноз окремо від фактичної оплати.
Dashboard/підписки не змінювати без погодження конкретного результату.

## R11. Фінальна локальна перевірка

Локальний Node був **24.19.0**, package вимагає **>=20 <23**. Перевірити поточний
`package.json`, знайти підтримуваний runtime (наприклад, Node 22); не змінювати
engine range, щоб приховати цю прогалину. `.agents/PROJECT_CONTEXT.md` може
містити старішу версію Next; фактичні package/lockfile важливіші.

### Послідовність

1. Narrow meaningful tests зміненої поведінки.
2. Selected regressions, TypeScript, lint. Нові errors — blocker; 550 warnings
   історична база, не дозвіл додавати нові без пояснення.
3. Новий disposable PostgreSQL: migrate deploy, відповідні DB integrations,
   source/policy/publication tests. DB-less preview цього не замінює.
4. Clean commit перед commit-bound gates; не обходити dirty-tree/signature guard.
5. Підтримуваний Node build, bundle/HTTP/browser gates на відомих даних і flags.
6. Scale, cold/warm та конкурентність тільки на test/disposable environment.
7. Review actual diff, docs/remaining gaps, локальний commit.

### Відомі команди (з кореня справжнього репозиторію)

```powershell
git status --short --branch
node --version
npm run typecheck
npm run lint
$catalogTests = Get-ChildItem tests/shop/unit -File |
  Where-Object { $_.Name -like 'shopStock*.test.ts' -or $_.Name -like 'shopCatalog*.test.ts' -or $_.Name -eq 'shopPricingAudience.test.ts' } |
  ForEach-Object FullName
node --import tsx --test --test-concurrency=4 $catalogTests
```

DB-тестам передати лише новий явно disposable localhost URL через process env:
`DATABASE_URL`, `OPS_TEST_DATABASE_URL` з ОДНАКОВИМ значенням і
`CATALOG_EPHEMERAL_TEST=1`. Міграціям також `DIRECT_URL` на цю базу.
Не читати/підтягувати production `.env` і не копіювати секрети у звіти.

```powershell
# Тільки після перевірки disposable URL/flags:
node --import tsx --test --test-concurrency=1 tests/shop/integration/shopCatalogImportEvidence.test.ts
```

Інші вже наявні gates: `shop:catalog:v2:all-source:docker`,
`shop:catalog:v2:publication:docker`, `shop:catalog:v2:scale:docker`,
`shop:catalog:v2:storefront:build-gate`, `:runtime-gate`, `:browser-gate`,
`shop:catalog:v2:release:evidence`. Перед запуском читати відповідний script,
його аргументи та environment guard. Не запускати всі дорогі gates після
кожного маленького patch; після успішного релевантного тесту переходити далі.
`npm run build` і `test:shop` не запускати навмання.

### Матриця приймання

- UA/EN; auto/moto; без brand та з одним/кількома brands.
- BMW M5 G90, M3 G80, X5, Audi A4/Q5/A6, moto, KW/FI і кожне інше джерело.
- Model/chassis/year/engine/fuel/OPF/transmission, category/type/kind/strict;
  exact SKU, aliases, typo, ambiguous, zero, unknown, universal, review.
- Кожна verified application породжує query зі своїм product/variant;
  додавання правильного виміру його не губить. Суперечливі виміри з різних
  applications того самого товару не створюють exact match.
- B2C/B2B/brand/customer discounts; UA/Europe; EUR/USD/UAH; price/stock/visibility edits.
- 360/390/768/1440 px, клавіатура, Back/Forward, slow/error network,
  latest-request-wins, no-JS базовий HTML, missing/unpublished/outage PDP.
- Реальний Safari/iOS тільки якщо доступний; Chromium emulation не називати iPhone test.

### Бюджети результату

- Visible filter response ≤100 ms.
- Warm API new key без CDN HIT: p95 ≤800 ms; cold ціль p95 ≤1500 ms.
- Browser action → правильні картки: p95 ≤1000 ms у фіксованому профілі.
- PDP click-to-content ціль 1–2 s; LCP p75 ≤2.5 s, INP p75 ≤200 ms, CLS p75 ≤0.1.
- Не послаблювати суворіші чинні Catalog V2 bundle/publication gates.
- Мінімум 30 warm повторів; cold окремо. Для малої cold вибірки показувати
  самі значення, а не подавати ненадійний p95 як гарантію.
- Порівняння лише однакових dataset/runtime/region/network/CPU/audience/cache
  states. Local snapshot і production DB не є порівнюваними середовищами.

## R12. Реліз і виміри після нього

Підготувати два reviewable пакети:

1. Код/config: exact commit/diff, checks, expected effect, flags, rollback.
2. Дані: потрібні migrations, source revisions, bounded backfill/promotion,
   rebuild/publication, coverage/shadow evidence, порядок і контрольні counts.

Порядок звірити з guard кодом: schema migration → generated client → source
revision/policies → UA/EN projections → coverage/shadow/ready evidence → activation.
Не вигадувати підписи activation документа і не обходити його.
Якщо legacy fallback має семантичні обмеження — описати їх у rollback runbook.

Після окремого дозволу на release: повторити однакові анонімні сценарії,
cache MISS/HIT окремо, error/lag/DB operations/function CPU/build usage.
Фіксовану абонплату рахувати окремо. Low traffic обмежує field percentile
висновки; не обіцяти підвищення CTR/замовлень від самої швидкості.
До дозволу зупинитися лише на реальній зовнішній межі, з готовим пакетом.

## 5. Артефакти, які економлять повторну роботу

- `artifacts/storefront-wave7-{regressions,integration,typecheck,lint,migrations}.log`.
- `artifacts/storefront-wave7-{fi,kw}-dry-run.log` — 223/1 999, не DB imports.
- `artifacts/catalog-v2-all-source/catalog-v2-all-source-gate.json` — full run
  `114b918c`, overall FAIL через unsupported sources і тодішні mismatches.
- `selector-existing-fixture-audit.json` у тому самому каталозі — clean
  `2a207f69`, 14 sources PASS після локальних 4 Ilmberger promotions;
  overall все ще FAIL для KW/FI. Не називати його новим full backfill.
- `ilmberger-scope-fixture-promotion.json`, `selector-before-scope-promotion.json`.
- `wave6-coverage-fixture.dump` — локальний disposable fixture, не production backup;
  SHA256 `5F9CAEDE01D46F0F877C0A6E7C0581062E914A42BAD3BFEEF07CDA9940334B10`.
  Відновлювати тільки у нову disposable DB після перевірки hash.
- `docs/catalog-v2/FILTER_CONTRACT_AUDIT_2026-09-07.md` — залишкові semantic gaps.
- `docs/operations/catalog-build-cost-audit-2026-09-07.md` — аудит build/cron.

Артефакти ignored і можуть бути відсутні на іншій машині. Це не привід
позначати перевірки PASS без повторного відтворення. Старі line numbers,
commit hashes і виміри — історичні, не доказ нового patch.

## 6. Інструкція наступній моделі

> Продовжуй реалізацію в `codex/storefront-cost-optimization` зі справжнього
> репозиторію `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany`.
> Прочитай AGENTS.md і IMPLEMENTATION_HANDOFF_2026-09-07.md. Починай із R01,
> не повторюй завершені хвилі 1–7. Перед правкою звіряй owner code і поточний
> статус; працюй невеликими завершеними пакетами, перевіряй поведінку реальними
> тестами та роби локальні коміти. Коміт не завершує загальну задачу: переходь
> до наступного доступного кроку. Не губи невідому сумісність, не вигадуй exact
> matches, не додавай full-catalog read у request. Не пуш, не деплой і не
> змінюй production. Оновлюй STATUS.md після кожного завершеного пакета:
> результат, точні tests/evidence, залишок, наступний конкретний крок.
> Економ ліміт: без дубльованих аудитів і необґрунтованих повних builds.

Весь план завершений лише коли R01–R11 мають поточні докази, а R12 або
виконаний за дозволом, або готовий як конкретний пакет, що очікує дозволу.
Невідомі source facts і недоступні real-device/production виміри залишаються
явними обмеженнями, а не мовчазними PASS.
