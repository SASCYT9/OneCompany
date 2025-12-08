export interface BrandStory {
  headline: { en: string; ua: string };
  description: { en: string; ua: string };
  highlights: { en: string; ua: string }[];
}

export const curatedBrandStories: Record<string, BrandStory> = {
  Akrapovic: {
    headline: { en: 'Akrapovic MotoGP titanium lab', ua: 'Akrapovic · титановий MotoGP-центр' },
    description: {
      en: 'Full titanium systems with carbon sleeves, dyno verified for Ducati, BMW and liter-bike paddocks.',
      ua: 'Повні титанові системи з карбоновими кожухами, підтверджені діно для Ducati, BMW та літрових байків.',
    },
    highlights: [
      { en: 'Evolution Racing & Slip-On Street', ua: 'Evolution Racing та Slip-On Street' },
      { en: 'Custom logo badging + heat mapping', ua: 'Кастомні бейджі та термо-графіки' },
      { en: 'Door-to-door insured freight', ua: 'Door-to-door доставка зі страхуванням' },
    ],
  },
  'SC-Project': {
    headline: { en: 'SC-Project WSBK soundtrack', ua: 'SC-Project · звук WSBK' },
    description: {
      en: 'Valved and race-only exhausts with double-wall headers and Moto2-derived silencers.',
      ua: 'Клапанні та трекові вихлопи з двошаровими колекторами та глушниками з Moto2.',
    },
    highlights: [
      { en: 'CR-T, S1, S1-GP allocations', ua: 'CR-T, S1, S1-GP квоти' },
      { en: 'Lambda-safe bungs & hardware kits', ua: 'Лямбда-безпечні бонги й кріплення' },
      { en: 'Install supervision + ECU pairing', ua: 'Контроль монтажу та підбір ECU' },
    ],
  },
  Termignoni: {
    headline: { en: 'Termignoni Corse heritage', ua: 'Termignoni · спадок Corse' },
    description: {
      en: 'Signature systems for Ducati and Aprilia with matching ECU flashes and upmap slots.',
      ua: 'Фірмові системи Ducati та Aprilia з ECU-прошивками та upmap слотами.',
    },
    highlights: [
      { en: 'Corse and Relevance lines in stock', ua: 'Лінійки Corse та Relevance на складі' },
      { en: 'Track-legal paperwork bundles', ua: 'Пакети документів для треку' },
      { en: 'Paint-to-sample carbon shields', ua: 'Карбонові щитки з індивідуальним фарбуванням' },
    ],
  },
  Arrow: {
    headline: { en: 'Arrow Pro-Race studio', ua: 'Arrow Pro-Race студія' },
    description: {
      en: 'Slip-ons, headers and MotoGP-inspired silencers with titanium or nichrome options.',
      ua: 'Slip-on, колектори та глушники в стилі MotoGP з титану чи ніхрому.',
    },
    highlights: [
      { en: 'Road & race homologations', ua: 'Гомологації для дороги та треку' },
      { en: 'Quick-turn spare parts', ua: 'Швидкі поставки запчастин' },
      { en: 'Dyno-verified gains per platform', ua: 'Діно-графіки для кожної платформи' },
    ],
  },
  'Ohlins': {
    headline: { en: 'Ohlins Advanced Suspension', ua: 'Ohlins · передова підвіска' },
    description: {
      en: 'The gold standard in suspension technology for street and track performance.',
      ua: 'Золотий стандарт у технологіях підвіски для вулиці та треку.',
    },
    highlights: [
      { en: 'TTX technology shock absorbers', ua: 'Амортизатори технології TTX' },
      { en: 'NIX 30 cartridge kits', ua: 'Картриджні комплекти NIX 30' },
      { en: 'Electronic suspension upgrades', ua: 'Електронні апгрейди підвіски' },
    ],
  },
  'Marchesini': {
    headline: { en: 'Marchesini Forged Wheels', ua: 'Marchesini · ковані диски' },
    description: {
      en: 'Lightweight magnesium and aluminum forged wheels used by MotoGP champions.',
      ua: 'Легкі магнієві та алюмінієві ковані диски, що використовуються чемпіонами MotoGP.',
    },
    highlights: [
      { en: 'M7R Genesi magnesium wheels', ua: 'Магнієві диски M7R Genesi' },
      { en: 'M10RS Kompe aluminum wheels', ua: 'Алюмінієві диски M10RS Kompe' },
      { en: 'Significant weight reduction', ua: 'Значне зниження ваги' },
    ],
  },
  'OZ Racing': {
    headline: { en: 'OZ Racing Technology', ua: 'OZ Racing · технології перемог' },
    description: {
      en: 'High-performance wheels derived from F1 and MotoGP experience.',
      ua: 'Високопродуктивні диски, створені на основі досвіду F1 та MotoGP.',
    },
    highlights: [
      { en: 'GASS RS-A forged aluminum', ua: 'Кований алюміній GASS RS-A' },
      { en: 'Piega forged aluminum', ua: 'Кований алюміній Piega' },
      { en: 'Cattiva forged magnesium', ua: 'Кований магній Cattiva' },
    ],
  },
  'SparkExhaust': {
    headline: { en: 'Spark Italian Passion', ua: 'Spark · італійська пристрасть' },
    description: {
      en: 'High-performance exhaust systems with a unique sound and design.',
      ua: 'Високопродуктивні вихлопні системи з унікальним звуком та дизайном.',
    },
    highlights: [
      { en: 'Dyno-tested performance', ua: 'Перевірена на діно продуктивність' },
      { en: 'Dark style silencers', ua: 'Глушники в стилі Dark' },
      { en: 'Handcrafted in Italy', ua: 'Ручна робота з Італії' },
    ],
  },
  'Bitubo': {
    headline: { en: 'Bitubo track-day suspension', ua: 'Bitubo · трекові підвіски' },
    description: {
      en: 'Competition-ready cartridge kits, steering dampers and full-rebuild services for race bikes.',
      ua: 'Конкурентні картриджі, демпфери керма та повний ребілд для трекових байків.',
    },
    highlights: [
      { en: 'Dyno-driven valving specs', ua: 'Діно-підібрані клапанні спеки' },
      { en: 'Track corner-weighting sessions', ua: 'Трекові сесії балансування ваги' },
      { en: 'Pit-side rebuild service', ua: 'Сервіс ребілду в піт-лейні' },
    ],
  },
  Brembo: {
    headline: { en: 'Brembo GP4 braking suites', ua: 'Brembo GP4 гальмівні комплекти' },
    description: {
      en: "Monoblock calipers, Corsa Corta masters and T-drive rotors spec'd for pit crews.",
      ua: 'Моноблок супорти, головні циліндри Corsa Corta та диски T-drive для трекових команд.',
    },
    highlights: [
      { en: 'Track bedding procedures', ua: 'Процедури обкатки для треку' },
      { en: 'Pad libraries for every compound', ua: 'Бібліотека колодок усіх сумішей' },
      { en: 'On-site pedal feel tuning', ua: 'Налаштування педалі на місці' },
    ],
  },
  'Accossato': {
    headline: { en: 'Accossato race controls', ua: 'Accossato · рейсинг-контролі' },
    description: {
      en: 'Radial master cylinders, folding levers and lightweight rearsets engineered for Italian superbikes.',
      ua: 'Радіальні головні циліндри, складні важелі та легкі rearsets для італійських супербайків.',
    },
    highlights: [
      { en: 'Billet aluminum construction', ua: 'Конструкція з білетного алюмінію' },
      { en: 'Lever ratio adjustment', ua: 'Регулювання передатного числа важеля' },
      { en: 'Race-proven ergonomics', ua: 'Перевірена трековою ергономіка' },
    ],
  },
  'ValterMoto': {
    headline: { en: 'ValterMoto pit equipment', ua: 'ValterMoto · піт-обладнання' },
    description: {
      en: 'Track-side tools, paddock stands and quick-change kits for race-day efficiency.',
      ua: 'Трекові інструменти, паддок-стенди та швидкозмінні комплекти для ефективності в race-day.',
    },
    highlights: [
      { en: 'Universal fitment stands', ua: 'Універсальні стенди' },
      { en: 'Tire warmer bundles', ua: 'Комплекти підігрівачів' },
      { en: 'Pit-lane toolkits', ua: 'Піт-лейн тулкіти' },
    ],
  },
  Eventuri: {
    headline: { en: 'Eventuri Carbon Intake Lab', ua: 'Eventuri — лабораторія карбону' },
    description: {
      en: 'Autoclave carbon assemblies that stabilise IAT and add theatre to every throttle input.',
      ua: 'Автоклавні карбонові системи, що стабілізують IAT та додають драму кожному натисканню.',
    },
    highlights: [
      { en: 'Pre-preg carbon options with kevlar cores', ua: 'Препрег-карбон з кевларовими осердями' },
      { en: 'Dyno-verified gains for M, RS, AMG platforms', ua: 'Діно-підтвердження для платформ M, RS, AMG' },
      { en: 'Coordinated install + ECU calibration', ua: 'Координація встановлення та калібрування ECU' },
    ],
  },
  'KW Suspension': {
    headline: { en: 'KW · Adaptive Control', ua: 'KW · адаптивний контроль' },
    description: {
      en: 'Variant, Clubsport and DDC plug & play kits with geo setup plans from our chassis lab.',
      ua: 'Variant, Clubsport та DDC-комплекти з налаштуванням геометрії від нашої шасі-лабораторії.',
    },
    highlights: [
      { en: 'Track sheets + corner-weighting in Kyiv', ua: 'Налаштування кутів та ваги в Києві' },
      { en: 'Road + snow presets for SUVs', ua: 'Налаштування для доріг та снігу для SUV' },
      { en: 'Warranty preserved via OEM torque specs', ua: 'Збережена гарантія завдяки OEM моментам затягування' },
    ],
  },
  'HRE wheels': {
    headline: { en: 'HRE Wheels Forged Program', ua: 'HRE Wheels — програма forged' },
    description: {
      en: 'Bespoke monoblock, 2-piece and 3-piece sets engineered for hypercar tolerances.',
      ua: 'Кастомні моноблоки, дво- та трисекційні диски з допусками гіперкарів.',
    },
    highlights: [
      { en: 'Aerospace-grade forgings + T\u00DCV paperwork', ua: 'Авіаційні заготовки та документи TÜV' },
      { en: 'Finish library + transparent timelines', ua: 'Бібліотека фінішів та прозорі строки' },
      { en: 'Ceramic coating + TPMS setup on delivery', ua: 'Керамічне покриття та TPMS при видачі' },
    ],
  },
  Vorsteiner: {
    headline: { en: 'Vorsteiner Carbon Importer', ua: 'Vorsteiner — карбоновий імпортер' },
    description: {
      en: 'Carbon aero programs for Lamborghini, Porsche, BMW and SUV flagships with factory-level fit.',
      ua: 'Карбонові аеропакети для Lamborghini, Porsche, BMW та флагманських SUV з OEM-пасуванням.',
    },
    highlights: [
      { en: 'Autoclave dry carbon & forged options', ua: 'Сухий та кований карбон з автоклава' },
      { en: 'Paint-to-sample & PPF ready finishing', ua: 'Індивідуальне фарбування та готовність під PPF' },
      { en: 'Install supervision + alignment presets', ua: 'Контроль монтажу та налаштування сходження' },
    ],
  },
  Armytrix: {
    headline: { en: 'Armytrix Valvetronic Theatre', ua: 'Armytrix — клапанний саунд' },
    description: {
      en: 'Valvetronic exhausts with smart remotes, bluetooth control and night stealth modes.',
      ua: 'Клапанні вихлопи зі смарт-брелоками, bluetooth-контролем та тихими режимами.',
    },
    highlights: [
      { en: 'Titanium + stainless options in stock', ua: 'Титанові та сталеві опції на складі' },
      { en: 'ECU-safe valve modules', ua: 'Блоки клапанів без помилок ECU' },
      { en: 'Install + wiring diagrams translated', ua: 'Схеми монтажу та проводки українською' },
    ],
  },
  CSF: {
    headline: { en: 'CSF Cooling Program', ua: 'CSF — програма охолодження' },
    description: {
      en: 'Billet end-tank intercoolers and radiators that keep intake temps repeatable on stage 3 builds.',
      ua: 'Інтеркулери та радіатори з білетними баками для стабільних температур на stage 3.',
    },
    highlights: [
      { en: 'Drag + track proven cores', ua: 'Перевірені на драгу та треку ядра' },
      { en: 'Heat exchanger bundles in stock', ua: 'Готові комплекти теплообмінників' },
      { en: 'Coolant bleeding with telemetry report', ua: 'Прокачка з рипортом телеметрії' },
    ],
  },
  Manhart: {
    headline: { en: 'Manhart Bespoke Builds', ua: 'Manhart — індивідуальний сервіс' },
    description: {
      en: 'Complete conversion kits with aero, wheels and ECU calibrations for BMW, Audi and Mercedes.',
      ua: 'Повні комплекти конверсій з аеро, дисками та прошивками для BMW, Audi, Mercedes.',
    },
    highlights: [
      { en: 'Stage packages shipped as one crate', ua: 'Stage-комплекти в одному ящику' },
      { en: 'Interior trims + steering wheels included', ua: 'Включені інтерʼєрні елементи та керма' },
      { en: 'On-site coding and warranty docs', ua: 'Кодування та гарантійні документи на місці' },
    ],
  },
  Renntech: {
    headline: { en: 'Renntech AMG Power Stages', ua: 'Renntech — ступені потужності AMG' },
    description: {
      en: 'Turbo, cooling and ECU programs engineered by ex-AMG powertrain teams.',
      ua: 'Турбіни, охолодження та ECU від екс-команди AMG.',
    },
    highlights: [
      { en: 'Stage 1-4 calibrations with dyno sheets', ua: 'Stage 1-4 з діно-рапортами' },
      { en: 'TCU + gearbox cooling upgrades', ua: 'TCU та охолодження КПП' },
      { en: 'Worldwide warranty honoured via us', ua: 'Гарантія по всьому світу через нас' },
    ],
  },
  'Velos': {
    headline: { en: 'Velos Forged Luxury', ua: 'Velos — розкішне кування' },
    description: {
      en: 'Luxury-focused forged sets with marble, brushed and two-tone finishes for SUVs and limousines.',
      ua: 'Розкішні ковані комплекти з мармуровими, брашованими та двотоновими фінішами для SUV та лімузинів.',
    },
    highlights: [
      { en: '24-26 inch fitments verified for Maybach & Cullinan', ua: '24-26" підбори для Maybach та Cullinan' },
      { en: 'Floating centre caps + bespoke engraving', ua: 'Плаваючі ковпачки та гравіювання' },
      { en: 'TPMS + run-flat compatible', ua: 'Сумісність з TPMS та run-flat' },
    ],
  },
  'Weistec': {
    headline: { en: 'Weistec Engineering Power Lab', ua: 'Weistec Engineering — лабораторія потужності' },
    description: {
      en: 'Billet turbos, meth kits and calibration suites for AMG, McLaren and exotic SUV platforms.',
      ua: 'Білетні турбіни, метанольні комплекти та калібрування для AMG, McLaren та екзотичних SUV.',
    },
    highlights: [
      { en: 'Complete fuel system solutions', ua: 'Повні паливні системи' },
      { en: 'Built transmissions with break-in support', ua: 'Підготовлені КПП з підтримкою обкатки' },
      { en: 'Remote + on-site calibration days', ua: 'Віддалені й виїзні дні калібрування' },
    ],
  },
  'ABT': {
    headline: { en: 'ABT Sportsline Power Programs', ua: 'ABT Sportsline — програми потужності' },
    description: {
      en: 'Official Audi tuning partner with ECU calibrations, aero kits and forged wheels for the VAG platform.',
      ua: 'Офіційний тюнінг-партнер Audi з прошивками ECU, аеро-китами та кованими дисками для платформи VAG.',
    },
    highlights: [
      { en: 'ABT Power S stages with warranty', ua: 'ABT Power S з гарантією' },
      { en: 'RS & RSQ aero programs', ua: 'Аеро програми для RS та RSQ' },
      { en: 'Sport wheels & suspension kits', ua: 'Спортивні диски та комплекти підвіски' },
    ],
  },
  'Capristo': {
    headline: { en: 'Capristo Exhaust Systems', ua: 'Capristo — вихлопні системи' },
    description: {
      en: 'Valve-controlled exhaust systems made of heat-resistant stainless steel for supercars.',
      ua: 'Клапанні вихлопні системи з жаростійкої сталі для суперкарів.',
    },
    highlights: [
      { en: 'Programmable control units', ua: 'Програмовані блоки керування' },
      { en: 'Carbon fiber composites', ua: 'Карбонові композити' },
      { en: 'OEM quality', ua: 'OEM якість' },
    ],
  },
  'FI Exhaust': {
    headline: { en: 'Frequency Intelligent Exhaust', ua: 'FI Exhaust — частотний інтелект' },
    description: {
      en: 'Valvetronic technology combining comfort and racing sound for high-performance cars.',
      ua: 'Технологія Valvetronic, що поєднує комфорт та гоночний звук для потужних авто.',
    },
    highlights: [
      { en: 'Mobile app control', ua: 'Керування через додаток' },
      { en: 'Intelligent valve system', ua: 'Розумна система клапанів' },
      { en: 'Signature frequency', ua: 'Фірмова частота' },
    ],
  },
  'RYFT': {
    headline: { en: 'RYFT Titanium Artisan', ua: 'RYFT — титанове мистецтво' },
    description: {
      en: "Hand-made titanium exhaust systems and carbon aero for the world's rarest cars.",
      ua: 'Ручної роботи титанові вихлопи та карбон для найрідкісніших авто світу.',
    },
    highlights: [
      { en: 'Proprietary velocity loops', ua: 'Фірмові петлі швидкості' },
      { en: 'Aerospace grade titanium', ua: 'Авіаційний титан' },
      { en: 'Limited production', ua: 'Лімітоване виробництво' },
    ],
  },
  'Tubi Style': {
    headline: { en: 'Tubi Style Maranello', ua: 'Tubi Style — звук Маранелло' },
    description: {
      en: 'The historic sound of Italian supercars, born and bred next to the Ferrari factory.',
      ua: 'Історичний звук італійських суперкарів, народжений поруч із заводом Ferrari.',
    },
    highlights: [
      { en: 'Inconel racing systems', ua: 'Гоночні системи з інконелю' },
      { en: 'Restoration classics', ua: 'Класика реставрації' },
      { en: 'OEM supplier heritage', ua: 'Спадщина постачальника OEM' },
    ],
  },
  'Fabspeed': {
    headline: { en: 'Fabspeed Motorsport', ua: 'Fabspeed — автоспорт США' },
    description: {
      en: 'Precision-crafted exhaust and intake systems for Porsche, Ferrari, and McLaren.',
      ua: 'Прецизійні системи вихлопу та впуску для Porsche, Ferrari та McLaren.',
    },
    highlights: [
      { en: 'Dyno-proven performance', ua: 'Підтверджена діно продуктивність' },
      { en: 'Lifetime warranty', ua: 'Довічна гарантія' },
      { en: 'CNC mandrel bending', ua: 'CNC гнуття' },
    ],
  },
  'Supersprint': {
    headline: { en: 'Supersprint Headers', ua: 'Supersprint — колектори' },
    description: {
      en: 'The authority on exhaust headers and complete systems, dyno-tuned for maximum gains.',
      ua: 'Авторитет у колекторах та повних системах, налаштованих на стенді для максимуму.',
    },
    highlights: [
      { en: 'Individual pipe sizing', ua: 'Індивідуальний підбір труб' },
      { en: 'HJS catalytic converters', ua: 'Каталізатори HJS' },
      { en: 'Long-tube headers', ua: 'Довгі колектори' },
    ],
  },
  'Nitron Suspension': {
    headline: { en: 'Nitron Racing Shocks', ua: 'Nitron — гоночні амортизатори' },
    description: {
      en: 'Hand-built suspension systems from the UK, dominating track days and Nurburgring records.',
      ua: 'Ручної збірки підвіски з Британії, що домінують на трек-днях та Нюрбургринзі.',
    },
    highlights: [
      { en: 'NTR R1/R3 kits', ua: 'Комплекти NTR R1/R3' },
      { en: 'Titanium finish', ua: 'Титанове покриття' },
      { en: 'Custom spring rates', ua: 'Індивідуальні пружини' },
    ],
  },
  'BC Racing': {
    headline: { en: 'BC Racing Coilovers', ua: 'BC Racing — койловери' },
    description: {
      en: 'The most customizable coilover platform for street and track, offering immense value and performance.',
      ua: 'Найбільш кастомізована платформа койловерів для вулиці та треку.',
    },
    highlights: [
      { en: 'BR & ER series', ua: 'Серії BR та ER' },
      { en: 'Custom valving options', ua: 'Опції кастомних клапанів' },
      { en: 'Swift Spring upgrades', ua: 'Апгрейд пружин Swift' },
    ],
  },
  'MCA Suspension': {
    headline: { en: 'MCA Time Attack', ua: 'MCA — тайм-аттак підвіска' },
    description: {
      en: "Australian engineered suspension that powers the world's fastest time attack cars.",
      ua: 'Австралійська підвіска, що приводить у рух найшвидші тайм-аттак авто світу.',
    },
    highlights: [
      { en: 'Red Series competition', ua: 'Змагальна серія Red' },
      { en: 'Gold Series street', ua: 'Вулична серія Gold' },
      { en: 'Traction modulation', ua: 'Модуляція зачепу' },
    ],
  },
  'Hardrace': {
    headline: { en: 'Hardrace Chassis Control', ua: 'Hardrace — контроль шасі' },
    description: {
      en: 'Reinforced suspension arms, bushings, and mounts to eliminate flex and sharpen steering.',
      ua: 'Посилені важелі, сайлентблоки та опори для усунення люфтів та гостроти керма.',
    },
    highlights: [
      { en: 'Pillow ball bushings', ua: 'ШС-з\'єднання' },
      { en: 'Adjustable camber/toe', ua: 'Регульований розвал/сходження' },
      { en: 'Harden rubber mounts', ua: 'Посилені гумові опори' },
    ],
  },
  'SPL Parts': {
    headline: { en: 'SPL Titanium Arms', ua: 'SPL — титанові важелі' },
    description: {
      en: 'High-strength adjustable suspension links for precise alignment on lowered and track cars.',
      ua: 'Високоміцні регульовані важелі для точного розвалу на занижених та трекових авто.',
    },
    highlights: [
      { en: 'Titanium hardware', ua: 'Титанова фурнітура' },
      { en: 'FK rod ends', ua: 'ШС FK' },
      { en: 'Made in USA', ua: 'Вироблено в США' },
    ],
  },
  'Airlift Performance': {
    headline: { en: 'Airlift 3H/3P Systems', ua: 'Airlift — пневмосистеми' },
    description: {
      en: 'Performance air suspension that combines "show" stance with "go" handling capabilities.',
      ua: 'Продуктивна пневмопідвіска, що поєднує стенс для шоу з керованістю для їзди.',
    },
    highlights: [
      { en: '3H height management', ua: 'Керування висотою 3H' },
      { en: 'Track-tested dampers', ua: 'Перевірені на треку амортизатори' },
      { en: 'Bolt-on fitment', ua: 'Bolt-on встановлення' },
    ],
  },
  'ADV.1 wheels': {
    headline: { en: 'ADV.1 Engineered Design', ua: 'ADV.1 — інженерний дизайн' },
    description: {
      en: 'The industry leader in concave wheel design and engineering, offering limitless customization for exotics.',
      ua: 'Лідер індустрії в дизайні та інженерії увігнутих дисків, що пропонує безмежну кастомізацію для екзотики.',
    },
    highlights: [
      { en: 'Track Spec configurations', ua: 'Конфігурації Track Spec' },
      { en: 'Hidden hardware options', ua: 'Опції прихованої фурнітури' },
      { en: 'Aerospace aluminum', ua: 'Авіаційний алюміній' },
    ],
  },
  'Strasse wheels': {
    headline: { en: 'Strasse Performance Series', ua: 'Strasse — серія Performance' },
    description: {
      en: 'High-performance 3-piece wheels built for speed and style, featuring deep concave profiles and carbon fiber barrels.',
      ua: 'Високопродуктивні 3-секційні диски для швидкості та стилю, з глибоким конкейвом та карбоновими ободами.',
    },
    highlights: [
      { en: 'Carbon fiber barrels', ua: 'Карбонові ободи' },
      { en: 'Deep concave profiles', ua: 'Глибокі профілі конкейв' },
      { en: 'Floating spoke designs', ua: 'Дизайн плаваючих спиць' },
    ],
  },
  'MV Forged': {
    headline: { en: 'MV Forged Bespoke', ua: 'MV Forged — індивідуальне кування' },
    description: {
      en: 'Precision-milled forged wheels that blend modern aesthetics with motorsport-grade weight reduction.',
      ua: 'Прецизійно фрезеровані ковані диски, що поєднують сучасну естетику зі зниженням ваги рівня автоспорту.',
    },
    highlights: [
      { en: 'Spoke-Lite technology', ua: 'Технологія Spoke-Lite' },
      { en: 'Modular assembly', ua: 'Модульна збірка' },
      { en: 'Aero-discs available', ua: 'Доступні аеро-диски' },
    ],
  },
  'AL13 wheels': {
    headline: { en: 'AL13 Design House', ua: 'AL13 — дім дизайну' },
    description: {
      en: 'The pinnacle of wheel design, offering intricate machining and multi-piece construction for the most discerning builds.',
      ua: 'Вершина дизайну дисків, що пропонує складну обробку та багатосекційну конструкцію для найвибагливіших проєктів.',
    },
    highlights: [
      { en: '4-piece construction', ua: '4-секційна конструкція' },
      { en: 'Precision machining', ua: 'Прецизійна обробка' },
      { en: 'Exotic finishes', ua: 'Екзотичні фініші' },
    ],
  },
  '1221 wheels': {
    headline: { en: '1221 Advanced Metallurgy', ua: '1221 — передова металургія' },
    description: {
      en: 'Utilizing proprietary alloy blends and AP3X technology to create the lightest and strongest wheels on the market.',
      ua: 'Використання фірмових сплавів та технології AP3X для створення найлегших та найміцніших дисків на ринку.',
    },
    highlights: [
      { en: 'AP3X forging technology', ua: 'Технологія кування AP3X' },
      { en: 'Proprietary alloy blends', ua: 'Фірмові суміші сплавів' },
      { en: 'Lightweight optimization', ua: 'Оптимізація ваги' },
    ],
  },
  'Stoptech': {
    headline: { en: 'Stoptech High Performance', ua: 'Stoptech — висока продуктивність' },
    description: {
      en: 'Balanced brake upgrades with stiffer calipers and larger rotors for improved heat capacity and modulation.',
      ua: 'Збалансовані апгрейди гальм із жорсткішими супортами та більшими дисками для кращої теплоємності та модуляції.',
    },
    highlights: [
      { en: 'Trophy Big Brake Kits', ua: 'Комплекти Trophy Big Brake' },
      { en: 'AeroRotors', ua: 'Аеро-ротори' },
      { en: 'Stainless steel lines', ua: 'Армовані шланги' },
    ],
  },
  'Girodisc': {
    headline: { en: 'Girodisc Racing Rotors', ua: 'Girodisc — гоночні диски' },
    description: {
      en: 'Two-piece floating rotors designed to reduce unsprung weight and increase cooling efficiency for track cars.',
      ua: 'Двосекційні плаваючі диски, розроблені для зниження непідресореної маси та покращення охолодження трекових авто.',
    },
    highlights: [
      { en: 'Direct replacement fitment', ua: 'Встановлення в штатні місця' },
      { en: 'High-carbon iron rings', ua: 'Кільця з високовуглецевого чавуну' },
      { en: 'Aluminum hats', ua: 'Алюмінієві центри' },
    ],
  },
  'Paragon brakes': {
    headline: { en: 'Paragon Track Systems', ua: 'Paragon — трекові системи' },
    description: {
      en: 'Motorsport-grade braking components offering exceptional durability and performance for club racers and time attack.',
      ua: 'Гальмівні компоненти рівня автоспорту, що пропонують виняткову витривалість та продуктивність для клубних гонок.',
    },
    highlights: [
      { en: '6-piston calipers', ua: '6-поршневі супорти' },
      { en: 'Titanium pistons available', ua: 'Доступні титанові поршні' },
      { en: 'Anti-knockback springs', ua: 'Пружини проти відбою' },
    ],
  },
  'Sachs Performance': {
    headline: { en: 'Sachs Performance Clutch', ua: 'Sachs Performance — зчеплення' },
    description: {
      en: 'Engineering excellence from ZF Race Engineering, delivering reinforced clutches and suspension for tuned vehicles.',
      ua: 'Інженерна досконалість від ZF Race Engineering: посилені зчеплення та підвіска для тюнінгованих авто.',
    },
    highlights: [
      { en: 'Sintered metal clutch discs', ua: 'Металокерамічні диски зчеплення' },
      { en: 'CSS coilover kits', ua: 'Комплекти койловерів CSS' },
      { en: 'OEM quality standards', ua: 'Стандарти якості OEM' },
    ],
  },
  'STOPART ceramic': {
    headline: { en: 'STOPART Carbon Ceramic', ua: 'STOPART — карбон-кераміка' },
    description: {
      en: 'Advanced carbon ceramic brake upgrades for ultimate fade resistance and weight reduction on high-performance cars.',
      ua: 'Передові карбон-керамічні гальма для максимальної стійкості до перегріву та зниження ваги на потужних авто.',
    },
    highlights: [
      { en: 'Carbon ceramic rotors', ua: 'Карбон-керамічні диски' },
      { en: 'High-temp pads', ua: 'Високотемпературні колодки' },
      { en: 'Bespoke caliper adapters', ua: 'Індивідуальні адаптери супортів' },
    ],
  },
  'RS-R': {
    headline: { en: 'RS-R Suspension & Active', ua: 'RS-R — підвіска та актив' },
    description: {
      en: 'Premium Japanese suspension components known for their high quality and innovative active suspension compatibility.',
      ua: 'Преміальні японські компоненти підвіски, відомі своєю якістю та сумісністю з активними підвісками.',
    },
    highlights: [
      { en: 'Best-i Active coilovers', ua: 'Койловери Best-i Active' },
      { en: 'Ti2000 titanium springs', ua: 'Титанові пружини Ti2000' },
      { en: 'Ran-Up oil additives', ua: 'Присадки Ran-Up' },
    ],
  },
  'Wagner Tuning': {
    headline: { en: 'Wagner Tuning Intercoolers', ua: 'Wagner Tuning — інтеркулери' },
    description: {
      en: 'High-performance intercoolers and downpipes engineered in Germany for maximum cooling and flow.',
      ua: 'Високопродуктивні інтеркулери та даунпайпи, розроблені в Німеччині для максимального охолодження та потоку.',
    },
    highlights: [
      { en: 'Competition intercoolers', ua: 'Інтеркулери Competition' },
      { en: 'Cast end tanks', ua: 'Литі баки' },
      { en: 'Flow-optimized downpipes', ua: 'Оптимізовані даунпайпи' },
    ],
  },
  'Gruppe-M': {
    headline: { en: 'GruppeM Ram Air Systems', ua: 'GruppeM — системи Ram Air' },
    description: {
      en: 'Premium carbon fiber intake systems from Japan, designed to maximize airflow and engine response.',
      ua: 'Преміальні карбонові системи впуску з Японії, розроблені для максимізації потоку повітря та відгуку двигуна.',
    },
    highlights: [
      { en: 'Ram Air System technology', ua: 'Технологія Ram Air System' },
      { en: 'Hand-laid carbon fiber', ua: 'Карбон ручної викладки' },
      { en: 'K&N filter elements', ua: 'Фільтруючі елементи K&N' },
    ],
  },
  'BMC': {
    headline: { en: 'BMC Air Filters', ua: 'BMC — повітряні фільтри' },
    description: {
      en: 'The choice of F1 and supercar manufacturers, offering high-flow air filters and carbon dynamic airboxes.',
      ua: 'Вибір виробників F1 та суперкарів: фільтри високого потоку та карбонові динамічні короби.',
    },
    highlights: [
      { en: 'CDA (Carbon Dynamic Airbox)', ua: 'CDA (Карбоновий динамічний короб)' },
      { en: 'OTA (Oval Trumpet Airbox)', ua: 'OTA (Овальний короб)' },
      { en: 'OEM replacement filters', ua: 'Фільтри для заміни OEM' },
    ],
  },
  'ARMA Speed': {
    headline: { en: 'ARMA Speed Carbon', ua: 'ARMA Speed — карбон' },
    description: {
      en: 'Innovative carbon fiber intake systems with variable air valves and 3D dry carbon technology.',
      ua: 'Інноваційні карбонові системи впуску зі змінними клапанами та технологією 3D сухого карбону.',
    },
    highlights: [
      { en: 'Variable air valve system', ua: 'Система змінних повітряних клапанів' },
      { en: 'Hyper-Flow carbon intakes', ua: 'Карбонові впуски Hyper-Flow' },
      { en: '3D dry carbon finish', ua: 'Фініш 3D сухий карбон' },
    ],
  },
  'Alpha-N': {
    headline: { en: 'Alpha-N Performance', ua: 'Alpha-N — продуктивність' },
    description: {
      en: 'German engineering focused on carbon fiber bodywork and performance upgrades for BMW M models.',
      ua: 'Німецька інженерія, зосереджена на карбонових кузовних елементах та апгрейдах для BMW M.',
    },
    highlights: [
      { en: 'Carbon intake plenums', ua: 'Карбонові ресивери впуску' },
      { en: 'Lightweight body panels', ua: 'Легкі кузовні панелі' },
      { en: 'Clubsport setups', ua: 'Налаштування Clubsport' },
    ],
  },
  'MST Performance': {
    headline: { en: 'MST Performance Intakes', ua: 'MST Performance — впуски' },
    description: {
      en: 'High-quality cold air intake systems designed to improve throttle response and engine sound.',
      ua: 'Високоякісні системи холодного впуску, розроблені для покращення відгуку педалі та звуку двигуна.',
    },
    highlights: [
      { en: 'Cold air intake kits', ua: 'Комплекти холодного впуску' },
      { en: 'Turbo inlet pipes', ua: 'Патрубки входу турбіни' },
      { en: 'Dyno-tested gains', ua: 'Перевірений на діно приріст' },
    ],
  },
  'do88': {
    headline: { en: 'do88 Cooling & Intake', ua: 'do88 — охолодження та впуск' },
    description: {
      en: 'Swedish-engineered cooling and intake solutions for Saab, Volvo, BMW, and Porsche.',
      ua: 'Шведські рішення для охолодження та впуску для Saab, Volvo, BMW та Porsche.',
    },
    highlights: [
      { en: 'Silicone hose kits', ua: 'Комплекти силіконових патрубків' },
      { en: 'Performance intercoolers', ua: 'Продуктивні інтеркулери' },
      { en: 'Carbon intake systems', ua: 'Карбонові системи впуску' },
    ],
  },
  'Karbonius': {
    headline: { en: 'Karbonius Composites', ua: 'Karbonius — композити' },
    description: {
      en: 'The finest autoclave carbon fiber components, specializing in BMW M CSL-style airboxes.',
      ua: 'Найкращі автоклавні карбонові компоненти, що спеціалізуються на ейрбоксах у стилі BMW M CSL.',
    },
    highlights: [
      { en: 'CSL-style airboxes', ua: 'Ейрбокси в стилі CSL' },
      { en: '100% Pre-preg carbon', ua: '100% препрег-карбон' },
      { en: 'OEM-level fitment', ua: 'Пасування рівня OEM' },
    ],
  },
  'Lumma': {
    headline: { en: 'Lumma Design Aerodynamics', ua: 'Lumma — аеродинаміка' },
    description: {
      en: 'Bold widebody conversions and aerodynamic styling kits for premium SUVs and sports cars.',
      ua: 'Сміливі widebody-конверсії та аеродинамічні комплекти для преміальних SUV та спорткарів.',
    },
    highlights: [
      { en: 'CLR widebody kits', ua: 'Widebody-комплекти CLR' },
      { en: 'Custom wheel programs', ua: 'Програми кастомних дисків' },
      { en: 'Interior refinement', ua: 'Оздоблення інтер\'єру' },
    ],
  },
  'Larte Design': {
    headline: { en: 'Larte Design Tuning', ua: 'Larte Design — тюнінг' },
    description: {
      en: 'Exclusive tuning kits made from premium materials like carbon fiber and basalt fiber, certified by TUV Germany.',
      ua: 'Ексклюзивні тюнінг-комплекти з преміальних матеріалів, таких як карбон та базальтове волокно, сертифіковані TUV.',
    },
    highlights: [
      { en: 'TUV certified kits', ua: 'Комплекти з сертифікацією TUV' },
      { en: 'Basalt fiber technology', ua: 'Технологія базальтового волокна' },
      { en: 'Handcrafted quality', ua: 'Якість ручної роботи' },
    ],
  },
  'Ronin Design': {
    headline: { en: 'Ronin Design Body Kits', ua: 'Ronin Design — обвіси' },
    description: {
      en: 'Aggressive and modern body kits designed to transform the aesthetics of high-performance vehicles.',
      ua: 'Агресивні та сучасні обвіси, розроблені для трансформації естетики потужних автомобілів.',
    },
    highlights: [
      { en: 'Modern aesthetic design', ua: 'Сучасний естетичний дизайн' },
      { en: 'Precision fitment', ua: 'Точне пасування' },
      { en: 'Lightweight materials', ua: 'Легкі матеріали' },
    ],
  },
  'Renegade Design': {
    headline: { en: 'Renegade Design Aero', ua: 'Renegade Design — аеро' },
    description: {
      en: 'Unique aerodynamic kits and forged wheels for SUVs and luxury cars, emphasizing individuality.',
      ua: 'Унікальні аеродинамічні комплекти та ковані диски для SUV та люкс-авто, що підкреслюють індивідуальність.',
    },
    highlights: [
      { en: 'Widebody options', ua: 'Опції widebody' },
      { en: 'Forged wheel collection', ua: 'Колекція кованих дисків' },
      { en: '5-year warranty', ua: '5-річна гарантія' },
    ],
  },
  'Liberty Walk': {
    headline: { en: 'Liberty Walk Works', ua: 'Liberty Walk — Works' },
    description: {
      en: 'The originators of the modern widebody movement, offering iconic over-fender kits for Japanese and European exotics.',
      ua: 'Засновники сучасного руху widebody, що пропонують культові комплекти розширення для японської та європейської екзотики.',
    },
    highlights: [
      { en: 'LB-Works widebody', ua: 'Widebody LB-Works' },
      { en: 'LB-Performance aero', ua: 'Аеро LB-Performance' },
      { en: 'Air suspension compatibility', ua: 'Сумісність з пневмопідвіскою' },
    ],
  },
  'Keyvany': {
    headline: { en: 'Keyvany Carbon Experts', ua: 'Keyvany — експерти карбону' },
    description: {
      en: 'High-end carbon fiber body kits and interior upgrades for the most exclusive luxury vehicles.',
      ua: 'Висококласні карбонові обвіси та апгрейди інтер\'єру для найексклюзивніших люкс-авто.',
    },
    highlights: [
      { en: 'Full carbon bodywork', ua: 'Повністю карбоновий кузов' },
      { en: 'Hermes leather interiors', ua: 'Інтер\'єри зі шкіри Hermes' },
      { en: 'Power upgrades', ua: 'Апгрейди потужності' },
    ],
  },
  'Bride': {
    headline: { en: 'Bride Racing Seats', ua: 'Bride — гоночні крісла' },
    description: {
      en: 'Japan\'s premier racing seat manufacturer, offering lightweight holding capability for circuit and drift.',
      ua: 'Провідний японський виробник гоночних крісел, що пропонує легку фіксацію для кільця та дрифту.',
    },
    highlights: [
      { en: 'Low Max system', ua: 'Система Low Max' },
      { en: 'Aramid fiber shells', ua: 'Оболонки з арамідного волокна' },
      { en: 'FIA homologation', ua: 'Омологація FIA' },
    ],
  },
  'Corbeau': {
    headline: { en: 'Corbeau Seats', ua: 'Corbeau — крісла' },
    description: {
      en: 'Affordable and high-quality seating solutions for street, track, and off-road vehicles.',
      ua: 'Доступні та якісні рішення для сидіння для вуличних, трекових та позашляхових авто.',
    },
    highlights: [
      { en: 'Reclining sport seats', ua: 'Спортивні крісла з регулюванням' },
      { en: 'Fixed back racing seats', ua: 'Фіксовані гоночні крісла' },
      { en: 'Harness belts', ua: 'Ремені безпеки' },
    ],
  },
  'OMP': {
    headline: { en: 'OMP Racing', ua: 'OMP — рейсинг' },
    description: {
      en: 'A world leader in motorsport safety equipment, supplying F1 and WRC teams with seats, suits, and steering wheels.',
      ua: 'Світовий лідер у обладнанні безпеки для автоспорту, що постачає команди F1 та WRC кріслами, комбінезонами та кермами.',
    },
    highlights: [
      { en: 'HTE-R carbon seats', ua: 'Карбонові крісла HTE-R' },
      { en: 'Superleggero steering wheels', ua: 'Керма Superleggero' },
      { en: 'Dyneema seatbelts', ua: 'Ремені Dyneema' },
    ],
  },
  'Takata': {
    headline: { en: 'Takata Racing Harnesses', ua: 'Takata — гоночні ремені' },
    description: {
      en: 'Iconic green racing harnesses known for their quality and safety in the JDM and tuning scenes.',
      ua: 'Культові зелені гоночні ремені, відомі своєю якістю та безпекою в JDM та тюнінг-сценах.',
    },
    highlights: [
      { en: 'Drift II & III harnesses', ua: 'Ремені Drift II та III' },
      { en: 'FIA approved models', ua: 'Моделі з схваленням FIA' },
      { en: 'Signature green webbing', ua: 'Фірмова зелена стрічка' },
    ],
  },
  'Schroth': {
    headline: { en: 'Schroth Safety Products', ua: 'Schroth — безпека' },
    description: {
      en: 'Advanced racing harness technology including HANS devices and custom restraint systems for professional motorsport.',
      ua: 'Передові технології гоночних ременів, включаючи системи HANS та індивідуальні системи утримання для професійного автоспорту.',
    },
    highlights: [
      { en: 'HANS devices', ua: 'Пристрої HANS' },
      { en: 'Profi II ASM harnesses', ua: 'Ремені Profi II ASM' },
      { en: 'Flexi belt systems', ua: 'Системи ременів Flexi' },
    ],
  },
  'Sabelt': {
    headline: { en: 'Sabelt Seatbelts & Seats', ua: 'Sabelt — ремені та крісла' },
    description: {
      en: 'Italian safety equipment manufacturer providing high-performance seats and harnesses for Ferrari and McLaren.',
      ua: 'Італійський виробник обладнання безпеки, що надає високопродуктивні крісла та ремені для Ferrari та McLaren.',
    },
    highlights: [
      { en: 'Carbon fiber seats', ua: 'Карбонові крісла' },
      { en: 'Lightweight harnesses', ua: 'Легкі ремені' },
      { en: 'OEM supplier for supercars', ua: 'Постачальник OEM для суперкарів' },
    ],
  },
  'Pure Turbos': {
    headline: { en: 'Pure Turbos Upgrades', ua: 'Pure Turbos — апгрейди' },
    description: {
      en: 'The world leader in pure turbocharger upgrades, offering stock-housing solutions for massive power gains.',
      ua: 'Світовий лідер у апгрейдах турбокомпресорів, що пропонує рішення в штатному корпусі для значного приросту потужності.',
    },
    highlights: [
      { en: 'Pure800 / Pure1000 kits', ua: 'Комплекти Pure800 / Pure1000' },
      { en: 'Billet compressor wheels', ua: 'Фрезеровані компресорні колеса' },
      { en: 'VSR balanced', ua: 'Балансування VSR' },
    ],
  },
  'Vargas Turbo': {
    headline: { en: 'Vargas Turbo Technologies', ua: 'Vargas Turbo — технології' },
    description: {
      en: 'Innovative turbocharger solutions and engine components for BMW, Ford, and VAG platforms.',
      ua: 'Інноваційні рішення для турбокомпресорів та компонентів двигуна для платформ BMW, Ford та VAG.',
    },
    highlights: [
      { en: 'GC / GC+ turbochargers', ua: 'Турбокомпресори GC / GC+' },
      { en: 'Crank bolt capture', ua: 'Фіксатори болта колінвала' },
      { en: 'Billet valve covers', ua: 'Фрезеровані клапанні кришки' },
    ],
  },
  'VF Engineering': {
    headline: { en: 'VF Engineering Superchargers', ua: 'VF Engineering — компресори' },
    description: {
      en: 'Supercharger systems and ECU tuning for Lamborghini, Audi, and BMW, delivering reliable horsepower.',
      ua: 'Системи механічних нагнітачів та тюнінг ECU для Lamborghini, Audi та BMW, що забезпечують надійну потужність.',
    },
    highlights: [
      { en: 'Hex Flash tuning', ua: 'Тюнінг Hex Flash' },
      { en: 'Supercharger kits', ua: 'Комплекти компресорів' },
      { en: 'Water-cooled manifolds', ua: 'Колектори з водяним охолодженням' },
    ],
  },
  'Burger Motorsport': {
    headline: { en: 'BMS JB4 Tuning', ua: 'BMS JB4 — тюнінг' },
    description: {
      en: 'Famous for the JB4 piggyback tuner, offering plug-and-play performance for turbocharged vehicles.',
      ua: 'Відомі завдяки JB4-тюнеру, що пропонує plug-and-play продуктивність для турбованих авто.',
    },
    highlights: [
      { en: 'JB4 performance tuner', ua: 'Тюнер продуктивності JB4' },
      { en: 'Methanol injection kits', ua: 'Комплекти впорскування метанолу' },
      { en: 'Billet intakes', ua: 'Фрезеровані впуски' },
    ],
  },
  'Mountune': {
    headline: { en: 'Mountune Performance', ua: 'Mountune — продуктивність' },
    description: {
      en: 'Ford factory-backed tuning upgrades, delivering warranty-friendly power for Fiesta and Focus ST/RS.',
      ua: 'Тюнінг-апгрейди з підтримкою заводу Ford, що забезпечують потужність зі збереженням гарантії для Fiesta та Focus ST/RS.',
    },
    highlights: [
      { en: 'MP / MR power packages', ua: 'Пакети потужності MP / MR' },
      { en: 'Forged engine components', ua: 'Ковані компоненти двигуна' },
      { en: 'Intercooler upgrades', ua: 'Апгрейди інтеркулерів' },
    ],
  },
  'Bell Intercoolers': {
    headline: { en: 'Bell Intercoolers Custom', ua: 'Bell Intercoolers — кастом' },
    description: {
      en: 'Custom aluminum intercoolers and heat exchangers built to specification for racing and industrial applications.',
      ua: 'Кастомні алюмінієві інтеркулери та теплообмінники, виготовлені за специфікацією для гонок та промисловості.',
    },
    highlights: [
      { en: 'Custom core sizes', ua: 'Індивідуальні розміри ядер' },
      { en: 'Bar and plate construction', ua: 'Конструкція Bar and plate' },
      { en: 'High-pressure testing', ua: 'Тестування високим тиском' },
    ],
  },
};
