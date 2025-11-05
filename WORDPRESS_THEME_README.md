# OneCompany Premium EPIC Theme - WordPress

## Огляд

Преміум WordPress тема з передовими GSAP анімаціями, відео фонами, частинками та ефектами спотлайту. Повна міграція з Next.js на WordPress з усіма функціями Shopify liquid template.

## ✨ Основні функції

### 🎨 Візуальні ефекти
- **Liquid Glass Design** - прозоре розмите скло з backdrop-filter
- **Ken Burns Effect** - відео масштабується 1.1 → 1.0 протягом 10 секунд
- **Spotlight Effect** - радіальний градієнт слідує за курсором
- **Particle System** - canvas з 40 інтерактивними частинками
- **Custom Cursor** - крапка 20px + кільце 50px + 8 частинок що слідують
- **Magnetic Effect** - кнопки та посилання реагують на курсор
- **Grain Texture** - анімований SVG фільтр шуму

### 🚀 GSAP Анімації
- **Fullpage Scroll** (desktop) - Observer API для повноекранного скролу
- **Native Scroll** (mobile) - ScrollTrigger для мобільних пристроїв
- **Counter Animation** - анімовані лічильники статистики
- **Clip-path Reveals** - текст з'являється через clip-path
- **Elastic Divider** - ease: 'elastic.out(1, 0.5)'
- **Parallax Effects** - контент слідує за мишею з демпфуванням

### 📦 Gutenberg Blocks
- **Hero Block** - повна Hero секція з редагуванням
- **Brand Slide Block** - слайди брендів для drag-and-drop

### ⚙️ Theme Customizer
- **Hero Section** - label, title (2 lines), subtitle, video URL
- **Stats Section** - 3 статистики з числами та підписами
- **Theme Colors** - accent color picker
- **Social Media** - Instagram, Facebook, YouTube, телефон
- **Contact Info** - email, адреса, опис футера

## 📋 Встановлення

### 1. Docker Environment

```bash
cd d:\Onecompany\onecompany-3d
docker compose -f docker-compose.wordpress.yml up -d
```

**URLs:**
- WordPress: http://localhost:8080
- phpMyAdmin: http://localhost:8081
- Credentials: root / example

### 2. WordPress Setup

1. Відкрийте http://localhost:8080
2. Заповніть форму встановлення:
   - Site Title: OneCompany
   - Username: admin
   - Password: (ваш пароль)
   - Email: your@email.com
3. Увійдіть в адмін панель

### 3. Активація теми

1. Appearance → Themes
2. Activate "OneCompany Premium EPIC"
3. Theme активовано ✅

## 🎯 Використання

### Theme Customizer

1. **Appearance → Customize**
2. Ви побачите 5 нових секцій:
   - **Hero Section** - редагуйте головний екран
   - **Stats Section** - змініть статистику
   - **Theme Colors** - оберіть колір акценту
   - **Social Media** - додайте соціальні мережі
   - **Contact Info** - контактна інформація

3. Натисніть **Publish** для збереження змін

### Створення сторінки

1. **Pages → Add New**
2. Назва: "Home"
3. Template: Select **"One Page EPIC Template"**
4. Publish

### Додавання брендів (Custom Post Type)

1. **Бренди → Додати новий**
2. Заповніть поля:
   - **Назва**: KW Suspension
   - **Підзаголовок**: Premium Suspension Systems
   - **URL відео**: `/wp-content/uploads/kw-suspension.mp4`
   - **Колір бренду**: #ff6b00
   - **Особливості**: Преміум якість, Гарантія, Доставка
3. Publish

### Використання Gutenberg Blocks

1. **Pages → Add New** або Edit existing page
2. Клік **+** для додавання блоку
3. Пошук "OneCompany" - ви побачите:
   - **Hero Section** - головний екран
   - **Brand Slide** - слайд бренду
4. Drag & Drop блоки як потрібно
5. Редагуйте через правий sidebar (Inspector)
6. Publish

## 📂 Структура файлів

```
wp-content/themes/onecompany-theme/
├── style.css                 # Main theme stylesheet (epic effects)
├── functions.php             # Theme setup, CPT, Customizer, Blocks
├── page-onepage.php          # One Page EPIC Template
├── header.php                # Theme header
├── footer.php                # Theme footer
├── index.php                 # Default template
├── js/
│   └── main.js               # GSAP animations, particles, cursor
├── blocks/
│   ├── hero-block/
│   │   ├── block.json        # Hero block metadata
│   │   ├── index.js          # Hero block entry
│   │   ├── edit.js           # Hero block editor
│   │   ├── save.js           # Hero block save
│   │   ├── editor.js         # Compiled editor script ✅
│   │   └── editor.css        # Editor styles
│   └── brand-slide/
│       ├── block.json        # Brand slide metadata
│       ├── index.js          # Brand slide entry
│       ├── edit.js           # Brand slide editor
│       ├── save.js           # Brand slide save
│       ├── editor.js         # Compiled editor script ✅
│       └── editor.css        # Editor styles
├── package.json              # npm dependencies
└── webpack.config.js         # Webpack configuration
```

## 🔧 Розробка

### Редагування блоків

```bash
cd wp-content/themes/onecompany-theme
npm run start    # Development mode with watch
```

### Збірка блоків

```bash
cd wp-content/themes/onecompany-theme
npm run build    # Production build ✅
```

### Перезапуск WordPress

```bash
cd d:\Onecompany\onecompany-3d
docker compose -f docker-compose.wordpress.yml restart wordpress
```

## 🎨 Customizer Settings (API)

### Hero Section
- `hero_label` - верхній label
- `hero_title_1` - перша лінія заголовку
- `hero_title_2` - друга лінія заголовку
- `hero_subtitle` - підзаголовок
- `hero_video` - URL відео

### Stats Section
- `stat1_number`, `stat1_label` - перша статистика
- `stat2_number`, `stat2_label` - друга статистика
- `stat3_number`, `stat3_label` - третя статистика

### Colors
- `accent_color` - акцентний колір (за замовчуванням #ff6b00)

### Social Media
- `instagram_url` - Instagram профіль
- `facebook_url` - Facebook сторінка
- `youtube_url` - YouTube канал
- `phone_number` - номер телефону

### Contact Info
- `contact_email` - email
- `contact_address` - адреса
- `footer_text` - опис у футері

## 🎬 GSAP Features

### Desktop (fullpage scroll)
- Observer API для повноекранного скролу
- Навігаційні точки з анімацією
- Progress bar синхронізований зі скролом
- Slide counter (01 / 04)
- Ken Burns effect на відео

### Mobile (native scroll)
- ScrollTrigger для плавної прокрутки
- Всі анімації адаптовані
- Responsive breakpoint: 1024px

### Particles System
- Canvas 40 частинок
- 10% accent color, 90% white
- Інтерактивність з мишею
- Анімація 60fps

### Custom Cursor
- Dot 20px + Ring 50px
- 8 trailing particles
- Magnetic effect на `.premium-btn`, `a`, `button`
- Tooltip при hover

## 🐛 Troubleshooting

### Customizer налаштування не відображаються
```bash
docker compose -f docker-compose.wordpress.yml restart wordpress
```
Оновіть сторінку в браузері після рестарту.

### Блоки не з'являються в редакторі
1. Перевірте: `npm run build` виконано ✅
2. Перевірте файли: `blocks/*/editor.js` створені ✅
3. Рестарт WordPress контейнера

### GSAP анімації не працюють
1. Перевірте консоль браузера на помилки
2. Переконайтесь що GSAP CDN доступні
3. Перевірте `functions.php` - `onecompany_enqueue_assets()`

## 📊 Status

✅ WordPress Docker running (localhost:8080)  
✅ Theme activated "OneCompany Premium EPIC"  
✅ Custom post type 'brand' registered  
✅ GSAP libraries enqueued (4 plugins)  
✅ Epic CSS with all Shopify effects  
✅ Epic JavaScript with particles, cursor, Ken Burns  
✅ Theme Customizer API (5 sections, 20+ settings)  
✅ Gutenberg blocks created (Hero, Brand Slide)  
✅ Blocks compiled (npm run build)  
⏳ Test page creation pending  
⏳ Brand posts creation pending  
⏳ Video uploads pending  

## 🚀 Next Steps

1. **Customizer**: Відкрийте Appearance → Customize, перевірте 5 секцій
2. **Blocks**: Створіть нову сторінку, додайте Hero Block та Brand Slide
3. **Brands**: Додайте бренди KW, Fi, Eventuri через Бренди → Додати новий
4. **Videos**: Завантажте відео у `/wp-content/uploads/`
5. **Test**: Створіть тестову сторінку з шаблоном "One Page EPIC Template"

## 💡 Tips

- **Відео оптимізація**: Використовуйте .mp4 H.264, макс 1920x1080
- **Performance**: Preload відео для швидшої загрузки
- **Mobile**: Всі ефекти адаптовані для мобільних
- **Colors**: Змініть accent color в Customizer для іншої палітри
- **Blocks**: Drag & drop блоки для гнучкого layout

## 📞 Підтримка

Якщо виникли питання:
1. Перевірте консоль браузера (F12)
2. Перевірте logs: `docker logs onecompany-wordpress`
3. Рестарт контейнера: `docker compose restart wordpress`

---

**Made with ❤️ for OneCompany**  
**Version:** 2.0.0 EPIC  
**Last Updated:** 2025
