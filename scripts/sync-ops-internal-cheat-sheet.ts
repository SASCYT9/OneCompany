import { OpsKnowledgeStatus } from "@prisma/client";
import { config as loadEnv } from "dotenv";

import { OPS_FORGED_WHEEL_SHIPPING_ESTIMATES } from "../src/data/operations/shipping-guides";

const envFile = process.env.OPS_DATABASE_ENV_FILE?.trim();
if (envFile) loadEnv({ path: envFile });
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.onecompany_DATABASE_URL ??
    process.env.onecompany_PRISMA_DATABASE_URL ??
    process.env.onecompany_POSTGRES_URL;
}

type BrandRulePatch = {
  guideKey: string;
  title: string;
  group: string;
  retail?: string;
  wholesale?: string;
  ourCost?: string;
  logistics?: string;
  notes?: string;
};

type ReferenceArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: "prices-and-brands" | "delivery" | "general-processes";
  tags: string[];
  contentMarkdown: string;
};

const brandRulePatches: BrandRulePatch[] = [
  {
    guideKey: "mickey-thompson",
    title: "Mickey Thompson",
    group: "Шины",
    wholesale: "Цена сайта + доставка до склада в Нью-Йорке + доставка в Украину + 10%.",
    notes:
      "Историческое партнёрское правило. Перед расчётом подтвердить цену сайта, наличие, обе доставки и валюту.",
  },
  {
    guideKey: "reifen",
    title: "Reifen",
    group: "Шины",
    wholesale: "Цена сайта + доставка в Medyka + 19% + 10%. Использовать именно 10%, не 15%.",
    notes:
      "Не объединять 19% и 10% в один процент: сначала нужно подтвердить назначение каждого компонента и VAT-режим.",
  },
  {
    guideKey: "tirerack",
    title: "TireRack",
    group: "Шины",
    wholesale:
      "Наша цена + 3% + фиксированные 100 USD на одну консолидированную оплату + доставки + 10%.",
    notes:
      "100 USD относятся ко всей оплате/партии, а не к каждой позиции. Распределять между товарами вручную.",
  },
  {
    guideKey: "brixton-hre",
    title: "Brixton / HRE",
    group: "Диски",
    retail:
      "Наша цена на сайте, не MSRP, + доставка до склада в Нью-Йорке + доставка по весу в Украину + 25%.",
    wholesale: "-10% по согласованной базе цены.",
    notes:
      "Правило в источнике записано для группы Brixton / HRE / Vossen. Базу скидки -10% подтвердить перед расчётом.",
  },
  {
    guideKey: "afe-power",
    title: "aFe Power",
    group: "Фильтры и впуск",
    retail: "Актуальную цену смотреть в Turn14.",
    wholesale: "Наша цена + все доставки + 15%.",
    notes:
      "Правило относится к группе фильтров BMC / K&N / aFe. Проверить, что используется цена нашего аккаунта.",
  },
  {
    guideKey: "dahler",
    title: "Dahler",
    group: "Выхлоп",
    retail: "Цена сайта уже является ориентиром цены для клиента.",
    wholesale: "-15% по согласованной базе.",
    ourCost: "Ориентир: -30% или -35% от нетто.",
    notes:
      "Групповое правило записано рядом с Dahler / Remus / GTHaus / Supersprint. Точную скидку аккаунта подтвердить.",
  },
  {
    guideKey: "remus",
    title: "Remus",
    group: "Выхлоп",
    retail: "Цена сайта уже является ориентиром цены для клиента.",
    wholesale: "-15% по согласованной базе.",
    ourCost: "Ориентир: -30% или -35% от нетто.",
    notes:
      "Групповое правило записано рядом с Dahler / Remus / GTHaus / Supersprint. Точную скидку аккаунта подтвердить.",
  },
  {
    guideKey: "gthaus",
    title: "GTHaus",
    group: "Выхлоп",
    retail: "Цена сайта уже является ориентиром цены для клиента.",
    wholesale: "-15% по согласованной базе.",
    ourCost: "Ориентир: -30% или -35% от нетто.",
    notes:
      "Групповое правило записано рядом с Dahler / Remus / GTHaus / Supersprint. Точную скидку аккаунта подтвердить.",
  },
  {
    guideKey: "girodisc",
    title: "Girodisc",
    group: "Ходовая и тормоза",
    retail:
      "При расчёте через Turn14: цена сайта + доставка до Нью-Йорка + доставка в Украину + 10%.",
    wholesale: "RRP Ex VAT, перевести в USD.",
    ourCost: "RRP Ex VAT - 30%.",
    notes:
      "Групповое правило записано для Girodisc / Paragon / EBC. Проверить применимость к конкретному SKU.",
  },
  {
    guideKey: "paragon-brakes",
    title: "Paragon brakes",
    group: "Ходовая и тормоза",
    retail:
      "При расчёте через Turn14: цена сайта + доставка до Нью-Йорка + доставка в Украину + 10%.",
    wholesale: "RRP Ex VAT, перевести в USD.",
    ourCost: "RRP Ex VAT - 30%.",
    notes:
      "Групповое правило записано для Girodisc / Paragon / EBC. Проверить применимость к конкретному SKU.",
  },
];

const referenceArticles: ReferenceArticle[] = [
  {
    slug: "automotive-terms-for-managers",
    title: "Автомобильные термины для менеджера",
    excerpt:
      "Поисковый словарь деталей, характеристик, ценовых терминов и логистики для ежедневной работы менеджера.",
    category: "general-processes",
    tags: ["onboarding", "glossary", "products", "searchable"],
    contentMarkdown: `# Автомобильные термины для менеджера

Используйте поиск над таблицей. Можно искать русское или английское название, сокращение, синоним либо часть объяснения.

| Термин и синонимы | Простое объяснение | Что уточнить менеджеру |
| --- | --- | --- |
| Радиатор / radiator | Охлаждает жидкость основного контура двигателя | Автомобиль, двигатель, размеры, расположение патрубков |
| Теплообменник / heat exchanger | Передаёт тепло между отдельными контурами; часто используется в водяном охлаждении наддува | Какой именно контур охлаждает и является ли деталь прямой заменой |
| Интеркулер / intercooler | Охлаждает воздух после турбины или компрессора перед двигателем | Тип, размеры ядра, расположение входов и заявленный fitment |
| Масляный радиатор / oil cooler | Снижает температуру масла двигателя или трансмиссии | Контур, адаптеры, термостат, шланги и комплектность |
| Впуск / intake | Система подачи воздуха к двигателю | Полный комплект или отдельная труба/фильтр, двигатель и кузов |
| Cold air intake / CAI | Впуск, рассчитанный на забор более холодного воздуха вне горячей зоны моторного отсека | Расположение фильтра, защита от воды и совместимость |
| Airbox / корпус фильтра | Корпус воздушного фильтра и часть впускной системы | Штатный или тюнинговый, закрытый или открытый |
| Charge pipe / boost pipe | Труба тракта наддува между турбиной, интеркулером и впуском | Какая секция нужна, диаметр, датчики и соединения |
| Turbo inlet / впуск турбины | Труба перед компрессорной частью турбины | Модель турбины, диаметр и совместимость с intake |
| Downpipe / даунпайп | Первая часть выхлопа после турбины | Catless или sport cat, диаметр, привод, кузов и требования по выбросам |
| Midpipe / центральная труба | Средняя секция выхлопной системы | Совместимость со штатным downpipe и cat-back |
| Cat-back / катбэк | Выхлопная система после каталитического нейтрализатора | Количество выходов, клапаны, материал и кузов |
| Turbo-back / турбобэк | Выхлопной тракт от турбины назад, обычно downpipe плюс последующие секции | Что именно входит в комплект и есть ли катализатор |
| Header / exhaust manifold / коллектор | Собирает выхлопные газы из цилиндров до остальной системы | Двигатель, LHD/RHD, катализатор и необходимость настройки |
| Resonator / резонатор | Уменьшает нежелательный гул и отдельные частоты выхлопа | Нужен ли resonated или non-resonated вариант |
| Muffler / silencer / глушитель | Финальная секция, снижающая громкость выхлопа | Количество и форма насадок, клапаны и материал |
| Catless / без катализатора | Деталь без каталитического нейтрализатора | Законность использования, ошибки ECU и необходимость настройки |
| Sport cat / спортивный катализатор | Катализатор с меньшим сопротивлением потоку | Cell count/CPSI, сертификация и совместимость с ECU |
| Valved exhaust / клапанный выхлоп | Выхлоп с управляемыми заслонками для изменения громкости | Тип управления, наличие контроллера и совместимость |
| Coilovers / койловеры | Стойки с пружинами и регулировкой высоты, иногда жёсткости | Привод, нагрузка на ось, диапазон занижения и электронные амортизаторы |
| Lowering springs / пружины занижения | Пружины, уменьшающие клиренс на штатных или подходящих амортизаторах | Величина занижения, тип подвески и допустимая нагрузка |
| Sway bar / anti-roll bar / стабилизатор | Уменьшает крены кузова в поворотах | Передний или задний, диаметр, крепления и регулируемость |
| Control arm / рычаг подвески | Соединяет ступицу или кулак с кузовом/подрамником | Сторона, ось, регулируемость и наличие сайлентблоков |
| BBK / big brake kit | Увеличенный тормозной комплект: суппорты, диски и крепления | Размер дисков, минимальный размер колёс, ось и комплектация |
| Forged wheel / кованый диск | Диск, изготовленный ковкой; обычно легче и прочнее литого аналога | Размер, ширина, ET, PCD, DIA, нагрузка и отделка |
| Cast wheel / литой диск | Диск, изготовленный литьём | Размеры, допустимая нагрузка и фактический вес |
| Offset / ET / вылет | Положение плоскости крепления диска относительно его центра | Передняя/задняя ось, ширина диска и требуемый fitment |
| PCD / разболтовка | Количество крепёжных отверстий и диаметр окружности их расположения | Например 5×112; не путать с DIA |
| Center bore / DIA / ЦО | Диаметр центрального отверстия диска | Нужны ли центровочные кольца |
| Splitter / front lip / губа | Нижний передний аэродинамический элемент | Бампер, версия кузова, материал и комплект крепежа |
| Diffuser / диффузор | Нижний элемент заднего бампера вокруг выхлопа | Тип бампера, количество выходов выхлопа и материал |
| Side skirts / пороги | Боковые элементы обвеса под дверями | Кузов, база автомобиля, сторона и способ установки |
| Spoiler / спойлер | Аэродинамический элемент, обычно повторяющий форму крышки багажника или крыши | Место установки, кузов и сверление |
| Wing / антикрыло | Отдельно расположенный аэродинамический профиль на стойках | Ширина, высота, крепления и транспортные габариты |
| Canards / канарды | Небольшие аэродинамические элементы по краям бампера | Сторона, количество, материал и совместимый бампер |
| Pistons / поршни | Детали цилиндро-поршневой группы, воспринимающие давление сгорания | Диаметр, степень сжатия, двигатель и комплектность |
| Connecting rods / шатуны | Соединяют поршни с коленчатым валом | Двигатель, длина, палец, крепёж и количество |
| Sleeves / гильзы | Рабочие цилиндрические поверхности внутри блока двигателя | Диаметр, материал, обработка блока и назначение сборки |
| Turbocharger / turbo / турбина | Использует энергию выхлопа для нагнетания воздуха в двигатель | Модель, flange, мощностная цель, охлаждение и настройка |
| Wastegate / вестгейт | Регулирует давление наддува, управляя потоком выхлопа мимо турбины | Internal/external, пружина, flange и контроллер |
| ECU tune / прошивка | Изменение программных калибровок блока управления двигателем | Топливо, железо, регион, гарантия и требуемая мощность |
| Stage 1/2/3 | Неформальное обозначение уровня доработок; у разных компаний означает разное | Всегда запрашивать точный список железа и программных изменений |
| SKU / артикул | Уникальный код конкретного товара или варианта | Не заменять названием бренда или общим названием детали |
| OEM / оригинал | Деталь производителя автомобиля или официального поставщика | Оригинальный номер и возможные замены/supersession |
| Aftermarket | Деталь стороннего производителя, не штатная OEM-позиция | Сертификация, гарантия и совместимость |
| Fitment / применяемость | Перечень автомобилей и конфигураций, на которые подходит товар | Марка, модель, год, кузов, двигатель, привод и точный SKU |
| MSRP | Рекомендованная производителем розничная цена | Валюта, tax/VAT и является ли она публичной или dealer MSRP |
| RRP | Рекомендованная розничная цена; значение близко к MSRP | Включён ли VAT и для какого рынка указана цена |
| Net / нетто | Цена без VAT/tax либо после согласованной скидки — зависит от источника | Обязательно уточнить, что именно исключено |
| Gross / брутто | Цена с включённым налогом/VAT | Ставка VAT, страна и возможность tax-free |
| VAT / НДС | Налог на добавленную стоимость | Включён ли в цену, страна ставки и документы для возврата |
| Backorder / под заказ | Товар временно отсутствует и ожидается от производителя | Подтверждённый ETA, возможность отмены и фиксация цены |
| Actual weight / фактический вес | Реальная масса упакованного отправления | Вес брутто каждой коробки |
| Volumetric weight / объёмный вес | Расчётная масса по размерам коробки, используемая перевозчиком | Формула перевозчика, размеры каждой коробки и единицы измерения |

## Важно

Словарь помогает понять запрос, но не подтверждает совместимость, наличие, цену или характеристики. Для подбора всегда нужны автомобиль, год, кузов, двигатель и точный SKU либо официальный fitment.`,
  },
  {
    slug: "internal-logistics-routes-reference",
    title: "Маршруты и ориентиры логистики",
    excerpt:
      "Структурированные исторические ориентиры по Medyka, Logsped, Великобритании, США, Словакии и Китаю.",
    category: "delivery",
    tags: ["delivery", "logistics", "internal-reference", "needs-current-check"],
    contentMarkdown: `# Маршруты и ориентиры логистики

> Все суммы ниже являются рабочими историческими ориентирами. Перед расчётом подтвердите маршрут, валюту, фактический и объёмный вес, локальную доставку, страхование и актуальный тариф.

## Основные маршруты

| Маршрут / способ | Исторический ориентир | Что проверить |
| --- | --- | --- |
| Medyka → Украина | Ориентир 350 USD за 1 м³ | Текущий тариф, минимальный объём, округление и локальную доставку |
| Через EX | +5% к сумме инвойса, затем курс и кубатура | Что входит в 5%, валюту инвойса и применяемый курс |
| Через Logsped | +5% + объём по 400 USD/м³ + 50 EUR | Комиссию, фиксированную часть и актуальный тариф за м³ |
| Великобритания → Польша | Старый вариант: 10 GBP за позицию; пороги около 50–60 GBP | Перевозчика, габариты и категорию товара |
| Великобритания → Польша, новый расчёт | Тяжёлое компактное: 2 GBP/кг; лёгкое объёмное: 350 GBP/м³ | Как перевозчик выбирает между весом и объёмом |
| Словакия → Украина | Ориентир 300 USD/м³ | Текущий маршрут и минимальный оплачиваемый объём |
| США → Украина | Ориентир 11 USD/кг | Перевозчика, объёмный вес и категорийный тариф для кузовных деталей |
| Китай → Киев | 18 USD/кг; для отправления 10+ кг — 10 USD/кг; ориентир 3–4 недели | Вес всей партии, доставку по Китаю и дату тарифа |

## Medyka и VAT

- Обычный объёмный расчёт нельзя смешивать с tax-free без проверки документов.
- В старой записи встречается формула с 19% и кросс-курсом. Она неоднозначна и не должна применяться автоматически.
- Оплаты в PLN описаны отдельно как оплаты с VAT. Сначала нужно определить цену без VAT и только затем выполнять валютную конвертацию.
- Источник курса, направление кросс-курса и момент его фиксации должны быть указаны в расчёте.

## Правило безопасности

Эти ориентиры не являются checkout-тарифами. Финальная доставка рассчитывается только после получения размеров, количества коробок, веса, адреса склада-отправителя и подтверждения перевозчика.`,
  },
  {
    slug: "internal-product-weight-reference",
    title: "Ориентиры веса и доставки по типам товаров",
    excerpt: "Рабочая таблица доставки кузовных деталей, дисков, выхлопов и деталей двигателя.",
    category: "delivery",
    tags: ["delivery", "weights", "products", "internal-reference", "needs-current-check"],
    contentMarkdown: `# Ориентиры веса и доставки по типам товаров

> Используйте таблицу для предварительной оценки. Для предложения клиенту нужны фактические размеры и вес упаковки.

## Кузовные детали из США

| Категория | Исторический ориентир |
| --- | ---: |
| Губа / splitter | 125 USD |
| Диффузор | 145 USD |
| Пороги | 165 USD |
| Канарды, зеркала, небольшие вставки | 25 USD |
| Бампер | 275 USD |
| Малый спойлер | 55 USD |
| Спойлер на крышу | 110 USD |
| Большое антикрыло | 200 USD |
| Очень большое антикрыло | 245 USD |
| Капот | 365 USD |
| Капот Performance Speed Shop | 485 USD |
| Винглеты | 45 USD |
| Решётка / grille | 65 USD |

## Кованые диски

| Размер | Ориентир доставки комплекта |
| --- | ---: |
${OPS_FORGED_WHEEL_SHIPPING_ESTIMATES.map(({ size, amountUsd }) => `| ${size} | ${amountUsd} USD |`).join("\n")}

Для некованого диска старый ориентир предлагает добавлять примерно 1 кг на каждый диск. Перед расчётом подтвердите количество дисков и упаковку.

## Детали двигателя и выхлоп

| Деталь | Ориентировочный вес |
| --- | ---: |
| Поршень, 1 шт. | 1 кг |
| Шатун, 1 шт. | 1 кг |
| Турбина | около 11 кг |
| Cat-back, выход на одну сторону | около 20 кг |
| Cat-back из нержавейки, выход на две стороны | 30–35 кг |
| V8 cat-back из нержавейки, выход на две стороны | 40–45 кг |
| Один catless downpipe | около 4–8 кг |
| Комплект кованых поршней | около 3 кг |
| Комплект шатунов | около 3 кг |

## Перед использованием

Проверьте материал, количество элементов, комплектность, размеры коробок и данные производителя. Одинаковое название детали не гарантирует одинаковый вес.`,
  },
  {
    slug: "internal-pricing-formula-reading-guide",
    title: "Как читать внутренние формулы цен",
    excerpt:
      "Единый порядок разбора формул: база цены, VAT, скидка, доставка, наценка и фиксированные расходы.",
    category: "prices-and-brands",
    tags: ["pricing", "formula", "internal-reference", "safety"],
    contentMarkdown: `# Как читать внутренние формулы цен

## Обязательные поля расчёта

1. Бренд и точный SKU.
2. Канал: розница, партнёр, опт или наша закупка.
3. Источник цены: сайт, MSRP, RRP, нетто, цена аккаунта, Turn14 или прайс поставщика.
4. Валюта и VAT/tax status.
5. Скидка аккаунта и база, от которой она считается.
6. Локальная доставка до склада.
7. Международная доставка по весу или объёму.
8. Пошлина/растаможка, если применима.
9. Наценка и фиксированные расходы.
10. Дата проверки правила и источник курса.

## Порядок расчёта

Не объединяйте проценты без подтверждения. Формулу нужно раскладывать на последовательные операции:

\`базовая цена → VAT/tax → скидка → локальная доставка → международная доставка → пошлина → фиксированные расходы → наценка\`.

## Неоднозначные записи

Следующие конструкции нельзя выполнять автоматически без уточнения:

- «+15% / 0.85»;
- «нетто +20% +10%»;
- «цена -60% × 0.1»;
- «+19% × кросс-курс»;
- фиксированные 100 EUR/USD, распределяемые на одну общую оплату;
- скидки, для которых не указана база: MSRP, RRP, сайт или наша цена.

## Правило использования AI

AI может найти бренд, объяснить правило и подготовить поля расчёта. Арифметика выполняется детерминированно только после того, как менеджер подтвердил исходную цену, валюту, VAT, скидку и маршрут доставки.`,
  },
  {
    slug: "brabus-discount-groups-reference",
    title: "Brabus: группы скидок",
    excerpt: "Категорийные группы скидок Brabus из внутреннего рабочего справочника.",
    category: "prices-and-brands",
    tags: ["brand-guide", "brand-brabus", "pricing", "discount-groups", "needs-current-check"],
    contentMarkdown: `# Brabus: группы скидок

> Перед расчётом подтвердите актуальную discount group конкретного SKU. Категория товара важнее общего правила бренда.

| Группа | Ориентир скидки | Категории |
| --- | ---: | --- |
| DG1 | 10% | Level 3 power increases; high-performance engines и turbo upgrades; brake systems; speedometers; leather interior conversions; multimedia/infotainment; spare wheel holder G 500 4x4² |
| DG2 | 17.5% | Coilover suspensions; valve-controlled exhausts; start-stop memory; shift paddles |
| DG3 | 17.5% | Carbon fibre exterior/interior; Level 1 и Level 2 performance increases; PowerXtra/PowerXtra+; electric step boards; Maybach-design front grille W/V 222 |
| DG4 | 20% | Additional headlights; Ride Control suspensions; exterior exhaust systems; suspensions M |
| DG5 | 27.5% | Wheels; suspension/sport springs; PU-Rim exterior; surround illumination; sports exhaust systems без valve-controlled; SoundXtra; emblems/logos; aluminium interior accessories; entrance panels; velour floor mats |

## Розничные ориентиры

- Украина: немецкий сайт + 10%.
- Европа: немецкий сайт.
- В старой заметке отдельно указано, что работа с VAT может быть выгодна от суммы около 2000 EUR; это не универсальное правило и требует проверки документов.

## Следующее действие

Перед расчётом найти категорию SKU, подтвердить discount group и проверить, включает ли сайт VAT и доставку.`,
  },
];

function brandArticleContent(rule: BrandRulePatch) {
  const value = (input?: string) => input || "Не указано";
  return `# ${rule.title}

> Правило перенесено из внутреннего рабочего справочника. Перед расчётом проверьте актуальную цену, скидку аккаунта, VAT/tax, валюту и доставку.

## Карточка правила

| Поле | Значение |
| --- | --- |
| Группа | ${rule.group} |
| Статус | Рабочий ориентир — требуется актуальная проверка |

## Формула и условия

| Тип | Правило |
| --- | --- |
| Розница | ${value(rule.retail)} |
| Опт / партнёр | ${value(rule.wholesale)} |
| Наша закупка | ${value(rule.ourCost)} |
| Логистика | ${value(rule.logistics)} |

## Важные заметки

${value(rule.notes)}

## Следующее действие

Проверить исходную цену, применимость правила к SKU, VAT/tax, валюту, доставку и дату тарифа. Не выполнять расчёт автоматически при отсутствии любого из этих параметров.`;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const forceExisting = process.argv.includes("--force-existing");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const { prisma } = await import("../src/lib/prisma");
  const { buildKnowledgeSearchText } = await import("../src/lib/operations/knowledge");
  const authorEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const author = await prisma.adminUser.findFirst({
    where: { isActive: true, ...(authorEmail ? { email: authorEmail } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });
  if (!author) throw new Error("Active admin was not found");

  const slugs = [
    ...brandRulePatches.map((rule) => `brand-${rule.guideKey}`),
    ...referenceArticles.map((article) => article.slug),
  ];
  const existing = await prisma.opsKnowledgeArticle.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, title: true, contentMarkdown: true, version: true },
  });
  const bySlug = new Map(existing.map((article) => [article.slug, article]));

  const desired = [
    ...brandRulePatches.map((rule) => ({
      slug: `brand-${rule.guideKey}`,
      title: rule.title,
      excerpt: rule.retail || rule.wholesale || rule.ourCost || "Рабочий ориентир правила бренда.",
      category: "prices-and-brands" as const,
      brandKey: rule.guideKey,
      tags: ["brand-guide", "formula-available", "internal-reference", "needs-current-check"],
      contentMarkdown: brandArticleContent(rule),
    })),
    ...referenceArticles.map((article) => ({ ...article, brandKey: null })),
  ];
  const obsoleteSourceTag = ["top", "level", "pdf"].join("-");
  const taggedArticles = await prisma.opsKnowledgeArticle.findMany({
    where: {
      tags: { has: obsoleteSourceTag },
      slug: { notIn: desired.map((article) => article.slug) },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      contentMarkdown: true,
      locale: true,
      category: true,
      brandKey: true,
      tags: true,
      status: true,
      version: true,
    },
  });
  const plan = desired.map((article) => {
    const current = bySlug.get(article.slug);
    return {
      slug: article.slug,
      action: !current
        ? "create"
        : current.contentMarkdown === article.contentMarkdown
          ? "unchanged"
          : forceExisting
            ? "update"
            : "preserve-manual",
    };
  });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        brandRules: brandRulePatches.length,
        referenceArticles: referenceArticles.length,
        removeObsoleteVisibleTag: taggedArticles.length,
        create: plan.filter((item) => item.action === "create").length,
        update: plan.filter((item) => item.action === "update").length,
        preservedManual: plan.filter((item) => item.action === "preserve-manual").length,
        unchanged: plan.filter((item) => item.action === "unchanged").length,
        plan,
      },
      null,
      2
    )
  );
  if (!apply) {
    await prisma.$disconnect();
    return;
  }

  for (const article of taggedArticles) {
    const tags = article.tags.filter((tag) => tag !== obsoleteSourceTag);
    const revision = article.version + 1;
    const searchText = buildKnowledgeSearchText({
      title: article.title,
      excerpt: article.excerpt,
      contentMarkdown: article.contentMarkdown,
      category: article.category,
      brandKey: article.brandKey,
      tags,
    });
    await prisma.$transaction(async (tx) => {
      await tx.opsKnowledgeArticle.update({
        where: { id: article.id },
        data: {
          tags,
          searchText,
          version: { increment: 1 },
          revisions: {
            create: {
              revision,
              status: article.status as OpsKnowledgeStatus,
              title: article.title,
              excerpt: article.excerpt,
              contentMarkdown: article.contentMarkdown,
              locale: article.locale,
              category: article.category,
              brandKey: article.brandKey,
              tags,
              changeNote: "Удалён устаревший пользовательский тег источника",
              changedById: author.id,
            },
          },
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: author.id,
          actorEmail: author.email,
          actorName: author.name,
          scope: "operations",
          action: "knowledge.internal_tag.remove",
          entityType: "ops.knowledge",
          entityId: article.id,
          metadata: { slug: article.slug, revision },
        },
      });
    });
  }

  for (const article of desired) {
    const current = bySlug.get(article.slug);
    if (current?.contentMarkdown === article.contentMarkdown) continue;
    if (current && !forceExisting) continue;
    const tags = Array.from(new Set(article.tags));
    const searchText = buildKnowledgeSearchText({
      title: article.title,
      excerpt: article.excerpt,
      contentMarkdown: article.contentMarkdown,
      category: article.category,
      brandKey: article.brandKey,
      tags,
    });
    const revision = current ? current.version + 1 : 1;
    const saved = await prisma.$transaction(async (tx) => {
      const result = current
        ? await tx.opsKnowledgeArticle.update({
            where: { id: current.id },
            data: {
              title: article.title,
              excerpt: article.excerpt,
              contentMarkdown: article.contentMarkdown,
              category: article.category,
              brandKey: article.brandKey,
              tags,
              searchText,
              status: OpsKnowledgeStatus.PUBLISHED,
              archivedAt: null,
              publishedById: author.id,
              publishedAt: new Date(),
              publishedRevision: revision,
              version: { increment: 1 },
              revisions: {
                create: {
                  revision,
                  status: OpsKnowledgeStatus.PUBLISHED,
                  title: article.title,
                  excerpt: article.excerpt,
                  contentMarkdown: article.contentMarkdown,
                  locale: "ru",
                  category: article.category,
                  brandKey: article.brandKey,
                  tags,
                  changeNote: "Структурировано из внутреннего рабочего справочника",
                  changedById: author.id,
                },
              },
            },
            select: { id: true },
          })
        : await tx.opsKnowledgeArticle.create({
            data: {
              slug: article.slug,
              title: article.title,
              excerpt: article.excerpt,
              contentMarkdown: article.contentMarkdown,
              locale: "ru",
              category: article.category,
              brandKey: article.brandKey,
              tags,
              searchText,
              status: OpsKnowledgeStatus.PUBLISHED,
              authorId: author.id,
              publishedById: author.id,
              publishedAt: new Date(),
              publishedRevision: 1,
              revisions: {
                create: {
                  revision: 1,
                  status: OpsKnowledgeStatus.PUBLISHED,
                  title: article.title,
                  excerpt: article.excerpt,
                  contentMarkdown: article.contentMarkdown,
                  locale: "ru",
                  category: article.category,
                  brandKey: article.brandKey,
                  tags,
                  changeNote: "Структурировано из внутреннего рабочего справочника",
                  changedById: author.id,
                },
              },
            },
            select: { id: true },
          });
      await tx.adminAuditLog.create({
        data: {
          actorId: author.id,
          actorEmail: author.email,
          actorName: author.name,
          scope: "operations",
          action: current
            ? "knowledge.internal_reference.update"
            : "knowledge.internal_reference.create",
          entityType: "ops.knowledge",
          entityId: result.id,
          metadata: {
            slug: article.slug,
            source: "internal-cheat-sheet",
            revision,
          },
        },
      });
      return result;
    });
    console.log(JSON.stringify({ slug: article.slug, id: saved.id, revision }));
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
