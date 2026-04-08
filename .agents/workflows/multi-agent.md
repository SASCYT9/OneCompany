---
description: How to use the multi-agent orchestration system (Antigravity + Claude Code + Vibe Kanban)
---

# 🤖 Мульти-Агентний Workflow

Цей воркфлоу описує, як використовувати систему синдикату AI-агентів для делегування та відстеження завдань.

## Компоненти системи

| Агент | Роль | Інтерфейс |
|---|---|---|
| **Antigravity** | 🧠 Архітектор, Планувальник | Gemini IDE (цей чат) |
| **Claude Code** | ⚙️ Термінальний Інженер | Термінал (`claude`) |
| **Gemma 4 (Ollama)** | 🔧 Локальний AI-двигун | `http://localhost:11434` |
| **Vibe Kanban** | 📊 Дашборд видимості | `npx vibe-kanban` (веб) |

## Як запустити систему

### Крок 1: Запустити Vibe Kanban (дашборд)
```powershell
cd d:\OneCompany
npx vibe-kanban
```
// turbo

### Крок 2: Запустити Ollama (якщо не запущена)
```powershell
ollama serve
```

### Крок 3: Відкрити Claude Code (у окремому терміналі)
```powershell
claude
```

## Як делегувати задачу

### Через Handoff документ (Antigravity → Claude Code):
1. Antigravity створює файл у `d:\OneCompany\.agents\handoffs\YYYY-MM-DD_<task>.md`
2. У Claude Code терміналі вводите:
   ```
   Прочитай файл .agents/handoffs/ і виконай PENDING задачі
   ```
3. Claude Code виконує роботу і змінює статус на `REVIEW`
4. Antigravity перевіряє результат

### Через Vibe Kanban (візуально):
1. Відкрийте дашборд у браузері
2. Створіть тікет (картку)
3. Призначте агента (Claude Code / Gemini)
4. Спостерігайте за прогресом у реальному часі

## Як перевірити статус
```powershell
# Переглянути всі активні handoffs
Get-ChildItem d:\OneCompany\.agents\handoffs\*.md | Select-String "status:"
```
// turbo

## Де зберігаються результати
- **Handoff output**: `.agents/handoffs/output/`
- **Wiki/Kanban**: `wiki/Tasks Kanban.md`
- **Vibe Kanban**: веб-інтерфейс (локальний)
