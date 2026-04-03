---
tags: [dashboard]
aliases: [Dashboard, Головна]
---

# 🏢 One Company — Повна Wiki

> [!info] Центральна база знань компанії
> Оновлено: **02 квітня 2026**

---

## 🗺 Mind Maps

- 📌 **[[Shop Mind Map]]** — E-commerce (Canvas)
- 📌 **[[Marketing Mind Map]]** — Маркетинг (Canvas)

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

### 🏪 E-Commerce (SHOP)
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

### 🖥️ Admin Panel (Адмінка)
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
- [[Order Processing Playbook]] — Як менеджерам обробляти замовлення (від плати до доставки)
- [[B2B Operations]] — Робота з дилерами (СТО), групи лояльності та видимість цін
- [[Brand Onboarding Playbook]] — Інструкція по інтеграції нових брендів-постачальників
- [[Competitor Analysis]] — Наші переваги на ринку та розбір конкурентів

### 📌 Статус
- [[Improvement Strategy]] — Ідеї по Інстаграму та функціоналу сайту 🚀
- [[Blockers]] — Зовнішні залежності
- [[TODO]] — Задачі без блокерів
- [[Team]] — Команда та відповідальності

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
