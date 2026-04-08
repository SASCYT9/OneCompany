---
banner: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
banner_y: 0.5
---

# 🛸 One Company: Центр Управління

> [!INFO] Головна Навігація
> 🗺️ **[Глобальна Архітектура](🗺️%20Глобальна%20Архітектура.canvas)** | 📋 **[Завдання (Kanban)](Tasks%20Kanban.md)** | 🧠 **[Як працювати з ШІ](AI%20Agent%20Syndicate.md)** | 🏪 **[Shop Overview](Shop%20Overview.md)**

---

## 📊 Поточні KPI / Метрики
*Тут будуть відображатися актуальні метрики з Supabase/Shopify за допомогою API...* 
*(Заглушка для майбутнього DataviewJS скрапінгу)*

---

## 🏬 Швидкий доступ: Shopify магазини
- 🌬 **[Eventuri Storefront](eventuri.onecompany.global)** — мультимовний (UA/EN) Shopify магазин впускних систем. → [[Shopify Storefronts|Детальніше]]
- 📉 **[KW Automotive](kw.onecompany.global)** — монобрендовий Shopify магазин підвісок. → [[Shopify Storefronts|Детальніше]]

---

## 🔥 Активні Завдання (В Роботі)
Тут автоматично збираються всі задачі, які зараз позначені як "в роботі" або не завершені.
```dataview
TASK 
FROM "Tasks Kanban"
WHERE !completed AND status != "Done"
LIMIT 5
```

---

## 📈 Останні Оновлені Документи
Що змінилося у "Мозку" за останній час:
```dataview
TABLE file.mtime AS "Останні зміни"
FROM ""
WHERE file.name != "🚀 Головна (Dashboard)"
SORT file.mtime DESC
LIMIT 5
```

---

## 🛠 Інструментарій Менеджера
- **Додати новий бренд (ШІ):** Використовуй макрос `auto_audit.md` або агентський скрипт для додавання бренду в каталог та БД.
- **Моніторинг контенту:** Перевіряй наповнення товарів через [[Brands]] таблицю.
- **Генерація SEO:** Виклик `/api/admin/shop/seo-generate` (описано в [[SEO Content Strategy]]).
- **Розробка:** Зв'язок із `nextjs-architect` для Pixel-Perfect нарізки UI/UX та впровадження нових фіч.

> [!TIP] Налаштування Головної Сторінки
> Оскільки в тебе увімкнений плагін **Homepage**, ти можеш зайти в його налаштування і вибрати цей файл `🚀 Головна (Dashboard).md`, щоб він відкривався САМЕ ПЕРШИМ, коли ти відкриваєш Obsidian!
