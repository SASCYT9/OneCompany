---
tags: [marketing, seo, content]
aliases: [SEO, Контент-маркетинг]
---

# 🔍 SEO Content Strategy

> [!info] Органічний трафік через блог, product pages, та keyword targeting
> Частота: **4-8 статей/місяць**

---

## 🎯 SEO Goals

1. **Transactional keywords** — "купити racechip", "do88 інтеркулер ціна"
2. **Informational keywords** — "чіп тюнінг переваги", "як працює інтеркулер"
3. **Brand keywords** — "racechip відгуки", "akrapovic ukraine"
4. **Long-tail fitment** — "racechip bmw 320d f30", "do88 intercooler n54"

---

## 📊 Keyword Clusters

### Cluster 1: Chip Tuning (RaceChip / Burger)
| Keyword | Volume | Difficulty | Intent |
|---|---|---|---|
| чіп тюнінг | High | Medium | Info |
| racechip відгуки | Medium | Low | Commercial |
| racechip bmw ціна | Medium | Low | Transactional |
| chip tuning що це | Medium | Low | Info |
| racechip vs dtuk | Low | Low | Comparison |
| чіп тюнінг гарантія | Low | Low | Info |

**Контент-план:**
- [ ] "Повний гід по чіп-тюнінгу: що це, як працює, чи безпечно" (pillar)
- [ ] "RaceChip — огляд всіх моделей (GTS, XLR, Ultimate)" 
- [ ] "RaceChip для BMW: повна таблиця сумісності"
- [ ] "Чіп-тюнінг і гарантія — що потрібно знати"
- [ ] "RaceChip vs Stage 1 ECU remap — порівняння"

### Cluster 2: Cooling (DO88)
| Keyword | Volume | Difficulty | Intent |
|---|---|---|---|
| інтеркулер | Medium | Medium | Info |
| do88 intercooler | Medium | Low | Brand |
| інтеркулер bmw | Medium | Medium | Commercial |
| зачем нужен інтеркулер | Low | Low | Info |

**Контент-план:**
- [ ] "Що таке інтеркулер і чому він важливий" (pillar)
- [ ] "DO88 vs Wagner vs Forge — порівняння інтеркулерів"
- [ ] "Як обрати інтеркулер для BMW: повний гід"
- [ ] "Ознаки що ваш інтеркулер потребує заміни"

### Cluster 3: Exhaust (Akrapovic)
| Keyword | Volume | Difficulty | Intent |
|---|---|---|---|
| akrapovic купити | Medium | Medium | Transaction |
| akrapovic ukraine | Medium | Low | Local |
| вихлопна система тюнінг | Medium | Medium | Info |
| cat-back vs downpipe | Low | Low | Info |

**Контент-план:**
- [ ] "Akrapovic в Україні: повний каталог та ціни"
- [ ] "Cat-back vs Downpipe vs Full system — що обрати?"
- [ ] "Звук Akrapovic: чому він коштує своїх грошей"
- [ ] "Titanium vs Stainless Steel exhaust — порівняння"

### Cluster 4: Intake (Eventuri)
**Контент-план:**
- [ ] "Carbon fiber intake — чому Eventuri найкращий?"
- [ ] "Cold Air Intake vs Stock — реальна різниця"
- [ ] "Eventuri: технологія та інженерія за впуском"

### Cluster 5: Premium Tuning (Urban / Brabus)
**Контент-план:**
- [ ] "Urban Automotive Defender Widetrack — повний огляд"
- [ ] "Brabus тюнінг Mercedes: модельний ряд 2026"
- [ ] "Преміум тюнінг: чому варто купувати quality over quantity"

---

## 📝 Типи Статей

### 1. Pillar Content (2000+ слів)
Основні тематичні статті, які ранкують на head terms
- "Повний гід по чіп-тюнінгу"
- "Все про інтеркулери"
- "Гід по вихлопним системам"

### 2. Product Reviews (1000-1500 слів)
Детальні огляди конкретних продуктів
- SEO title: "[Product] — Огляд, ціна, встановлення | One Company"
- Структура: Intro → Specs → Install → Results → Verdict → Buy

### 3. Comparison Articles (1500 слів)
"X vs Y" — дуже шукані, легко ранкують
- "RaceChip GTS vs XLR — яка різниця?"
- "DO88 vs Wagner intercooler для BMW"

### 4. Fitment Guides (500-1000 слів)
Таблиці сумісності per бренд/модель
- "RaceChip для BMW — всі сумісні моделі"
- "DO88 каталог по автомобілях"

### 5. How-To / Install Guides (1000 слів + фото)
- "Як встановити RaceChip — покрокова інструкція"
- "DO88 Intercooler install BMW M3 G80"

---

## 🏗 Technical SEO (вже зроблено)

- ✅ Sitemap для `/shop` та колекцій
- ✅ JSON-LD Product structured data
- ✅ OG / Twitter metadata на product pages
- ✅ Google Merchant Center XML Feed
- ✅ `generateMetadata` через `getShopProductPageMetadata`
- ✅ `noindex` на private routes (cart, checkout, admin)

### Що ще потрібно для блога
- [ ] Blog section: `/blog/[slug]`
- [ ] Blog sitemap integration
- [ ] Blog JSON-LD (Article schema)
- [ ] Internal linking strategy (blog ↔ product pages)
- [ ] Image alt text optimization
- [ ] FAQ schema на product pages

---

## 🔗 Internal Linking Strategy

```
Pillar Article (чіп-тюнінг гід)
  ├── links to → Product page (RaceChip GTS)
  ├── links to → Comparison (GTS vs XLR)  
  ├── links to → Install guide (RaceChip)
  └── links to → Brand page (Burger collection)

Product Page (RaceChip GTS)
  ├── links to → Pillar article
  ├── links to → Related products
  └── links to → Fitment guide
```

---

## 📊 KPIs

| Метрика | Ціль Q2 | Ціль Q4 |
|---|---|---|
| Organic visits/місяць | 5K | 20K |
| Keywords in Top 10 | 50 | 200 |
| Blog articles total | 20 | 60 |
| Featured snippets | 5 | 20 |
| Avg time on page | 3+ min | 4+ min |

---

## Зв'язки

- Technical SEO → [[Phase F — SEO]]
- Product data → [[Phase B — Catalog]]
- Загальна стратегія → [[Marketing Strategy]]
- Блог → [[Site Pages]]

← [[Home]]
