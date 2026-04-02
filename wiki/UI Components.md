---
tags: [dev, ui, frontend]
aliases: [Компоненти, Design System]
---

# 🎨 UI & Design Components

> [!info] Design System of One Company 

One Company — це преміум-вітрина. Тому наш код фронтенду (Next.js) використовує специфічні бібліотеки та підходи для забезпечення "Cinematic" відчуттів.

---

## 🛠 Стек Інтерфейсу

| Технологія | Призначення |
|---|---|
| **Tailwind CSS** | Основа стайлінгу (utility-first). |
| **Framer Motion** | Складні анімації, 3D Tilt ефекти (як у Urban Fleet cards), плавний скролінг. |
| **Radix UI / shadcn/ui** | Доступні (a11y) базові компоненти: `Select`, `Dialog`, `Toast`. |
| **Lucide React** | Сучасний і строгий набір іконок. |
| **next/image** | Автоматична оптимізація розмірів авто-фотографій. |

---

## 📓 Ключові Патерни

### 1. Dark & Cinematic Aesthetics (Стиль "Стелс")
Ввесь дизайн будується на глибоких чорних/сірих тонах.
- `bg-zinc-950` / `bg-black` — основа.
- Акценти: легкий `white/10` border-окантування (Glasmorphism).
- Button hover ефекти: свічення, glow.

### 2. Urban Theme Animations (З Shopify в React)
Ми перенесли важку логіку анімацій з Shopify Theme:
- **Reveal on Scroll**: Блоки з'являються плавно при скролі (Intersection Observer).
- **Parallax Backgrounds**: У `UrbanHomeSignature` задній фон hero-секції має ефект паралаксу.
- **Vimeo Lazy-Load**: Відео не вантажаться, поки користувач до них не доскролить (економить ~10-20MB трафіку на старті).

### 3. Server Components vs Client Components
Для SEO та швидкості ми жорстко дотримуємось патерну Next.js 14:
- Каталог (`page.tsx`) — **Server Component** (швидкий рендер, миттєво віддає HTML боту Google).
- Корзина та анімації (`AddToCartButton.tsx`) — **Client Component** (`"use client"`), бо взаємодіє зі станом/браузером.

---

## 🖼 Медіа Оптимізація

Зараз у нас в репозиторії лежить ~12MB логотипів (`public/logos.rar`). Щоб сайт літав:
- Ніколи не використовуємо `.png` напряму в `<img />`.
- Всі растрові логотипи пропускаються через `<Image />` компонент Next.js.
- Векторні логотипи (`.svg`) імпортуються напряму, бо вони важать кілобайти і мають ідеальну якість.

← [[Home]]
