# OneCompany: план прискорення та зменшення витрат

Дата: 7 вересня 2026. Власник інтеграції: головний агент. Виконавці: **GPT-5.6 Terra** (`gpt-5.6-terra`) та **GPT-5.6 Luna** (`gpt-5.6-luna`).

Статус: реалізацію розпочато 2026-09-07. Результати й незавершені перевірки — у docs/catalog-v2/STATUS.md. Користувач дозволив локальні коміти 2026-09-07; push, deploy та production-зміни залишаються без дозволу.

Це план виконання для поточних проблем, а не заміна [Catalog V2 MASTER_PLAN](docs/catalog-v2/MASTER_PLAN.md). Перед кожним завданням читати [AGENTS.md](AGENTS.md), [PROJECT_CONTEXT](.agents/PROJECT_CONTEXT.md), [workflow Catalog V2](.agents/workflows/catalog-v2-execution.md) та [його STATUS](docs/catalog-v2/STATUS.md). Давні позначки Done не доводять стан нинішнього production: пріоритет мають код, конфігурація та актуальні виміри.

План перевірили GPT-5.6 Luna та GPT-5.6 Terra; після дозволу користувача обидва агенти отримали окремі пакети реалізації. Root інтегрує та перевіряє їхні зміни.

## 1. Що потрібно отримати

**Уточнення користувача:** проблеми стосуються всього каталогу, не тільки контрольних BMW. Повнота моделей/кузовів/двигунів і розумний пошук — обов'язкова частина цієї роботи. [Детальний аудит і контракт пошуку](CATALOG_SEARCH_CORRECTNESS_PLAN.md) розширює T1–T3 та L1 і додає T7/L7. Тепер у плані **14 пакетів агентів**; швидкість без правильної фільтрації не проходить приймання.

Покупець відкриває каталог, вибирає BMW → M5 → G90, бачить зрозумілу реакцію та правильні товари, швидко відкриває Burger JB4 і повертається до того самого списку. Це має працювати в UA/EN, на мобільному та комп'ютері, для B2C/B2B і регіональних цін. Швидкість не повинна купуватися прихованою втратою товарів, некоректною сумісністю чи більшими витратами.

«У сотні разів» не є критерієм приймання. Вимірюємо абсолютну затримку, правильність і вартість однакового сценарію до/після.

### Відомі виміри

Окремі анонімні HTTP-запити до production 07.09.2026; це не p95, не LCP і не навантажувальний тест.

| Сценарій                | Час відповіді | Важливе спостереження                   |
| ----------------------- | ------------: | --------------------------------------- |
| BMW M5 G90              |      8 556 мс | `vehicle` 7 726 мс; MISS; 52 результати |
| BMW M3                  |      8 623 мс | `vehicle` 7 653 мс; MISS                |
| Текст `ohlins`          |        645 мс | MISS; той самий магазин                 |
| iPE G80/G82 exhaust PDP |     30 715 мс | перший байт 30 690 мс; MISS             |
| Eventuri generic PDP    |        432 мс | MISS                                    |

Поточний production reader повідомляє `catalog_v2_projection`, але використовує перехідний legacy-підбір сумісності. Повторний HIT не є доказом усунення цього вузького місця. Назви Kia/Hyundai/Genesis у результатах M5 G90 — окрема підозра щодо даних; походження кожної відповідності ще потрібно встановити.

### Що вже є локально і не потрібно робити повторно

- Кеш обчисленої legacy-сумісності на наявні 5 хвилин та single-flight для одночасних запитів.
- Перекриття незалежних читань settings/warehouse/vehicle.
- Чотири паралельні порції по 250 товарів із вікнами ID по 1 000. Це тимчасове прискорення: додає приблизно 18 невеликих ID-запитів на холодний каталог із 17 тисяч товарів. Не називати його самостійною економією DB operations.
- У Burger прибрано невикористаний `relatedProducts` і завантаження пулу бренду для нього.
- Рекомендації винесено з ISR у `/api/shop/recommendations`, клієнт запитує їх поблизу viewport.
- Рекомендаційні картки передають скорочені дані; похідна сумісність кешується.
- Додано локалізований стан підбору; інвалідації Atomic згруповано; є попередні зміни build/deployment config.

Це кандидати на інтеграцію, а не завершений production-реліз. Особливо повторно перевірити кеш та ціни нового endpoint рекомендацій.

## 2. Вимірювання і критерії приймання

Спочатку зафіксувати однаковий профіль мережі/CPU та даних. Не порівнювати localhost зі snapshot із Vercel та живою БД.

| Метрика                                               | Робоча ціль                                                 | Як приймаємо                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Видима реакція на фільтр                              | до 100 мс                                                   | стан оновлення після дії, незалежно від мережі                    |
| API фільтра, прогрітий процес, новий ключ без CDN HIT | p95 ≤ 800 мс                                                | окремо від HIT, на репрезентативному test DB                      |
| Холодний шлях фільтра                                 | ціль p95 ≤ 1 500 мс                                         | перезапуски контрольованого середовища, не довільний cache-buster |
| Фільтр у браузері                                     | p95 ≤ 1 000 мс у погодженому профілі                        | від дії до правильних нових карток                                |
| Головний вміст PDP                                    | ціль 1–2 с у погодженому профілі                            | вимір LCP і click-to-content, без очікування рекомендацій         |
| Web Vitals                                            | LCP p75 ≤ 2,5 с; INP p75 ≤ 200 мс; CLS p75 ≤ 0,1            | окремо лабораторні результати й реальні користувачі               |
| DB/CPU                                                | немає читання всього каталогу в основному search/PDP запиті | query count, returned rows, CPU, query plan, версії даних         |
| Витрати                                               | менше за однакової кількості сценаріїв                      | DB operations і Vercel usage окремо від базової абонплати         |

Цілі не дозволяють послаблювати наявні суворіші gates Catalog V2. Якщо середовище чи дані не дозволяють вимір, статус `код готовий, performance не підтверджено`.

Матриця: UA/EN; auto/moto; BMW M5 G90, BMW M3 G80, BMW X5, один мотоцикл; точний SKU, текст, порожня видача, комбінація без збігів; бренд, рік, двигун, OPF, stock, ціна, сортування, наступна сторінка; B2C/B2B; UA/Europe; EUR/USD/UAH. PDP: Burger G90 JB4, iPE G80/G82, Öhlins, generic Eventuri, Brabus, варіант без власної ціни, missing/unpublished, DB failure. Browser: вузький екран 360/390 px, tablet 768 px, desktop 1440 px; Chrome/Android і Safari/iOS, якщо доступні. Емуляція не доводить роботу на реальному iPhone.

Тестові вибірки: мінімум 30 повторів основного warm-сценарію, окремо cold; для недостатньої cold-вибірки публікувати всі значення, не надійний p95. Конкурентність 1/5/10 тільки на disposable/test environment. Масове навантаження production не запускати. Використовувати обмежену телеметрію без customer IDs, секретів або повного тексту приватних запитів.

## 3. Координація без конфліктів

- Один активний пакет на Terra і один на Luna. Ідентифікатори `T*`, `L*`, `C*` нижче — пакети цього плану; root зіставляє їх з існуючим Catalog V2 status, не створює конкуруючий трекер реалізації.
- Terra володіє DB/query/read-service/publication/build backend. Luna — UI, browser state, зображення та клієнтське завантаження.
- Спільні контракти API, props SSR, cache keys і нові залежності погоджуються через root **до** редагування споживачів. Не передавати секрети чи дані клієнтів у повідомленнях.
- `src/app/globals.css`, футер/GlobalPresence, локальні переклади, lockfiles і не пов'язані зі швидкістю зміни зберігаються. Їх ніхто не переформатовує попутно.
- Спільна робоча директорія означає спільні незакомічені файли. Не виконувати `git reset`, `clean`, stash/pop, checkout або створення worktree з припущенням, що це ізолює поточні зміни. Root обирає модель ізоляції; зараз безпечніше різні файли в наявній гілці `codex/storefront-cost-optimization`.
- Root веде ownership ledger перед кожною хвилею: task → agent → файли → стан. Перед передачею файлу попередній власник завершує редагування і надсилає handoff.
- Спільні `package.json`, Prisma schema/migrations, `next.config.*`, `vercel.json`, CI, root/localized layouts та загальні pricing helpers мають одного власника у конкретний момент; пакетні правки інтегрує root.
- Не додавати платний сервіс, нову БД, пошуковий кластер, AI-етап чи бібліотеку стану без доведеної потреби. Спочатку використати вже наявні Catalog V2 projection/policies/outbox.

## 4. Пакети Terra: сервер, сумісність, витрати

### T1 — Діагностика активного reader і точності, P0

**Залежить:** C0. **Файли:** `src/lib/shopCatalogLegacyVehicleIds.server.ts`, `shopCatalogPremiumProjection.server.ts`, `shopCatalogProjectionQuery.server.ts`; read-only schema, normalization/provenance; власні fixtures і звіт.

Простежити API → legacy bridge → canonical applications → projection clauses. Для кожного підозрілого Burger у M5 G90 показати, яка саме гілка, source/revision/variant та ознака його додає. Зняти кількість SQL, rows, CPU і stage timings. Перевірити фактичне покриття поточної версії по джерелах, не глобальне число чи давній snapshot.

**Результат:** карта запитів, golden-набір очікуваних matches/nonmatches із джерелом доказу, список missing/ambiguous policies. Не видаляти товари за їхньою назвою. **Прийнято:** кожна діагностована невідповідність відтворюється тестом; справжня сумісність/невідомість розрізнені; немає production-записів.

### T2 — Повнота й правильність наявної канонічної сумісності, P0

**Залежить:** T1. **Файли:** відповідні `shopCatalog*Normalization*`, `shopCatalog*Backfill*`, `shopCatalogProjectionSource.server.ts`, publication/persistence; `scripts/audit-catalog-v2-*`, `scripts/backfill-catalog-v2-*`; schema/migrations лише за доведеної необхідності, через root.

Виправляти правила на вході даних, зберігати сирі джерела та provenance. Вживати існуючі product/variant identities і стани `EXACT`, `ANY`, `NOT_APPLICABLE`, `UNKNOWN`. Виміри автомобіля мають збігатися в одній clause; не складати нові комбінації з різних авто. Не додавати brand-specific runtime винятки. Backfill — bounded, resumable, idempotent, dry-run за замовчуванням.

**Прийнято:** повний звіт product/variant coverage для поточних джерел; усі відмінності golden/legacy пояснені; replay не створює дублікати; неоднозначності збережені для review й не видаються як підтверджені. Disposable DB replay і rollback/cutover план. Production-backfill тільки окремим дозволеним кроком.

### T3 — Прибрати full-catalog scan з основного пошуку, P0

**Залежить:** T2 і погоджений API-контракт C1. **Файли:** `shopCatalogPremiumProjection.server.ts`, `shopCatalogProjectionQuery.server.ts`, `shopCatalogLegacyVehicleIds.server.ts`, `src/app/api/shop/stock/search/route.ts`, пов'язані facets/read services.

Перевести активний шлях на bounded SQL по вже наявних projection policies/constraints. Не переносити повний каталог у новий Redis/JSON-кеш і не збирати необмежений список ID перед пагінацією. 24 картки за замовчуванням; максимальний limit обмежений; canonical ціни лише для відібраних ID. Для глибокої пагінації використати stable cursor; сумісність із URL page та UI визначити в C1. Facets/count не повинні повертати весь набір у Node.js.

Eligibility перемикання має враховувати поточні canonical/projection versions, UA/EN, source coverage і parity fingerprint; загальний поріг «95% товарів» не доводить готовність конкретного джерела. Для cursor кожного сортування потрібні його власні sort keys та tie-breaker: `(stableRank, productId)` не можна механічно використати для ціни або brand interleave. Валідувати курсор і його прив'язку до query/sort/version; при зміні фільтрів скидати continuation.

Вивчити `EXPLAIN` на репрезентативних test data; додавати індекси лише під реальні predicates/order, без дублікатів. Перемикати reader на наявних flag/activation механізмах після coverage gates. Legacy залишити контрольованим rollback-шляхом, а не прихованим fallback на кожний важкий запит.

**Прийнято:** parity golden cases; page/count/facets узгоджені; новий ключ без CDN HIT вкладається у бюджет; основний handler не викликає `getShopFitmentCatalogProducts` і не виконує цикл по всьому каталогу. Окремий scale-proof на 100k даних; 500k лише якщо це gate існуючого плану або поточний масштаб виправдовує витрати тесту.

### T4 — Надійні PDP та рекомендації, P0

**Залежить:** C0; індексовані рекомендації завершуються після T3. **Файли:** `shopCatalogServer.ts`, `crossShopFitment.server.ts`, `crossShopRecommendationCard.ts`, `/api/shop/recommendations/route.ts`, server PDP entrypoints і `ShopProductDetailPage.tsx`. Luna володіє тільки deferred client після узгодження props.

Перевірити локальні правки Burger/iPE/RaceChip/default. Основний PDP читає один товар і settings; metadata/render не дублюють читання. Не додавати верхній `loading.tsx`, який ламає strict HTTP 404/redirect/outage. Перевірити, чи Brabus справді потребує blocking related pool, і відокремити його без втрати блоків.

Рекомендації мають bounded candidate query за канонічною сумісністю після T3. До цього позначити їхній legacy scan як тимчасовий борг. Перевірити повторні/паралельні звернення, publication freshness і приховані товари. Скорочений DTO не повинен містити B2B-полів, приватних цін чи зайвого контенту. Встановити політику базової/персональної ціни; не стверджувати, що ціна персоналізується, доки перевірка цього не довела.

**Прийнято:** cold PDP не залежить від рекомендацій; їхня помилка не блокує купівлю; cart/checkout/variant fallback незмінні; metadata та HTTP-семантика перевірені; endpoint має обмежений ввід, відповідь і коректну політику кешу.

### T5 — Кеші, актуальність, публікація, P1

**Залежить:** T3/T4; аудит можна почати раніше. **Файли:** `shopStorefrontRevalidation*.ts`, `shopPublicSettings.ts`, cache/read services, `shopCatalogPublication*`, `shopCatalogProjectionPersistence.server.ts`, відповідні mutation/outbox workers.

Скласти таблицю для HTML, RSC, search, facets, recommendations, pricing: ключ, audience, currency/country, canonical/projection version, TTL, invalidator. Простежити edit/import → transaction/revision/outbox → projection → cache → видимий товар. Shared cache не містить персоналізованих відповідей. TTL не замінює потрібну інвалідацію.

**Прийнято:** price, stock, visibility і fitment edits мають окремі freshness-tests; out-of-order event не перезаписує нову revision; ціна/stock не інвалідують весь магазин. SLA freshness визначається до cutover; checkout читає актуальну canonical ціну. Вимірюються backlog/retries/lag.

### T6 — Білди та фонові витрати, P1

**Залежить:** C0, координований доступ до config. **Файли:** `scripts/build-site.mjs`, `scripts/prebuild-shop-snapshot.ts`, `generateStaticParams` у погоджених routes; `vercel.json`, `.github/workflows/*` лише після ownership root; cron/worker paths після T5.

Розділити фіксовану плату, build compute, DB operations, function CPU/memory, ISR writes, image transforms та bandwidth. Знайти дублікати production/preview/release-note builds, повторне генерування тих самих snapshot, broad invalidation, порожні polling reads. Менша build machine не автоматично дешевша: порівнювати billed duration × актуальний тариф, included usage та wall time. Не вимикати cron recovery без аналізу backlog/freshness. Не переносити важку роботу з build на перший покупецький запит.

**Прийнято:** таблиця до/після для однакового patch/catalog і типу build; прогноз окремо від фактичної оплати; жодного послабленого build/release gate. Параметри тарифів перевіряти заново перед фінальним розрахунком. Зміни підписки чи dashboard тільки після конкретного погодження.

### T7 — Розумний пошук і єдині підказки, Terra, P0

**Залежить:** T1/T2/T3 та C1. **Файли:** `shopVehicleSearch.ts`, `shopVehicleTaxonomy.ts`, `shopCatalogSuggestion.server.ts`, погоджені search/stock-suggest/catalog-suggest adapters і відповідні tests. Спільні taxonomy файли не редагуються одночасно з L1; клієнт використовує узгоджений shared API.

Розпізнавання відомих vehicle/engine/category aliases, UA/EN і допустима нормалізація вводу; exact SKU має пріоритет. Неоднозначний engine/configuration повертає структуровані варіанти уточнення. Suggestions/result filters мають один canonical словник і bounded query, без legacy full scan або LLM на кожний query. Typo-підказки не послаблюють остаточну перевірку сумісності.

**Прийнято:** усі acceptance cases [контракту пошуку](CATALOG_SEARCH_CORRECTNESS_PLAN.md), включно з усіма джерелами/auto/moto, exact SKU, engine aliases, cross-clause negatives і missing-data states; costs/latency у погоджених межах. Поточний API не ігнорує жоден активний UI-фільтр мовчки.

## 5. Пакети Luna: взаємодія, мобільні пристрої, завантаження

### L1 — Фільтри, URL, скасування і повернення, P0

**Залежить:** C0; API залишається поточним до C1. **Файли:** `src/app/[locale]/shop/stock/page.tsx`, `shopCatalogFilterTransitions.ts`, `shopStockSearchTiming.ts`, `shopStockSearchParams.ts`, вузькі клієнтські hooks/tests.

Виділяти невеликі частини поступово, не переписувати 4 000 рядків за один пакет. Гарантувати latest-request-wins, cancellation і зрозумілий loading/error/empty стан. Зміна make скидає несумісні model/chassis; одна атомарна зміна фільтрів не породжує каскад зайвих searches. Повний cache key включає всі параметри, audience/country/currency; зміна сесії не показує кеш попереднього покупця. URL, Back/Forward, sort/page і scroll position узгоджені.

**Прийнято:** швидке BMW → Audi → BMW не показує запізнілі Audi; старі картки під час оновлення явно позначені; retry працює; натискання картки під час pending не вводить в оману; UA/EN і клавіатура. Не збільшувати debounce заради зниження DB-рахунку.

### L2 — Початкові товари в HTML, P0

**Залежить:** C1 + T3; L1 завершений, передача ownership stock page. **Файли:** `src/app/[locale]/shop/catalog/page.tsx`, `stock/page.tsx` та нові ізольовані UI components. Root/Terra надають shared server reader; Luna не створює HTTP-запит сервера до власного API.

Спочатку перевірити вже наявні `catalog/CatalogV2Server.tsx` і `catalog/CatalogV2Filters.tsx`: повторно використати придатні частини, не створювати третю реалізацію каталогу. Те, що ці файли існують, не доводить, що поточний premium route їх використовує.

Server wrapper читає нормалізований URL, передає bounded initial DTO та той самий query key у client. Перший mount не дублює цей самий search. Погодити політику B2B/country перед SSR: або request-bound персоналізація з приватним кешем, або явно public bootstrap з коректним оновленням viewer. Не допустити public cache персональної ціни, hydration mismatch чи нав'язаної валюти.

**Прийнято:** перші 24 картки є в HTML там, де це передбачено контрактом; direct filter URL відповідає першій видачі; нуль дубльованих search-запитів з однаковим ключем після hydration; failures доступні, pricing parity підтверджена.

### L3 — Переходи та deferred UI, P0

**Залежить:** T4 DTO + L1; root звільняє спільні файли. **Файли:** `src/components/shop/DeferredCrossShopFitment.tsx`, виділений card/link component, клієнтські частини brand PDP.

Перевірити click-to-content і повторне повернення. Якщо prefetch виправданий вимірами — тільки обмежений за наміром (hover/focus), без завантаження всіх товарів у viewport; врахувати touch/Save-Data. Зберегти справжні links, open-in-new-tab, keyboard, canonical URLs. Deferred recommendations: один запит при наближенні, cancellation на зміні slug, ігнорування старої відповіді, доступний fallback за відсутності IntersectionObserver, відсутність непотрібного layout shift.

**Прийнято:** на верхньому екрані запит рекомендацій не потрібен, доки блок не наблизився; optional failure не забирає cart/purchase controls; клієнт не повторює запити нескінченно. HTTP 404 та redirect належать T4, не маскуються loading shell.

### L4 — Зображення під реальний розмір, P1

**Залежить:** C0; незалежно від T1–T3. **Файли:** `ShopProductImage.tsx`, виділені product card/gallery image wrappers, `BurgerShopProductDetailLayout.tsx` після T4 handoff. Image config змінює root.

Порівняти rendered size, intrinsic size, actual transfer bytes, srcset/sizes і lazy/priority. Використовувати затверджені реальні картинки та наявні можливості source CDN. Не вмикати blanket Next optimization для всіх remote URLs: це може збільшити Vercel image transformations. Погодити allowlist, число розмірів, quality та cache policy з T6. Зберегти якість zoom; перша видима hero-картинка має пріоритет, решта — lazy, розміри зарезервовані.

**Прийнято:** порівняльний звіт bytes/quality/layout на 360/390/1440 px; картка 280 px не завантажує оригінал 2000 px без потреби; немає нових 404 або CLS; модель витрат на transforms погоджена.

### L5 — Прибрати блокування контенту і зайвий JS, P1

**Залежить:** C0; layout ownership root, не паралельно L2. **Файли:** `BrandedIntro.tsx`, погоджені imports у layouts, клієнтські допоміжні widgets; `HeroVideoWrapper.tsx` тільки якщо виміри доводять проблему.

Заставка не повинна закривати готові товари до JS або після нього; перевірити first/repeat visit, slow/no JS, reduced motion. Зняти route bundle/long tasks; deferred import AI-помічника та іншого не першочергового UI за фактичним використанням. Не видаляти функції задля штучного score. Відео вже має interaction/save-data обмеження — не оголошувати його головною причиною без трасування.

**Прийнято:** готовий контент не прихований декоративним overlay; менше JS/long tasks у виміряному маршруті; навігація, тема, модальні вікна, consent і footer не зламані. Зафіксувати compressed transfer, а не називати decoded JS мережевим трафіком.

### L6 — Browser-регресія та звіт, P1

**Залежить:** L1–L5, інтеграція Terra. **Файли:** лише погоджені browser fixtures/checklists та звіти; production checkout не тестувати.

Пройти матрицю розділу 2; перевірити loading, errors, empty states, no-JS базовий контент, клавіатуру, price changes, Back/Forward, slow network і unstable responses. Зафіксувати пристрій/viewport/network/CPU/cache state та ідентичність patch. Доступні реальні пристрої відрізняти від емуляції.

**Прийнято:** reproduction для кожної знайденої регресії, evidence для основних flows, список неперевірених платформ. Не називати Lighthouse score доказом швидкого серверного підбору.

### L7 — Підказки, уточнення та повні фільтри, Luna, P0

**Залежить:** L1, T7/C1; L2 для SSR integration. **Файли:** окремий search/suggestions UI, `CatalogV2Filters.tsx` або активний stock component згідно з root ownership.

Vehicle selection працює без обов'язкового виробника деталі. Показати розпізнані constraints, grouped suggestions та зрозуміле уточнення engine/configuration. Розрізняти error, no results, missing data і requires review. Чинні URL aliases не зникають при завантаженні options. Великі списки searchable/paginated, без мовчазної втрати значень.

**Прийнято:** UX та всі global acceptance cases [контракту пошуку](CATALOG_SEARCH_CORRECTNESS_PLAN.md); мобільний/keyboard, UA/EN, race cancellation; користувач бачить, які саме constraints застосовані. Runtime syntax/ціни/HTTP-контракти не змінюються без Terra/root.

## 6. Робота root і черговість

| Хвиля | Terra                                | Luna                                | Root / залежності                                           |
| ----- | ------------------------------------ | ----------------------------------- | ----------------------------------------------------------- |
| 0     | перевірка поточних backend правок    | перевірка поточного UI              | C0: inventory diff, baseline, ownership, test-env           |
| 1     | T1 діагностика і golden cases        | L1 filter state                     | C1: shared query/DTO/cache/pagination contract              |
| 2     | T2 canonical coverage                | L4 зображення                       | review даних, image cost/config                             |
| 3     | T3 indexed search                    | L5 intro/JS                         | SQL/scale review, release flags залишаються закритими       |
| 4     | T4 PDP/recommendations               | L2 SSR після T3/C1                  | послідовна передача shared server/UI contracts              |
| 5     | T5 freshness/cache                   | L3 navigation/deferred UI           | B2B/HTTP/visibility integration                             |
| 6     | T6 builds/workers/cost               | L6 browser regression               | C2: consolidated tests/evidence/review                      |
| 6а    | T7 smart search після canonical path | L7 після T7/C1, потім доповнення L6 | жодного релізу до global filter correctness gates           |
| 7     | підготовка deployment/data runbook   | перевірка staged candidate          | C3: reviewable release package; production ще не дозволений |

Це залежності, а не обіцянка виконати хвилю за один запуск агента. Пакет T2 із багатьма джерелами розбивати на підпакети за source ownership; не послаблювати coverage задля графіка. Root може поміняти порядок незалежних робіт після baseline, але не пропускати gates.

**C0:** зберегти inventory поточного diff та список невідомих середовищ. Перевірити можливість disposable PostgreSQL; DB-less preview достатній лише для UI. Не читати/друкувати `.env` задля звіту. Зібрати заміри обмеженими read-only методами.

**C1 — контракт перед SSR:** єдине parsed query; допустимі параметри й межі; query key і locale/country/currency/audience; response `data/meta/filters/filterStats/globalFilterStats` або backward-compatible adapter; cursor/page semantics; error/empty contract; public vs personalized pricing; versions/freshness. Root фіксує рішення, Terra реалізує сервіс, Luna споживає його.

**C2:** review поточного diff, а не лише агентського резюме; значущі unit/integration/browser тести; typecheck і lint з чесним переліком warnings. Окремо перевірити існуючий failing source-text test у `shopStockLocalCatalogContract.test.ts`: підтвердити, що це застаріле очікування, а не прихована DB-регресія; не просто видаляти assertion. Власник тестової зміни — root.

**C3:** два reviewable пакети: код/config і окремо data migrations/backfills/activation, якщо потрібні. Для кожного exact diff, очікуваний ефект, evidence, rollback і дозволені targets. Production/readout після дозволеного release: ті самі запити, cache states, помилки, freshness, operations/CPU і build usage. Низький трафік не дає надійного польового p95 — повідомляти розмір вибірки.

## 7. Перевірки, середовища та реліз

Для одного пакета запускати вузькі релевантні тести, далі `npm run typecheck` та `npm run lint`. Базова форма: `node node_modules/tsx/dist/cli.mjs --test tests/shop/unit/<relevant>.test.ts`. Не запускати всі E2E проти невідомої DB.

Наявні інструменти для перевикористання: `scripts/benchmark-catalog-v2-scale.ts`, `scripts/benchmark-catalog-v2-storefront-runtime.ts`, `scripts/benchmark-catalog-v2-storefront-browser.ts`, `scripts/measure-catalog-v2-storefront-build.ts`, `scripts/audit-catalog-v2-source-coverage.ts` та існуючі release-evidence/activation scripts. Перед виконанням читати їхні env/target/side-effect guards; назва audit або benchmark не гарантує відсутність DB-записів.

Runtime/browser release gates вимагають clean committed worktree. **Заборонено робити коміт лише щоб обійти це обмеження.** До дозволеного коміту збирати окремі exploratory результати з hash patch і позначкою «не release evidence»; не підробляти commit/deployment identity і не вимикати guards. `npm run build` генерує catalog artifacts, тому потрібний контрольований test DB і один координований запуск root, а не build від кожного агента.

Наявні gates, які не можна послаблювати під цей план: runtime TTFB p95 ≤ 300 мс і початкова відповідь ≤ 100 KiB gzip; browser LCP p75 ≤ 1 800 мс, p95 ≤ 2 500 мс, filter p95 ≤ 1 000 мс у профілях відповідних scripts. `shopCatalogReleaseActivationGuard.ts` додатково вимагає zero projection lag, щонайменше 1 000 shadow samples, нуль parity mismatches, error rate ≤ 0,1%, shadow window 24–168 годин; scale p95 ≤ 200 мс і commit-to-visible p95 ≤ 2 000 мс. Для full SSR — щонайменше 72 години shadow observation та signed rollout authorization. Це різні метрики й середовища; не підмінювати ними p95 cold API. Перед виконанням звірити актуальний код guards; наявний production mode не є дозволом обійти gates нового cutover.

Rollback: код через попередній дозволений deployment/reader flag; projection через наявний version/rebuild механізм; міграції — additive і сумісні зі старим кодом. Не видаляти canonical дані або нові колонки для rollback. Перед cutover зафіксувати freshness, warm-up бюджет і критерії відкату: помилкові prices/matches, витік персоналізації, missing published products, системні 5xx або вихід latency/cost за погоджені межі.

План не включає приховане погодження на коміт, push, production deploy, зміну Vercel/Prisma тарифу, production migration/backfill, платний сервіс чи recurring automation. Усе необхідне локально підготувати й перевірити до фінального погодження конкретної зовнішньої дії.

## 8. Готові доручення агентам

### Terra — шаблон запуску одного пакета

> Ти GPT-5.6 Terra (`gpt-5.6-terra`). Виконай тільки пакет **T_ID** з PERFORMANCE_EXECUTION_PLAN.md. Спочатку прочитай AGENTS.md, PROJECT_CONTEXT, workflow Catalog V2 і поточні MASTER_PLAN/STATUS. Репозиторій: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany`. Перевір git status і фактичну гілку; не скидай незакомічені зміни. Прочитай handoff залежностей **DEPENDENCIES**. Твої файли: **OWNED_FILES**; спільні файли поза цим переліком тільки через root. Не роби комітів, push, deploy, production DB/зовнішніх записів, env pull чи paid API calls. Не запускай повний build/test:shop без перевірки середовища й координації. Використовуй наявні projection/pricing/publication механізми, збережи UA/EN, B2B, варіанти, HTTP-семантику. Доведи acceptance criteria цього пакета тестами й вимірами; якщо бракує test DB, заверш незалежну локальну роботу та явно відокрем неперевірене. Надішли handoff за формою нижче. Не запускай інших агентів.

### Luna — шаблон запуску одного пакета

> Ти GPT-5.6 Luna (`gpt-5.6-luna`). Виконай тільки пакет **L_ID** з PERFORMANCE_EXECUTION_PLAN.md. Прочитай AGENTS.md, PROJECT_CONTEXT та відповідні workflow/контракти, перевір status. Репозиторій: `C:\Users\Admin\OneDrive\Documents\ChatGPT\One Company\OneCompany`. Отриманий API/SSR контракт: **CONTRACT**. Твої файли: **OWNED_FILES**; не редагуй Terra backend, globals.css, footer, lockfiles або shared config. Збережи поточні локальні зміни. Не роби комітів, push, deploy або production checkout. Не маскуй серверну повільність затримками/заставками; не вмикай масовий prefetch. Збережи локалі, accessibility, URL/Back behavior та pricing audience isolation. Перевір свій пакет у доступному локальному браузері та релевантними тестами; справжні мобільні пристрої й емуляцію позначай окремо. Надішли handoff. Не запускай інших агентів.

Root підставляє конкретний ID, залежності, контракт і **скінченний** список файлів. Не віддавати агенту весь документ як необмежене «зроби все».

### Єдина форма handoff

```text
Task ID / модель:
Стан: не почато | виконується | код готовий | перевірено | потрібні зовнішні дані
Поведінка до → після:
Файли змінено:
Контракти/міграції/flags змінено:
Команди перевірки та результати:
Виміри: environment, patch/commit, data version, cache state, sample count:
Ризики, неперевірене, залежності для наступного пакета:
Production/інші зовнішні дії: жодних
Файли, які можна передати іншому власнику:
```

## Локальна хвиля після checkpoint — 2026-09-07

Checkpoint `23106ffc` зберіг усі попередні зміни. T3 тепер має окремий opt-in
`SHOP_CATALOG_V2_VEHICLE_READER_MODE=projection`: broad vehicle constraints
залишаються в correlated SQL, legacy resolver не запускається. Default — `legacy`;
engine/fuel залишаються canonical-native незалежно від цього перемикача.
Це реалізація для перевірки, не завершення coverage/cutover всього каталогу.

`npm run build` перевіряє існуючий підписаний Catalog V2 release marker перед
snapshot/index/Next stages, включно з Git-triggered Vercel builds. Для нового
vehicle mode потрібен повний `ssr` із відповідним evidence; dev NODE_ENV не обходить
production-build gate. Expiry перевіряється при збірці, а не на кожному запиті:
читач не перемикається самовільно назад через 24 години. Source coverage, shadow,
актуальні revisions і репрезентативні виміри перед активацією залишаються обов'язковими.

Luna перевірила package-manager configuration: Vercel явно використовує npm,
тому наявність pnpm lockfile сама по собі не доводить додаткові витрати. Збережені
pnpm файли мають неузгоджені `allowBuilds` placeholders; до використання pnpm треба
окремо узгодити й перевірити цю конфігурацію. Зміни package manager/тарифу не виконані.

## Локальна хвиля цін і фільтрів — 2026-09-07

T3/T4: Premium використовує ціну поточного покупця в SQL-фільтрах, сортуванні,
фасетах і підрахунках; stock/price aggregate більше не залежить від поточної сторінки.
Перевірено B2C/B2B, Europe, три валюти, explicit/default-variant prices та null/zero.
Legacy fuel перевіряється в одному application/clause; type/kind/strict/multi-brand
поки спрямовуються до legacy, щоб параметри не ігнорувалися.

Ordered SQL повторно використовує один розрахунок ціни. На чотирьох DB fixtures
EXPLAIN показав зменшення читань canonical price з 8 до 4 без зміни результатів;
це не вимір продуктивності повного каталогу. Пройшли 85 unit і 4 DB integration
тести, TypeScript та ESLint із нулем помилок / 551 попередженням по репозиторію.
Деталі й залишкові gates — [STATUS.md](docs/catalog-v2/STATUS.md).

Далі: репрезентативні SQL/latency виміри, повторні price computations у фасетах,
global/filtered discovery statistics, smart text/category/scope та повне source
coverage. Чинні release gates не пройдені; production і reader flags не змінювалися.

## Наступна хвиля: результати та порядок продовження — 2026-09-07

T3: повторні розрахунки ціни між гілками фасетів прибрані. На однакових чотирьох
fixtures EXPLAIN показав 18 → 4 читання canonical price. Реальні SQL читачі також
перевірено на 1k/10k synthetic products; warm single sample 10k facets — 419.83 ms,
ordered — 401.40 ms. Це проміжний локальний результат, не production/p95 evidence.

L1/T4: список двигунів враховує вибраний рік у межах одного clause, список років
залишається повним. Root доповнив Luna patch прямим engine endpoint, HTTP 400 для
невалідного року та PostgreSQL regression для різних двигунів одного товару.
334 unit tests, 5 DB integrations і 2 scale runs пройшли; деталі у STATUS.md.

Подальша послідовність:

1. T4/T5 — виміряти повноту makes/models/chassis/engines по нормалізованих джерелах.
   Підтверджено: часткові canonical options приховують legacy-only моделі. Усунути
   через повний indexed source projection та перевірку наборів опцій, без нового
   повного сканування каталогу на кожен запит і без повернення забруднених fitments.
2. T3 — зменшити broad effective-price cost і перевірити 100k/500k, cold/warm та
   кілька повторів. Поточні 10k/0.4s не доводять виконання остаточного SLO.
3. T4 — узгодити global/filtered facet discovery та category/scope mapping;
   впроваджувати native type/kind/strict лише з еквівалентними доказами сумісності.
4. T7 — supported-Node build, Preview/device matrix, freshness/shadow і rollback;
   production activation та виміри вартості виконуються після окремого рішення.

### T4: уточнення після перевірки поточних джерел

У manifest уже 17 385 товарів. Перевірка 14 старих джерел охоплює 15 163;
ще 1 999 KW і 223 Fi EXHAUST потребують підключення до канонічної сумісності.
Обидва імпортери поки записують normalized-fitment metafield, а не canonical
policies. Перевірка тепер явно показує непідключені джерела та не проходить із ними.

Наступний крок T4 — адаптер canonical policies для KW на основі повного source
snapshot, збереження окремого джерела FI fitment/evidence, потім перевірка
публікації проєкцій та наборів опцій фактичного endpoint. Самої наявності
canonical rows або перевірки кількості товарів недостатньо.

Для 14 джерел додано offline порівняння цілих комбінацій нормалізації,
канонічних правил та результату projection builder. Воно зберігає межі
товару/варіанта, рік, двигун, паливо, OPF і стан перевірки. Дані читаються
обмеженими порціями; результати повного повторного прогону фіксуються у STATUS.md.
Також виправлено FI review-status: неповні/непідтверджені дані більше не
стають verified. Хеші повних чернеток нинішніх 223 коректних FI товарів збігаються.

## 9. Коли весь план завершено

Усі acceptance gates пакетів мають evidence; BMW M5 G90 та інші golden cases правильні; основні search/PDP запити не сканують весь каталог; B2B/regional prices, publication freshness і strict HTTP збережені; UI працює в погодженій матриці; cold/warm затримки й витрати виміряні окремо; review та rollback готові. Локальне завершення і production-підтвердження — різні статуси. Якщо production ще не дозволений, фінальний стан: **готово локально, реліз і production-виміри очікують окремого рішення**.

Додатково обов'язкові coverage та metamorphic/property checks для всіх джерел, product/variant applications і обох scopes із CATALOG_SEARCH_CORRECTNESS_PLAN.md. Не називати весь пошук готовим за результатами тільки M3/M5, і не зберігати false-positive legacy matches заради формальної parity.
