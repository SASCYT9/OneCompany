## Автоматичний переклад описів товарів (UA → EN)

### Навіщо
У storefront тексти товарів використовуються як `{ ua, en }`. Якщо поля `*En` у БД порожні (або дублюють UA), сторінки `EN` можуть показувати **порожній опис**.

### Що робить скрипт
`scripts/translate-shop-products-en.js`:

- знаходить товари, де `shortDescEn/longDescEn/bodyHtmlEn` **порожні або однакові з UA**
- робить переклад UA → EN
- **дедуплікує** однакові UA тексти (перекладає 1 раз і повторно використовує результат)
- підтримує `--dry-run` та `--commit`

### Підготовка
Додай у `.env.local`:

- `DEEPL_AUTH_KEY=...`
- (опційно) `DEEPL_BASE_URL=...` (якщо хочеш явно: `https://api-free.deepl.com` або `https://api.deepl.com`)

### Запуск

Dry-run (нічого не пише в БД):

```bash
node scripts/translate-shop-products-en.js --dry-run --limit=50
```

Запис у БД:

```bash
node scripts/translate-shop-products-en.js --commit --limit=50
```

Якщо треба включити неопубліковані товари:

```bash
node scripts/translate-shop-products-en.js --commit --include-unpublished --limit=200
```

### Примітки
- Скрипт **не вигадує** характеристики — перекладає тільки те, що вже є у UA тексті.
- Для максимальної “маркетингової” якості краще запускати батчами (наприклад, по 50–200).

