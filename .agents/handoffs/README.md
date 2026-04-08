# 🤝 Agent Handoff System

## Що це?
Ця папка — **спільна пам'ять** між усіма AI-агентами проекту One Company.
Коли один агент (Antigravity, Claude Code, Gemma) завершує етап роботи,
він залишає тут структурований "handoff" документ для наступного агента.

## Як це працює

### Потік роботи:
```
Antigravity (Архітектор)
    │
    ├─→ Створює handoff у цій папці
    │
    ▼
Claude Code (Інженер)
    │
    ├─→ Читає handoff, виконує код
    ├─→ Оновлює статус: IN_PROGRESS → DONE
    │
    ▼
Antigravity
    ├─→ Перевіряє результат у браузері
    └─→ Закриває задачу в wiki/Tasks Kanban.md
```

### Формат файлів:
- `YYYY-MM-DD_<task-slug>.md` — активний handoff
- Кожен файл має YAML frontmatter зі статусом та призначеним агентом

### Статуси:
- `PENDING` — Створено, чекає виконавця
- `IN_PROGRESS` — Агент взяв у роботу
- `REVIEW` — Виконано, чекає перевірки
- `DONE` — Завершено та верифіковано

## Структура Frontmatter
```yaml
---
task: "Короткий опис задачі"
created_by: antigravity | claude-code | gemma
assigned_to: antigravity | claude-code | gemma
status: PENDING | IN_PROGRESS | REVIEW | DONE
priority: critical | high | medium | low
created_at: 2026-04-07T13:20:00+03:00
updated_at: 2026-04-07T13:20:00+03:00
kanban_ref: "Посилання на wiki/Tasks Kanban.md"
---
```
