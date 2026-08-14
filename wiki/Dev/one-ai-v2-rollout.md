# One AI V2 — staging і production rollout

Цей документ описує керований запуск One AI V2. Команди нижче не є частиною
Vercel Build і не повинні запускатися автоматично під час deploy.
Він є обов'язковим runbook для staging, canary та подальшого production rollout.

## 1. Поточний стан

- V2 та shadow mode за замовчуванням вимкнені.
- Production activation fail-closed: для поточного commit потрібен підписаний
  release-gate marker.
- `Other` не входить до runtime rollout.
- Exact-SKU baseline має окремий прапорець і також залежить від загального kill
  switch.
- Поточний development fixture містить лише 8 сценаріїв. Він корисний для
  регресії, але навмисно не проходить production gate у 500 перевірених
  менеджером сценаріїв.

## 2. Передумови для staging

1. Створити point-in-time backup PostgreSQL і перевірити можливість restore.
2. Зберегти exact Git commit, який розгорнуто на захищеному staging URL.
3. Переконатися, що `DIRECT_URL` вказує на staging PostgreSQL, а не production.
4. Налаштувати server-only secrets:
   - `SHOP_AI_API_KEY`;
   - `SHOP_AI_EVAL_TOKEN` — щонайменше 32 bytes;
   - `SHOP_AI_OWNER_HMAC_SECRET` — стабільний server-only secret щонайменше 32 bytes;
   - `SHOP_AI_V2_RELEASE_GATE_SIGNING_SECRET` — щонайменше 32 bytes;
   - `ONE_AI_QUALITY_BULK_SECRET` — щонайменше 32 bytes;
   - `CRON_SECRET`.

5. Залишити `SHOP_AI_V2_ENABLED=0`, `SHOP_AI_V2_SHADOW=0` і
   `SHOP_AI_V2_EXACT_SKU_ENABLED=0`.

## 3. Migration і backfill на staging

Спочатку перевірити стан migration:

```bash
npx prisma migrate status
npx prisma validate
```

Після підтвердженого backup:

```bash
npx prisma migrate deploy
```

Migration `20260717143000_add_shop_ai_knowledge_v2` сумісна як із базою, де
Knowledge V1 уже застосовано, так і з чистим переходом через попередню V1
migration. Стару migration не редагувати.

Почати з bounded dry-run:

```bash
npm run shop:knowledge:v2:dry -- --category=exhaust --limit=100 --batch=50
```

Після перевірки preview виконати staging backfill цієї ж категорії. Commit без
явного `--category` відхиляється, а `other` не можна передати навіть явно:

```bash
npm run shop:knowledge:v2:backfill -- --category=exhaust --batch=100
```

Перевірити embedding backlog без зовнішніх викликів:

```bash
npm run shop:knowledge:v2:embed:dry -- --limit=100 --batch=20
```

Після контролю кількості chunks і вартості:

```bash
npm run shop:knowledge:v2:embed -- --limit=10000 --batch=20 --max-calls=50 --attempts=3
```

Повторний запуск є idempotent: незмінні content hashes не повинні
переіндексовуватися або повторно отримувати embeddings.

Production embedding виконується тільки окремим bounded worker, не Vercel
Build/Function. Для нього потрібен explicit
`SHOP_KNOWLEDGE_EMBEDDING_PRODUCTION_ACK=1`, cost ceiling і зовнішній scheduler,
який запускає `npm run shop:knowledge:v2:embed:recover` до спорожнення backlog.

## 4. Data gates

Перед shadow mode зафіксувати звіт, який підтверджує:

- 100% ACTIVE + published товарів мають current Knowledge V2 record;
- 100% варіантів і непорожніх UA/EN source fields охоплено;
- усі READY revisions мають узгоджені chunks, applications та embeddings;
- загальна кількість chunks не перевищує 60 000;
- жоден exact candidate не має `NEEDS_REVIEW`, `BLOCKED`, stale revision або
  непідтвердженого application evidence;
- RaceChip і `Other` не ввімкнені до завершення окремого review.
- singleton `ShopKnowledgeCatalogState` існує, має 64-hex fingerprint і змінюється
  разом з кожною активацією revision або активною manager mutation.

## 5. Shadow і canary

Shadow запускається лише на staging і лише після data gates:

```text
SHOP_AI_V2_ENABLED=0
SHOP_AI_V2_SHADOW=1
SHOP_AI_V2_CATEGORIES=exhaust
SHOP_AI_V2_CATEGORY_PERCENTAGES=exhaust:100
```

Після internal canary:

```text
SHOP_AI_V2_ENABLED=1
SHOP_AI_V2_SHADOW=0
SHOP_AI_V2_CATEGORIES=exhaust
SHOP_AI_V2_CATEGORY_PERCENTAGES=exhaust:10
```

Допустимі етапи лише `0`, `10`, `50`, `100`. Категорія без explicit percentage
отримує `0`. Перехід на наступний етап робиться тільки після окремого quality
review. Негайний kill switch:

```text
SHOP_AI_V2_ENABLED=0
SHOP_AI_V2_SHADOW=0
SHOP_AI_V2_EXACT_SKU_ENABLED=0
```

## 6. Release evaluation

Production corpus має містити щонайменше 500 перевірених сценаріїв і не менше
30 для кожної ввімкненої категорії. Кожен сценарій повинен мати reviewer,
UTC `reviewedAt`, durable `reviewEvidenceId`, expected та forbidden IDs.

GitHub workflow `One AI V2 Release Evaluation`:

1. запускається вручну через protected GitHub Environment;
2. приймає exact 40-character commit;
3. звертається лише до захищеного staging origin;
4. вимагає V2/strict response markers;
5. перевіряє quality, response size, latency і commit identity;
6. створює підписаний marker;
7. не виконує deploy або promotion.

Eval-відповіді читають catalog fingerprint безпосередньо з
`ShopKnowledgeCatalogState`, а не з environment fallback. Marker підписує commit,
цей fingerprint та строк дії до 24 годин. Для evaluated production deployment
`SHOP_AI_V2_CATALOG_FINGERPRINT` має дорівнювати значенню singleton-рядка.
`predeploy-check` і runtime retrieval відхиляють activation, якщо marker
відсутній, пошкоджений, прострочений, належить іншому commit або база вже
активувала іншу knowledge revision. Після такої зміни потрібен новий protected
eval і marker.

## 7. Production

Production migration, backfill і embeddings виконуються тільки після:

- успішного staging restore rehearsal;
- повного shadow run;
- пройдених data та release gates;
- окремого підтвердження власника проєкту.

Порядок категорій: exact SKU/merch, exhaust, carbon & aero, brakes, suspension,
performance, chip tuning після RaceChip adapter, moto carbon, cooling, wheels,
lighting, interior, accessories. `Other` спочатку перекласифікувати або
заблокувати.

## 8. Спостереження після ввімкнення

Для кожного етапу перевіряти:

- wrong fitment і hard-negative exact — 0;
- correct no-match — не нижче 99%;
- recall@20 — не нижче 98%;
- P95 deterministic retrieval — до 750 ms;
- P95 turn — до 3 s, hard timeout — 6 s;
- active CPU — до 250 ms/turn;
- response — до 100 KB;
- failed/retry/dead-letter outbox jobs;
- manual-change freshness P95 — до 5 хвилин;
- large-import freshness — до 30 хвилин;
- Vercel Functions, Fluid CPU, memory, ISR і transfer витрати.

Якщо gate погіршується, категорію повернути на `0` або вимкнути загальний kill
switch; не послаблювати chassis/year/engine/OPF/product-kind constraints.
