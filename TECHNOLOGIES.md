# 🛠️ OneCompany.global — Технології та Архітектура

> Детальний опис всіх технологій, бібліотек та сервісів, що використовуються на сайті

---

## 📋 Зміст

1. [Frontend Framework](#-frontend-framework)
2. [UI та Стилізація](#-ui-та-стилізація)
3. [3D Графіка та Візуалізація](#-3d-графіка-та-візуалізація)
4. [Анімації](#-анімації)
5. [Backend та API](#-backend-та-api)
6. [База Даних](#-база-даних)
7. [Аутентифікація](#-аутентифікація)
8. [Інтернаціоналізація (i18n)](#-інтернаціоналізація-i18n)
9. [Email та Комунікації](#-email-та-комунікації)
10. [Telegram Інтеграція](#-telegram-інтеграція)
11. [Аналітика](#-аналітика)
12. [SEO Оптимізація](#-seo-оптимізація)
13. [Медіа та Зображення](#-медіа-та-зображення)
14. [DevOps та Деплой](#-devops-та-деплой)
15. [Безпека](#-безпека)
16. [Утиліти](#-утиліти)
17. [Порівняння з Конкурентами](#-порівняння-з-конкурентами)

---

## 🎯 Frontend Framework

### Next.js 16.0.7
- **Тип:** React метафреймворк
- **Режим:** App Router (не Pages Router)
- **Рендеринг:** 
  - SSR (Server-Side Rendering) — динамічні сторінки
  - SSG (Static Site Generation) — статичні сторінки
  - ISR (Incremental Static Regeneration) — гібрид
- **Bundler:** Webpack (з підтримкою Turbopack для dev)
- **Особливості:**
  - Server Components (React 19)
  - Streaming та Suspense
  - Middleware для routing
  - API Routes
  - Image Optimization
  - Font Optimization

### React 19.0.0
- **Тип:** UI бібліотека
- **Особливості:**
  - Server Components
  - Server Actions
  - `use` hook
  - Concurrent Rendering
  - Automatic Batching
  - Transitions API

### TypeScript 5.x
- **Тип:** Типізована надбудова над JavaScript
- **Конфігурація:** Strict mode
- **Особливості:**
  - Type inference
  - Generics
  - Decorators
  - Path aliases (`@/`)

---

## 🎨 UI та Стилізація

### Tailwind CSS 3.4.17
- **Тип:** Utility-first CSS фреймворк
- **Плагіни:**
  - `tailwindcss-animate` — анімації
  - `@tailwindcss/typography` — проза
- **Кастомізація:**
  - Кастомні кольори (brand palette)
  - Кастомні шрифти
  - Кастомні breakpoints
  - CSS змінні для теми

### Шрифти
- **IBM Plex Mono** — моноширинний (технічний вигляд)
- **Unbounded** — display шрифт (заголовки)
- **Завантаження:** Next.js Font Optimization (self-hosted)

### Компоненти UI
- **Radix UI** — headless компоненти:
  - `@radix-ui/react-dialog` — модальні вікна
  - `@radix-ui/react-dropdown-menu` — випадаючі меню
  - `@radix-ui/react-tabs` — таби
  - `@radix-ui/react-tooltip` — підказки
  - `@radix-ui/react-slot` — slot pattern
- **Lucide React** — іконки (800+ SVG іконок)
- **class-variance-authority (CVA)** — варіанти компонентів
- **clsx / tailwind-merge** — умовні класи

### Теми
- **next-themes** — dark/light mode
- **Стандартна тема:** Dark (чорний фон)

---

## 🎮 3D Графіка та Візуалізація

### Three.js (через React Three Fiber)
- **@react-three/fiber 9.1.2** — React renderer для Three.js
- **@react-three/drei 10.0.6** — хелпери та компоненти:
  - `OrbitControls` — управління камерою
  - `Environment` — HDR освітлення
  - `useGLTF` — завантаження 3D моделей
  - `Float` — анімація плавання
  - `Text3D` — 3D текст
- **three 0.175.0** — core 3D engine

### 3D Особливості
- **Формати моделей:** GLTF/GLB
- **Текстури:** PBR (metalness, roughness)
- **Освітлення:** HDR environment maps
- **Пост-обробка:** Bloom, SSAO

### Розташування 3D компонентів
```
src/components/3d/
├── CinematicCamera.tsx      — анімована камера
├── CinematicHero.tsx        — hero секція з 3D
├── Homepage3DScene.tsx      — головна 3D сцена
├── StoreHeroSection.tsx     — 3D для магазину
└── ...
```

---

## ✨ Анімації

### Framer Motion 12.9.4
- **Тип:** Declarative анімації для React
- **Використання:**
  - Page transitions
  - Scroll-based анімації (`useScroll`, `useMotionValue`)
  - Gesture анімації (drag, hover, tap)
  - Layout анімації
  - AnimatePresence (mount/unmount)
- **Приклад:**
  ```tsx
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  />
  ```

### GSAP 3.12.7
- **Тип:** Професійна анімаційна бібліотека
- **Плагіни:**
  - `ScrollTrigger` — scroll-based анімації
  - `SplitText` — анімація тексту
- **Використання:**
  - Складні timeline анімації
  - Parallax ефекти
  - Morphing

### React Spring
- **@react-spring/three** — physics-based анімації для 3D
- **@react-spring/web** — анімації для DOM

### Lenis
- **Тип:** Smooth scroll бібліотека
- **Особливості:**
  - Плавний scroll
  - Momentum
  - Touch підтримка

---

## 🔧 Backend та API

### Next.js API Routes
- **Розташування:** `src/app/api/`
- **Endpoints:**
  ```
  /api/contact          — форма зворотнього зв'язку
  /api/messages         — управління повідомленнями
  /api/partnership      — партнерські заявки
  /api/admin/auth       — авторизація адміна
  /api/admin/content    — CMS API
  /api/telegram/webhook — Telegram бот
  ```

### Middleware
- **Файл:** `src/middleware.ts`
- **Функції:**
  - Locale detection та redirect
  - URL rewriting
  - Protected routes

---

## 🗄️ База Даних

### PostgreSQL
- **Хостинг:** Neon / Vercel Postgres
- **ORM:** Prisma 6.19.0

### Prisma Schema
```prisma
model Message {
  id          String   @id @default(cuid())
  type        String   // auto | moto
  model       String
  vin         String?
  wishes      String
  budget      String
  email       String
  phone       String
  status      String   @default("new")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Prisma Features
- **Prisma Client** — type-safe queries
- **Prisma Migrate** — database migrations
- **Prisma Studio** — GUI для бази

---

## 🔐 Аутентифікація

### NextAuth.js 4.x
- **Providers:**
  - Credentials (admin login)
- **Session:** JWT tokens
- **Захист:** Admin routes protection

### Custom Admin Auth
- **Cookie-based sessions**
- **Password hashing:** bcrypt (рекомендовано)
- **Rate limiting:** на login endpoint

---

## 🌍 Інтернаціоналізація (i18n)

### next-intl 4.1.0
- **Мови:** 
  - `ua` — Українська (основна)
  - `en` — English
- **Routing:** `/ua/...`, `/en/...`
- **Default:** `ua` (redirect з `/`)

### Структура перекладів
```
messages/
├── en.json     — англійські переклади
└── ua.json     — українські переклади
```

### Особливості
- Server Components підтримка
- Type-safe translations
- Plural forms
- Date/Number formatting

---

## 📧 Email та Комунікації

### Resend
- **Тип:** Email API сервіс
- **Бібліотека:** `resend` npm package
- **Використання:**
  - Відправка заявок клієнтів
  - Відповіді на повідомлення
  - Transactional emails

### React Email
- **Тип:** Email templates як React компоненти
- **Розташування:** `src/components/emails/`
- **Переваги:**
  - Type-safe templates
  - Preview в dev
  - Responsive emails

---

## 🤖 Telegram Інтеграція

### Grammy 1.x
- **Тип:** Telegram Bot framework
- **Файл:** `src/lib/telegram.ts`

### Функціонал бота
- **Отримання заявок** — форвард в чати
- **Webhook** — real-time повідомлення
- **Команди:**
  - `/start` — привітання
  - `/dashboard` — статистика
- **Mini App** — `src/app/telegram-app/`

### Чати
- `TELEGRAM_AUTO_CHAT_ID` — авто заявки
- `TELEGRAM_MOTO_CHAT_ID` — мото заявки

---

## 📊 Аналітика

### Google Analytics 4
- **ID:** `G-1CQVYW3WK7`
- **Компонент:** `src/components/analytics/GoogleAnalytics.tsx`
- **Events:** page_view, form_submit, click

### Microsoft Clarity
- **ID:** `uyw0rumkiv`
- **Компонент:** `src/components/analytics/MicrosoftClarity.tsx`
- **Функції:**
  - Session recordings
  - Heatmaps
  - User journey

### Vercel Analytics
- **Пакет:** `@vercel/analytics`
- **Функції:**
  - Web Vitals
  - Page views
  - Unique visitors

### Meta Pixel (опціонально)
- **Компонент:** `src/components/analytics/MetaPixel.tsx`
- **Events:** PageView, Lead, Contact

---

## 🔍 SEO Оптимізація

### Meta Tags
```tsx
// src/app/[locale]/metadata.ts
export const metadata: Metadata = {
  title: "OneCompany — Premium Auto & Moto Tuning",
  description: "Official distributor 200+ premium brands...",
  keywords: ["Akrapovic", "Brabus", "Mansory", ...],
  openGraph: { ... },
  twitter: { ... },
}
```

### Structured Data (JSON-LD)
- **Organization** — інформація про компанію
- **WebSite** — пошук по сайту
- **LocalBusiness** — локальний бізнес
- **Product** — товари
- **BreadcrumbList** — хлібні крихти

### Sitemap
- **Файл:** `/sitemap.xml`
- **Генерація:** Динамічна (Next.js)
- **Включає:**
  - Всі сторінки
  - Всі бренди
  - Всі категорії
  - Hreflang для мов

### Robots.txt
- **Файл:** `/robots.txt`
- **Дозволено:** Всі боти
- **Заборонено:** `/admin`, `/api`

### IndexNow
- **Ключ:** `33907e2840024e78ab4a123cd59a0a13`
- **Файл:** `/33907e2840024e78ab4a123cd59a0a13.txt`
- **Підтримка:** Bing, Yandex миттєва індексація

### Canonical URLs
- Автоматичні canonical теги
- Hreflang для мультимовності

---

## 🖼️ Медіа та Зображення

### Next.js Image Optimization
- **Компонент:** `next/image`
- **Функції:**
  - Automatic WebP/AVIF
  - Lazy loading
  - Blur placeholder
  - Responsive sizes

### Sharp
- **Використання:** Server-side image processing
- **Функції:**
  - Resize
  - Format conversion
  - Quality optimization

### Формати
- **Logos:** SVG, PNG, WebP
- **Photos:** WebP, JPEG
- **Videos:** MP4 (H.264)

### Структура медіа
```
public/
├── images/          — статичні зображення
├── logos/           — логотипи брендів (200+)
├── videos/          — hero відео
├── branding/        — брендинг матеріали
└── models/          — 3D моделі (GLTF)
```

---

## 🚀 DevOps та Деплой

### Vercel
- **Тип:** Hosting platform
- **Features:**
  - Edge Functions
  - Serverless Functions
  - CDN (global)
  - Preview deployments
  - Analytics

### GitHub
- **Repository:** Private
- **CI/CD:** GitHub → Vercel auto-deploy
- **Branches:**
  - `master` — production
  - `preview` — staging

### Docker
- **Dockerfile:** Для локального dev
- **Base:** Node 20 Alpine
- **Multi-stage:** Build optimization

### Environment Variables
```env
# Core
DATABASE_URL=
NEXT_PUBLIC_SITE_URL=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Email
RESEND_API_KEY=

# Analytics
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_CLARITY_ID=

# Admin
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

---

## 🛡️ Безпека

### Input Sanitization
- **DOMPurify** — XSS protection
- **Zod** — schema validation

### Rate Limiting
- Custom implementation
- Per-IP limits
- Endpoint-specific limits

### Headers
```ts
// next.config.ts
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
]
```

### CORS
- Restricted to own domain
- API routes protected

### Content Security Policy
- Scripts: self + analytics
- Styles: self + inline
- Images: self + CDN

---

## 🧰 Утиліти

### Lodash
- **Функції:** debounce, throttle, merge

### Date-fns
- **Функції:** Date formatting, parsing

### clsx + tailwind-merge
- **Функції:** Conditional class names

### uuid
- **Функції:** Unique ID generation

### Zustand
- **Тип:** State management
- **Stores:** UI state, filters

---

## 📈 Порівняння з Конкурентами

| Параметр | OneCompany | Atomic-Shop | Autotuning |
|----------|------------|-------------|------------|
| **Framework** | Next.js 16 | WordPress | OpenCart |
| **Rendering** | SSR/SSG | PHP | PHP |
| **Mobile** | Responsive | Responsive | Adaptive |
| **3D** | ✅ Three.js | ❌ | ❌ |
| **Animations** | ✅ GSAP + Framer | ❌ jQuery | ❌ |
| **PWA** | ✅ | ❌ | ❌ |
| **Core Web Vitals** | 90+ | 60-70 | 50-60 |
| **SEO Keywords** | 500+ | ~50 | ~30 |
| **Structured Data** | ✅ 5 types | ❌ | Basic |
| **i18n** | ✅ 2 мови | ❌ | ❌ |
| **Analytics** | 3 сервіси | 1 | 1 |
| **SSL** | ✅ A+ | ✅ | ✅ |
| **CDN** | Vercel Edge | Cloudflare | ❌ |
| **Telegram Bot** | ✅ | ❌ | ❌ |

---

## 📦 Повний список NPM залежностей

### Production Dependencies
```json
{
  "next": "16.0.7",
  "react": "19.0.0",
  "react-dom": "19.0.0",
  "@prisma/client": "6.19.0",
  "next-intl": "4.1.0",
  "next-auth": "4.x",
  "framer-motion": "12.9.4",
  "@react-three/fiber": "9.1.2",
  "@react-three/drei": "10.0.6",
  "three": "0.175.0",
  "gsap": "3.12.7",
  "tailwindcss": "3.4.17",
  "resend": "latest",
  "@vercel/analytics": "latest",
  "grammy": "1.x",
  "zod": "latest",
  "lucide-react": "latest"
}
```

### Dev Dependencies
```json
{
  "typescript": "5.x",
  "prisma": "6.19.0",
  "@types/node": "latest",
  "@types/react": "latest",
  "eslint": "latest",
  "eslint-config-next": "latest",
  "postcss": "latest",
  "autoprefixer": "latest"
}
```

---

## 🎯 Архітектурні Рішення

### Чому Next.js?
- Server Components = менше JS на клієнті
- Вбудована оптимізація зображень
- API Routes без окремого backend
- Vercel = zero-config deploy

### Чому Tailwind?
- Швидка розробка
- Маленький CSS bundle (purge)
- Consistency across components
- Dark mode з коробки

### Чому Prisma?
- Type-safe database queries
- Auto-generated types
- Easy migrations
- Works with Vercel Postgres

### Чому Framer Motion + GSAP?
- Framer: простий API для React
- GSAP: складні timeline анімації
- Разом: повна свобода

---

## 📞 Контакти розробки

- **Репозиторій:** GitHub (private)
- **Production:** https://onecompany.global
- **Admin Panel:** https://onecompany.global/admin

---

*Останнє оновлення: Січень 2026*
