# CLAUDE.md — OneCompany

Інструкції для Claude Code (та інших AI-агентів) при роботі з цим репо.

## Проєктний Obsidian Vault — `wiki/`

В корені проєкту є Obsidian vault (`wiki/`) — це **проєктна wiki**, не персональні нотатки.
Призначення: тримати контекст, що не належить коду — рішення, дослідження брендів,
артефакти інцидентів, скріншоти багів.

### Структура
- `wiki/Index.md` — Map of Content, точка входу.
- `wiki/Shop/` — нотатки по архітектурі/фічах магазину.
- `wiki/Brands/` — нотатки по брендах (джерела даних, особливості скрейпінгу).
- `wiki/Dev/` — dev notes, інциденти, відлагодження.
- `wiki/screenshots/` — скріншоти (формат імені: `YYYY-MM-DD-context.png`).

### Правила для AI-агентів
- **Читати** `wiki/` коли потрібен історичний контекст по бренду/фічі/інциденту,
  якого немає в коді (наприклад, чому так зроблено, які були спроби раніше).
- **Писати** в `wiki/` тільки коли user просить явно ("задокументуй це у wiki",
  "додай нотатку про X"). Не створювати нотаток автоматично після кожної зміни.
- Формат — `.md` з Obsidian wikilinks `[[Note Name]]`. Зовнішні URL — звичайний markdown.
- Tags: `#shop`, `#brand/<name>`, `#bug`, `#decision`.
- File-names — `PascalCase` або `Kebab-Case` без пробілів.

### Obsidian config (`wiki/.obsidian/`)
Конфіг розшарюється через git. Що трекається:
- `app.json`, `appearance.json`, `core-plugins.json` — базові налаштування.
- `community-plugins.json` — список увімкнених community plugins (зараз: `graphify`).
- `graph.json` — налаштування core Graph View (кольорові групи по папках).
- `plugins/*/data.json` — налаштування кожного community plugin.

Що **не** трекається (див. `.gitignore`):
- `workspace.json`, `workspace-mobile.json`, `workspaces.json`, `cache/` — per-user UI state.
- `plugins/*/main.js`, `styles.css`, `manifest.json` — бінарі плагінів (Obsidian
  сам завантажує їх через Settings → Community Plugins).

### Graphify (community plugin)
Розширює стандартний Graph View Obsidian: кращі layout-и, кластеризація, фільтри.
Встановлюється вручну через Obsidian UI (Settings → Community Plugins → Browse →
"Graphify" → Install → Enable). Налаштування зберігаються в
`wiki/.obsidian/plugins/graphify/data.json` і комітяться в git.

### Перший запуск (для нової машини / нового розробника)
1. Відкрити Obsidian → Open folder as vault → вказати `D:\OneCompany\wiki\`.
2. Settings → Community Plugins → Turn on community plugins (один раз на vault).
3. Browse → знайти "Graphify" → Install → Enable.
4. Налаштування Graphify і всі core-конфіги вже застосуються з git.
