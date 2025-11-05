# OneCompany Premium EPIC Theme

**Version:** 2.0.0  
**Author:** OneCompany  
**Description:** Ultimate premium automotive theme with GSAP animations, Liquid Glass effects, and React-based Gutenberg blocks

---

## 🚀 Features

### ✨ Advanced Animations
- **GSAP 3.12.5** integration with ScrollTrigger, ScrollToPlugin, and Observer
- **Particle System** with canvas-based animations
- **Ken Burns Effect** for video backgrounds
- **Spotlight Effect** following mouse cursor
- **Custom Cursor** with magnetic interactions
- **Full-page Scroll** system (desktop) with smooth transitions

### 💎 Liquid Glass Framework
- Premium "liquid glass" effect (`backdrop-filter`, gradients, shadows)
- Ready-to-use CSS classes for cards, buttons, panels, and forms
- Responsive design with mobile optimizations
- Interactive hover effects with radial gradients

### 🧩 Gutenberg Blocks
1. **Hero Block** — преміальна Hero-секція з відео фоном
2. **Brand Slide Block** — слайд для демонстрації бренду
3. **Brand Grid Block** — динамічна сітка брендів з фільтрацією
4. **Contact Form Block** — контактна форма з ефектом Liquid Glass
5. **Gallery Block** — галерея зображень з лайтбоксом

### 📦 Custom Post Types & Taxonomies
- **Brand** CPT з метаполями (підзаголовок, відео, колір, особливості)
- **Brand Category** taxonomy для фільтрації брендів

### 🎨 Theme Customizer
- **Hero Section** — текст, відео, стилі
- **Stats Section** — три блоки зі статистикою
- **Colors** — акцентний колір теми
- **Social Media** — посилання на соцмережі та телефон
- **Contact Info** — email, адреса, текст футера

---

## 📋 Installation

1. **Завантажте тему** до `/wp-content/themes/onecompany-theme`
2. **Активуйте тему** в адмін-панелі WordPress: `Appearance > Themes`
3. **Збудуйте Gutenberg-блоки**:
   ```bash
   cd wp-content/themes/onecompany-theme
   npm install
   npm run build
   ```
4. **Перезавантажте permalinks**: `Settings > Permalinks > Save Changes`

---

## 🎯 Quick Start

### Створення брендів

1. Перейдіть до **Бренди > Додати новий**
2. Заповніть:
   - **Назву** бренду (наприклад, "KW")
   - **Зміст** — опис бренду
   - **Зображення запису** — головне зображення (обов'язково!)
3. У блоці **Деталі бренду** вкажіть:
   - Підзаголовок
   - URL відео (наприклад, `/wp-content/uploads/kw.mp4`)
   - Колір бренду (hex)
   - Особливості (через кому)
4. Виберіть **Категорію Бренду** (праворуч)

### Налаштування Customizer

1. Перейдіть до **Appearance > Customize**
2. Відкрийте розділи:
   - **Hero Section** — змініть текст та відео головної секції
   - **Stats Section** — вкажіть статистику (кількість проектів, роки досвіду тощо)
   - **Theme Colors** — оберіть акцентний колір
   - **Social Media** — додайте посилання на Instagram, Facebook, YouTube
   - **Contact Info** — вкажіть email та адресу

### Використання Gutenberg-блоків

1. Створіть нову **Сторінку** або **Запис**
2. Натисніть **+** (Add Block)
3. Знайдіть категорію **OneCompany Blocks**
4. Оберіть потрібний блок:
   - **Hero Section** — для головного екрану
   - **Brand Slide** — для слайду з брендом
   - **Сітка Брендів** — для виведення всіх або вибраних брендів
   - **Контактна Форма** — для форми зв'язку
   - **Liquid Gallery** — для галереї зображень

---

## 🖌️ CSS Framework Usage

### Liquid Glass Classes

```html
<!-- Liquid Card -->
<div class="liquid-card">
    <h3>Заголовок</h3>
    <p>Текст картки з ефектом рідкого скла</p>
</div>

<!-- Liquid Button -->
<button class="liquid-btn">Click Me</button>

<!-- Liquid Input -->
<input type="text" class="liquid-input" placeholder="Your text">

<!-- Liquid Panel -->
<div class="liquid-panel">
    <p>Контент панелі</p>
</div>

<!-- Liquid Badge -->
<span class="liquid-badge">NEW</span>

<!-- Liquid Divider -->
<div class="liquid-divider"></div>
```

### Варіанти

```html
<!-- Dark Glass -->
<div class="liquid-glass liquid-glass--dark">...</div>

<!-- Light Glass -->
<div class="liquid-glass liquid-glass--light">...</div>

<!-- Accent Glass -->
<div class="liquid-glass liquid-glass--accent">...</div>
```

---

## 🛠️ Development

### File Structure

```
onecompany-theme/
├── blocks/                     # Gutenberg blocks
│   ├── hero-block/
│   ├── brand-slide/
│   ├── brand-grid-block/
│   ├── contact-form-block/
│   └── gallery-block/
├── css/                        # Additional stylesheets
│   ├── liquid-glass.css       # Liquid Glass Framework
│   ├── contact-form.css       # Contact form styles
│   └── gallery.css            # Gallery styles
├── js/                         # JavaScript files
│   └── main.js                # Main theme logic (GSAP, particles, etc.)
├── functions.php               # Theme logic and hooks
├── style.css                   # Main stylesheet
├── page-onepage.php            # One-page template
├── archive-brand.php           # Brands archive template
├── single-brand.php            # Single brand template
├── header.php                  # Header template
├── footer.php                  # Footer template
├── package.json                # npm dependencies
└── webpack.config.js           # Webpack configuration
```

### Build Commands

```bash
# Встановити залежності
npm install

# Зібрати блоки (production)
npm run build

# Зібрати блоки (development з watch mode)
npm run start
```

---

## 📐 Page Templates

### One-Page Template
Застосуйте шаблон **One Page** до сторінки для отримання повноекранних секцій зі слайдами.

1. Створіть нову сторінку
2. У **Page Attributes** оберіть **Template: One Page**
3. Контент сторінки буде відображатися після головної Hero-секції

### Archive Brands
Сторінка `/brands` автоматично виводить усі бренди у вигляді сітки з фільтрами за категоріями.

### Single Brand
Сторінка окремого бренду з Hero-секцією, описом, особливостями та можливістю додати галерею.

---

## 🎨 Color Customization

### Зміна акцентного кольору

1. **Через Customizer**: `Appearance > Customize > Theme Colors > Accent Color`
2. **Через CSS**: змініть змінну `--accent` у `style.css`
   ```css
   :root {
       --accent: #ff6b00; /* Ваш колір */
       --accent-rgb: 255, 107, 0; /* RGB-значення */
   }
   ```

### Кольори брендів

Кожен бренд може мати свій власний колір. Вкажіть його в мета-полі **Колір бренду** при редагуванні бренду.

---

## 🚧 Troubleshooting

### Блоки не відображаються в редакторі
1. Переконайтеся, що ви виконали `npm install` та `npm run build`
2. Очистіть кеш браузера
3. Перевірте консоль браузера на наявність помилок

### Відео не відтворюється
1. Переконайтеся, що файл відео завантажений у медіа-бібліотеку
2. Використовуйте формат `.mp4` для максимальної сумісності
3. Вкажіть повний URL до файлу (наприклад, `/wp-content/uploads/2024/01/video.mp4`)

### Isotope (фільтри) не працюють
1. Перевірте, що бібліотека Isotope завантажена (має бути підключена через `functions.php`)
2. Переконайтеся, що у брендів призначені категорії

---

## 📞 Support

Для підтримки або питань зв'яжіться з командою OneCompany.

---

## 📄 License

This theme is licensed for OneCompany projects only.

---

## 🎉 Credits

- **GSAP** — GreenSock Animation Platform
- **Isotope** — Magical layouts
- **WordPress** — Content Management System
- **Inter Font** — Google Fonts

---

**Enjoy creating premium automotive experiences! 🚗✨**
