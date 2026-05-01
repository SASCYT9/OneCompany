# OneCompany — проєктний vault

Це Obsidian vault для проєкту OneCompany (`D:\OneCompany`). Тут — нотатки,
що **не** належать до коду, але потрібні для спільного контексту: рішення,
дослідження брендів, архітектура магазину, відлагодження.

## Розділи
- [[Shop/README|Shop]] — архітектура та фічі магазину (Brabus, RaceChip, do88, Öhlins, CSF тощо)
- [[Brands/README|Brands]] — нотатки по брендах: джерела даних, особливості скрейпінгу
- [[Dev/README|Dev]] — dev notes, відлагодження, інциденти

## Конвенції
- Всі заголовки файлів — `PascalCase` або `Kebab-Case` (без пробілів у file-name).
- Wikilinks (`[[Note Name]]`) — за замовчуванням; markdown-links — лише для зовнішніх URL.
- Скріншоти кладемо в `screenshots/` з назвою виду `YYYY-MM-DD-context.png`.
- Tags: `#shop`, `#brand/<name>`, `#bug`, `#decision`.

## Плагіни
- Core graph view + community **Graphify** для покращеного візуалу зв'язків.
- Кольорові групи в Graph: Shop / Brands / Dev (див. `.obsidian/graph.json`).
