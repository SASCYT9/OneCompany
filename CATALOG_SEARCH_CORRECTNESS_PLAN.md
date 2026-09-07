# Повнота фільтрів і розумний пошук для всього каталогу

Це початковий аудит і продуктовий контракт. Частину описаних нижче дефектів
уже виправлено локально; line numbers і фінальний старий статус історичні.
Актуальний залишок: [IMPLEMENTATION_HANDOFF_2026-09-07.md](docs/catalog-v2/IMPLEMENTATION_HANDOFF_2026-09-07.md)
і [STATUS.md](docs/catalog-v2/STATUS.md). Глобальні критерії правильності лишаються чинними.

Доповнення до [плану прискорення](PERFORMANCE_EXECUTION_PLAN.md), 07.09.2026. Це обов'язкова частина T1–T3, T7, L1/L7 і фінального приймання, а не набір виправлень тільки для BMW. Root/Astra інтегрує; GPT-5.6 Terra відповідає за дані й пошук; GPT-5.6 Luna — за фільтри, підказки та відображення станів.

## 1. Уточнення мети

Перевірити всі джерела товарів, автомобільні марки, моделі, покоління/кузови та мототехніку, що представлені в каталозі. BMW M5 G90 — відтворений приклад системної проблеми. Не оголошувати весь каталог виправленим після кількох успішних BMW-запитів.

Повнота означає відсутність прихованих підтверджених даних і загублених товарів у нашому каталозі. Вона не означає, що ми вже маємо повний світовий довідник усіх автомобілів. Відсутні факти потрібно доповнювати за перевіреним джерелом, а не вигадувати двигун із назви моделі.

## 2. Що вже підтверджено

### Живі анонімні HTTP-відповіді

| Перевірка                        | Результат 07.09.2026                                                                                                                   | Що це доводить                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| BMW M5 G90, звичайний пошук      | 52 товари в попередньому замірі                                                                                                        | товари для вибраного авто видаються                                                                                   |
| BMW M5 G90, selector `details=1` | `years: []`, `engines: []`                                                                                                             | UI не отримує років/двигунів для цього авто                                                                           |
| BMW M5 G90 + `engine=S68`        | 0 товарів, 8 900 мс                                                                                                                    | додавання коду двигуна обнуляє цю видачу; це ще не доводить сумісність усіх попередніх 52 товарів із S68              |
| BMW M3 G80, `details=1`          | двигуни: `m3-2993ccm-480hp-353kw-550nm`, `m3-competition-2993ccm-510hp-375kw-650nm`, `m3-competition-xdrive-2993ccm-510hp-375kw-650nm` | поле ENGINE містить конфігураційні позначення, а не лише звичний покупцю код двигуна                                  |
| BMW S 1000 RR, moto `details=1`  | `years: []`, `engines: []`                                                                                                             | порожні детальні селектори трапляються також у moto; необхідність engine для цього сценарію треба визначити за даними |
| Audi A6, chassis                 | `4G`, `C6`, `C7`, `C8`, `C9`, `F2`                                                                                                     | змішані види позначень потребують перевірки зв'язків/відображення; це не доказ, що кожне з них неправильне            |

Public raw evidence: `artifacts/fitment-selectors-audit-2026-09-07.json` та `artifacts/fitment-engine-audit-2026-09-07.json` у локальній робочій копії. Файли exploratory, не release evidence. Дані можуть змінюватися; перед прийманням повторити на відомій версії каталогу.

### Підтверджені властивості коду

1. **Результати та селектори використовують різні механізми.** `shopCatalogPremiumProjection.server.ts:198` проходить через legacy IDs, потім прибирає make/model/generation/year з native query (`:211`). Engine/fuel залишаються projection-фільтрами (`:155`). Це ризик втрати кореляції автомобіля з його двигуном: до наступного запиту доходить ID товару, а не обов'язково та сама vehicle clause. Фактичні false positives/negatives потрібно довести fixtures і source evidence.
2. **Неповний canonical selector маскує решту даних.** `api/shop/stock/fitment/route.ts:218` повертає canonical-відповідь одразу. Для models fallback застосовується тільки коли нема жодного рядка (`:103`), а chassis/details можуть повертати порожній object response. Непорожній частковий список не доводить повного coverage. Legacy details, зі свого боку, завжди повертає `engines: []` (`:261`).
3. **Двигун — exact comparison, UI пропонує довільний текст.** `shopCatalogProjectionQuery.server.ts`, `correlatedTextConstraintSql`, для ENGINE використовує нечутливу до регістру рівність. Stock UI при відсутності options показує placeholder «S58, 3.0 TFSI…» (`stock/page.tsx:2182`). Звичний код, назва сімейства і збережений конфігураційний slug не є однаковими рядками. Це потребує canonical powertrain/alias resolution, не простого fuzzy порівняння сумісності.
4. **V2 facets залежать від product brand.** `shopCatalogProjectionQuery.server.ts:615` генерує model facet тільки при `brand && make`, а generation/year/engine/fuel — при `brand && make && model`. Це властивість цього V2 query service; не слід плутати її з окремим активним stock selector endpoint. Вимога користувача — підбір автомобіля по всьому каталогу, без обов'язкового вибору виробника деталі.
5. **Частина UI-параметрів не має однакового контракту з premium reader.** Stock надсилає `opfGpf`, `productKind`, `strict`, `productType` та кілька brands. Поточний premium adapter використовує `firstBrand` (`:53`, `:149`) і явно читає engine/fuel, але не ці додаткові параметри. Потрібна повна таблиця параметрів; не залишати активний control, який сервер мовчки ігнорує.
6. **URL aliases/case можуть втрачатися.** `stock/page.tsx:1397` і `:1434` відновлює початкові model/chassis через `Array.includes` після canonicalized options. Назва з іншими пробілами/регістром/alias може не відновитись. AbortController у каскадних запитах уже є; не описувати це як повну відсутність cancellation. Окремо перевірити responses, що вже встигли завершитись, parent identity та обробку помилок.
7. **Є два suggestions endpoint.** `/api/shop/stock/suggest` читає весь fitment-каталог (`route.ts:34`), тоді як `/api/shop/catalog/suggest` використовує bounded V2 service. Самого існування швидшого endpoint недостатньо — простежити, який споживає поточний UI. `ShopCatalogSuggestion` vehicle variant зараз має make/model, без generation/engine/year.
8. **Таксономія має статичні винятки.** `shopVehicleTaxonomy.ts:371` фільтрує BMW chassis за локальним allowlist. Це захищає від частини сміття, але повноту нових/рідкісних значень необхідно перевірити. Не прибирати захист без canonical replacement і не додавати нескінченні маркові винятки в runtime.
9. **Роки, engines і fuel не повністю каскадні.** Stock details endpoint читає тільки make/model/chassis, не selected year/engine/fuel; UI має статичні fuel options. Через це доступний engine option не обов'язково означає сумісність із уже вибраним роком. Канонічні downstream options мають ураховувати вибраний prefix та релевантні інші dimensions.
10. **Scope відрізняється між шляхами.** Selector вимагає `SCOPE=EXACT`, тоді як premium adapter перетворює auto scope на `null`. Потрібно перевірити, які товари з пропущеним scope зникають із selectors і чи може auto search включати moto. Не виправляти це загальним wildcard без нормалізації.
11. **Legacy rollback теж має неповну семантику.** У старому `stock/search/route.ts` fuel передається shadow query, але не основному legacy fitment predicate; legacy fallback фільтрує make/model/chassis/year без engine/OPF. Це не твердження про застосування цих параметрів нинішнім V2 reader: поведінка залежить від активного шляху. Rollback має залишатися явно виміряним обмеженим режимом, а не обіцянкою повної рівноцінності.

Номери рядків наведені для поточної незакоміченої копії; після редагування орієнтуватися також на ім'я функції. Це аудит шляхів, а не вичерпна перевірка кожного production-запису: пряме читання production DB не виконувалося.

## 3. Продуктовий контракт фільтрів

- **Автомобіль і виробник деталі — різні сутності.** Користувач може вибрати make → model → generation без Burger/Öhlins/iPE. Brand — необов'язкове звуження товарів, із очевидним поясненням впливу на лічильники.
- **Єдиний набір правил.** Search results, facets, counts і suggestions споживають ті самі canonical identities, projection version та visibility semantics. Не виправляти dropdown окремим JSON-списком, який не може відтворити товари.
- **Кореляція.** Make/model/generation/year/engine/fuel/OPF повинні задовольняти одну допустиму vehicle application для product/variant. Не брати кузов з однієї application, а двигун з іншої.
- **Кузов і покоління.** Внутрішньо окремі canonical поля: generation, chassis/type code, body style. UI показує зрозуміле групування та синоніми, не змішує всі значення в нерозрізнену строку. Чинні deep links отримують сумісний adapter.
- **Рік та engine не завжди обов'язкові.** Вибір моделі/кузова не повинен вимагати невідомого двигуна, щоб показати огляд каталогу. Для деталі, де двигун суттєвий, стан UNKNOWN не стає exact. Для деталі, де двигун перевірено не впливає, використовувати явний ANY/NOT_APPLICABLE.
- **Розрізняти стани:** завантаження, помилка API, нема даних про двигуни, нема товарів для комбінації, є товари з неперевіреною сумісністю. Порожній array не повинен означати всі ці ситуації одразу.
- **Без прихованого послаблення.** Якщо exact matches = 0, повідомити причину/можливе уточнення. Окремо можна показати review candidates з явною позначкою, але не вважати їх підтвердженими й не рахувати як exact results.
- **Повнота dropdown.** Показати всі підтверджені доступні значення для поточних батьків. Якщо застосовується limit (наприклад 100), має бути searchable/paginated continuation, а не мовчазне обрізання. Нормалізація не видаляє нові supplier values без audit reason.
- **Детермінований стан.** Дійсні alias/URL values зберігаються; несумісні descendants скидаються тільки при справжній зміні parent, не при тимчасовій помилці мережі. Лічильники чітко означають matching published products/variants згідно з контрактом.

## 4. Що означає «розумний пошук»

Це швидкий bounded пошук із розпізнаванням наміру та перевіреною сумісністю, без LLM на кожне натискання клавіші.

| Ввід                                   | Очікувана поведінка                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `BMW M5 G90 S68`, `бмв м5 g90`         | resolve відомих aliases у canonical vehicle constraints; показати розпізнані chips                                             |
| `M5 G90`                               | запропонувати canonical vehicle, якщо він однозначно відомий з даних; не вимагати введення make вручну                         |
| `S58`, `3.0 TFSI`                      | код/сімейство/комплектацію розрізнити; при неоднозначності запропонувати кілька powertrain/configurations, не обирати довільно |
| `Audi A6 C7`, альтернативний type code | відобразити одну identity через перевірений alias; не створювати зайві незалежні варіанти у dropdown                           |
| Артикул із дефісами/пробілами          | exact normalized SKU має перший пріоритет; не виправляти символи артикула автоматично як звичайну опечатку                     |
| Назва товару з малою опечаткою         | обмежена typo/prefix підтримка для назв; жорсткі vehicle constraints лишаються чинними                                         |
| `вихлоп`, `exhaust` + авто             | контрольовані UA/EN синоніми category; ранжування всередині допустимих для авто кандидатів                                     |
| Невідома/суперечлива комбінація        | пояснити, що саме не розпізнано/суперечить; дати змінити filter, не підміняти автомобіль                                       |

Порядок: exact SKU → exact canonical vehicle + relevant category/title → approved aliases/token search → bounded typo suggestions. Brand, stock і ціна не можуть підняти несумісний товар вище підтвердженого. Назва чи SEO-текст самі по собі не доводять fitment. Походження aliases/provenance зберігається; transliteration та мовна нормалізація мають collision/negative tests.

## 5. Розширення завдань агентів

### Terra T1/T2: аудит усіх даних і engine resolution

Створити coverage ledger по **всіх джерелах**, product/variant та auto/moto. Для кожного dimension: confirmed, missing, ambiguous, not applicable; source/revision; чи потрапляє значення в selector; чи дає відповідний query результат. Дані для cold/coverage proof — disposable DB з репрезентативним наповненням.

Простежити full evidence chain для engine: сирий код/назва/об'єм/потужність/паливо → existing canonical powertrain/configuration → policy → projection → label/value selector → search predicate. Різні engine конфігурації не зливати за одним об'ємом. Не заповнювати UNKNOWN без доказу. Міграції/backfill dry-run і proof idempotency як у головному плані.

### Terra T3: єдиний facet/search contract

Реалізувати facet/search/count на одному correlated канонічному шляху; прибрати обов'язковий product brand для vehicle facets. Перевірити dimension CHASSIS vs GENERATION у кожному caller. Facet availability/loading/errors/coverage мають явний контракт для Luna.

Побудувати таблицю **кожного** UI/API параметра: type, allowed values, aliases, query predicate, scope, interactions, invalid value behavior, tests. Обов'язково: multibrand, category, productType/productKind, strict, stock states, year, engine, fuel, OPF/GPF, scope, sort, currency/country, page/cursor. Не дозволяти мовчазно ігноровані фільтри.

### Terra T7: bounded smart search

Окремий пакет після T2/T3: перевикористати `shopVehicleTaxonomy`, `shopVehicleSearch`, `shopCatalogSuggestion.server.ts` і наявні індекси. Додати canonical query interpretation та approved aliases, структуровані suggestions для generation/year/engine там, де є докази; прив'язати підказки до вибраного авто/фільтрів. Переключити consumer з legacy full scan на спільний bounded сервіс після parity proof. LLM/semantic vector service не є залежністю цього етапу.

Acceptance: golden exact/SKU/alias/typo/ambiguous/negative tests, справжній query bound, список interpreted constraints і невпізнаних tokens, search/suggest/result parity, zero тихих послаблень авто. Виміряти p95 без CDN HIT і кількість DB operations на typing session.

### Luna L1/L7: зрозуміла взаємодія

L1 доповнюється canonical URL restore, explicit option states і атомарним cascading state. Новий L7 після C1/T7: input з grouped suggestions «Автомобіль / Двигун / Товар / Артикул», chips розпізнаного запиту, disambiguation без примусового вибору, пояснення zero/missing/review states. Якщо engine даних нема — не показувати нічим не пояснений довільний input, який сервер трактує як точний internal slug.

Усі зміни UA/EN, keyboard/mobile, з latest-request-wins і бюджетом запитів. Не додавати повний довідник авто в initial JS; options підвантажуються bounded, але повнота доступна через пошук/continuation.

## 6. Глобальні критерії приймання

1. Звіт охоплює кожне опубліковане джерело та обидва scopes; «перевірено BMW» не є статусом всього каталогу.
2. Усі підтверджені доступні model/generation/engine значення з канонічних даних знаходяться через selectors або continuation. Виключення пояснені visibility/current filters, не прихованим allowlist чи top-100 cutoff.
3. Metamorphic checks: кожний verified application породжує query, що повертає свій product/variant; додавання конкретного правильного dimension не втрачає його; завідомо суперечливий dimension не робить exact match. Для UNKNOWN/review/universal очікування окремі.
4. Negative combinations будуються також між різними applications **того самого** товару, не лише між різними авто. OPF, паливо, transmission/engine, body style не перехрещуються випадково.
5. Golden-набір стратифікований за всіма source brands, make families, auto/moto, common/rare vehicles, UA/EN, source aliases, новими імпортами й варіантами. Кількісний coverage report доповнює, а не замінює golden cases.
6. M5 G90 + S68 має коректно знаходити підтверджені S68-compatible товари після normalization; не вимагати збереження всіх попередніх 52 legacy matches. G80 конфігурації та код engine отримують зрозумілі labels/aliases лише на основі джерел.
7. Жодного control, який виглядає активним, але не впливає на запит згідно з контрактом. Direct URL, Back/Forward та зміна brand не гублять valid vehicle silently.
8. Ті самі constraints дають узгоджені search results, counts, facets і suggestions на одній published version. У разі publication lag видимий контракт не видає незавершені дані за повні.
9. Правильність не обмінюється на швидкість: нова реалізація також проходить latency/cost gates головного плану; немає повного catalog scan або платного LLM на кожний query.

Поточний статус: read-only code/API audit виконано, завдання розширено. Аудит кожного production-запису, normalization/backfill, новий unified reader і новий smart-search UI **ще не виконані**. Комітів, push, deploy і production DB-записів не було.
