import { SiteContent } from "@/types/site-content";

export const defaultSiteContent: SiteContent = {
  hero: {
    badge: "onecompany · B2B wholesale importer",
    title: "Premium performance importer",
    subtitle:
      "B2B wholesale for workshops, detailing studios & tuning shops. Expert programs for VIP clients.",
    ctaAutoLabel: "Automotive",
    ctaMotoLabel: "Motorcycles",
    scrollLabel: "Scroll",
    globalPresence: "B2B wholesale since 2007",
    brandPromise: "200+ brands for trade partners",
    atelierAddress: "21B Baseina St · Kyiv Importer",
  },
  marqueeBrands: [
    "Aston Martin Racing",
    "Brabus",
    "Akrapovič",
    "KW Suspensions",
    "Novitec",
    "Eventuri",
    "ABT Sportsline",
    "TechArt",
    "Ruf Automobile",
    "Z Performance",
    "Capristo",
  ],
  statHighlights: [
    { value: "18", label: "years of heritage" },
    { value: "200+", label: "performance marques" },
    { value: "36h", label: "global logistics" },
    { value: "4", label: "continents weekly" },
  ],
  values: ["PERFORMANCE", "QUALITY", "SERVICE", "SOUND", "INNOVATION"],
  brandSections: {
    automotive: [
      { name: "Eventuri", logo: "/logos/eventuri.png" },
      { name: "KW Suspension", logo: "/logos/kw-official.png" },
      { name: "TechArt", logo: "/logos/techart.svg" },
      { name: "Urban Automotive", logo: "/logos/urban-automotive.png" },
      { name: "HRE Wheels", logo: "/logos/hre-wheels.png" },
      { name: "Brembo", logo: "/logos/brembo.png" },
      { name: "Akrapovič", logo: "/logos/akrapovic.png" },
      { name: "Liberty Walk", logo: "/logos/liberty-walk.png" },
      { name: "Vorsteiner", logo: "/logos/vorsteiner.png" },
      { name: "Milltek", logo: "/logos/milltek.png" },
      { name: "FI Exhaust", logo: "/logos/fi-exhaust.png" },
      { name: "Remus", logo: "/logos/remus.png" },
      { name: "IPE Exhaust", logo: "/logos/ipe-exhaust.png" },
      { name: "Capristo", logo: "/logos/capristo.png" },
      { name: "Armytrix", logo: "/logos/armytrix.png" },
    ],
    moto: [
      { name: "Akrapovič", logo: "/logos/akrapovic.png" },
      { name: "SC-Project", logo: "/logos/sc-project.png" },
      { name: "Rizoma", logo: "/logos/rizoma.webp" },
      { name: "Brembo", logo: "/logos/brembo.png" },
      { name: "Arrow", logo: "/logos/arrow.png" },
      { name: "Yoshimura", logo: "/logos/yoshimura.png" },
      { name: "Scorpion", logo: "/logos/scorpion.png" },
      { name: "Alpha Racing", logo: "/logos/alpha-racing.png" },
      { name: "CNC Racing", logo: "/logos/cnc-racing.png" },
    ],
  },
  productCategories: [
    { name: "Exhaust Systems", description: "Valved exhausts, headers, titanium race systems" },
    { name: "Suspension", description: "Coilovers, adaptive damping, motorsport setups" },
    { name: "Wheels & Brakes", description: "Forged wheels, carbon-ceramic upgrades, aero discs" },
    { name: "Carbon Fiber", description: "Aero programs, interior trim, structural upgrades" },
    { name: "Engine Tuning", description: "ECU calibrations, hybrid turbos, intake systems" },
    { name: "Body Kits", description: "Widebody programs, splitters, GT diffusers" },
    { name: "Interior", description: "Seats, steering, telemetry, bespoke materials" },
    { name: "Cooling", description: "Intercoolers, radiators, oil cooling solutions" },
  ],
  contactCta: {
    heading: "Ready to upgrade?",
    body: "Expert engineers on-call for bespoke specs, logistics, and fitment worldwide.",
    buttonLabel: "Get in touch",
    buttonHref: "/contact",
  },
  contactPage: {
    heroBadge: "B2B Wholesale Importer · відповідь до 12 годин",
    infoBody:
      "Команда відповідає українською, англійською та польською. Підготуйте VIN та список бажаних оновлень — одразу зможемо дати реальні строки та вартість.",
    timezoneNote: "Kyiv · UTC+2 · щоденні оновлення статусу",
    slaPromise: "Середній час першої відповіді — 2 години у робочі дні / 6 годин у вихідні.",
    messengerTagline: "Хочете швидке уточнення? Напишіть у месенджер — відповімо з черги лідів.",
    budgets: [
      "€3k–€7k · street aero & sound",
      "€8k–€15k · підвіска та гальма",
      "€15k+ · трекові та rally raid комплекти",
    ],
    channels: [
      {
        id: "email",
        label: "B2B wholesale email",
        value: "info@onecompany.global",
        note: "Відповідь до 12 годин",
        type: "email",
      },
      {
        id: "phone",
        label: "Support phone",
        value: "+380 66 077 17 00",
        note: "10:00–21:00 GMT+2",
        type: "phone",
      },
      {
        id: "telegram",
        label: "Telegram",
        value: "@onecompany_global",
        note: "B2B запити",
        type: "telegram",
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        value: "+380 66 077 17 00",
        note: "Глобальні клієнти",
        type: "whatsapp",
      },
    ],
    successStories: [
      {
        id: "rs6-logistics",
        badge: "Logistics 72h",
        title: "Audi RS6 · повний Stage 2",
        summary:
          "Закрили spec лист за 3 дні: Akrapovic, Eventuri, KW V4, Brembo. Доставка Київ — Варшава — Київ з митним супроводом.",
        metric: "72h",
        metricLabel: "door-to-door",
      },
      {
        id: "panigale-track",
        badge: "Moto race",
        title: "Panigale V4R · трековий пакет",
        summary:
          "Fi titanium, STM slipper clutch, Öhlins, carbon protection. Передали мото у збірці, провели трек-сесію.",
        metric: "+28hp",
        metricLabel: "dyno verified",
      },
      {
        id: "g63-widebody",
        badge: "Design lab",
        title: "G63 · widebody + interior",
        summary:
          "TechArt bodykit, HRE forged, повний інтер'єр з алькантари та карбону. Координація 4 підрядників.",
        metric: "6 weeks",
        metricLabel: "from brief",
      },
    ],
    messengerHandles: {
      telegram: "https://t.me/onecompany_global",
      whatsapp: "https://wa.me/380660771700",
      phone: "+380660771700",
    },
  },
  blog: {
    instagramUrl: "https://www.instagram.com/onecompany.global",
    instagramHandle: "@onecompany.global",
    posts: [
      {
        id: "ig-2026-02-06-darwinpro",
        slug: "darwinpro-bmw8-widetrack",
        title: {
          ua: "DarwinPro BMW 8 Widetrack · Карбоновий комплект",
          en: "DarwinPro BMW 8 Widetrack · Carbon Kit",
        },
        caption: {
          ua: "Перетворіть свою BMW (G14/G15/G16) на ексклюзивний проєкт з комплектом Widetrack від DarwinPro. Використовуємо тільки «сухий» карбон (Prepreg) для ідеальної міцності та стилю. До комплекту входять:\n—Front Lip- хижий профіль.\n—Side Skirts- атлетичні лінії.\n—Rear Diffuser- агресивний фініш.\n—Swan Neck Wing- максимальний притиск.\nМи в One Company забезпечуємо прямі поставки та гарантуємо 100% оригінальність кожної деталі.\nЗалиште заявку через форму на сайті — підберемо ваш ідеальний комплект! 🏁",
          en: "Transform your BMW (G14/G15/G16) into an exclusive project with the Widetrack kit from DarwinPro. We use only dry carbon (Prepreg) for perfect strength and style. The kit includes:\n—Front Lip — aggressive profile.\n—Side Skirts — athletic lines.\n—Rear Diffuser — aggressive finish.\n—Swan Neck Wing — maximum downforce.\nAt One Company we provide direct supply and guarantee 100% authenticity of every part.\nLeave a request via the contact form — we'll find your perfect kit! 🏁",
        },
        date: "2026-02-06T12:00:00.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["onecompany", "darwinpro", "bmw8", "tuning", "carbon"],
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-02-06",
            type: "image" as const,
            src: "/images/blog/DUbIS32DOtX-3.jpg",
            alt: "DarwinPro BMW 8 Widetrack carbon kit",
          },
        ],
      },
      {
        id: "ig-2026-02-03-3d-design",
        slug: "3d-design-bmw-exhaust-tips",
        title: {
          ua: "3D Design · Насадки вихлопу BMW G8X/G9X",
          en: "3D Design · BMW G8X/G9X Exhaust Tips",
        },
        caption: {
          ua: "Навіть такий нюанс, як насадки вихлопної системи, може повністю змінити характер задньої частини авто. Представляємо преміальні насадки від 3D Design для моделей BMW G8X (M2, M3, M4) та G9X (M5).\nЦе саме той випадок, коли японська якість зустрічається з німецькою потужністю.\nДоступні у двох варіантах виконання:\n—Polished: класичний дзеркальний блиск полірованої сталі.\n—Carbon: сучасний агресивний вигляд з високоякісним вуглецевим волокном.\nЗробіть свій автомобіль унікальним. Для консультації та замовлення — залиште заявку на сайті! 🏁",
          en: "Even a detail as subtle as exhaust tips can completely change the character of the rear end. Introducing premium tips from 3D Design for BMW G8X (M2, M3, M4) and G9X (M5) models.\nThis is where Japanese quality meets German power.\nAvailable in two finishes:\n—Polished: classic mirror shine of polished steel.\n—Carbon: modern aggressive look with premium carbon fiber.\nMake your car unique. For consultation and ordering — leave a request on our website! 🏁",
        },
        date: "2026-02-03T12:00:00.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["bmw", "mperfomance", "onecompany", "3ddesign", "тюнінг"],
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-02-03",
            type: "image" as const,
            src: "/images/blog/DUTF_x9DPIl-4.jpg",
            alt: "3D Design BMW exhaust tips",
          },
        ],
      },
      {
        id: "ig-2026-01-30-urban-automotive",
        slug: "urban-range-rover-widetrack",
        title: {
          ua: "Urban · Range Rover Widetrack Kit",
          en: "Urban · Range Rover Widetrack Kit",
        },
        caption: {
          ua: "Ваш Range Rover заслуговує на більше, ніж просто заводський вигляд. Urban Widetrack Kit - це поєднання карбонового стилю та атлетичних форм.\nПовністю карбоновий передній бампер, матрична решітка радіатора з візуального вуглеволокна та інтегровані денні ходові вогні. Розширені колісні арки Widetrack (технологія PU-Rim) та карбонові накладки на пороги створюють масивний і впевнений силует. Завершують образ ексклюзивні 24-дюймові ковані диски.\nЩо входить у комплект?\n—Повний боді-кіт з візуального карбону (бампери, спліттери, дифузори).\n—Брендовані написи Urban на капот та багажник.\n—Вибір дизайну 24\" легкосплавних дисків.\n—Опціональні висувні або фіксовані бічні підніжки.\nБажаєте виділити свій Range Rover серед інших? Залиште заявку через форму зворотного зв'язку. 🏁",
          en: "Your Range Rover deserves more than just a factory look. Urban Widetrack Kit combines carbon style with athletic forms.\nFull carbon front bumper, matrix grille with visual carbon fiber and integrated daytime running lights. Widened Widetrack fender arches (PU-Rim technology) and carbon sill covers create a massive, confident silhouette. Exclusive 24-inch forged wheels complete the look.\nWhat's included?\n—Full visual carbon body kit (bumpers, splitters, diffusers).\n—Branded Urban lettering on hood and trunk.\n—Choice of 24\" alloy wheel designs.\n—Optional retractable or fixed side steps.\nWant to set your Range Rover apart? Contact us via the form below. 🏁",
        },
        date: "2026-01-30T12:00:00.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["rangerovertuning", "widetrack", "onecompanyglobal", "onecompany"],
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-01-30",
            type: "image" as const,
            src: "/images/blog/DUImF4bjCgv-1.jpg",
            alt: "Urban Range Rover Widetrack Kit",
          },
        ],
      },
      {
        id: "ig-2026-01-29-brabus",
        slug: "brabus-performance",
        title: {
          ua: "Brabus · Нова реальність потужності",
          en: "Brabus · A New Reality of Power",
        },
        caption: {
          ua: "Є автомобілі, а є Brabus. Це бренд, який десятиліттями диктує правила в індустрії преміального доопрацювання. Коли стандартних потужностей та комфорту стає замало, Brabus створює нову реальність, де кожна деталь є втіленням сили та бездоганного стилю.\nЙого фундамент - це продуктивність без меж: від інтелектуальних блоків PowerXtra до повної перебудови двигуна, що докорінно змінює сприйняття швидкості. Кожен елемент карбонового обвісу проходить випробування в аеродинамічній трубі, забезпечуючи реальну притискну силу та стабільність на дорозі. Довершують образ легендарні ковані диски серії Monoblock.\nМи забезпечуємо прямі поставки з Німеччини, гарантуючи стовідсоткову автентичність кожної позиції.\nГотові вивести свій автомобіль на рівень Brabus? Залиште заявку на сайті! 🏁",
          en: "There are cars, and then there is Brabus. A brand that has been setting the rules in the premium refinement industry for decades. When standard power and comfort are not enough, Brabus creates a new reality where every detail embodies strength and impeccable style.\nIts foundation is limitless performance: from intelligent PowerXtra modules to complete engine rebuilds that fundamentally change the perception of speed. Every carbon body element is wind-tunnel tested, delivering real downforce and road stability. The legendary Monoblock forged wheels complete the look.\nWe provide direct supply from Germany, guaranteeing 100% authenticity of every item.\nReady to elevate your car to Brabus level? Leave a request — we'll find the right solution. 🏁",
        },
        date: "2026-01-29T12:00:00.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["onecompany", "onecompanyglobal", "brabus", "тюнінг"],
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-01-29",
            type: "image" as const,
            src: "/images/blog/DUGFrvdDCzP-1.jpg",
            alt: "Brabus premium tuning",
          },
        ],
      },
      {
        id: "ig-2026-01-26-ct-carbon",
        slug: "ct-carbon-rsq8",
        title: {
          ua: "CT Carbon · Audi RSQ8 Facelift тюнінг",
          en: "CT Carbon · Audi RSQ8 Facelift Tuning",
        },
        caption: {
          ua: "Audi RSQ8 Facelift + CT Carbon = 🔥\nДосконалість не має меж, але має чіткі лінії. Представляємо повний комплект тюнінгу від CT Carbon, створений спеціально для оновленого Audi RSQ8.\nКожна деталь виготовлена з високоякісного вуглецевого волокна з глянцевим фінішем.\n—Carbon Gloss Front Spoiler- для впевненого вигляду та кращої аеродинаміки.\n—Gloss Carbon Side Skirt Extensions- візуально занижують силует.\n—Carbon Gloss Trunk & Roof Spoilers- подвійний акцент на спортивному стилі ззаду.\nЦе не просто стайлінг - це маніфест сили на дорозі.\nЩоб отримати консультацію та замовити тюнінг на ваше авто - просто залиште заявку через контактну форму. 🏁",
          en: "Audi RSQ8 Facelift + CT Carbon = 🔥\nPerfection has no limits, but it has clean lines. Introducing the full tuning kit from CT Carbon, designed specifically for the updated Audi RSQ8.\nEvery part is made from high-quality carbon fiber with a gloss finish.\n—Carbon Gloss Front Spoiler — confident look and improved aerodynamics.\n—Gloss Carbon Side Skirt Extensions — visually lower the silhouette.\n—Carbon Gloss Trunk & Roof Spoilers — double accent on sporty style at the rear.\nThis is not just styling — it's a statement of power on the road.\nFor consultation and ordering — just fill out the contact form. 🏁",
        },
        date: "2026-01-26T14:00:00.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["RSQ8Facelift", "CTCarbon", "onecompanyglobal", "тюнінг", "carbonbodykit"],
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-01-26-ct",
            type: "image" as const,
            src: "/images/blog/DT-4lpxDFRy-2.jpg",
            alt: "CT Carbon Audi RSQ8 Facelift tuning kit",
          },
        ],
      },
      {
        id: "ig-2026-01-26-ipe",
        slug: "ipe-exhaust-valvetronic",
        title: {
          ua: "iPE · Valvetronic вихлопна система",
          en: "iPE · Valvetronic Exhaust System",
        },
        caption: {
          ua: "Існує просто вихлоп, а існує iPE. Бренд, що став світовим стандартом для власників суперкарів та преміальних авто.\n—Valvetronic System. Фірмова система клапанів, що працює від вакууму. Ви самі вирішуєте: залишатися непомітним у потоці чи відкрити всю потужність одним натисканням кнопки.\n—Матеріали та вага. Використання титану та преміальної сталі марки T304 дозволяє суттєво полегшити задню частину авто.\n—Тонка настройка частот. Інженери iPE фокусуються на високих частотах. Це звук, який не «давить» на вуха, а викликає мурахи по шкірі.\n—Дизайн насадок. Кожна деталь виглядає як витвір інженерного мистецтва.\nМи забезпечуємо прямі поставки iPE з повною заводською гарантією.\nГотові змінити звучання свого авто? Залиште заявку на сайті! 🏁",
          en: "There is just an exhaust, and then there is iPE. The brand that has become the global standard for supercar and premium vehicle owners.\n—Valvetronic System. Proprietary vacuum-operated valve system. You decide: stay quiet in traffic or unleash full power at the push of a button.\n—Materials & Weight. Titanium and premium T304 steel significantly reduce rear-end weight.\n—Fine-tuned Frequencies. iPE engineers focus on high frequencies. A sound that doesn't overwhelm, but sends chills down your spine.\n—Tip Design. Every part looks like a work of engineering art.\nWe provide direct iPE supply with full factory warranty.\nReady to change how your car sounds? Leave a request on our website! 🏁",
        },
        date: "2026-01-26T10:00:00.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["onecompany", "onecompanyglobal", "iPE", "тюнінг"],
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-01-26-ipe",
            type: "image" as const,
            src: "/images/blog/DT-XLbLjQEb-1.jpg",
            alt: "iPE Valvetronic exhaust system",
          },
        ],
      },
      {
        id: "ig-2026-01-22-eventuri",
        slug: "eventuri-intake",
        title: {
          ua: "Eventuri · Системи впуску повітря",
          en: "Eventuri · Air Intake Systems",
        },
        caption: {
          ua: "Більшість систем впуску на ринку просто замінюють пластик на карбон. Eventuri пішли іншим шляхом. Вони переосмислили потік повітря, створивши «ефект Вентурі», який дає реальний приріст потужності.\n—Запатентований корпус. Унікальна форма фільтра, перевернутого догори дном, забезпечує ламінарний потік повітря.\n—Карбон преміум-класу. Плетіння ідеальної якості, яке витримує критичні температури.\n—Звук впуску. Ви почуєте, як турбіна «дихає». Це агресивний, благородний звук.\n—Температурний контроль. Карбонові повітрозабірники мінімізують нагрів повітря.\nМи забезпечуємо прямі поставки з Великобританії.\nБажаєте додати своєму авто «правильного» повітря? Залиште заявку на сайті! 🏁",
          en: 'Most intake systems on the market simply replace plastic with carbon. Eventuri took a different path. They reimagined airflow, creating a "Venturi effect" that delivers real power gains.\n—Patented Housing. A unique upside-down filter shape ensures laminar airflow.\n—Premium Carbon. Perfect-quality weave that withstands critical temperatures.\n—Intake Sound. You\'ll hear the turbo "breathe". An aggressive, refined sound.\n—Temperature Control. Carbon air scoops minimize air heating.\nWe provide direct supply from the United Kingdom.\nWant to give your car the "right" air? Leave a request on our website! 🏁',
        },
        date: "2026-01-22T12:00:00.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["onecompany", "onecompanyglobal", "eventuri", "тюнінг"],
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-01-22",
            type: "image" as const,
            src: "/images/blog/DT0NWC8DCsl-1.jpg",
            alt: "Eventuri air intake system",
          },
        ],
      },
      {
        id: "ig-2026-01-21-adro",
        slug: "adro-bmw-g8x-carbon",
        title: {
          ua: "ADRO · Карбоновий обвіс BMW G8X",
          en: "ADRO · BMW G8X Carbon Aero Kit",
        },
        caption: {
          ua: "ADRO - це бренд, що змінив правила гри для нового покоління G8X. Їхній карбоновий обвіс - не просто тюнінг, а повна корекція візуальної ідентичності «емок».\nКомплект включає:\n—Prepreg Front Lip. Передня губа, яка візуально робить морду агресивнішою.\n—Prepreg Side Skirts. Бокові пороги, що додають силуету стрімкості.\n—Swan Neck Wing. Легендарне антикрило типу «лебедина шия».\n—Prepreg Rear Diffuser. Дифузор, що ідеально завершує задню частину авто.\nМи беремо на себе всі питання логістики та митного оформлення. Ви отримуєте офіційний продукт ADRO з гарантією оригінальності.\nБажаєте змінити вигляд своєї BMW G8X? Залиште заявку через форму на сайті! 🏁",
          en: "ADRO is a brand that changed the game for the new G8X generation. Their carbon aero kit is not just tuning — it's a complete visual identity overhaul for the M cars.\nThe kit includes:\n—Prepreg Front Lip. A front lip that makes the nose visually more aggressive.\n—Prepreg Side Skirts. Side skirts that add a sense of speed to the silhouette.\n—Swan Neck Wing. The legendary swan-neck rear wing.\n—Prepreg Rear Diffuser. A diffuser that perfectly finishes the rear end.\nWe handle all logistics and customs clearance. You receive an official ADRO product with an authenticity guarantee.\nWant to transform your BMW G8X? Leave a request via the contact form! 🏁",
        },
        date: "2026-01-21T12:00:00.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["onecompany", "onecompanyglobal", "adro", "bmwm3", "bmwm4"],
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-01-21",
            type: "image" as const,
            src: "/images/blog/DTx1PMAjARI-2.jpg",
            alt: "ADRO BMW G8X carbon aero kit",
          },
        ],
      },
      {
        id: "ig-2026-01-20-akrapovic",
        slug: "akrapovic-titanium",
        title: {
          ua: "Akrapovič · Титанова вихлопна система",
          en: "Akrapovič · Titanium Exhaust System",
        },
        caption: {
          ua: "Якщо у світі тюнінгу і є бренд, який не потребує презентації, то це Akrapovič. Вихлопні системи виготовляються з запатентованого титану, що витримує екстремальні температури та важить удвічі менше за заводську сталь.\nЦе не просто «гучніше» - це правильний відвід газів, що додає реальні кінські сили та крутний момент. Окрім технічних характеристик, Akrapovič забезпечує високу ліквідність: автомобіль із такою системою завжди цінується вище на вторинному ринку.\nМи в One Company забезпечуємо прямий імпорт оригінальних систем із заводською гарантією.\nХочете почути, як звучатиме саме ваше авто? Залиште заявку на сайті! 🏁",
          en: "If there is one brand in the tuning world that needs no introduction, it's Akrapovič. Exhaust systems are made from patented titanium that withstands extreme temperatures and weighs half as much as factory steel.\nIt's not just \"louder\" — it's proper gas flow that adds real horsepower and torque. Beyond technical specs, Akrapovič ensures high resale value: a car with this system is always worth more on the secondary market.\nAt One Company we provide direct import of original systems with factory warranty.\nWant to hear how your car would sound? Leave a request on our website! 🏁",
        },
        date: "2026-01-20T12:00:00.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["onecompany", "onecompanyglobal", "akrapovic", "тюнінг"],
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-01-20",
            type: "image" as const,
            src: "/images/blog/DTu98JODL1s-1.jpg",
            alt: "Akrapovič titanium exhaust system",
          },
        ],
      },
      {
        id: "ig-2026-01-19-onecompany",
        slug: "onecompany-premium-import",
        title: {
          ua: "One Company · Професійний імпорт преміального тюнінгу",
          en: "One Company · Premium Tuning Import",
        },
        caption: {
          ua: "One Company. Професійний імпорт преміального тюнінгу.\nМи працюємо з 2007 року. Наша задача-забезпечити доступ до найкращих інженерних рішень світу без ризиків, підробок та логістичних проблем.\nАвтентичність: Тільки оригінальні деталі з офіційною гарантією від виробника. Жодних компромісів із якістю.\nМасштаб: Прямий доступ до 200+ найкращих брендів Європи, США та Азії в одному вікні.\nГарантія: Тільки автентичні деталі з заводською гарантією. Жодних компромісів із якістю.\nМи повністю закриваємо питання підбору та доставки. Ви отримуєте прогнозований результат незалежно від складності запиту.\nПотрібен прайс або консультація? Залиште заявку через форму на сайті! 📨",
          en: "One Company. Professional import of premium tuning.\nWe have been working since 2007. Our goal is to provide access to the best engineering solutions worldwide without risks, counterfeits, or logistics issues.\nAuthenticity: Only original parts with official manufacturer warranty. No compromises on quality.\nScale: Direct access to 200+ top brands from Europe, the USA, and Asia in one window.\nWarranty: Only authentic parts with factory warranty. No compromises on quality.\nWe fully cover selection and delivery. You get a predictable result regardless of the request complexity.\nNeed a price list or consultation? Fill out the contact form! 📨",
        },
        date: "2026-01-19T11:10:24.000Z",
        location: {
          ua: "Україна",
          en: "Ukraine",
        },
        tags: ["onecompany", "tuningglobal", "onecompanyglobal", "тюнінг"],
        pinned: true,
        status: "published" as const,
        media: [
          {
            id: "media-ig-2026-01-19",
            type: "image" as const,
            src: "/images/blog/DTsKmdmjFgF-1.jpg",
            alt: "One Company premium tuning import",
          },
        ],
      },
    ],
  },
};
