---
tags: [dashboard]
aliases: [Dashboard, Головна]
---

# 🏢 One Company — Повна Wiki

> [!info] Центральна база знань компанії
> Оновлено: **07 квітня 2026**

---

## 🗺 Mind Maps & Architecture

- 📌 **[[Shop Mind Map]]** — E-commerce (Canvas)
- 📌 **[[Marketing Mind Map]]** — Маркетинг (Canvas)

> [!abstract] Архітектура Екосистеми OneCompany
> ```mermaid
> graph TD
>     subgraph Storefront ["🛍️ B2B / B2C Клієнти"]
>         C[Клієнт / Дилер] -->|Чекаут & Каталог| Next[Next.js 14 App Router]
>     end
> 
>     subgraph CoreSystem ["⚙️ Core System"]
>         Next -->|Prisma Client| Prisma[Prisma ORM]
>         Prisma <--> DB[(PostgreSQL DB)]
>         DB --> Supabase[Supabase Auth & Storage]
>     end
> 
>     subgraph ExternalAPI ["🌍 External Integrations"]
>         Next <--> Turn14[Turn14 API / Каталог]
>         Next <--> Payment[Еквайринг]
>     end
> 
>     subgraph AdminPanel ["🛡️ Admin Panel"]
>         M[Адміністратор] -->|RBAC Доступ| AdminUI[CRM / Адмінка]
>         AdminUI --> Prisma
>     end
>     
>     style Next fill:#111,stroke:#444,stroke-width:2px,color:#fff
>     style DB fill:#3182ce,stroke:#2b6cb0,color:#fff
>     style AdminUI fill:#2b6cb0,stroke:#2c5282,color:#fff
> ```

---

## 📊 Компанія

| | |
|---|---|
| **Що** | Портал преміум авто-тюнінгу та lifestyle |
| **Ринок** | B2B + B2C, worldwide |
| **Домен** | onecompany.global |
| **Стек** | Next.js · Prisma · PostgreSQL · Vercel |
| **Мови** | UA 🇺🇦 · EN 🇬🇧 |
| **Валюти** | UAH · EUR · USD |

---

## 🧭 Навігація

### 💡 Генератор Ідей
Свіжі думки, архітектурні інсайти та пропозиції (створюйте нові ідеї в папці `💡 Ідеї`):
```dataview
TABLE
  status as "Статус",
  priority as "Пріоритет",
  file.cday as "Створено"
FROM "💡 Ідеї" AND #idea
SORT file.ctime DESC
LIMIT 5
```

### 🏪 E-Commerce (SHOP)
- **[[✅ Розроблені Магазини (Storefronts)|🚀 Всі Готові Магазини (Візуал та Роути)]]**
- [[Shop Overview]] — Архітектура магазину (фази A-F)
- [[Phase A — Security]] · [[Phase B — Catalog]] · [[Phase C — Storefront]]
- [[Phase D — Orders]] · [[Phase E — CSV Import]] · [[Phase F — SEO]]
- [[Brands]] · [[Logistics]] · [[Pricing]] · [[Turn14]]

### 📣 Маркетинг & Продвиження
- [[Marketing Strategy]] — Загальна стратегія
- [[Instagram Strategy]] — Контент-план Інста
- [[YouTube Strategy]] — Канал та контент
- [[TikTok Strategy]] — Вірусний контент
- [[SEO Content Strategy]] — Контент-маркетинг та блог
- [[Content Calendar]] — Розклад публікацій

### 🏷 Бренди
- [[Urban Automotive]] — Преміум тюнінг (Land Rover, Rolls-Royce, etc.)
- [[Burger Motorsports]] — RaceChip чіп-тюнінг
- [[DO88]] — Радіатори та інтеркулери
- [[Brabus]] — Mercedes преміум тюнінг
- [[RaceChip]] — ECU чіпи (7700+ configs)
- [[Akrapovic]] — Вихлопні системи
- [[Eventuri]] — Впускні системи

### 🌐 Сайт & Портал
- [[Portal]] — Головний портал (shop gateway)
- [[Urban Theme]] — Дизайн Urban storefront
- [[Site Pages]] — Про нас, контакти, доставка, блог
- [[UI Components]] — Дизайн-система (Tailwind, Framer Motion)

### 🛒 Client Storefront (Візуал для Клієнтів)

> [!example] Дизайн Магазину та Чекаут (Stealth Wealth)
> ![[screenshots/storefront_hero.png]]
> ![[screenshots/storefront_checkout.png]]

> [!abstract] User Journey (Шлях клієнта)
> ```mermaid
> sequenceDiagram
>     actor C as Клієнт
>     participant S as Storefront
>     participant B as База (Prisma)
>     participant A as Admin
>     
>     C->>S: Переглядає Каталог
>     S->>C: Показує Premium UI
>     C->>S: Додає в Кошик
>     S->>B: Зберігає Cart (Session/DB)
>     C->>S: Checkout (Доставка + Оплата)
>     S->>B: Створює PENDING_REVIEW Order
>     B-->>A: Сповіщення Менеджеру
> ```

### 🖥️ Admin Panel (Адмінка)

> [!example] Візуал Адмінки
> ![[screenshots/pres_03_crm.png]]
> ![[screenshots/pres_04_catalog.png]]

- [[Admin Panel]] — Огляд адмін-панелі (37 сторінок, ~780 KB коду)
- [[Admin — Dashboard]] · [[Admin — Catalog]] · [[Admin — Orders]]
- [[Admin — Logistics]] · [[Admin — Pricing]] · [[Admin — CSV Import]]
- [[Admin — Turn14]] · [[Admin — CRM]] · [[Admin — Customers]]
- [[Admin — Settings]] · [[Admin — Audit]]

### 🏗 Tech & Architecture
- [[Architecture]] — System architecture, Database schema, Tech Stack
- [[DevOps]] — Vercel Serverless, Supabase, Backups, Cron jobs
- [[Analytics & Performance]] — Аналіз трафіку (Google Search Console) та Core Web Vitals

### ⚙️ Операції (Playbooks / SOPs)
- 👑 **[[SOP - Standard Operating Procedures|Усі Інструкції (Головний Хаб)]]** — Відкрийте цей хаб для повної класифікації відділів
- [[Order Processing Playbook]] — Як менеджерам обробляти замовлення
- [[B2B Operations]] — Робота з дилерами (СТО) та знижки
- [[Brand Onboarding Playbook]] — Чекліст інтеграції нових брендів

### 📌 Статус та Задачі
- 🎯 **[[Tasks Kanban|Kanban Board (Робоча Дошка)]]** — Повноцінний дашборд завдань (TODO, In Progress, Done)
- [[Improvement Strategy]] — Ідеї по Інстаграму та функціоналу сайту 🚀
- [[TODO]] — Архів текстових задач
- [[Team]] — Команда та відповідальності

### 🤖 AI Agent Syndicate
- 🧠 **[[AI Agent Syndicate]]** — Мульти-агентна система розробки
- 📋 **[Vibe Kanban](http://localhost:53923)** — Візуальний дашборд завдань агентів
- 📄 Handoff-система — `.agents/handoffs/` (обмін задачами між агентами)
- ⚙️ Workflow — `.agents/workflows/multi-agent.md`

---

## 📈 Dataview: Прогрес по Фазах

```dataview
TABLE
  status as "Статус",
  progress + "%" as "Прогрес",
  join(tags, ", ") as "Теги"
FROM ""
WHERE contains(tags, "phase")
SORT file.name ASC
```

---

## 📋 Dataview: Всі Блокери

```dataview
LIST
FROM #blocker
SORT file.name ASC
```
