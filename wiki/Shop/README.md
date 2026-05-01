# Shop

Нотатки по архітектурі та фічах магазину. Код магазину живе в `src/data/shop/`
(дані по брендах) + `src/app/shop/` (сторінки) + `prisma/` (БД-моделі).

## Бренди в роботі
- Brabus
- RaceChip
- do88
- Öhlins
- CSF
- Urban

## Що сюди писати
- Архітектурні рішення (наприклад, чому ShopProduct, а не Product).
- Спільні патерни (cascade-фільтри Brand → Model → Кузов і т.д.).
- Фічі, що зачіпають кілька брендів одразу.

## Що сюди **не** писати
- Деталі скрейпінгу окремого бренду — то в [[Brands/README|Brands]].
- Bug fix recipes — то в коді / commit message.

## Пов'язане
- [[../Index|Index]]
- [[../Brands/README|Brands]]
