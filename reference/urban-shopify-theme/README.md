# Urban Shopify Theme — референс для магазину Urban

Ця папка містить експорт теми **Urban** (Rise) з Shopify. Тема не запускається в нашому проєкті — вона на Liquid і працює тільки на Shopify. Ми використовуємо її як **референс дизайну та структури** при побудові повноцінного магазину Urban на Next.js у цьому репо.

## Структура (що брати для повторення)

| Папка / файл | Для чого використовувати |
|--------------|--------------------------|
| `layout/theme.liquid` | Загальний каркас, header/footer, підключення стилів |
| `sections/header.liquid`, `sections/footer.liquid` | Навігація, лого, меню, футер |
| `sections/main-product.liquid` | Сторінка товару: галерея, ціна, варіанти, кнопка в кошик |
| `sections/main-collection-product-grid.liquid` | Список товарів (каталог), сітка, фільтри |
| `sections/main-cart-*.liquid`, `sections/cart-drawer.liquid` | Кошик, drawer, підсумки |
| `sections/section-urban-*.liquid` | Унікальні блоки Urban: баннери, hero, галереї, модель overview тощо |
| `sections/hero-automotive.liquid` | Hero для авто-тематики |
| `sections/vehicle-picker.liquid` | Вибір авто/моделі (якщо потрібно в нашому магазині) |
| `assets/*.css` | Стилі: кольори, сітки, компоненти (переносити в наш CSS/ Tailwind) |
| `assets/*.svg`, `assets/*.png` | Іконки, зображення — можна копіювати в `public/` при потребі |
| `config/settings_schema.json`, `config/settings_data.json` | Кольори, шрифти, налаштування — для design tokens |

## Де будуємо магазин у репо

- **Маршрути:** `src/app/[locale]/shop/` — список, товар, далі cart, checkout.
- **Компоненти:** повторюємо блоки з `sections/` та стилі з `assets/` у React-компонентах (Next.js).
- **План реалізації:** `docs/onecompany-shop-plan.md` (фази A–F для Urban).

## Як працювати з референсом

1. Відкривати потрібну секцію (наприклад `main-product.liquid`) і переносити розмітку та логіку в React.
2. Копіювати CSS з `assets/` у наші модулі або переписувати на Tailwind за тим самим виглядом.
3. Унікальні секції Urban (`section-urban-*`, `hero-automotive`, `vehicle-picker`) — пріоритет для головної та каталогу.

Експорт з: `theme_export__urbanautomotive-shop-theme-export-urbanautomotive-shop-rise-20feb2__14MAR2026-0910pm.zip`.
