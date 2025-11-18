# Оновлення головної сторінки - Мінімалістичний преміум дизайн

## Дата оновлення
16 листопада 2025

## Концепція
Повністю переробили головну сторінку у мінімалістичному преміум стилі з фокусом на:
- Повноекранне відео на весь viewport
- Чистий, витончений текст
- Елегантні анімації
- Максимум простору, мінімум елементів
- Фокус на якості та ексклюзивності

## Основні зміни

### 1. Структура сторінки (`src/app/[locale]/page.tsx`)
**Було:** Багато секцій з різним контентом, блоки послуг, бренди, CTA секції
**Стало:** Одна повноекранна секція з мінімалістичним контентом

**Нові елементи:**
- Великий логотип "onecompany" як центральний елемент
- Підпис "Консьєрж Сервіс"
- Напрям послуг "hypercar & moto"
- Мінімальна інформація про заснування
- Один CTA - "забронювати консультацію"
- Нижній рядок зі статистикою (200+ brands, 18 years, 4 continents)

### 2. Новий компонент (`src/components/home/MinimalistHero.tsx`)
Створено новий client-side компонент з GSAP анімаціями:
- Послідовна поява елементів з ефектом blur
- Плавна анімація divider
- Hover ефекти на CTA кнопці
- Використання framer-motion та gsap для преміальних переходів

### 3. Оновлення контенту (`public/config/site-content.json`)
**Змінено hero секцію:**
```json
{
  "badge": "onecompany",
  "title": "Concierge Service",
  "subtitle": "Curated excellence for discerning collectors.",
  "ctaAutoLabel": "Hypercar",
  "ctaMotoLabel": "Superbike",
  "globalPresence": "kyiv, ukraine · since 2007"
}
```

### 4. Покращення Layout (`src/app/[locale]/layout.tsx`)
**Оновлено оверлеї для більш витонченого вигляду:**
- Зменшено opacity головного градієнту (70% → 30% → 70%)
- Зменшено інтенсивність accent градієнту (28% → 12%)
- Збільшено радіус розмиття для м'якшого переходу

### 5. Виправлення відео конфігурації (`public/config/video-config.json`)
**Було:** `"heroVideo": "public/videos/Luxury_Automotive_Abstract_Video_Creation.mp4"`
**Стало:** `"heroVideo": "Luxury_Automotive_Abstract_Video_Creation.mp4"`
(Видалено зайвий префікс `public/videos/` оскільки він додається в компоненті)

## Технічні деталі

### Типографіка
- Головний заголовок: `clamp(3rem, 8vw, 7rem)` - адаптивний розмір
- Tracking (letter-spacing): `0.25em` для логотипу, `0.5em` для tagline
- Font-weight: `extralight` (200) для головного тексту
- Uppercase для всіх текстових елементів

### Колірна схема
- Текст: `white` з різними рівнями opacity
  - Головний: `text-white` (100%)
  - Tagline: `text-white/60` (60%)
  - Services: `text-white/90` (90%)
  - Established: `text-white/50` (50%)
  - Stats: `text-white/40` (40%)

### Анімації
1. **Fade in з blur:**
   - Opacity: 0 → 1
   - Y position: 60px → 0
   - Blur: 20px → 0
   - Duration: 1.2s

2. **Divider:**
   - ScaleX: 0 → 1
   - Duration: 0.8s

3. **Stagger анімація:**
   - Поетапна поява елементів знизу вверх
   - Delay між елементами: 0.1-0.2s

### Hover ефекти
- CTA кнопка:
  - Border opacity: 30% → 60%
  - Background: transparent → white/5%
  - Arrow translate: 0 → 1px
  - Duration: 500ms

## Що видалено
- Секція "Iconic marques" з списком брендів
- Секція "Signature programs" з детальним описом
- Секція "Programs engineered for collectors"
- Блок ателье послуг
- Нижня CTA секція з телефоном

## Що збережено
- Повноекранне відео з `FullScreenVideo` компонентом
- Header з навігацією
- Footer з контактною інформацією
- SEO метадані та structured data
- Локалізація (українська та англійська)

## Наступні кроки (опціонально)

### Додаткові покращення:
1. Додати parallax ефект для відео при скролі
2. Додати mouse follow ефект для gradient accent
3. Створити окрему сторінку з повним переліком брендів
4. Додати секцію галереї робіт (портфоліо)
5. Інтегрувати плавний перехід між сторінками

### Оптимізація:
1. Додати lazy loading для відео
2. Створити thumbnail для швидшого завантаження
3. Оптимізувати анімації для мобільних пристроїв
4. Додати preload для критичних ресурсів

## Тестування
Перед запуском перевірте:
- [ ] Відео відтворюється коректно
- [ ] Анімації працюють плавно
- [ ] Адаптивність на різних екранах
- [ ] Локалізація працює (українська/англійська)
- [ ] CTA кнопка веде на сторінку контактів
- [ ] SEO метадані оновлені
- [ ] Accessibility (screen readers, keyboard navigation)

## Команди для запуску
```bash
# Розробка
npm run dev

# Білд
npm run build

# Запуск продакшн версії
npm start
```

## Браузерна підтримка
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Залежності
- Next.js 16
- React 19
- Framer Motion
- GSAP
- Tailwind CSS
