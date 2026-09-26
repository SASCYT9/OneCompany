import fs from "node:fs";
import path from "node:path";

const outputDir = path.resolve("tmp/fi-products");
fs.mkdirSync(outputDir, { recursive: true });

const products = [
  {
    sku: "AD-R825F-CBV + R2016OL + OBD-CAB-V", baseSku: "AD-R825F-CBV", msrp: 5250, page: 3,
    make: "Audi", modelUa: "Audi R8 V10 / V10 Plus MK2.5", modelEn: "Audi R8 V10 / V10 Plus MK2.5", yearsUa: "2018+ за прайсом; звірити ринок/VIN", yearsEn: "2018+ per price list; confirm market/VIN", yearFrom: 2018, yearTo: null, engineUa: "V10", engineEn: "V10", opf: "with", chassis: "4S facelift / MK2.5", bodyUa: "купе або Spyder", bodyEn: "Coupe or Spyder", configUa: "OPF, Valvetronic Muffler і стандартний remote", configEn: "OPF, Valvetronic Muffler and standard remote", configShortUa: "OPF", configShortEn: "OPF Valvetronic", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "AD-R825F-CBV + R2016OL + OBD-CAB-V", image: "https://www.fi-exhaust.com/uploads/product/en/r8_mk2.5.jpg", alt: "Fi EXHAUST для Audi R8 MK2.5 V10", video: null,
    source: "NEW USD-1.pdf p.3; Fi EXHAUST PD1670568388830; store.fi-exhaust.com R8 collection", control: "remote",
    introUa: "Fi EXHAUST для Audi R8 V10 та V10 Plus покоління MK2.5 адресований власникам, яким потрібен виразніший тембр атмосферного V10 із можливістю керувати клапанами. Ця позиція в прайсі позначена саме для OPF-автомобілів; вона не є універсальним варіантом для всіх R8.",
    introEn: "This Fi EXHAUST application is for the Audi R8 V10 and V10 Plus facelift generation MK2.5. It is listed specifically for OPF-equipped cars and pairs the model-specific valved muffler with a standard remote-control module. The exact year and market specification should be matched to the vehicle before ordering.",
    detailUa: "Комплект побудований навколо Valvetronic Muffler: закриті клапани спрямовують потік через глушник для спокійнішого режиму, а відкрите положення змінює подачу та гучність. У цій комплектації в прайсі окремо вказані стандартний модуль дистанційного керування R2016OL та кабель OBD-CAB-V.",
    detailEn: "The package centers on a valvetronic muffler. With the valves closed, exhaust flow is routed through the muffler for a more restrained drive; opening them changes the sound volume and character. This listed configuration includes the R2016OL standard remote module and OBD-CAB-V cable, so the selected SKU identifies more than the muffler alone.",
    soundUa: "Атмосферний V10 має власний високочастотний характер, тому ця система розрахована на зміну звучання через клапани, а не на одну постійну гучність. Керування залежить від встановленого модуля й сумісності з електронікою конкретного авто; стандартний remote у рядку комплектації дозволяє окремо задавати положення клапанів.",
    soundEn: "The naturally aspirated V10 has a distinctive high-rev character, and this setup lets the driver change the exhaust volume through the valves instead of relying on one fixed sound level. Control depends on the vehicle electronics and the listed module; the standard remote in this package provides a separate way to command the valves.",
    buyerUa: "У прайсі для facelift MK2.5 зазначено 2018+, а сторінки Fi можуть відображати інший мінімальний рік залежно від ринку та ревізії системи. Перед оформленням зіставте VIN, наявність OPF і тип кузова. Це важливо для вибору правильного глушника та підключення клапанів.",
    buyerEn: "The supplied price list gives 2018+ for the MK2.5 facelift, while Fi catalogue pages may show a later starting year for a market-specific revision. Before ordering, confirm the VIN, OPF presence and body style. These details determine whether this muffler and its valve connections match the car.",
    apps: [{ make: "Audi", model: "R8 V10 / V10 Plus", chassisCode: "4S MK2.5", yearFrom: 2018, yearTo: null, engine: "V10", bodyStyle: "Coupe / Spyder", opfGpf: "with" }],
  },
  {
    sku: "BN-96MF-CBE + TIP70114S*4 + CAB-BTB*2", baseSku: "BN-96MF-CBE", msrp: 5200, page: 17,
    make: "BMW", modelUa: "BMW X5 M F95 / X6 M F96 EU6 I OPF", modelEn: "BMW X5 M F95 / X6 M F96 EU6 I OPF", yearsUa: "2020–2023", yearsEn: "2020–2023", yearFrom: 2020, yearTo: 2023, engineUa: "4.4TT S63", engineEn: "4.4TT S63", opf: "with", chassis: "F95 / F96", bodyUa: "позашляховик", bodyEn: "SUV", configUa: "EU6 I OPF, cat-back із чотирма срібними насадками", configEn: "EU6 I OPF cat-back with four silver tips", configShortUa: "EU6 I OPF", configShortEn: "EU6 I OPF", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-96MF-CBE + TIP70114S*4 + CAB-BTB*2", image: "https://www.fi-exhaust.com/uploads/product/en/x6m-f96-x5m-f95%20%281%29.jpg", alt: "Fi EXHAUST для BMW X5 M F95 та X6 M F96", video: "L8uRDAZA46I",
    source: "NEW USD-1.pdf p.17; Fi EXHAUST PD1627444192905", control: "oem",
    introUa: "Ця версія Fi EXHAUST призначена для BMW X5 M F95 та X6 M F96 із нормою EU6 I та фільтром OPF. Вона відрізняється від не-OPF і EU6 II рішень окремим кодом основної системи, тому важливо не вибирати її лише за назвою моделі чи двигуна.",
    introEn: "This Fi EXHAUST configuration is intended for BMW X5 M F95 and X6 M F96 vehicles with EU6 I emissions equipment and an OPF filter. It is distinct from the non-OPF and EU6 II versions, so the vehicle’s emissions specification matters as much as the model and engine when selecting the system.",
    detailUa: "Позиція включає cat-back систему, комплект із чотирьох срібних насадок TIP70114S та два CAB-BTB подовжувачі. Fi описує цю генерацію як сумісну з оригінальними електричними клапанами та штатними налаштуваннями; remote у наведеній комплектації не вказаний.",
    detailEn: "The listed package combines the cat-back system with four TIP70114S silver tips and two CAB-BTB valve-extension cables. Fi’s F95/F96 description identifies the system as compatible with the original electronic valve motors and stock settings. A separate remote is not shown in this package line.",
    soundUa: "Клапани допомагають перемикати характер вихлопу між більш стриманим і відкритим режимом. У цій конфігурації керування зберігає штатну логіку BMW, без окремого remote в комплекті. Такий варіант доречний для власника, який хоче залишити заводське керування й отримати повний cat-back із срібними насадками.",
    soundEn: "The valves let the driver move between a more restrained and a more open exhaust character. This configuration retains BMW’s original valve-control logic and does not list a separate remote. It suits an owner who wants the complete cat-back and silver tips while keeping the factory control approach.",
    buyerUa: "Перед замовленням звірте виробничу дату, ринок та код екологічної версії: EU6 I OPF відрізняється від EU6 II OPF навіть у межах тих самих кузовів. Для F95 і F96 перевірте також штатні моторчики клапанів. Інші насадки чи дистанційні модулі в цей код не входять.",
    buyerEn: "Before ordering, check the production date, market and emissions version: EU6 I OPF differs from EU6 II OPF even on the same chassis. Also confirm the factory valve motors on the F95 or F96. Tip colors or remote-control upgrades beyond the listed silver set are separate options.",
    apps: [
      { make: "BMW", model: "X5 M", chassisCode: "F95", yearFrom: 2020, yearTo: 2023, engine: "4.4TT S63", bodyStyle: "SUV", market: "EU6 I", opfGpf: "with" },
      { make: "BMW", model: "X6 M", chassisCode: "F96", yearFrom: 2020, yearTo: 2023, engine: "4.4TT S63", bodyStyle: "SUV", market: "EU6 I", opfGpf: "with" },
    ],
  },
  {
    sku: "BN-96MF2-CBE + TIP70114S*4 + CAB-4BTB*2", baseSku: "BN-96MF2-CBE", msrp: 5200, page: 18,
    make: "BMW", modelUa: "BMW X5 M F95 / X6 M F96 EU6 II OPF", modelEn: "BMW X5 M F95 / X6 M F96 EU6 II OPF", yearsUa: "2020.11–2023", yearsEn: "2020.11–2023", yearFrom: 2020, yearTo: 2023, engineUa: "4.4TT S63", engineEn: "4.4TT S63", opf: "with", chassis: "F95 / F96", bodyUa: "позашляховик", bodyEn: "SUV", configUa: "EU6 II OPF, cat-back із чотирма срібними насадками", configEn: "EU6 II OPF cat-back with four silver tips", configShortUa: "EU6 II OPF", configShortEn: "EU6 II OPF", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-96MF2-CBE + TIP70114S*4 + CAB-4BTB*2", image: "https://www.fi-exhaust.com/uploads/product/en/x6m-f96-x5m-f95%20%281%29.jpg", alt: "Fi EXHAUST для BMW X5 M F95 та X6 M F96", video: "L8uRDAZA46I",
    source: "NEW USD-1.pdf p.18; Fi EXHAUST PD1627444192905", control: "oem",
    introUa: "EU6 II OPF — окрема конфігурація для BMW X5 M F95 та X6 M F96, яку не слід змішувати з EU6 I лише через однаковий кузов і мотор S63. У Fi EXHAUST для цих версій окремі індекси передньої секції; код BN-96MF2-CBE визначає саме варіант EU6 II.",
    introEn: "EU6 II OPF is a separate configuration for the BMW X5 M F95 and X6 M F96. It should not be treated as interchangeable with EU6 I simply because the chassis and S63 engine are shared. Fi assigns a separate system code to this emissions revision; BN-96MF2-CBE identifies the EU6 II package.",
    detailUa: "Комплект містить cat-back, чотири срібні насадки TIP70114S і два кабелі CAB-4BTB. За описом виробника, клапани сумісні зі штатними електромоторами й налаштуваннями. Саме тип кабелю в цій збірці відрізняється від EU6 I, тому важливо звірити комплектацію автомобіля.",
    detailEn: "The package lists a cat-back, four TIP70114S silver tips and two CAB-4BTB cables. Fi describes its F95/F96 valvetronic system as compatible with factory electronic valve motors and stock settings. The cable configuration differs from EU6 I, which makes the emissions revision a key part of the fitment check.",
    soundUa: "Система зберігає клапанний принцип Fi: закрите положення проводить потік через глушник, відкрите змінює гучність і тембр. Ця версія не додає окремий remote у вказаному рядку; керування залишається в межах штатної логіки клапанів. Чотири срібні насадки — стандартна частина цього SKU.",
    soundEn: "The valvetronic layout follows Fi’s two-mode approach: with valves closed, flow is routed through the muffler; with them open, volume and tone change. The listed package does not include a separate remote, so valve operation remains tied to the factory setup. Four silver tips are part of this SKU.",
    buyerUa: "Перевірте VIN, місяць виробництва та підтвердження EU6 II OPF до замовлення. Не підміняйте цю версію кодом EU6 I або не-OPF системою. Якщо автомобіль має іншу конфігурацію клапанів чи насадок, узгодьте її окремо; аксесуари, не перелічені в package-коді, не входять автоматично.",
    buyerEn: "Confirm the VIN, production month and EU6 II OPF specification before ordering. Do not substitute the EU6 I or non-OPF system. If the vehicle has a different valve or tip setup, confirm it separately; accessories absent from the package code are not automatically included.",
    apps: [
      { make: "BMW", model: "X5 M", chassisCode: "F95", yearFrom: 2020, yearTo: 2023, engine: "4.4TT S63", bodyStyle: "SUV", market: "EU6 II", opfGpf: "with" },
      { make: "BMW", model: "X6 M", chassisCode: "F96", yearFrom: 2020, yearTo: 2023, engine: "4.4TT S63", bodyStyle: "SUV", market: "EU6 II", opfGpf: "with" },
    ],
  },
  {
    sku: "BN-G06B58F-CBE + CAB-BT2B + ACT-BN", baseSku: "BN-G06B58F-CBE", msrp: 4300, page: 13,
    make: "BMW", modelUa: "BMW X5 G05 / X6 G06 40i OPF", modelEn: "BMW X5 G05 / X6 G06 40i OPF", yearsUa: "2019–2022 за прайсом", yearsEn: "2019–2022 per price list", yearFrom: 2019, yearTo: 2022, engineUa: "3.0T B58", engineEn: "3.0T B58", opf: "with", chassis: "G05 / G06", bodyUa: "SUV", bodyEn: "SUV", configUa: "OPF cat-back із керуванням штатними клапанами", configEn: "OPF cat-back retaining factory valve control", configShortUa: "OPF", configShortEn: "OPF", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-G06B58F-CBE + CAB-BT2B + ACT-BN", image: "https://www.fi-exhaust.com/uploads/product/en/x5-x6-40i%20non-OPF%20%285%29.jpg", alt: "Fi EXHAUST для BMW X5 G05 та X6 G06 40i", video: null,
    source: "NEW USD-1.pdf p.13; Fi EXHAUST PD1627455183975", control: "oem",
    introUa: "Fi EXHAUST для BMW X5 G05 та X6 G06 40i створений для шестициліндрового B58 і версії з OPF. У прайсі позиція обмежена роками 2019–2022; виробник окремо показує OPF-код та кабелі клапанів, тож для пізнішого модельного року потрібно повторно звірити SKU.",
    introEn: "This Fi EXHAUST application is for the BMW X5 G05 and X6 G06 40i with the B58 engine and OPF equipment. The supplied price list narrows the position to 2019–2022, while Fi’s product page separates OPF and non-OPF packages. Later model years should be matched against the exact code before ordering.",
    detailUa: "OPF-версія поєднує передню секцію, mid-pipe та Valvetronic Muffler. У переліку також є CAB-BT2B і ACT-BN — компоненти системи клапанів. Downpipe в наведеній комплектації не зазначений, тому не включений у товар автоматично.",
    detailEn: "The OPF package combines the front section, mid-pipe and valvetronic muffler. CAB-BT2B and ACT-BN are also listed in the supplied configuration as valve-system components. A downpipe is not named in this package line and is therefore not included automatically with this listing.",
    soundUa: "Клапанна конструкція дозволяє змінювати гучність вихлопу, зберігаючи можливість користуватися штатним керуванням автомобіля. Ця комплектація не перелічує окремий пульт Fi; перед замовленням важливо перевірити, що встановлений заводський мотор клапана відповідає версії G05/G06 та регіональній специфікації.",
    soundEn: "The valved design lets the driver change exhaust volume while retaining the factory control approach. This package line does not list a separate Fi remote. Before ordering, confirm the original valve motor and the regional G05/G06 specification, especially where the vehicle’s emissions hardware differs from the price-list application.",
    buyerUa: "Для підбору звірте шасі G05 або G06, двигун B58, рік та наявність OPF. Фото виробника показує ту саму модельну родину, але конкретний пакет потрібно визначати за кодом BN-G06B58F-CBE. Кольорові насадки, remote чи downpipe не додаються, якщо їх немає в коді замовлення.",
    buyerEn: "For fitment, verify G05 versus G06 chassis, B58 engine, model year and OPF presence. The manufacturer image represents the same vehicle family, but the package is determined by BN-G06B58F-CBE. Colored tips, a remote or a downpipe are not added unless their codes appear in the order configuration.",
    apps: [
      { make: "BMW", model: "X5 40i", chassisCode: "G05", yearFrom: 2019, yearTo: 2022, engine: "3.0T B58", bodyStyle: "SUV", opfGpf: "with" },
      { make: "BMW", model: "X6 40i", chassisCode: "G06", yearFrom: 2019, yearTo: 2022, engine: "3.0T B58", bodyStyle: "SUV", opfGpf: "with" },
    ],
  },
  {
    sku: "BN-G16B58F-CBE + ACT-BN + CAB-BT2B", baseSku: "BN-G16B58F-CBE", msrp: 4800, page: 11,
    make: "BMW", modelUa: "BMW 840i Gran Coupe G16 OPF", modelEn: "BMW 840i Gran Coupe G16 OPF", yearsUa: "2019+", yearsEn: "2019+", yearFrom: 2019, yearTo: null, engineUa: "3.0T B58", engineEn: "3.0T B58", opf: "with", chassis: "G16", bodyUa: "Gran Coupe", bodyEn: "Gran Coupe", configUa: "OPF cat-back, штатне керування клапанами без remote", configEn: "OPF cat-back with factory valve control and no remote", configShortUa: "OPF", configShortEn: "OPF", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-G16B58F-CBE + ACT-BN + CAB-BT2B", image: "https://www.fi-exhaust.com/uploads/product/en/840i%20G16%20GC%20%28OPF%29%20X%20Fi%20%281%29.jpg", alt: "Fi EXHAUST для BMW 840i G16 Gran Coupe", video: null,
    source: "NEW USD-1.pdf p.11; Fi EXHAUST PD1627455873325", control: "oem",
    introUa: "Для BMW 840i Gran Coupe G16 із двигуном B58 ця OPF-комплектація додає клапанний cat-back, зберігаючи штатне керування автомобіля. Вона орієнтована на власників, яким потрібен модельний вихлоп із можливістю змінювати характер звуку без окремого remote у цьому наборі.",
    introEn: "For the BMW 840i Gran Coupe G16 with the B58 engine, this OPF package adds a valved cat-back while retaining factory valve control. It is aimed at owners who want a vehicle-specific exhaust and adjustable sound without a separate remote in this listed configuration.",
    detailUa: "До складу входять передня секція, mid-pipe та Valvetronic Muffler, а також ACT-BN і CAB-BT2B для підключення клапанів. Насадки не вказані як окремий компонент у вихідному пакеті; опційні downpipe та Fi Pro Remote продаються окремо й не слід додавати їх до цієї картки.",
    detailEn: "The source configuration lists a front section, mid-pipe and valvetronic muffler together with ACT-BN and CAB-BT2B for the valve connection. Tips are not named as a separate item in this package line. Optional downpipes and the Fi Pro remote remain separate items and should not be assumed included.",
    soundUa: "Fi описує G16 систему як сумісну з оригінальним електричним клапаном без дистанційного керування. Закритий режим проводить гази через глушник для спокійнішого звучання, а відкритий змінює тон і гучність. Реальна робота залежить від режимів керування, доступних на конкретному автомобілі.",
    soundEn: "Fi describes the G16 system as compatible with the original electric valve and supplied without a remote. In the closed position, exhaust flow passes through the muffler for a calmer sound; opening the valve changes tone and volume. Actual operation depends on the control modes available on the specific car.",
    buyerUa: "Перед замовленням підтвердіть, що автомобіль є саме G16 840i Gran Coupe з B58 та OPF. Для інших 8 Series, кузовів або двигунів потрібна інша позиція. Якщо потрібне керування через Fi Pro App, звірте окремий код комплекту з менеджером до оформлення замовлення.",
    buyerEn: "Before ordering, confirm that the car is a G16 840i Gran Coupe with the B58 engine and OPF. Other 8 Series body styles or engines require a different application. If Fi Pro App control is required, confirm its separate module code with the sales team before placing the order.",
    apps: [{ make: "BMW", model: "840i Gran Coupe", chassisCode: "G16", yearFrom: 2019, yearTo: null, engine: "3.0T B58", bodyStyle: "Gran Coupe", opfGpf: "with" }],
  },
  {
    sku: "BN-G29B48-CBE + TIP63114S*2 + CAB-BTB", baseSku: "BN-G29B48-CBE", msrp: 3000, page: 13,
    make: "BMW", modelUa: "BMW Z4 G29 20i / 30i без OPF", modelEn: "BMW Z4 G29 20i / 30i non-OPF", yearsUa: "2019+", yearsEn: "2019+", yearFrom: 2019, yearTo: null, engineUa: "2.0T B48", engineEn: "2.0T B48", opf: "without", chassis: "G29", bodyUa: "родстер", bodyEn: "Roadster", configUa: "версія без OPF, клапанний cat-back і дві срібні насадки", configEn: "non-OPF valved cat-back with two silver tips", configShortUa: "без OPF", configShortEn: "non-OPF", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-G29B48-CBE + TIP63114S*2 + CAB-BTB", image: "https://www.fi-exhaust.com/uploads/product/en/Z4-01.jpg", alt: "Fi EXHAUST для BMW Z4 G29 20i та 30i", video: "KxKt5_uaDgE",
    source: "NEW USD-1.pdf p.13; Fi EXHAUST PD1654848181566", control: "oem",
    introUa: "Ця версія призначена для BMW Z4 G29 із B48 2.0T без OPF. Вона поєднує Valvetronic cat-back із двома срібними насадками та кабелем клапана; від OPF-варіанта відрізняється основним кодом і має підбиратися за фактичною системою очищення вихлопу.",
    introEn: "This configuration is for the BMW Z4 G29 with the B48 2.0T engine and no OPF. It combines a valvetronic cat-back with two silver tips and a valve cable. The main system code differs from the OPF version, so selection should follow the vehicle’s actual exhaust equipment.",
    detailUa: "Для родстера важливо перевірити не тільки двигун, а й наявність фільтра частинок та штатного електроклапана. Комплект містить BN-G29B48-CBE, TIP63114S*2 і CAB-BTB. Remote-модуль у цьому рядку не зазначений, тому не включений автоматично.",
    detailEn: "On this roadster, the engine code alone is not enough: confirm the particulate filter and original electric valve setup. The listed package contains BN-G29B48-CBE, two TIP63114S silver tips and CAB-BTB. A remote module is not shown in this line and is not automatically part of the SKU.",
    soundUa: "Клапанна конструкція дає змогу зберегти спокійніший режим під час щоденного руху й відкрити виразніший тон за потреби. Fi вказує модельно налаштований звук і використання заводського керування там, де його підтримує автомобіль. Це версія без OPF, а не універсальна заміна OPF-системи.",
    soundEn: "The valved layout allows a more restrained everyday mode and a more pronounced tone when desired. Fi describes its sound as model-tuned and designed to work with factory control where the vehicle supports it. This is specifically the non-OPF version, not a universal replacement for an OPF system.",
    buyerUa: "Перевірте рік виробництва, двигун B48 і конфігурацію без OPF перед замовленням. Для машин із фільтром потрібен інший SKU BN-G29B48F-CBE. Збережіть код системи під час звернення до сервісу: він допомагає не переплутати труби, кабель клапана й комплект насадок.",
    buyerEn: "Confirm the production year, B48 engine and non-OPF configuration before ordering. Cars equipped with the particulate filter require the separate BN-G29B48F-CBE SKU. Keep the system code available for the installer so the pipework, valve cable and tip package are not confused with the OPF version.",
    apps: [{ make: "BMW", model: "Z4 20i / 30i", chassisCode: "G29", yearFrom: 2019, yearTo: null, engine: "2.0T B48", bodyStyle: "Roadster", opfGpf: "without" }],
  },
  {
    sku: "BN-G29B48F-CBE + TIP63114S*2 + CAB-BTB", baseSku: "BN-G29B48F-CBE", msrp: 3000, page: 14,
    make: "BMW", modelUa: "BMW Z4 G29 20i / 30i OPF", modelEn: "BMW Z4 G29 20i / 30i OPF", yearsUa: "2019+", yearsEn: "2019+", yearFrom: 2019, yearTo: null, engineUa: "2.0T B48", engineEn: "2.0T B48", opf: "with", chassis: "G29", bodyUa: "родстер", bodyEn: "Roadster", configUa: "OPF-версія, клапанний cat-back і дві срібні насадки", configEn: "OPF valved cat-back with two silver tips", configShortUa: "OPF", configShortEn: "OPF", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-G29B48F-CBE + TIP63114S*2 + CAB-BTB", image: "https://www.fi-exhaust.com/uploads/product/en/Z4-01.jpg", alt: "Fi EXHAUST для BMW Z4 G29 20i та 30i OPF", video: "KxKt5_uaDgE",
    source: "NEW USD-1.pdf p.14; Fi EXHAUST PD1654848181566", control: "oem",
    introUa: "OPF-версія Fi EXHAUST для BMW Z4 G29 20i/30i підходить до автомобілів із B48 та фільтром частинок. Вона використовує окремий код BN-G29B48F-CBE, срібні подвійні насадки й кабель клапана; саме літера F у коді відділяє цей варіант від системи без OPF.",
    introEn: "This OPF version of the Fi EXHAUST system is for BMW Z4 G29 20i/30i cars with the B48 engine and particulate filter. It uses the distinct BN-G29B48F-CBE code, dual silver tips and valve cable. The F suffix separates it from the non-OPF system for the same chassis.",
    detailUa: "У комплектації перелічені основна cat-back система, дві насадки TIP63114S та CAB-BTB. Насадки срібні, remote окремим рядком не наведений. Якщо авто імпортоване з іншого ринку або було змінене після виробництва, перевірте OPF та тип штатного моторчика клапана за VIN.",
    detailEn: "The configuration lists the cat-back system, two TIP63114S silver tips and CAB-BTB. The tips are silver, and no separate remote appears in the package line. For an imported car or one modified after production, confirm OPF presence and the original valve motor by VIN before choosing this version.",
    soundUa: "Fi застосовує клапанну конструкцію, щоб змінювати гучність залежно від режиму руху. У закритому положенні потік іде через глушник, а при відкритті звучання стає виразнішим. Фактичне керування залежить від заводської електроніки Z4; комплектація не містить окремої Fi Pro системи, якщо її не додано окремо.",
    soundEn: "Fi uses a valved layout to adjust sound volume for different driving situations. With the valves closed, flow is routed through the muffler; opening them makes the exhaust more pronounced. Actual control depends on the Z4’s factory electronics. This configuration does not list a separate Fi Pro system unless purchased separately.",
    buyerUa: "Не використовуйте цю позицію для G29 без OPF: для такого авто в прайсі є окрема система BN-G29B48-CBE. Перед установленням звірте двигун, рік, шасі та заводське керування клапанами. Фото показує ту саму модельну лінійку; код у картці визначає OPF-виконання.",
    buyerEn: "Do not use this position for a non-OPF G29; the price list carries a separate BN-G29B48-CBE system for that car. Before installation, confirm engine, year, chassis and factory valve control. The image represents the same model family; the SKU in this listing identifies the OPF configuration.",
    apps: [{ make: "BMW", model: "Z4 20i / 30i", chassisCode: "G29", yearFrom: 2019, yearTo: null, engine: "2.0T B48", bodyStyle: "Roadster", opfGpf: "with" }],
  },
  {
    sku: "BN-G6030F-CBE", baseSku: "BN-G6030F-CBE", msrp: 3800, page: 10,
    make: "BMW", modelUa: "BMW 530i G60 OPF", modelEn: "BMW 530i G60 OPF", yearsUa: "2023+", yearsEn: "2023+", yearFrom: 2023, yearTo: null, engineUa: "2.0T B48", engineEn: "2.0T B48", opf: "with", chassis: "G60", bodyUa: "седан", bodyEn: "Sedan", configUa: "OPF cat-back із Valvetronic керуванням", configEn: "OPF cat-back with valvetronic control", configShortUa: "OPF", configShortEn: "OPF", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-G6030F-CBE", image: "https://www.fi-exhaust.com/uploads/product/en/G60_530i_exhaust.jpg", alt: "Fi EXHAUST для BMW 530i G60", video: null,
    source: "NEW USD-1.pdf p.10; Fi EXHAUST PD1771819777566", control: "oem",
    introUa: "Fi EXHAUST для BMW 530i G60 — це окрема OPF-конфігурація для покоління, що стартувало з 2023 року. Система розрахована на 2.0T B48 і має підбиратися саме до G60, а не до попередньої 5 Series з подібним двигуном.",
    introEn: "This Fi EXHAUST application is a dedicated OPF configuration for the BMW 530i G60 generation introduced from 2023. It is developed for the 2.0T B48 and should be matched to the G60 chassis rather than an earlier 5 Series that happens to use a similar engine.",
    detailUa: "Основний код комплекту — BN-G6030F-CBE. Виробник описує його як клапанну вихлопну систему для OPF-версії; джерело прайсу не додає remote чи насадки як окремі позиції. Тому картка не обіцяє додаткових аксесуарів, яких немає в цьому SKU.",
    detailEn: "The package code is BN-G6030F-CBE. Fi describes the system as a valved exhaust for the OPF version; the supplied price-list row does not add a remote or separate tip set. This listing therefore does not promise accessories that are absent from this SKU.",
    soundUa: "Клапани змінюють гучність і тембр вихлопу, а штатний режим автомобіля може керувати ними залежно від конфігурації системи. Для цієї позиції окремий модуль дистанційного керування не вказаний. Після монтажу варто перевірити роботу клапана на всіх режимах, передбачених конкретним G60.",
    soundEn: "The exhaust valves change sound volume and tone, while the factory vehicle mode may control them depending on the system configuration. A separate remote module is not listed for this position. After installation, check valve operation across the drive modes available on the specific G60.",
    buyerUa: "Для точного підбору підтвердіть VIN, 530i, шасі G60, двигун B48 та наявність OPF. Інші двигуни G60, 540i чи версії без фільтра потребують іншої перевірки. Ця картка містить основний SKU з прайсу; необумовлені насадки та пульт не додаються.",
    buyerEn: "For accurate fitment, confirm the VIN, 530i model, G60 chassis, B48 engine and OPF equipment. Other G60 engines, 540i variants or cars without a particulate filter require a separate check. This listing carries the main price-list SKU; unlisted tips or a remote are not included.",
    apps: [{ make: "BMW", model: "530i", chassisCode: "G60", yearFrom: 2023, yearTo: null, engine: "2.0T B48", bodyStyle: "Sedan", opfGpf: "with" }],
  },
  {
    sku: "BN-G82MPF-CBE + TIP70101S*4 + CAB-BTB*2", baseSku: "BN-G82MPF-CBE", msrp: 4600, page: 15,
    make: "BMW", modelUa: "BMW M3 G80 / M4 G82 M-Performance, dual mid-pipe", modelEn: "BMW M3 G80 / M4 G82 M-Performance, dual mid-pipe", yearsUa: "2021+", yearsEn: "2021+", yearFrom: 2021, yearTo: null, engineUa: "3.0TT S58", engineEn: "3.0TT S58", opf: "unknown", chassis: "G80 / G82", bodyUa: "седан / купе", bodyEn: "Sedan / Coupe", configUa: "подвійний front-mid cat-back, стиль M Performance", configEn: "dual front-mid cat-back, M Performance style", configShortUa: "M Performance dual", configShortEn: "M Performance dual-pipe", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-G82MPF-CBE + TIP70101S*4 + CAB-BTB*2", image: "https://www.fi-exhaust.com/uploads/product/en/g80-g82-m3-m4-mperformance-exhaust-01.webp", alt: "Fi EXHAUST M Performance для BMW M3 G80 та M4 G82", video: "y7IGQgsyUws",
    source: "NEW USD-1.pdf p.15; Fi EXHAUST PD1657615563160", control: "oem",
    introUa: "Ця конфігурація для BMW M3 G80 та M4 G82 поєднує подвійний front-mid тракт із глушником у стилі M Performance. Інтегрований X-pipe формує відмінний від single mid-pipe характер на високих обертах; код MPF допомагає відрізнити її від single-pipe версій.",
    introEn: "This BMW M3 G80 / M4 G82 configuration pairs a dual front-mid layout with an M Performance-style muffler. The integrated X-pipe gives it a different high-rev character from the single mid-pipe versions. The MPF code distinguishes this package from the single-pipe M Performance and standard layouts.",
    detailUa: "У списку вказані чотири срібні насадки TIP70101S і два CAB-BTB кабелі. Fi описує подвійний X-pipe як джерело більш виразного високочастотного тону. Дифузор M Performance на виробничій сторінці названий опцією, тому він не включений у ціну цього рядка без окремого коду.",
    detailEn: "The price-list package includes four TIP70101S silver tips and two CAB-BTB cables. Fi describes the dual X-pipe as producing a sharper, higher-pitched tone. The manufacturer page identifies the M Performance diffuser as optional, so it is not included in this price-list line unless a separate code is added.",
    soundUa: "Valvetronic клапани зберігають можливість тихішого щоденного режиму й відкритішого звучання під навантаженням. За інформацією Fi, клапани можна інтегрувати зі штатними режимами BMW; remote Fi Pro — окрема опція. Під час вибору перевірте, чи потрібна саме геометрія dual mid-pipe, а не глибший single-pipe тон.",
    soundEn: "Valvetronic valves retain a quieter everyday mode and a more open sound under load. Fi notes that the valves can integrate with BMW’s factory modes; a Fi Pro remote is a separate option. Choose this version when the dual mid-pipe layout is intended, rather than the deeper character associated with the single-pipe setup.",
    buyerUa: "Підбір залежить від покоління й кузова: G80 M3 або G82 M4, мотор S58, рік 2021+ та стан OPF. Прайсова комплектація однакова для двох шасі, але встановлення й опційний дифузор потрібно підтвердити за VIN. Катлесні або 200-cell downpipe не входять у цей пакет.",
    buyerEn: "Fitment depends on chassis and body: G80 M3 or G82 M4, S58 engine, 2021+ model year and OPF status. The price-list configuration covers both chassis, but installation details and any optional diffuser should be confirmed by VIN. Catless or 200-cell downpipes are not part of this package.",
    apps: [
      { make: "BMW", model: "M3", chassisCode: "G80", yearFrom: 2021, yearTo: null, engine: "3.0TT S58", bodyStyle: "Sedan", opfGpf: "unknown" },
      { make: "BMW", model: "M4", chassisCode: "G82", yearFrom: 2021, yearTo: null, engine: "3.0TT S58", bodyStyle: "Coupe", opfGpf: "unknown" },
    ],
  },
  {
    sku: "BN-G82MPSF-CBE + TIP70101S*4 + CAB-BTB*2", baseSku: "BN-G82MPSF-CBE", msrp: 4700, page: 15,
    make: "BMW", modelUa: "BMW M3 G80 / M4 G82 M-Performance, single mid-pipe", modelEn: "BMW M3 G80 / M4 G82 M-Performance, single mid-pipe", yearsUa: "2021+", yearsEn: "2021+", yearFrom: 2021, yearTo: null, engineUa: "3.0TT S58", engineEn: "3.0TT S58", opf: "unknown", chassis: "G80 / G82", bodyUa: "седан / купе", bodyEn: "Sedan / Coupe", configUa: "одинарний mid-pipe cat-back, стиль M Performance", configEn: "single mid-pipe cat-back, M Performance style", configShortUa: "M Performance single", configShortEn: "M Performance single-pipe", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-G82MPSF-CBE + TIP70101S*4 + CAB-BTB*2", image: "https://www.fi-exhaust.com/uploads/product/en/g80-g82-m3-m4-mperformance-exhaust-01.webp", alt: "Fi EXHAUST M Performance single-pipe для BMW M3 та M4", video: "y7IGQgsyUws",
    source: "NEW USD-1.pdf p.15; Fi EXHAUST PD1729485145355", control: "oem",
    introUa: "Single-pipe M Performance версія Fi EXHAUST призначена для BMW M3 G80 і M4 G82 із двигуном S58. Вона відрізняється від MPF dual-пакета конфігурацією mid-pipe: виробник пов’язує single-варіант із глибшим, більш насиченим тембром, зберігаючи M Performance-style задню геометрію.",
    introEn: "This single-pipe M Performance version is for BMW M3 G80 and M4 G82 cars with the S58 engine. It differs from the MPF dual package in its mid-pipe layout; Fi associates the single configuration with a deeper, fuller tone while retaining the M Performance-style rear arrangement.",
    detailUa: "Комплект містить чотири срібні насадки TIP70101S та два кабелі CAB-BTB разом із основною cat-back системою. M Performance дифузор не зазначений у прайсовому package-коді як включений компонент. Якщо автомобіль має стандартний задній вихід, сумісність дифузора слід перевірити окремо.",
    detailEn: "The package lists the cat-back system, four TIP70101S silver tips and two CAB-BTB cables. An M Performance diffuser is not listed as an included component in the price-line code. If the car has the standard rear outlet, confirm diffuser compatibility separately before installation.",
    soundUa: "Single mid-pipe змінює акцент порівняно з подвійним X-pipe: Fi описує його як глибший і більш басовитий варіант із контрольованим тембром S58. Штатна кнопка звуку та режимів може керувати клапанами; у базовому коді окремий Fi remote не вказаний.",
    soundEn: "The single mid-pipe shifts the sound emphasis from the dual X-pipe: Fi describes it as deeper and fuller, with a controlled S58 tone. The factory sound button and drive modes may control the valves; a separate Fi remote is not listed in this base package.",
    buyerUa: "Порівняйте цю картку з BN-G82MPF-CBE перед замовленням: обидві мають M Performance style, але різняться схемою mid-pipe. Перевірте G80 чи G82, модельний рік, OPF та наявний дифузор за VIN. Додаткові downpipe продаються окремо.",
    buyerEn: "Compare this listing with BN-G82MPF-CBE before ordering: both use M Performance styling but differ in mid-pipe architecture. Confirm G80 versus G82, model year, OPF status and diffuser fitment by VIN. Optional downpipes are separate products.",
    apps: [
      { make: "BMW", model: "M3", chassisCode: "G80", yearFrom: 2021, yearTo: null, engine: "3.0TT S58", bodyStyle: "Sedan", opfGpf: "unknown" },
      { make: "BMW", model: "M4", chassisCode: "G82", yearFrom: 2021, yearTo: null, engine: "3.0TT S58", bodyStyle: "Coupe", opfGpf: "unknown" },
    ],
  },
  {
    sku: "BN-G82MSF-CBE + TIP70114S*4 + CAB-BTB*2", baseSku: "BN-G82MSF-CBE", msrp: 4600, page: 15,
    make: "BMW", modelUa: "BMW M3 G80 / M4 G82, single mid-pipe, стандартний вихід", modelEn: "BMW M3 G80 / M4 G82, single mid-pipe, standard outlet", yearsUa: "2021+", yearsEn: "2021+", yearFrom: 2021, yearTo: null, engineUa: "3.0TT S58", engineEn: "3.0TT S58", opf: "unknown", chassis: "G80 / G82", bodyUa: "седан / купе", bodyEn: "Sedan / Coupe", configUa: "одинарний mid-pipe cat-back із класичними чотирма насадками", configEn: "single mid-pipe cat-back with classic quad tips", configShortUa: "single-pipe", configShortEn: "single-pipe", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-G82MSF-CBE + TIP70114S*4 + CAB-BTB*2", image: "https://www.fi-exhaust.com/uploads/product/en/g80-m3-g82-m4-single-front-pipe-exhaust.webp", alt: "Fi EXHAUST single mid-pipe для BMW M3 G80 та M4 G82", video: "jxCM3teU_64",
    source: "NEW USD-1.pdf p.15; Fi EXHAUST PD1729483444658; PD1729480235386", control: "oem",
    introUa: "Це стандартна single mid-pipe cat-back конфігурація для BMW M3 G80 та M4 G82, а не M Performance-style пакет. Вона зберігає класичний quad-tip силует і додає Valvetronic muffler до S58. Для порівняння з іншими позиціями в каталозі використовуйте повний код BN-G82MSF-CBE.",
    introEn: "This is the standard single mid-pipe cat-back configuration for BMW M3 G80 and M4 G82, not the M Performance-style package. It keeps the classic quad-tip rear appearance and adds a valvetronic muffler for the S58. Use the full BN-G82MSF-CBE code when comparing it with the other catalog options.",
    detailUa: "У ціні зазначені чотири срібні насадки TIP70114S та два кабелі CAB-BTB. Fi описує single mid-pipe як глибший і більш насичений за dual X-pipe варіант; стандартний задній вихід відрізняє цей товар від двох M Performance сторінок.",
    detailEn: "The price-list package includes four TIP70114S silver tips and two CAB-BTB cables. Fi describes a single mid-pipe as deeper and fuller than a dual X-pipe setup. The standard rear outlet distinguishes this product from the two M Performance pages for the same chassis.",
    soundUa: "Звук формується поєднанням S58 і клапанного глушника. Із закритими клапанами система залишається придатною до звичайного руху; відкриття підкреслює моторний тембр. За Fi, штатне керування BMW доступне через заводську кнопку/режими, а окремий remote у цьому пакеті не наведений.",
    soundEn: "The sound comes from the S58 engine and valved muffler working together. With the valves closed, the system remains suited to routine driving; opening them brings the engine tone forward. Fi describes factory BMW control through the sound button or modes, while this package does not list a separate remote.",
    buyerUa: "Ця позиція не є front-mid pipe для штатного глушника: це cat-back із власним Valvetronic muffler. Перед оплатою перевірте кузов G80/G82, рік, OPF і бажаний тип насадок. У комплекті за прайсом саме чотири срібні TIP70114S; інші види не включені.",
    buyerEn: "This is not a front-mid pipe intended to retain the factory muffler; it is a cat-back with its own valvetronic muffler. Before purchase, verify G80/G82 chassis, year, OPF and desired tip layout. The price-list package specifies four TIP70114S silver tips; other tip styles are not included.",
    apps: [
      { make: "BMW", model: "M3", chassisCode: "G80", yearFrom: 2021, yearTo: null, engine: "3.0TT S58", bodyStyle: "Sedan", opfGpf: "unknown" },
      { make: "BMW", model: "M4", chassisCode: "G82", yearFrom: 2021, yearTo: null, engine: "3.0TT S58", bodyStyle: "Coupe", opfGpf: "unknown" },
    ],
  },
  {
    sku: "BN-G87MPSF-CBE + TIP70101S*4 + CAB-BTB*2", baseSku: "BN-G87MPSF-CBE", msrp: 4700, page: 14,
    make: "BMW", modelUa: "BMW M2 G87 M-Performance single mid-pipe", modelEn: "BMW M2 G87 M-Performance single mid-pipe", yearsUa: "2022+", yearsEn: "2022+", yearFrom: 2022, yearTo: null, engineUa: "3.0TT S58", engineEn: "3.0TT S58", opf: "unknown", chassis: "G87", bodyUa: "купе", bodyEn: "Coupe", configUa: "single mid-pipe cat-back у стилі M Performance", configEn: "single mid-pipe cat-back in M Performance style", configShortUa: "M Performance single", configShortEn: "M Performance single-pipe", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "BN-G87MPSF-CBE + TIP70101S*4 + CAB-BTB*2", image: "https://www.fi-exhaust.com/uploads/product/en/g87-m2-fi-single-mid-pipe-exhaust-6.jpg", alt: "Fi EXHAUST M Performance single-pipe для BMW M2 G87", video: "lP7WwH-Vrr4",
    source: "NEW USD-1.pdf p.14; Fi EXHAUST PD1727425091662", control: "oem",
    introUa: "Для BMW M2 G87 із двигуном S58 ця позиція поєднує single mid-pipe із заднім глушником у стилі M Performance. Вона орієнтована на глибший, більш басовитий характер, ніж dual-pipe варіант, і допомагає відрізнити повний cat-back від одного mid-pipe для штатного глушника.",
    introEn: "For the BMW M2 G87 with the S58 engine, this position pairs a single mid-pipe with an M Performance-style rear muffler. It is intended for a deeper, fuller tone than a dual-pipe setup and is distinct from a standalone mid-pipe designed to retain the factory muffler.",
    detailUa: "Прайсова комплектація містить чотири срібні TIP70101S і два CAB-BTB кабелі разом із BN-G87MPSF-CBE. Виробник описує M Performance-style задній вигляд як доступний для M Performance та стандартних авто; дифузор може бути опційним залежно від вихідного кузовного оформлення.",
    detailEn: "The price-list package contains four TIP70101S silver tips and two CAB-BTB cables with BN-G87MPSF-CBE. Fi describes the M Performance-style rear layout as usable on M Performance and standard cars; a diffuser may remain an option depending on the car’s original rear styling.",
    soundUa: "Fi пов’язує single mid-pipe з глибшим тоном і керованим тембром S58. Клапани дають змогу змінювати гучність, а заводська кнопка/режими BMW можуть зберігати штатну логіку керування. Якщо потрібне повне відкриття клапанів через remote, перевірте сумісність і замовте окремий модуль.",
    soundEn: "Fi associates the single mid-pipe with a deeper tone and controlled S58 character. Valves provide sound adjustment, while BMW’s factory button and drive modes can retain stock-style control. If full valve opening through a remote is required, confirm compatibility and order the separate control module.",
    buyerUa: "Під час підбору перевірте G87, рік від 2022, OPF/не-OPF та тип заднього дифузора. Катбек цієї сторінки включає глушник; він відрізняється від окремої труби, де потрібне з’єднання зі штатним muffler. Це важлива різниця при встановленні.",
    buyerEn: "For fitment, confirm G87 chassis, 2022+ model year, OPF status and rear diffuser style. This cat-back includes the muffler; it differs from a standalone pipe that connects to the factory muffler. That distinction matters when planning installation and selecting the right package.",
    apps: [
      { make: "BMW", model: "M2", chassisCode: "G87", yearFrom: 2022, yearTo: null, engine: "3.0TT S58", bodyStyle: "Coupe", opfGpf: "with" },
      { make: "BMW", model: "M2", chassisCode: "G87", yearFrom: 2022, yearTo: null, engine: "3.0TT S58", bodyStyle: "Coupe", opfGpf: "without" },
    ],
  },
  {
    sku: "FD-STMK4F-CBE + TIP63127S*2 + ACT-BN + R2016OL + OBD-CAB-5BNE", baseSku: "FD-STMK4F-CBE", msrp: 2650, page: 21,
    make: "Ford", modelUa: "Ford Focus ST MK4 / MK4.5 OPF", modelEn: "Ford Focus ST MK4 / MK4.5 OPF", yearsUa: "2019+", yearsEn: "2019+", yearFrom: 2019, yearTo: null, engineUa: "2.3T EcoBoost", engineEn: "2.3T EcoBoost", opf: "with", chassis: "MK4 / MK4.5", bodyUa: "Hatchback / Wagon", bodyEn: "Hatchback / Wagon", configUa: "OPF front pipe, mid-pipe, клапанний muffler, подвійні срібні насадки та remote", configEn: "OPF front pipe, mid-pipe, valved muffler, dual silver tips and remote", configShortUa: "OPF", configShortEn: "OPF Cat-Back", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "FD-STMK4F-CBE + TIP63127S*2 + ACT-BN + R2016OL + OBD-CAB-5BNE", image: "https://www.fi-exhaust.com/uploads/product/cn/ford-mk4.5-focus-st-fi-valvetronic-exhaust-1.jpg", alt: "Fi EXHAUST для Ford Focus ST MK4.5", video: "c6h5gYcMSJE",
    source: "NEW USD-1.pdf p.21; Fi EXHAUST PD1633327452049 / PD1692848365452", control: "remote",
    introUa: "Fi EXHAUST для Ford Focus ST MK4/MK4.5 адресований автомобілям із 2.3 EcoBoost та OPF. Комплект включає OPF front pipe, mid-pipe, клапанний глушник, дві срібні насадки й стандартний remote-модуль, тож він відрізняється від рішень без OPF та від окремих downpipe.",
    introEn: "This Fi EXHAUST application is for Ford Focus ST MK4/MK4.5 cars with the 2.3 EcoBoost engine and OPF. The listed package includes the OPF front pipe, mid-pipe, valved muffler, two silver tips and standard remote module, separating it from non-OPF applications and standalone downpipes.",
    detailUa: "Основний код FD-STMK4F-CBE доповнений TIP63127S*2, ACT-BN, R2016OL і OBD-CAB-5BNE. Усі ці позиції потрібно звіряти разом: сама наявність двигуна 2.3 EcoBoost не підтверджує, що автомобіль має потрібне виконання OPF чи відповідний тип кузова.",
    detailEn: "The primary system code FD-STMK4F-CBE is accompanied by TIP63127S*2, ACT-BN, R2016OL and OBD-CAB-5BNE. Check the bundle as a whole: the 2.3 EcoBoost engine alone does not confirm OPF fitment or the correct hatchback/wagon body configuration.",
    soundUa: "Клапанний глушник дає водієві змогу переходити між більш спокійною подачею та відкритішим спортивним тоном. Для цього набору вказаний стандартний remote, а не лише штатна кнопка. Звук буде залежати від стану OPF, інших модифікацій вихлопу та коректного монтажу на конкретному Focus ST.",
    soundEn: "The valved muffler lets the driver switch between a more restrained delivery and a more open sport tone. This package lists a standard remote rather than relying only on a factory button. Sound will also depend on OPF condition, other exhaust modifications and correct installation on the specific Focus ST.",
    buyerUa: "Перш ніж оформлювати замовлення, підтвердіть MK4 або MK4.5, Hatchback чи Wagon, рік, 2.3 EcoBoost та OPF. Інший випускний фільтр або інший корпус кузова може вимагати іншого коду. Downpipe та інші опційні частини не входять, якщо їх немає в переліку SKU.",
    buyerEn: "Before ordering, confirm MK4 or MK4.5, hatchback or wagon body, model year, 2.3 EcoBoost and OPF. A different filter or body revision may require another code. A downpipe and other optional parts are not included unless they appear in the package SKU.",
    apps: [{ make: "Ford", model: "Focus ST", chassisCode: "MK4 / MK4.5", yearFrom: 2019, yearTo: null, engine: "2.3T EcoBoost", bodyStyle: "Hatchback / Wagon", opfGpf: "with" }],
  },
  {
    sku: "FR-458-CBV + TIP-458-S + R2016OL + OBD-CAB-V", baseSku: "FR-458-CBV", msrp: 5250, page: 20,
    make: "Ferrari", modelUa: "Ferrari 458 Italia / Spider Race", modelEn: "Ferrari 458 Italia / Spider Race", yearsUa: "2010–2015", yearsEn: "2010–2015", yearFrom: 2010, yearTo: 2015, engineUa: "4.5L V8", engineEn: "4.5L V8", opf: "unknown", chassis: "F142", bodyUa: "купе / Spider", bodyEn: "Coupe / Spider", configUa: "Race cat-back із трьома срібними насадками та стандартним remote", configEn: "Race cat-back with tri-silver tips and standard remote", configShortUa: "Race Version", configShortEn: "Race Version", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "FR-458-CBV + TIP-458-S + R2016OL + OBD-CAB-V", image: "https://www.fi-exhaust.com/uploads/product/en/ferrari_458-italia_race_exhaust_1.jpg", alt: "Fi EXHAUST Race Version для Ferrari 458 Italia", video: "vQ1OHjmoam8",
    source: "NEW USD-1.pdf p.20; Fi EXHAUST PD1631774831458", control: "remote",
    introUa: "Race Version Fi EXHAUST для Ferrari 458 Italia та Spider налаштована під атмосферний 4.5-літровий V8. Це окрема позиція від F1 Version: назва комплектації та системний код FR-458-CBV визначають саме Race виконання, а не універсальний варіант для будь-якого 458.",
    introEn: "The Fi EXHAUST Race Version for Ferrari 458 Italia and Spider is specified for the naturally aspirated 4.5-litre V8. It is a separate position from the F1 Version: the configuration name and FR-458-CBV system code identify the Race setup rather than a universal option for every 458.",
    detailUa: "У ціні прайсу вказані Valvetronic Muffler, комплект насадок TIP-458-S та стандартний модуль керування R2016OL з OBD-CAB-V. Downpipe й headers доступні окремими позиціями й не слід вважати включеними до цієї картки, якщо вони не додані окремо.",
    detailEn: "The price-list bundle identifies a valvetronic muffler, TIP-458-S tip set and standard R2016OL control module with OBD-CAB-V. Downpipes and headers are separate positions and should not be assumed to be included with this listing unless ordered as separate items.",
    soundUa: "Клапани дозволяють змінювати гучність між стриманим режимом і виразнішим відкритим звучанням V8. Remote у цій комплектації зазначений як стандартний, тому важливо перевірити його та кабель у замовленні. Race Version слід відрізняти від F1 Version за кодом, а не тільки за обраною назвою насадок.",
    soundEn: "The valves allow the driver to move between a restrained mode and a more pronounced open V8 sound. A standard remote is listed in this package, so verify the module and cable on the order. Distinguish the Race Version from the F1 Version by the system code, not just by the chosen tip appearance.",
    buyerUa: "Підбір залежить від року 2010–2015, кузова Italia чи Spider та наявних клапанів. Перед монтажем звірте VIN і штатну конфігурацію задньої частини. Опційні headers, catalytic downpipe та інші насадки змінюють комплект; їхня наявність має бути підтверджена окремими кодами.",
    buyerEn: "Fitment depends on the 2010–2015 model year, Italia or Spider body and the installed valve configuration. Confirm the VIN and original rear setup before installation. Optional headers, catalytic downpipes and alternate tips change the package; their inclusion must be confirmed through separate item codes.",
    apps: [{ make: "Ferrari", model: "458 Italia / 458 Spider", chassisCode: "F142", yearFrom: 2010, yearTo: 2015, engine: "4.5L V8", bodyStyle: "Coupe / Spider", opfGpf: "unknown" }],
  },
  {
    sku: "FR-458F1-CBV + TIP-458-S + R2016OL + OBD-CAB-V", baseSku: "FR-458F1-CBV", msrp: 5750, page: 20,
    make: "Ferrari", modelUa: "Ferrari 458 Italia / Spider F1", modelEn: "Ferrari 458 Italia / Spider F1", yearsUa: "2009–2015", yearsEn: "2009–2015", yearFrom: 2009, yearTo: 2015, engineUa: "4.5L V8", engineEn: "4.5L V8", opf: "unknown", chassis: "F142", bodyUa: "купе / Spider", bodyEn: "Coupe / Spider", configUa: "F1 cat-back із трьома срібними насадками та стандартним remote", configEn: "F1 cat-back with tri-silver tips and standard remote", configShortUa: "F1 Version", configShortEn: "F1 Version", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "FR-458F1-CBV + TIP-458-S + R2016OL + OBD-CAB-V", image: "https://www.fi-exhaust.com/uploads/product/en/ferrari_458-italia_tri-tips_exhaust_1.jpg", alt: "Fi EXHAUST F1 Version для Ferrari 458 Italia", video: null,
    source: "NEW USD-1.pdf p.20; Fi EXHAUST PD1631778718039", control: "remote",
    introUa: "Fi EXHAUST F1 Version створена для Ferrari 458 Italia та Spider з 4.5-літровим атмосферним V8. Вона виділена в прайсі окремим індексом FR-458F1-CBV і має іншу ціну, ніж Race Version. Підбирайте її за точною версією системи, а не лише за моделлю 458.",
    introEn: "The Fi EXHAUST F1 Version is listed for Ferrari 458 Italia and Spider models with the 4.5-litre naturally aspirated V8. It carries the separate FR-458F1-CBV index and a different price from the Race Version. Select it by the system version, not by the 458 model name alone.",
    detailUa: "Склад указує Valvetronic Muffler, TIP-458-S насадки та стандартний remote R2016OL з кабелем OBD-CAB-V. Інші частини, зокрема headers і downpipe, вказуються виробником як додаткові; вони не входять автоматично до вартості саме цього cat-back набору.",
    detailEn: "The package lists a valvetronic muffler, TIP-458-S tips and standard R2016OL remote with OBD-CAB-V cable. Other parts, including headers and downpipes, are shown by Fi as add-ons; they are not automatically included in the value of this cat-back package.",
    soundUa: "Клапанна система дає змогу перемикати звук V8 за допомогою стандартного дистанційного модуля. Виробник пропонує також Race Version для тієї ж родини автомобілів, тому перед замовленням варто порівняти обидва системні коди та перевірити встановлений вихлоп на конкретній машині.",
    soundEn: "The valved system lets the driver change the V8 sound through the listed standard remote module. Fi also offers a Race Version for the same vehicle family, so compare both system codes and check the exhaust already fitted to the specific car before placing an order.",
    buyerUa: "Для сумісності підтвердіть рік 2009–2015, кузов Italia або Spider, VIN та тип клапанного керування. Ці дані допоможуть відрізнити F1 конфігурацію від Race. Не додавайте до комплекту optional parts без окремого коду; сторінка містить саме позицію, зазначену у прайсі.",
    buyerEn: "For fitment, confirm the 2009–2015 year, Italia or Spider body, VIN and valve-control type. These details help distinguish the F1 configuration from Race. Do not assume optional parts are included without their own code; this page represents the position shown in the price list.",
    apps: [{ make: "Ferrari", model: "458 Italia / 458 Spider", chassisCode: "F142", yearFrom: 2009, yearTo: 2015, engine: "4.5L V8", bodyStyle: "Coupe / Spider", opfGpf: "unknown" }],
  },
  {
    sku: "MB-167A53-CBE + ACT-BN + R2020OBD + OBD-CAB-5BNE", baseSku: "MB-167A53-CBE", msrp: 5400, page: 27,
    make: "Mercedes-Benz", modelUa: "Mercedes-Benz GLE 450 W167", modelEn: "Mercedes-Benz GLE 450 W167", yearsUa: "2019+", yearsEn: "2019+", yearFrom: 2019, yearTo: null, engineUa: "3.0T M256", engineEn: "3.0T M256", opf: "unknown", chassis: "W167", bodyUa: "позашляховик", bodyEn: "SUV", configUa: "Valvetronic cat-back із Fi Pro дистанційним керуванням", configEn: "valvetronic cat-back with Fi Pro remote control", configShortUa: "Fi Pro remote", configShortEn: "Fi Pro remote", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "MB-167A53-CBE + ACT-BN + R2020OBD + OBD-CAB-5BNE", image: "https://www.fi-exhaust.com/uploads/product/en/w167-gle450-fi%20%281%29.jpg", alt: "Fi EXHAUST для Mercedes-Benz GLE 450 W167", video: "BssfUpBMLlI",
    source: "NEW USD-1.pdf p.27; Fi EXHAUST PD1711533287626", control: "fiPro",
    introUa: "Ця позиція Fi EXHAUST призначена для Mercedes-Benz GLE 450 у кузові W167 з двигуном M256. У комплекті вказані активатори клапанів і Fi Pro remote-модуль, що дозволяє керувати клапанною системою окремо від стандартних режимів авто, якщо конкретна електроніка це підтримує.",
    introEn: "This Fi EXHAUST application is for the Mercedes-Benz GLE 450 W167 with the M256 engine. Its price-list package includes valve actuators and a Fi Pro remote module, providing separate valve control where supported by the vehicle’s electronics.",
    detailUa: "Основний код MB-167A53-CBE доповнений ACT-BN, R2020OBD та OBD-CAB-5BNE. Це потрібно відрізняти від альтернативної D-конфігурації на сторінці 28 прайсу. У картці не додаються інші насадки чи секції, якщо їх немає у наведеній збірці.",
    detailEn: "The primary code MB-167A53-CBE is paired with ACT-BN, R2020OBD and OBD-CAB-5BNE. This should be distinguished from the alternate D configuration shown on page 28 of the price list. Other tips or exhaust sections are not added unless named in this package.",
    soundUa: "Fi EXHAUST використовує клапанну конструкцію, що змінює потік і гучність вихлопу. Fi Pro система у цій версії містить дистанційний модуль та мобільне керування; можливості конкретної модифікації залежать від ринку, заводських моторчиків клапанів і програмної версії авто.",
    soundEn: "Fi EXHAUST uses a valved layout to change exhaust flow and volume. This version lists a Fi Pro remote module and app-based control; exact behavior depends on market specification, factory valve motors and the vehicle’s software version.",
    buyerUa: "Перед замовленням підтвердіть W167 GLE 450, 2019+, M256 і заводський клапанний вузол. Для цієї серії прайс окремо показує MB-167A53-CBE та MB-167A53D-CBOE; менеджеру потрібно передати VIN, щоб звірити правильний тип системи й комплект кабелів.",
    buyerEn: "Before ordering, confirm W167 GLE 450, 2019+, M256 engine and the factory valve assembly. The price list separates MB-167A53-CBE from MB-167A53D-CBOE; provide the VIN so the correct system and cable package can be checked.",
    apps: [{ make: "Mercedes-Benz", model: "GLE 450", chassisCode: "W167", yearFrom: 2019, yearTo: null, engine: "3.0T M256", bodyStyle: "SUV", opfGpf: "unknown" }],
  },
  {
    sku: "MB-167A53D-CBOE + CAB-MTM*2", baseSku: "MB-167A53D-CBOE", msrp: 4700, page: 28,
    make: "Mercedes-Benz", modelUa: "Mercedes-Benz W167 AMG GLE, альтернативна конфігурація", modelEn: "Mercedes-Benz W167 AMG GLE, alternate configuration", yearsUa: "за сумісністю W167; перевірити VIN", yearsEn: "W167 application; confirm by VIN", yearFrom: 2019, yearTo: null, engineUa: "3.0T M256 — звірити версію", engineEn: "3.0T M256 - verify exact trim", opf: "unknown", chassis: "W167", bodyUa: "позашляховик", bodyEn: "SUV", configUa: "альтернативний CBOE варіант, точну версію підтвердити за VIN", configEn: "alternate CBOE configuration; verify exact trim by VIN", configShortUa: "CBOE варіант", configShortEn: "CBOE variant", typeUa: "Вихлопна система", typeEn: "Exhaust System", status: "draft",
    package: "MB-167A53D-CBOE + CAB-MTM*2", image: "https://www.fi-exhaust.com/uploads/product/en/w167-gle450-fi%20%281%29.jpg", alt: "Fi EXHAUST для Mercedes-Benz W167 AMG GLE", video: null,
    source: "NEW USD-1.pdf p.28 (continuation of p.27); Fi EXHAUST W167 product references", control: "review",
    introUa: "Цей запис підготовлений із рядка MB-167A53D-CBOE на сторінці 28 NEW USD-1.pdf. У самому рядку немає окремої назви автомобіля; він іде як продовження W167 AMG GLE позиції зі сторінки 27. Щоб не підставити неправильну версію клієнту, точний трим і двигун потрібно підтвердити за VIN.",
    introEn: "This record is based on the MB-167A53D-CBOE line on page 28 of NEW USD-1.pdf. The row itself omits the vehicle label and continues the W167 AMG GLE section from page 27. The exact trim and engine must be confirmed by VIN before this position is published for customers.",
    detailUa: "Прайс наводить альтернативний CBOE код та два CAB-MTM кабелі з MSRP $4,700. Інші компоненти або тип remote у цьому рядку не вказані. Ми зберігаємо назву конфігурації за кодом і не приписуємо їй характеристик сусіднього стандартного MB-167A53-CBE.",
    detailEn: "The price list gives an alternate CBOE code and two CAB-MTM cables at a $4,700 MSRP. It does not list other components or a remote type in this row. This draft keeps the configuration tied to its own code instead of borrowing details from the adjacent MB-167A53-CBE package.",
    soundUa: "CBOE позначення у рядку не достатньо, щоб визначити спосіб керування клапанами або конкретний двигун. Саме тому сторінка зберігається як чернетка: перед публікацією потрібне підтвердження, чи це W167 GLE 450, GLE 53 або інша версія, і який комплект контролю має бути включений.",
    soundEn: "The CBOE suffix alone is not enough to establish valve control or the exact engine application. This page remains a draft until the supplier confirms whether it is for the W167 GLE 450, GLE 53 or another trim, and which control components belong in the package.",
    buyerUa: "У картці вже зафіксовано основний SKU, кабелі та ціну прайсу, але вона не публікується до верифікації моделі. Для завершення потрібні точна назва автомобіля та підтвердження комплектації за VIN або відповідний офіційний Fi артикул.",
    buyerEn: "The draft records the primary SKU, cables and price-list amount, but is not published until the vehicle is verified. Completion requires the exact vehicle trim and a VIN-backed package confirmation or the corresponding official Fi product reference.",
    apps: [],
    fitmentMode: "needs_review",
  },
  {
    sku: "MB-205A-CBOE + MB-VS", baseSku: "MB-205A-CBOE", msrp: 3300, page: 28,
    make: "Mercedes-Benz", modelUa: "Mercedes-AMG C63 / C63 S W205", modelEn: "Mercedes-AMG C63 / C63 S W205", yearsUa: "2014–2021; не для Cabriolet", yearsEn: "2014–2021; not for Cabriolet", yearFrom: 2014, yearTo: 2021, engineUa: "4.0TT M177", engineEn: "4.0TT M177", opf: "unknown", chassis: "W205", bodyUa: "седан / купе, не Cabriolet", bodyEn: "Sedan / Coupe, not Cabriolet", configUa: "OEM-керування клапанами, без remote", configEn: "OEM valve control, no remote", configShortUa: "OEM valves", configShortEn: "OEM Valve Control", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "MB-205A-CBOE + MB-VS", image: "https://www.fi-exhaust.com/uploads/product/en/w205-amg-c63s-exhaust-1.webp", alt: "Fi EXHAUST для Mercedes-AMG C63 W205", video: null,
    source: "NEW USD-1.pdf p.28; Fi EXHAUST PD1627976814207", control: "oem",
    introUa: "OEM-compatible конфігурація Fi EXHAUST для Mercedes-AMG C63 та C63 S W205 з двигуном M177 зберігає штатні електричні клапани. У рядку цієї версії вказаний MB-VS, але немає окремого дистанційного модуля, що відрізняє її від варіанта з R2016OL.",
    introEn: "This OEM-compatible Fi EXHAUST configuration is for Mercedes-AMG C63 and C63 S W205 cars with the M177 engine. It retains the factory electronic valves. The price-list row includes MB-VS but no separate remote module, distinguishing it from versions that list R2016OL control hardware.",
    detailUa: "Виробник описує систему як Front Pipe, Mid X-Pipe і Valvetronic Muffler, сумісні зі штатним електроклапаном; Cabriolet не входить у підтверджену сумісність. Додаткові downpipe можуть продаватися окремо, але в цей товар вони не входять.",
    detailEn: "Fi describes this setup as a front pipe, mid X-pipe and valvetronic muffler compatible with the factory electric valve; Cabriolet fitment is excluded by the manufacturer. Optional downpipes may be sold separately, but they are not part of this listing.",
    soundUa: "Керування клапанами залишається прив’язаним до штатних режимів автомобіля; окремий пульт у пакеті не зазначений. Закрите положення клапана спрямовує гази через глушник, а відкрите створює більш виразний тон. Якщо потрібне керування телефоном чи окремим пультом, потрібна інша конфігурація.",
    soundEn: "Valve operation remains tied to the factory vehicle controls; no separate remote is listed in this package. Closed valves route exhaust through the muffler, while the open position produces a more pronounced tone. A different configuration is required if app or standalone remote control is needed.",
    buyerUa: "Підтвердіть кузов W205 Sedan або Coupe, рік, двигун M177 та відсутність Cabriolet перед замовленням. Код MB-205A-CBOE + MB-VS — це саме OEM-керований варіант. Не плутайте його з Titanium SKU, який уже має іншу назву й комплект у каталозі.",
    buyerEn: "Confirm W205 Sedan or Coupe body, model year, M177 engine and non-Cabriolet fitment before ordering. MB-205A-CBOE + MB-VS is the OEM-controlled version. Keep it distinct from the separate Titanium SKU already present in the catalog.",
    apps: [{ make: "Mercedes-AMG", model: "C63 / C63 S", chassisCode: "W205", yearFrom: 2014, yearTo: 2021, engine: "4.0TT M177", bodyStyle: "Sedan / Coupe", opfGpf: "unknown" }],
  },
  {
    sku: "MB-205V2-CBE + R2016OL + OBD-CAB-BNE + ACT-BN*2", baseSku: "MB-205V2-CBE", msrp: 3000, page: 28,
    make: "Mercedes-Benz", modelUa: "Mercedes-Benz C300 W205 Facelift M264", modelEn: "Mercedes-Benz C300 W205 Facelift M264", yearsUa: "2018–2021; C200/C250 перевірити окремо", yearsEn: "2018–2021; verify C200/C250 separately", yearFrom: 2018, yearTo: 2021, engineUa: "2.0T M264", engineEn: "2.0T M264", opf: "unknown", chassis: "W205 facelift", bodyUa: "седан", bodyEn: "Sedan", configUa: "Valvetronic cat-back зі стандартним remote", configEn: "valvetronic cat-back with standard remote", configShortUa: "M264 facelift", configShortEn: "M264 Facelift", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "MB-205V2-CBE + R2016OL + OBD-CAB-BNE + ACT-BN*2", image: "https://www.fi-exhaust.com/uploads/product/en/w205-c300-fl-udg_1.jpg", alt: "Fi EXHAUST для Mercedes-Benz C300 W205 Facelift", video: null,
    source: "NEW USD-1.pdf p.28; Fi EXHAUST PD1684746092637", control: "remote",
    introUa: "Ця версія MB-205V2-CBE відповідає facelift конфігурації W205 із двигуном M264; офіційна сторінка Fi прямо показує C300 Facelift 2018–2021. Прайсова група згадує також C200 і C250, тому сумісність цих двигунів не розширюємо без окремого підтвердження за VIN.",
    introEn: "This MB-205V2-CBE configuration corresponds to the W205 facelift with the M264 engine; Fi’s official page identifies the C300 facelift for 2018–2021. The price-list group also mentions C200 and C250, so those engine applications should be confirmed by VIN rather than assumed from the C300 reference.",
    detailUa: "У пакет входять front pipe, mid Y-pipe і Valvetronic Muffler, стандартний remote R2016OL, OBD-CAB-BNE та два ACT-BN. Downpipe не вказаний. Цей набір відрізняється від попереднього M274 покоління W205 і має оформлюватися за кодом V2.",
    detailEn: "The package includes a front pipe, mid Y-pipe and valvetronic muffler, standard R2016OL remote, OBD-CAB-BNE and two ACT-BN actuators. No downpipe is listed. This package differs from earlier M274 W205 applications and should be ordered using the V2 code.",
    soundUa: "Стандартний remote вказаний у прайсі як частина комплектації, а виробник описує клапанний глушник для керування гучністю. Закритий режим спрямовує потік через muffler, відкритий — змінює тембр і гучність. Перевірте, що автомобіль має відповідний facelift та електронне підключення клапанів.",
    soundEn: "The standard remote is listed as part of the package, and Fi describes the valved muffler as sound-adjustable. In the closed position, flow passes through the muffler; opening the valves changes tone and volume. Confirm that the car has the matching facelift and valve-electronics connection.",
    buyerUa: "У прайсі код з’являється в групі W205 C-Class, але офіційний Fi артикул підтверджує саме C300 Facelift M264. Перед замовленням для C200 чи C250 надішліть VIN, рік і код двигуна. Це дозволить перевірити, чи підходять труби та remote без припущень.",
    buyerEn: "The price list places the code in a W205 C-Class group, while Fi’s product reference confirms the C300 facelift M264. For C200 or C250, provide the VIN, model year and engine code before ordering. This verifies the pipework and remote fitment without guessing.",
    apps: [{ make: "Mercedes-Benz", model: "C300 Facelift", chassisCode: "W205", yearFrom: 2018, yearTo: 2021, engine: "2.0T M264", bodyStyle: "Sedan", opfGpf: "unknown" }],
  },
  {
    sku: "MB-465AFQ-CBOE + TIP-G63-S + CAB-MTM*2", baseSku: "MB-465AFQ-CBOE", msrp: 5000, page: 33,
    make: "Mercedes-AMG", modelUa: "Mercedes-AMG G63 W465 Quad Tips OPF", modelEn: "Mercedes-AMG G63 W465 Quad Tips OPF", yearsUa: "2024+", yearsEn: "2024+", yearFrom: 2024, yearTo: null, engineUa: "4.0T M177", engineEn: "4.0T M177", opf: "with", chassis: "W465", bodyUa: "позашляховик", bodyEn: "SUV", configUa: "Valvetronic Muffler з чотирма срібними насадками, OEM-клапани", configEn: "Valvetronic Muffler with quad silver tips and OEM valve compatibility", configShortUa: "Quad Tips", configShortEn: "Quad Tips", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "MB-465AFQ-CBOE + TIP-G63-S + CAB-MTM*2", image: "https://www.fi-exhaust.com/uploads/product/en/W465_G63_QUAD.3.jpg", alt: "Fi EXHAUST Quad Tips для Mercedes-AMG G63 W465", video: null,
    source: "NEW USD-1.pdf p.33; Fi EXHAUST PD1779865643602", control: "oem",
    introUa: "Fi EXHAUST Quad Tips для Mercedes-AMG G63 W465 розрахований на нове покоління G-Class від 2024 року з двигуном M177. Позиція в прайсі позначена OPF і має окремий код MB-465AFQ-CBOE, тож її не можна замінювати системами для попереднього W463/W463A.",
    introEn: "This Fi EXHAUST Quad Tips application is for the Mercedes-AMG G63 W465 generation from 2024 with the M177 engine. The supplied price list marks it as OPF and assigns the distinct MB-465AFQ-CBOE code, so it should not be substituted with W463 or W463A systems.",
    detailUa: "Комплект містить Valvetronic Muffler, чотири срібні насадки TIP-G63-S і два CAB-MTM кабелі. Окремий Fi remote у рядку не зазначений; CBOE варіант має звірятися зі штатною системою клапанів. Інші типи насадок або даунпайпи не включені без окремих кодів.",
    detailEn: "The package lists a valvetronic muffler, four TIP-G63-S silver tips and two CAB-MTM cables. A separate Fi remote is not shown in this row; the CBOE version should be checked against the factory valve system. Other tip styles and downpipes are not included without their own codes.",
    soundUa: "Клапанна конструкція допомагає перемикати G63 між стриманішим рухом і відкритішим спортивним тоном. Fi описує W465 систему як модельно розроблену й виконану з нержавіючої сталі T304. Контроль клапанів залежить від штатного оснащення та ринку; перевірте моторчики й електроніку до монтажу.",
    soundEn: "The valved layout lets the G63 move between a more restrained drive and a more open sport tone. Fi describes the W465 system as model-specific and made from T304 stainless steel. Valve control depends on the factory equipment and market, so verify the motors and electronics before installation.",
    buyerUa: "Звірте W465, 2024+, OPF, M177 та чотиривихідне виконання. Фото й код стосуються саме W465 Quad Tips; W463A може мати схожий вигляд, але іншу геометрію. Перед підтвердженням замовлення надішліть VIN і фото задньої частини автомобіля.",
    buyerEn: "Confirm W465 chassis, 2024+, OPF, M177 engine and quad-exit layout. The image and code refer to the W465 Quad Tips product; a W463A may look similar but uses different geometry. Provide the VIN and a rear vehicle photo before confirming the order.",
    apps: [{ make: "Mercedes-AMG", model: "G63", chassisCode: "W465", yearFrom: 2024, yearTo: null, engine: "4.0T M177", bodyStyle: "SUV", opfGpf: "with" }],
  },
  {
    sku: "MC-720-CBE + ACT-BN*2 + TIP-720-CRMB + R2020OBD + OBD-CAB-BNE", baseSku: "MC-720-CBE", msrp: 7200, page: 34,
    make: "McLaren", modelUa: "McLaren 720S Coupe / Spider, valved", modelEn: "McLaren 720S Coupe / Spider, valved", yearsUa: "2017–2023", yearsEn: "2017–2023", yearFrom: 2017, yearTo: 2023, engineUa: "4.0TT V8", engineEn: "4.0TT V8", opf: "unknown", chassis: "720S", bodyUa: "купе / Spider", bodyEn: "Coupe / Spider", configUa: "Valvetronic Muffler із Fi Pro remote та двома насадками TIP-720-CRMB", configEn: "Valvetronic Muffler with Fi Pro remote and TIP-720-CRMB tips", configShortUa: "Fi Pro valved", configShortEn: "Fi Pro Valved", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "MC-720-CBE + ACT-BN*2 + TIP-720-CRMB + R2020OBD + OBD-CAB-BNE", image: "https://www.fi-exhaust.com/uploads/product/en/720-fc-03.jpg", alt: "Fi EXHAUST Valvetronic Muffler для McLaren 720S", video: "WKjvGg0hSAA",
    source: "NEW USD-1.pdf p.34; Fi EXHAUST PD1633068700445", control: "fiPro",
    introUa: "Fi EXHAUST для McLaren 720S Coupe та Spider з 4.0TT V8 використовує Valvetronic Muffler і окрему систему керування клапанами. Ця позиція має код MC-720-CBE з R2020OBD, OBD-CAB-BNE та двома ACT-BN; її слід відрізняти від OEM-керованої та безклапанної версій.",
    introEn: "This Fi EXHAUST application for the McLaren 720S Coupe and Spider with the 4.0TT V8 uses a valvetronic muffler and separate valve-control hardware. The MC-720-CBE package lists R2020OBD, OBD-CAB-BNE and two ACT-BN actuators, distinguishing it from the OEM-controlled and non-valved alternatives.",
    detailUa: "До комплектації також входить TIP-720-CRMB. Назва коду насадки зберігається саме так, як у прайсі, без припущень про матеріал чи колір, які там не розписані. Downpipe та тепловий захист є окремими можливими компонентами й не включені в цей рядок.",
    detailEn: "The listed package also includes TIP-720-CRMB. The tip code is kept exactly as shown in the price list rather than assigning an unlisted material or color. Downpipes and heat protection are separate possible components and are not included in this row.",
    soundUa: "Fi описує 720S систему як клапанну: закриті клапани забезпечують тихіший рух, відкриті — інтенсивніше звучання. R2020OBD і OBD-CAB-BNE у пакеті дають окреме Fi Pro керування, але фактична робота модулів залежить від типу штатного клапанного оснащення конкретного McLaren.",
    soundEn: "Fi describes the 720S system as valved: closed valves support quieter driving, while open valves produce a stronger soundtrack. R2020OBD and OBD-CAB-BNE provide the listed Fi Pro control package, though actual module operation depends on the factory valve equipment on the specific McLaren.",
    buyerUa: "Підтвердіть 720S, кузов Coupe або Spider, 2017–2023 та систему заводських клапанів. Код CBE означає окрему дистанційно-керовану версію в прайсі; CBOE та CB — інші варіанти. Під час підбору передайте VIN і точний код комплектації.",
    buyerEn: "Confirm 720S model, Coupe or Spider body, 2017–2023 year and factory valve setup. The CBE code identifies the remote-controlled version in the price list; CBOE and CB are other configurations. Provide the VIN and exact package code when arranging fitment.",
    apps: [{ make: "McLaren", model: "720S", chassisCode: "720S", yearFrom: 2017, yearTo: 2023, engine: "4.0TT V8", bodyStyle: "Coupe / Spider", opfGpf: "unknown" }],
  },
  {
    sku: "MC-720Z-CB + TIP-720Z-CRMB + Zacoe Conversion Kits", baseSku: "MC-720Z-CB", msrp: 10800, page: 34,
    make: "McLaren", modelUa: "McLaren 720S Zacoe Center Quad-Exit, CB", modelEn: "McLaren 720S Zacoe Center Quad-Exit, CB", yearsUa: "2017–2023", yearsEn: "2017–2023", yearFrom: 2017, yearTo: 2023, engineUa: "4.0TT V8", engineEn: "4.0TT V8", opf: "unknown", chassis: "720S", bodyUa: "купе / Spider", bodyEn: "Coupe / Spider", configUa: "Zacoe Center Quad-Exit Conversion Kit, конфігурація CB", configEn: "Zacoe Center Quad-Exit Conversion Kit, CB configuration", configShortUa: "Zacoe CB", configShortEn: "Zacoe CB", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "MC-720Z-CB + TIP-720Z-CRMB + Zacoe Conversion Kits", image: "https://www.fi-exhaust.com/uploads/root/JOE/720S/720SXCBXAJ2.jpg", alt: "Fi EXHAUST і Zacoe center quad-exit для McLaren 720S", video: null,
    source: "NEW USD-1.pdf p.34; Fi EXHAUST PD1672380054002; NP1675397008994", control: "review",
    introUa: "Ця позиція поєднує систему Fi EXHAUST із центральним чотиривихідним оформленням Zacoe для McLaren 720S. Виробник описує conversion kit як окрему розробку з Zacoe, що змінює задню частину авто та маршрут вихлопу; це не стандартний подвійний боковий вихід 720S.",
    introEn: "This position combines Fi EXHAUST with the Zacoe center quad-exit conversion for the McLaren 720S. Fi describes the conversion as a Zacoe-developed design that changes the rear appearance and exhaust routing; it is not the standard dual side-exit 720S layout.",
    detailUa: "У прайсовому рядку зазначені MC-720Z-CB, TIP-720Z-CRMB та Zacoe Conversion Kits. Оскільки код CB відрізняється від CBOE і сторінка виробника докладно описує саме CBOE варіант, точний тип клапанного керування для CB потрібно підтвердити до публікації.",
    detailEn: "The price-list row names MC-720Z-CB, TIP-720Z-CRMB and Zacoe Conversion Kits. Since CB differs from CBOE and Fi’s detailed product page documents the CBOE version, the precise valve-control arrangement for CB should be confirmed before publication.",
    soundUa: "Zacoe conversion змінює не тільки звук, а й компонування задньої частини 720S. Виробник описує центральні чотири насадки, Valvetronic Muffler та теплозахисні компоненти; конкретна електронна версія залежить від суфікса SKU. У цьому записі ми не приписуємо CB керування, яке в прайсі окремо не показане.",
    soundEn: "The Zacoe conversion changes both the sound and the rear layout of the 720S. Fi’s description covers a center quad outlet, valvetronic muffler and heat-protection pieces; the exact electronic setup depends on the SKU suffix. This listing does not assign a valve-control feature to CB that the price row does not specify.",
    buyerUa: "Для встановлення conversion kit виробник вказує зміну центральної частини заднього бампера; перед замовленням перевірте матеріал бампера, комплект Zacoe та потребу в роботах із вирізання. Потрібне підтвердження VIN і точного набору CB. Ця картка залишена чернеткою до підтвердження керування клапанами.",
    buyerEn: "Fi notes that the conversion requires work on the rear bumper’s center section; before ordering, check bumper material, the Zacoe kit contents and whether cutting is needed. VIN and the exact CB package must be verified. This page remains a draft until valve control is confirmed.",
    apps: [{ make: "McLaren", model: "720S", chassisCode: "720S", yearFrom: 2017, yearTo: 2023, engine: "4.0TT V8", bodyStyle: "Coupe / Spider", opfGpf: "unknown" }], fitmentMode: "needs_review", status: "draft",
  },
  {
    sku: "MC-720Z-CBOE + TIP-720Z-CRMB + Zacoe Conversion Kits", baseSku: "MC-720Z-CBOE", msrp: 11500, page: 34,
    make: "McLaren", modelUa: "McLaren 720S Zacoe Center Quad-Exit, OEM valve", modelEn: "McLaren 720S Zacoe Center Quad-Exit, OEM valve", yearsUa: "2017–2023", yearsEn: "2017–2023", yearFrom: 2017, yearTo: 2023, engineUa: "4.0TT V8", engineEn: "4.0TT V8", opf: "unknown", chassis: "720S", bodyUa: "купе / Spider", bodyEn: "Coupe / Spider", configUa: "Zacoe Center Quad-Exit Conversion Kit, OEM-керування клапанами", configEn: "Zacoe Center Quad-Exit Conversion Kit with OEM valve control", configShortUa: "Zacoe OEM Valve", configShortEn: "Zacoe OEM Valve", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "MC-720Z-CBOE + TIP-720Z-CRMB + Zacoe Conversion Kits", image: "https://www.fi-exhaust.com/uploads/root/JOE/720S/720SXCBXAJ2.jpg", alt: "Fi EXHAUST і Zacoe center quad-exit для McLaren 720S", video: null,
    source: "NEW USD-1.pdf p.34; Fi EXHAUST PD1672380054002; NP1675397008994", control: "oem",
    introUa: "OEM-керована версія Zacoe center quad-exit створена для McLaren 720S Coupe/Spider 2017–2023. Вона поєднує Valvetronic Muffler Fi із переробленою центральною частиною заднього виходу та комплектом Zacoe; код CBOE відрізняє цей варіант від CB у прайсі.",
    introEn: "This OEM-controlled Zacoe center quad-exit version is for McLaren 720S Coupe/Spider models from 2017–2023. It combines a Fi valvetronic muffler with a redesigned center rear outlet and Zacoe conversion kit; the CBOE code distinguishes it from the CB position in the price list.",
    detailUa: "У комплекті перелічені MC-720Z-CBOE, TIP-720Z-CRMB і Zacoe Conversion Kits. Виробник описує центральну конверсію як спільну розробку з Zacoe та вказує OEM-сумісний клапанний мотор для відповідних авто. Даунпайпи залишаються окремими опціями.",
    detailEn: "The package lists MC-720Z-CBOE, TIP-720Z-CRMB and Zacoe Conversion Kits. Fi describes the center conversion as a Zacoe collaboration and offers OEM-valve compatibility for the relevant vehicle setup. Downpipes remain separate options.",
    soundUa: "Valvetronic система зберігає можливість керувати клапанами через штатну електроніку автомобіля, якщо 720S має сумісний заводський мотор. Центральні насадки та оновлена траса створюють інший акустичний і візуальний результат, ніж стандартна система. Перевірте контроль клапанів та кузов за VIN до монтажу.",
    soundEn: "The valvetronic system can retain factory valve control when the 720S has a compatible OEM valve motor. The center outlet and revised routing create a different acoustic and visual result from the standard system. Verify valve control and body fitment by VIN before installation.",
    buyerUa: "Fi вказує, що конверсія потребує роботи з центральною ділянкою заднього бампера та теплозахисними елементами. Перед замовленням погодьте монтаж із майстернею, підтвердіть комплектацію Zacoe і код CBOE. Ця система не є простим комплектом насадок для штатного глушника.",
    buyerEn: "Fi notes that the conversion involves the rear bumper’s center section and heat-protection components. Confirm installation with the workshop, Zacoe kit contents and CBOE code before ordering. This system is not a simple tip-only replacement for the factory muffler.",
    apps: [{ make: "McLaren", model: "720S", chassisCode: "720S", yearFrom: 2017, yearTo: 2023, engine: "4.0TT V8", bodyStyle: "Coupe / Spider", opfGpf: "unknown" }],
  },
  {
    sku: "NI-R35-CBV + TIP63127S*4 + R2016OL + OBD-CAB-V", baseSku: "NI-R35-CBV", msrp: 3750, page: 37,
    make: "Nissan", modelUa: "Nissan GT-R R35 Race Version", modelEn: "Nissan GT-R R35 Race Version", yearsUa: "2008+; звірити рік/фейсліфт", yearsEn: "2008+; confirm year/facelift", yearFrom: 2008, yearTo: null, engineUa: "3.8L V6 twin-turbo", engineEn: "3.8L twin-turbo V6", opf: "unknown", chassis: "R35", bodyUa: "купе", bodyEn: "Coupe", configUa: "Race cat-back із Y-pipe, mid-pipe, Valvetronic Muffler, quad silver tips і remote", configEn: "Race cat-back with Y-pipe, mid-pipe, Valvetronic Muffler, quad silver tips and remote", configShortUa: "Race Version", configShortEn: "Race Version", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "NI-R35-CBV + TIP63127S*4 + R2016OL + OBD-CAB-V", image: "https://www.fi-exhaust.com/uploads/product/en/gtr-RV-01.jpg", alt: "Fi EXHAUST Race Version для Nissan GT-R R35", video: null,
    source: "NEW USD-1.pdf p.37; Fi EXHAUST PD1633504865469 / PD1640750055114", control: "remote",
    introUa: "Race Version Fi EXHAUST для Nissan GT-R R35 включає передній Y-pipe, mid-pipe і клапанний глушник. У прайсі застосовність позначена як 2008+, а офіційний каталог окремо показує ранню та facelift версії; рік і регіон автомобіля потрібно зіставити перед замовленням.",
    introEn: "The Fi EXHAUST Race Version for Nissan GT-R R35 includes a front Y-pipe, mid-pipe and valved muffler. The price list gives 2008+, while Fi’s catalogue also separates early and facelift applications; confirm the car’s year and market specification before ordering.",
    detailUa: "Комплект складається з NI-R35-CBV, чотирьох TIP63127S срібних насадок, стандартного remote R2016OL і кабелю OBD-CAB-V. Downpipe в рядку не включений. Виробник описує стандартний remote як блок керування з пультами для відкриття/закриття клапанів.",
    detailEn: "The listed package combines NI-R35-CBV, four TIP63127S silver tips, standard R2016OL remote and OBD-CAB-V cable. No downpipe is included in this row. Fi describes the standard remote as a control box and handsets for opening or closing the valves.",
    soundUa: "Клапани допомагають змінювати тембр R35 між стриманішим рухом і відкритим Race звучанням. Стандартний remote входить у цей пакет; робота автоматичного режиму залежить від налаштування блоку. Інші каталізатори чи downpipe продаються окремо і можуть вплинути на гучність та вимоги до налаштування.",
    soundEn: "The valves let the R35 move between a more restrained drive and the open Race sound. A standard remote is included in this package; automatic mode depends on control-box setup. Other catalysts or downpipes are separate products and may change sound level and calibration requirements.",
    buyerUa: "Підбір охоплює ранні й facelift R35 за прайсом, але точні роки залежать від регіону та конфігурації. Перед оформленням надішліть VIN і рік виробництва. У картці зазначений Race Version; не плутайте її з Super Sport чи Ultimate Power системами, які мають інші SKU.",
    buyerEn: "The price list spans early and facelift R35 models, but exact years depend on market and vehicle specification. Provide the VIN and production year before ordering. This is the Race Version; do not confuse it with Super Sport or Ultimate Power systems, which carry different SKUs.",
    apps: [
      { make: "Nissan", model: "GT-R", chassisCode: "R35", yearFrom: 2008, yearTo: 2016, engine: "3.8L twin-turbo V6", bodyStyle: "Coupe", opfGpf: "unknown" },
      { make: "Nissan", model: "GT-R Facelift", chassisCode: "R35", yearFrom: 2017, yearTo: null, engine: "3.8L twin-turbo V6", bodyStyle: "Coupe", opfGpf: "unknown" },
    ],
  },
  {
    sku: "PH-718GT4F-CBV + TIP63114S*2", baseSku: "PH-718GT4F-CBV", msrp: 4200, page: 38,
    make: "Porsche", modelUa: "Porsche 718 GT4 / Spyder OPF, after Feb 2020", modelEn: "Porsche 718 GT4 / Spyder OPF, after Feb 2020", yearsUa: "після 02.2020", yearsEn: "after 02.2020", yearFrom: 2020, yearTo: null, engineUa: "4.0L flat-6", engineEn: "4.0L flat-6", opf: "with", chassis: "982", bodyUa: "купе / Spyder", bodyEn: "Coupe / Spyder", configUa: "Valvetronic Muffler, срібні tips, штатні клапани без remote", configEn: "Valvetronic Muffler, silver tips, OEM valves, no remote", configShortUa: "після 02.2020", configShortEn: "After 02.2020", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "PH-718GT4F-CBV + TIP63114S*2", image: "https://www.fi-exhaust.com/uploads/product/en/718-cayman-gt4spyder-OPF-1.jpg", alt: "Fi EXHAUST Valvetronic Muffler для Porsche 718 GT4 OPF", video: "KRorgVnzhpw",
    source: "NEW USD-1.pdf p.38; Fi EXHAUST PD1630551878462", control: "oem",
    introUa: "Цей SKU для Porsche 718 Cayman GT4/Spyder з OPF призначений для автомобілів після лютого 2020 року. Важливим є не лише рік реєстрації, а й дата виробництва: Fi розділяє pre-Feb і post-Feb 2020 версії під окремими кодами.",
    introEn: "This SKU is for Porsche 718 Cayman GT4/Spyder cars with OPF produced after February 2020. Production date matters alongside registration year: Fi separates pre-February and post-February 2020 applications under distinct codes.",
    detailUa: "У пакеті зазначені Valvetronic Muffler PH-718GT4F-CBV та дві срібні насадки TIP63114S. Виробник вказує сумісність зі штатними клапанами без remote. Downpipe, headers та пульт — окремі позиції, якщо вони потрібні конкретному автомобілю.",
    detailEn: "The package lists the PH-718GT4F-CBV valvetronic muffler and two TIP63114S silver tips. Fi specifies compatibility with the factory valves and no remote. Downpipes, headers and a remote are separate positions if required for the specific car.",
    soundUa: "Клапанна система зберігає управління через штатну електроніку; закриті клапани спрямовують потік через глушник, відкриті додають гучності й виразнішого тембру. Встановлення на OPF-автомобіль може вимагати додаткової перевірки програмного забезпечення, тож це слід узгодити з майстернею.",
    soundEn: "The valved system retains factory electronic control: closed valves route flow through the muffler, while the open position adds volume and a more pronounced tone. Installation on an OPF car may require a software check, which should be discussed with the workshop in advance.",
    buyerUa: "Це післялютнева версія, її не можна міняти місцями з PH-718GT4PF-CBV для раннього випуску 2020 року. Перевірте дату виробництва, OPF, кузов GT4 чи Spyder і VIN. Ціна прайсу покриває саме muffler з двома срібними насадками.",
    buyerEn: "This is the post-February version and should not be interchanged with PH-718GT4PF-CBV for earlier 2020 production. Confirm build date, OPF, GT4 or Spyder body and VIN. The price-list position covers the muffler with two silver tips.",
    apps: [{ make: "Porsche", model: "718 Cayman GT4 / Spyder", chassisCode: "982", yearFrom: 2020, yearTo: null, engine: "4.0L flat-6", bodyStyle: "Coupe / Spyder", market: "After Feb 2020", opfGpf: "with" }],
  },
  {
    sku: "PH-718GT4PF-CBV + TIP63114S*2", baseSku: "PH-718GT4PF-CBV", msrp: 4200, page: 38,
    make: "Porsche", modelUa: "Porsche 718 GT4 / Spyder OPF, before Feb 2020", modelEn: "Porsche 718 GT4 / Spyder OPF, before Feb 2020", yearsUa: "до 02.2020", yearsEn: "before 02.2020", yearFrom: 2020, yearTo: 2020, engineUa: "4.0L flat-6", engineEn: "4.0L flat-6", opf: "with", chassis: "982", bodyUa: "купе / Spyder", bodyEn: "Coupe / Spyder", configUa: "ранній Valvetronic Muffler, срібні tips, штатні клапани без remote", configEn: "early Valvetronic Muffler, silver tips, OEM valves, no remote", configShortUa: "до 02.2020", configShortEn: "Before 02.2020", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "PH-718GT4PF-CBV + TIP63114S*2", image: "https://www.fi-exhaust.com/uploads/product/en/718-cayman-gt4spyder-OPF-1.jpg", alt: "Fi EXHAUST Valvetronic Muffler для Porsche 718 GT4 до 02.2020", video: "KRorgVnzhpw",
    source: "NEW USD-1.pdf p.38; Fi EXHAUST PD1630551878462", control: "oem",
    introUa: "Ранній SKU PH-718GT4PF-CBV призначений для Porsche 718 GT4/Spyder OPF до лютого 2020 року. У прайсі він відокремлений від післялютневої версії PH-718GT4F-CBV, хоча обидва мають однакову ціну й зовні близький склад.",
    introEn: "The early PH-718GT4PF-CBV SKU is for Porsche 718 GT4/Spyder OPF cars built before February 2020. The price list separates it from the post-February PH-718GT4F-CBV version even though both carry the same price and a similar listed package.",
    detailUa: "У комплекті — Valvetronic Muffler та дві срібні насадки TIP63114S. Система сумісна зі штатними електроклапанами й не містить окремого пульта. Ці відмінності прив’язані до дати виробництва, а не до бажаного звучання чи вибору кольору насадок.",
    detailEn: "The package consists of a valvetronic muffler and two TIP63114S silver tips. It is compatible with the factory electric valves and does not include a separate remote. This distinction is tied to the production date, not to sound preference or tip color selection.",
    soundUa: "Після встановлення клапани продовжують працювати через заводське керування. Коли вони закриті, потік проходить через глушник для спокійнішої їзди; відкритий режим підсилює звук опозитного шестициліндрового двигуна. Перевірте програмні вимоги для конкретного ринку з майстернею.",
    soundEn: "After installation, the valves continue to use factory control. With them closed, flow passes through the muffler for a quieter drive; the open mode emphasizes the flat-six sound. Check market-specific software requirements with the workshop for the individual car.",
    buyerUa: "Перевірте місяць виробництва, кузов 718 Cayman GT4 чи Spyder, двигун 4.0 flat-six та OPF. Для машин після лютого 2020 використовується інший артикул. Перед замовленням надішліть VIN: саме він допоможе визначити PF або F версію.",
    buyerEn: "Confirm build month, 718 Cayman GT4 or Spyder body, 4.0 flat-six engine and OPF. Cars produced after February 2020 use a different part code. Send the VIN before ordering so the correct PF or F version can be selected.",
    apps: [{ make: "Porsche", model: "718 Cayman GT4 / Spyder", chassisCode: "982", yearFrom: 2020, yearTo: 2020, engine: "4.0L flat-6", bodyStyle: "Coupe / Spyder", market: "Before Feb 2020", opfGpf: "with" }],
  },
  {
    sku: "PH-991GT-CBV + TIP70101S*2", baseSku: "PH-991GT-CBV", msrp: 3550, page: 41,
    make: "Porsche", modelUa: "Porsche 911 991.1 / 991.2 GT3 / GT3 RS", modelEn: "Porsche 911 991.1 / 991.2 GT3 / GT3 RS", yearsUa: "2013–2019", yearsEn: "2013–2019", yearFrom: 2013, yearTo: 2019, engineUa: "3.8 / 4.0L flat-6", engineEn: "3.8 / 4.0L flat-6", opf: "unknown", chassis: "991.1 / 991.2", bodyUa: "купе", bodyEn: "Coupe", configUa: "Valvetronic Muffler із двома срібними tips, штатні клапани без remote за прайсом", configEn: "Valvetronic Muffler with dual silver tips, OEM valves, no remote per price list", configShortUa: "OEM valves", configShortEn: "OEM Valve", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "PH-991GT-CBV + TIP70101S*2", image: "https://www.fi-exhaust.com/uploads/product/en/991.2-GT3-Fi-EXHAUST-Product-1.jpg", alt: "Fi EXHAUST Valvetronic Muffler для Porsche 911 991 GT3", video: null,
    source: "NEW USD-1.pdf p.41; Fi EXHAUST PD1630572129384 / PD1630633451146", control: "oem",
    introUa: "Ця позиція Fi EXHAUST призначена для Porsche 911 GT3/GT3 RS покоління 991.1 та 991.2. Вона містить Valvetronic Muffler із двома срібними насадками та в прайсі позначена як сумісна зі штатними клапанами без remote — це важливо відрізняти від інших пакетів для 991.",
    introEn: "This Fi EXHAUST position is for Porsche 911 GT3/GT3 RS models in the 991.1 and 991.2 generation. It lists a valvetronic muffler with two silver tips and is marked in the price list as retaining factory valve control without a remote, distinguishing it from other 991 packages.",
    detailUa: "Код PH-991GT-CBV і TIP70101S*2 визначає саме глушник та пару срібних насадок. Стандартний remote, downpipe або headers у цій ціновій позиції не наведені. Виробник має сторінки для 991.1 і 991.2, тому конкретний рік та мотор потрібно звірити за VIN.",
    detailEn: "PH-991GT-CBV with TIP70101S*2 identifies the muffler and a pair of silver tips. A standard remote, downpipe or headers are not listed in this price position. Fi maintains 991.1 and 991.2 product references, so confirm exact year and engine by VIN.",
    soundUa: "Клапанний глушник змінює пропускну здатність вихлопу, зберігаючи штатний електричний контроль. Закритий режим допомагає тримати звук стриманим, відкритий виразніше передає атмосферний flat-six. Пульт у цьому наборі не вказаний; якщо він потрібен, слід узгодити окремий Fi Pro код.",
    soundEn: "The valved muffler adjusts exhaust flow while retaining factory electronic control. Closed valves keep the sound more restrained; opening them brings out the naturally aspirated flat-six. A remote is not listed in this bundle; confirm the separate Fi Pro code if remote operation is needed.",
    buyerUa: "Перед замовленням вкажіть 991.1 або 991.2, GT3 чи RS, рік і двигун. Хоча базовий код спільний у каталозі Fi, компоненти та клапанна проводка можуть залежати від конкретної ревізії. Ця картка не додає інші опційні компоненти автоматично.",
    buyerEn: "When ordering, provide 991.1 or 991.2, GT3 or RS trim, model year and engine. Although Fi uses a shared base code across its catalogue, components and valve wiring may depend on the exact revision. This listing does not automatically add other optional parts.",
    apps: [
      { make: "Porsche", model: "911 GT3 / GT3 RS", chassisCode: "991.1", yearFrom: 2013, yearTo: 2019, engine: "3.8 / 4.0L flat-6", bodyStyle: "Coupe", opfGpf: "unknown" },
      { make: "Porsche", model: "911 GT3 / GT3 RS", chassisCode: "991.2", yearFrom: 2013, yearTo: 2019, engine: "3.8 / 4.0L flat-6", bodyStyle: "Coupe", opfGpf: "unknown" },
    ],
  },
  {
    sku: "PH-GT2-CBV", baseSku: "PH-GT2-CBV", msrp: 4600, page: 40,
    make: "Porsche", modelUa: "Porsche 911 991.2 GT2 RS OEM-compatible Rear X-Pipe", modelEn: "Porsche 911 991.2 GT2 RS OEM-compatible Rear X-Pipe", yearsUa: "2017–2019", yearsEn: "2017–2019", yearFrom: 2017, yearTo: 2019, engineUa: "3.8TT flat-6", engineEn: "3.8TT flat-6", opf: "unknown", chassis: "991.2", bodyUa: "купе", bodyEn: "Coupe", configUa: "Rear X-Pipe OEM-compatible; код треба звірити з постачальником", configEn: "OEM-compatible Rear X-Pipe; confirm code with supplier", configShortUa: "Rear X-Pipe", configShortEn: "Rear X-Pipe", typeUa: "Компонент вихлопної системи", typeEn: "Exhaust Component", status: "draft",
    package: "PH-GT2-CBV", image: "https://www.fi-exhaust.com/uploads/product/en/991.2-GT2-RS--Fi-T304-2.jpg", alt: "Fi EXHAUST для Porsche 991.2 GT2 RS", video: null,
    source: "NEW USD-1.pdf p.40; Fi EXHAUST PD1630570472264", control: "review",
    introUa: "За NEW USD-1.pdf позиція PH-GT2-CBV є OEM-compatible Rear X-Pipe для Porsche 991.2 GT2 RS. Однак поточна сторінка Fi EXHAUST використовує той самий код PH-GT2-CBV у конфігурації з Valvetronic Muffler. Через цю різницю сторінка створюється як чернетка, а не публікується клієнтам.",
    introEn: "NEW USD-1.pdf identifies PH-GT2-CBV as an OEM-compatible Rear X-Pipe for the Porsche 991.2 GT2 RS. Fi EXHAUST’s current product page uses the same PH-GT2-CBV code in a Valvetronic Muffler configuration. Because the component identity conflicts, this listing remains a draft rather than being published to customers.",
    detailUa: "Прайсова позиція містить лише код PH-GT2-CBV, без окремого списку інших компонентів. Заявлена в прайсі роль — Rear X-Pipe; код, ціна $4,600, сумісність з 991.2 GT2 RS та OEM-версією збережені для перевірки. Остаточну назву і склад слід підтвердити у Fi перед публікацією.",
    detailEn: "The price-list position contains only PH-GT2-CBV and no separate list of other components. Its stated role is Rear X-Pipe; the code, $4,600 MSRP, 991.2 GT2 RS application and OEM-compatible wording are retained for review. The final name and package contents should be confirmed with Fi before publication.",
    soundUa: "Це окремий компонент, а не повна 80 mm система з downpipe та muffler. Опис керування клапанами не додається до цієї сторінки, оскільки прайс називає лише Rear X-Pipe, а поточна сторінка виробника пов’язує код із глушником. Це потрібно з’ясувати до продажу.",
    soundEn: "This is a component rather than the complete 80 mm setup with downpipe and muffler. Valve-control claims are not added because the price list names only a Rear X-Pipe while the current manufacturer page associates the code with a muffler. That distinction must be resolved before sale.",
    buyerUa: "Чернетка зберігає дані прайсу та фітмент 991.2 GT2 RS 2017–2019, але не доступна покупцям. Для публікації потрібне підтвердження, чи PH-GT2-CBV на новому прайсі означає Rear X-Pipe, чи використовується як Valvetronic Muffler, і яке фото відповідає саме компоненту.",
    buyerEn: "This draft preserves the price-list details and 2017–2019 991.2 GT2 RS fitment but is not visible to shoppers. Publication requires confirmation whether PH-GT2-CBV in the new price list means a Rear X-Pipe or a Valvetronic Muffler, and which image represents that component.",
    apps: [{ make: "Porsche", model: "911 GT2 RS", chassisCode: "991.2", yearFrom: 2017, yearTo: 2019, engine: "3.8TT flat-6", bodyStyle: "Coupe", opfGpf: "unknown" }], fitmentMode: "needs_review",
  },
  {
    sku: "PH-GT2-FUV200", baseSku: "PH-GT2-FUV200", msrp: 5800, page: 40,
    make: "Porsche", modelUa: "Porsche 911 991.2 GT2 RS 80 mm Full FI, Sport 200 Cell", modelEn: "Porsche 911 991.2 GT2 RS 80 mm Full FI, Sport 200 Cell", yearsUa: "2017–2019", yearsEn: "2017–2019", yearFrom: 2017, yearTo: 2019, engineUa: "3.8TT flat-6", engineEn: "3.8TT flat-6", opf: "unknown", chassis: "991.2", bodyUa: "купе", bodyEn: "Coupe", configUa: "Sport 200 Cell Downpipe + Valvetronic Muffler, OEM-клапани без remote", configEn: "Sport 200 Cell Downpipe + Valvetronic Muffler, OEM valves, no remote", configShortUa: "Sport 200 Cell", configShortEn: "Sport 200 Cell", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "PH-GT2-FUV200", image: "https://www.fi-exhaust.com/uploads/product/en/991.2-GT2-RS--Fi-T304-2.jpg", alt: "Fi EXHAUST 80 mm Sport 200 Cell для Porsche 991.2 GT2 RS", video: null,
    source: "NEW USD-1.pdf p.40; Fi EXHAUST PD1630570472264", control: "oem",
    introUa: "PH-GT2-FUV200 — 80 mm Full FI конфігурація для Porsche 991.2 GT2 RS із Sport 200 Cell. Прайс прямо перелічує downpipe та Valvetronic Muffler, а також збереження штатного керування клапанами без remote; це повніша збірка, ніж окрема rear X-pipe позиція.",
    introEn: "PH-GT2-FUV200 is the 80 mm Full FI configuration for the Porsche 991.2 GT2 RS with a Sport 200 Cell catalyst. The price list explicitly includes a downpipe and valvetronic muffler, with OEM valve settings retained and no remote. It is a more complete package than the separate rear X-pipe position.",
    detailUa: "Цей товар ідентифікується кодом PH-GT2-FUV200 та MSRP $5,800. У прайсі зазначені Sport 200 Cell Downpipe + Valvetronic Muffler. Опційне дистанційне керування R2020OBD має окрему доплату й не входить до цього коду.",
    detailEn: "This product is identified by PH-GT2-FUV200 at a $5,800 MSRP. The price-list description is Sport 200 Cell Downpipe plus Valvetronic Muffler. Optional R2020OBD remote control has a separate upgrade price and is not part of this code.",
    soundUa: "Клапани сумісні зі штатними налаштуваннями автомобіля; remote у цьому пакеті відсутній. Це важливо під час планування: якщо потрібне окреме керування або Fi Pro App, модуль потрібно додати окремо. 200-cell конфігурація не повинна плутатися з Catless Downpipe варіантом.",
    soundEn: "The valves retain factory settings, and no remote is included in this package. Plan accordingly: if standalone control or Fi Pro App functionality is required, add the appropriate module separately. The 200-cell configuration should not be confused with the catless downpipe variant.",
    buyerUa: "Підтвердіть 991.2 GT2 RS, 2017–2019, діаметр системи 80 mm і штатний клапанний вузол. Downpipe та muffler вже вказані в ціні цього коду; remote та інші опції — окремо. Монтаж варто погодити зі спеціалістом, знайомим із GT2 RS.",
    buyerEn: "Confirm 991.2 GT2 RS, 2017–2019, 80 mm system configuration and the factory valve assembly. The downpipe and muffler are listed in this code; remote control and other options are separate. Installation should be planned with a workshop familiar with the GT2 RS.",
    apps: [{ make: "Porsche", model: "911 GT2 RS", chassisCode: "991.2", yearFrom: 2017, yearTo: 2019, engine: "3.8TT flat-6", bodyStyle: "Coupe", opfGpf: "unknown" }],
  },
  {
    sku: "PH-MAC2F-CBE + TIP958S*4 + PH-VS + R2020OBD + ACT-BN*2 + OBD-CAB-BNE", baseSku: "PH-MAC2F-CBE", msrp: 4000, page: 44,
    make: "Porsche", modelUa: "Porsche Macan 95B.2 2.0T OPF", modelEn: "Porsche Macan 95B.2 2.0T OPF", yearsUa: "2019–2022", yearsEn: "2019–2022", yearFrom: 2019, yearTo: 2022, engineUa: "2.0T I4", engineEn: "2.0T I4", opf: "with", chassis: "95B.2", bodyUa: "позашляховик", bodyEn: "SUV", configUa: "OPF cat-back із quad silver tips та Fi Pro керуванням", configEn: "OPF cat-back with quad silver tips and Fi Pro control", configShortUa: "OPF Fi Pro", configShortEn: "OPF Fi Pro", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "PH-MAC2F-CBE + TIP958S*4 + PH-VS + R2020OBD + ACT-BN*2 + OBD-CAB-BNE", image: "https://www.fi-exhaust.com/uploads/product/en/macan-g2-95b.2-2.0t-nonopf-1-NEW.jpg", alt: "Fi EXHAUST для Porsche Macan 95B.2 2.0T", video: "El9P28UmVDk",
    source: "NEW USD-1.pdf p.44; Fi EXHAUST PD1630649604946", control: "fiPro",
    introUa: "Ця OPF-комплектація для Porsche Macan 95B.2 G2 2.0T поєднує клапанний cat-back, чотири срібні насадки та Fi Pro керування. Вона відрізняється від версії без OPF окремим кодом PH-MAC2F-CBE й призначена для автомобілів 2019–2022 років із чотирициліндровим двигуном.",
    introEn: "This OPF configuration for the Porsche Macan 95B.2 G2 2.0T combines a valved cat-back, four silver tips and Fi Pro control. Its PH-MAC2F-CBE code distinguishes it from the non-OPF version and identifies the 2019–2022 four-cylinder application.",
    detailUa: "У наборі вказані TIP958S*4, PH-VS, R2020OBD, два ACT-BN і OBD-CAB-BNE. Виробник для Macan описує середню Y-pipe секцію, Valvetronic Muffler, quad silver tips і модуль Fi Pro; downpipe до цієї комплектації не включений.",
    detailEn: "The package lists TIP958S*4, PH-VS, R2020OBD, two ACT-BN actuators and OBD-CAB-BNE. Fi describes the Macan system around a mid Y-pipe, valvetronic muffler, quad silver tips and Fi Pro module; a downpipe is not included in this configuration.",
    soundUa: "Модуль R2020OBD дає дистанційне та app-керування клапанами. Закритий режим проводить потік через глушник, відкритий створює інтенсивніший звук; поведінка залежить від налаштувань автомобіля. Важливо зберегти OPF-виконання й не використовувати downpipe без окремої перевірки сумісності.",
    soundEn: "The R2020OBD module provides remote and app-based valve control. Closed valves route flow through the muffler, while opening them produces a stronger sound; behavior also depends on vehicle settings. Preserve the OPF configuration and check downpipe compatibility separately before adding one.",
    buyerUa: "Звірте 95B.2, 2.0T, рік 2019–2022 та OPF. На фото виробника може бути показана сусідня версія або встановлення з додатковими частинами; саме SKU PH-MAC2F-CBE визначає товар у цій картці. Для відмінних моторів Macan потрібен інший код.",
    buyerEn: "Confirm 95B.2 chassis, 2.0T engine, 2019–2022 year and OPF. Manufacturer imagery may show a related version or an installation with optional parts; PH-MAC2F-CBE identifies the package represented here. Other Macan engines require a different code.",
    apps: [{ make: "Porsche", model: "Macan 2.0T", chassisCode: "95B.2", yearFrom: 2019, yearTo: 2022, engine: "2.0T I4", bodyStyle: "SUV", opfGpf: "with" }],
  },
  {
    sku: "TO-SPRB58F-CBE + TIP63114S*2 + CAB-BT2B + ACT-BN", baseSku: "TO-SPRB58F-CBE", msrp: 3200, page: 46,
    make: "Toyota", modelUa: "Toyota GR Supra A90 / A91 3.0T OPF", modelEn: "Toyota GR Supra A90 / A91 3.0T OPF", yearsUa: "2020+", yearsEn: "2020+", yearFrom: 2020, yearTo: null, engineUa: "3.0T B58", engineEn: "3.0T B58", opf: "with", chassis: "A90 / A91 / MK5", bodyUa: "купе", bodyEn: "Coupe", configUa: "OPF cat-back із двома срібними насадками та OEM-керуванням", configEn: "OPF cat-back with two silver tips and OEM valve control", configShortUa: "OPF", configShortEn: "OPF", typeUa: "Вихлопна система", typeEn: "Exhaust System",
    package: "TO-SPRB58F-CBE + TIP63114S*2 + CAB-BT2B + ACT-BN", image: "https://www.fi-exhaust.com/uploads/product/cn/supra-opf-01.jpg", alt: "Fi EXHAUST для Toyota GR Supra A90 A91 3.0T OPF", video: null,
    source: "NEW USD-1.pdf p.46; Fi EXHAUST PD1633339530395", control: "oem",
    introUa: "OPF-система Fi EXHAUST для Toyota GR Supra A90/A91 3.0T B58 поєднує mid-pipe та Valvetronic Muffler. Вона зберігає штатне керування клапаном без remote у прайсовій комплектації та відрізняється від версії без фільтра кодом TO-SPRB58F-CBE.",
    introEn: "This OPF Fi EXHAUST system for the Toyota GR Supra A90/A91 3.0T B58 pairs a mid-pipe with a valvetronic muffler. The price-list package retains factory valve control without a remote and uses the distinct TO-SPRB58F-CBE code to separate it from the non-OPF version.",
    detailUa: "До комплекту входять дві срібні насадки TIP63114S, кабель CAB-BT2B і ACT-BN. Fi описує систему як сумісну зі штатним електроклапаном без дистанційного пульта. Downpipe або Fi Pro Remote вказані як окремі опції і не входять у цей SKU.",
    detailEn: "The package includes two TIP63114S silver tips, CAB-BT2B cable and ACT-BN. Fi describes the system as compatible with the factory electric valve without a remote. A downpipe or Fi Pro remote appears as a separate option and is not part of this SKU.",
    soundUa: "Клапанна система дає Supra більш виразний спортивний звук у відкритому режимі та зберігає тихіший варіант через заводське керування. OPF-версія враховує фільтр частинок; її не слід змішувати з не-OPF системою лише через спільний B58 і кузов A90/A91.",
    soundEn: "The valved system gives the Supra a more pronounced sport sound when open while retaining a quieter mode through factory control. The OPF version accounts for the particulate filter and should not be confused with the non-OPF system just because both use the B58 engine and A90/A91 chassis.",
    buyerUa: "Підтвердіть 3.0T B58, A90 чи A91, модельний рік від 2020 та наявність OPF. Кабель і actuator вже наведені в прайсовому комплекті; remote не включений. Встановлення та програмні вимоги залежать від ринку й поточного стану системи вихлопу.",
    buyerEn: "Confirm 3.0T B58 engine, A90 or A91 chassis, 2020+ model year and OPF presence. The cable and actuator are listed in the package; a remote is not included. Installation and software requirements depend on market and the car’s current exhaust setup.",
    apps: [{ make: "Toyota", model: "GR Supra 3.0T", chassisCode: "A90 / A91", yearFrom: 2020, yearTo: null, engine: "3.0T B58", bodyStyle: "Coupe", opfGpf: "with" }],
  },
];

const videos = {
  L8uRDAZA46I: "Fi EXHAUST sound check for BMW F95/F96 X5M/X6M",
  KxKt5_uaDgE: "Fi EXHAUST sound check for BMW Z4 G29",
  y7IGQgsyUws: "Fi EXHAUST M-Performance conversion for BMW G80 M3",
  jxCM3teU_64: "Fi EXHAUST sound check for BMW G80 M3",
  "lP7WwH-Vrr4": "Fi EXHAUST sound test for BMW G87 M2",
  c6h5gYcMSJE: "Fi EXHAUST sound check for Ford Focus ST MK4",
  vQ1OHjmoam8: "Fi EXHAUST Race Version sound check for Ferrari 458",
  BssfUpBMLlI: "Fi EXHAUST sound check for Mercedes-Benz W167 GLE450",
  WKjvGg0hSAA: "Fi EXHAUST sound check for McLaren 720S",
  KRorgVnzhpw: "Fi EXHAUST sound check for Porsche 718 GT4/Spyder OPF",
  El9P28UmVDk: "Fi EXHAUST sound check for Porsche Macan 95B.2 2.0T",
};

const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const slugify = (value) => String(value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[\r\n,"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const words = (html) => (html.replace(/<[^>]*>/g, " ").replace(/&(?:amp|lt|gt|quot);/g, " ").match(/[\p{L}\p{N}]+(?:[.'’/-][\p{L}\p{N}]+)*/gu) ?? []).length;

function controlText(p, locale) {
  const ua = locale === "ua";
  if (p.control === "remote") return ua
    ? "У цьому SKU окремо перелічений стандартний remote-модуль. Перевірте, щоб блок, кабель та керування клапанами відповідали саме цій комплектації; не підмінюйте його Fi Pro без окремої перевірки."
    : "This SKU explicitly lists a standard remote module. Check that the control box, cable and valve operation match this configuration; do not substitute Fi Pro without a separate fitment check.";
  if (p.control === "fiPro") return ua
    ? "У цій збірці перелічений модуль Fi Pro з OBD-підключенням. Він дає окремий канал керування клапанами; сумісність із заводськими моторчиками та програмною версією авто потрібно перевірити перед монтажем."
    : "This package lists a Fi Pro module with OBD connection. It provides a separate valve-control path; compatibility with the factory motors and the vehicle software should be checked before installation.";
  if (p.control === "oem") return ua
    ? "Прайсова комплектація зберігає штатне керування клапанами або не перелічує окремий remote. Не додавайте функції пульта чи застосунку за припущенням: вони мають бути підтверджені кодом конкретного модуля."
    : "The price-list configuration retains factory valve control or does not list a separate remote. Do not assume remote or app functionality; it must be confirmed by the code of the specific control module.";
  return ua
    ? "Спосіб керування для цього коду не підтверджений в описі рядка. До публікації або замовлення потрібно звірити OEM-клапани, remote-комплект і точний автомобіль за VIN."
    : "The control method for this code is not confirmed in the source row. OEM valves, the remote package and the exact vehicle should be verified by VIN before publication or ordering.";
}

function fitmentText(p, locale) {
  const ua = locale === "ua";
  const vehicle = ua ? p.modelUa : p.modelEn;
  const years = ua ? p.yearsUa : p.yearsEn;
  const engine = ua ? p.engineUa : p.engineEn;
  const opf = p.opf === "with" ? (ua ? "OPF встановлений" : "OPF equipped") : p.opf === "without" ? (ua ? "без OPF" : "without OPF") : (ua ? "OPF-статус уточнюється за VIN" : "OPF status must be confirmed by VIN");
  const chassis = p.chassis ? `${ua ? "Шасі" : "Chassis"} ${p.chassis}` : "";
  return ua
    ? `Заявлене застосування: ${vehicle}, ${years}; ${chassis ? `${chassis}; ` : ""}двигун ${engine}; ${opf}. Ці параметри важливіші за схожу назву моделі: зміна покоління, двигуна або фільтра може вимагати іншого артикулу. Перевірте заводську комплектацію за VIN до передзамовлення.`
    : `Listed application: ${vehicle}, ${years}; ${chassis ? `${chassis}; ` : ""}${engine} engine; ${opf}. These details matter more than a similar model name: a generation, engine or filter change may require another part number. Confirm factory specification by VIN before pre-ordering.`;
}

function packageText(p, locale) {
  const ua = locale === "ua";
  return ua
    ? `Код постачальника з прайсу: <code>${escapeHtml(p.package)}</code>. Ця стрічка зберігає ідентифікатори системи та перелічених аксесуарів без заміни їх на схожі коди. Якщо компонент не вказаний у пакеті, його не слід вважати включеним; опції потрібно додавати окремими позиціями.`
    : `Supplier configuration from the price list: <code>${escapeHtml(p.package)}</code>. This line preserves the system and listed accessory identifiers without substituting similar codes. If a component is not named in the package, it should not be assumed included; options must be added as separate items.`;
}

function orderText(p, locale) {
  const ua = locale === "ua";
  const v = ua ? p.modelUa : p.modelEn;
  const yrs = ua ? p.yearsUa : p.yearsEn;
  const opf = p.opf === "with" ? (ua ? "OPF" : "OPF") : p.opf === "without" ? (ua ? "без OPF" : "non-OPF") : (ua ? "фільтр OPF" : "OPF equipment");
  if (ua) return `Перед замовленням надішліть VIN і підтвердіть ${v}, роки ${yrs} та ${opf}. Звірте двигун, кузов, клапанний мотор і тип з’єднання. Частини, яких немає в коді комплекту, зокрема headers, downpipe, інші насадки чи додатковий пульт, не включені автоматично. Товар постачається під замовлення; строк підтверджується після перевірки наявності у постачальника.`;
  return `Before ordering, provide the VIN and confirm ${v}, model years ${yrs} and ${opf}. Check engine, body, valve motor and connection type. Components absent from the package code - including headers, downpipes, alternate tips or an extra remote - are not automatically included. This item is supplied to order; lead time is confirmed after supplier availability is checked.`;
}

function buildBody(p, locale) {
  const ua = locale === "ua";
  const title = ua ? p.titleUa : p.titleEn;
  const intro = ua ? p.introUa : p.introEn;
  const detail = ua ? p.detailUa : p.detailEn;
  const sound = ua ? p.soundUa : p.soundEn;
  const buyer = ua ? p.buyerUa : p.buyerEn;
  const hFit = ua ? "Сумісність" : "Fitment";
  const hPackage = ua ? "Комплектація" : "Package contents";
  const hControl = ua ? "Клапани та звук" : "Valves and sound";
  const hOrder = ua ? "Підбір і замовлення" : "Fitment and ordering";
  const hFaq = ua ? "Поширені запитання" : "Frequently asked questions";
  const qFit = ua ? "Для якого автомобіля ця система?" : "Which vehicle is this system for?";
  const qPack = ua ? "Що входить у цю позицію?" : "What is included in this position?";
  const qControl = ua ? "Як керуються клапани?" : "How are the valves controlled?";
  const aControl = controlText(p, locale);
  const fit = fitmentText(p, locale);
  const sourceLink = p.video ? `<p><strong>${ua ? "Офіційне відео зі звуком:" : "Official sound video:"}</strong> <a href="https://www.youtube.com/watch?v=${p.video}" target="_blank" rel="noopener noreferrer">${escapeHtml(videos[p.video])}</a></p>` : "";
  const warning = p.status === "draft" ? (ua
    ? `<p><strong>Внутрішня перевірка:</strong> ${escapeHtml(p.draftNoteUa)}</p>`
    : `<p><strong>Review note:</strong> ${escapeHtml(p.draftNoteEn)}</p>`) : "";
  const body = [
    `<h2>${escapeHtml(title)}</h2>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<p>${escapeHtml(detail)}</p>`,
    `<h3>${hControl}</h3><p>${escapeHtml(sound)}</p><p>${escapeHtml(aControl)}</p>`,
    `<h3>${hFit}</h3><p>${escapeHtml(fit)}</p><p>${escapeHtml(buyer)}</p>`,
    `<h3>${hPackage}</h3><p>${packageText(p, locale)}</p>`,
    `<h3>${hOrder}</h3><p>${escapeHtml(orderText(p, locale))}</p>`,
    `<h3>${hFaq}</h3>`,
    `<p><strong>${qFit}</strong> ${escapeHtml(ua ? `У прайсі вказано ${p.modelUa}, ${p.yearsUa}, двигун ${p.engineUa} та застосування ${p.opf === "with" ? "з OPF" : p.opf === "without" ? "без OPF" : "за уточненим OPF-статусом"}. Для конкретного ринку підтвердьте VIN.` : `The price list specifies ${p.modelEn}, ${p.yearsEn}, the ${p.engineEn} engine and ${p.opf === "with" ? "OPF" : p.opf === "without" ? "non-OPF" : "VIN-dependent OPF status"}. Confirm the VIN for the exact market.`)}</p>`,
    `<p><strong>${qPack}</strong> ${escapeHtml(ua ? `Комплект визначається кодом ${p.package}. Перевірте його разом із ціною та назвою конфігурації; додаткові частини, яких немає в цьому рядку, узгоджуються окремо.` : `The package is identified by ${p.package}. Check it together with the price and configuration name; additional parts absent from this line must be agreed separately.`)}</p>`,
    `<p><strong>${qControl}</strong> ${escapeHtml(aControl)}</p>`,
    sourceLink,
    warning,
  ].filter(Boolean).join("");
  return body;
}

function ensureProductDepth(body, p, locale) {
  if (words(body) >= 420) return body;
  const ua = locale === "ua";
  const extra = ua
    ? `Окрема перевірка перед монтажем: зіставте VIN із моделлю ${p.modelUa}, кодом ${p.baseSku} та роками ${p.yearsUa}. Підтвердіть двигун ${p.engineUa}, кузов і OPF-комплектацію, а також тип заводського клапанного приводу. Якщо на автомобілі вже змінювали вихлоп або електроніку, передайте ці дані установнику разом із точним SKU, щоб система й кабелі відповідали наявному обладнанню.`
    : `One final installation check: match the VIN to ${p.modelEn}, code ${p.baseSku} and model years ${p.yearsEn}. Confirm the ${p.engineEn} engine, body and OPF specification, plus the factory valve actuator type. If the exhaust or electronics have already been modified, give those details to the installer with the exact SKU so the system and cables match the existing hardware.`;
  return `${body}<p>${escapeHtml(extra)}</p>`;
}

const columns = [
  "Handle", "Title", "Title (EN)", "Body (HTML)", "Body (HTML) (EN)", "Vendor", "Type", "Type (EN)",
  "Product Category", "Tags", "Published", "Status", "Variant SKU", "Variant Grams", "Variant Inventory Tracker",
  "Variant Inventory Qty", "Variant Inventory Policy", "Variant Fulfillment Service", "Variant Price",
  "Variant Requires Shipping", "Variant Taxable", "Image Src", "Image Position", "Image Alt Text", "SEO Title",
  "SEO Title (EN)", "SEO Description", "SEO Description (EN)",
  "brand (product.metafields.custom.brand)", "vehicle (product.metafields.custom.vehicle)",
  "vehicle_en (product.metafields.custom.vehicle_en)",
  "onecompany.supplier_fitment (product.metafields.onecompany.supplier_fitment)",
];

function titleFor(p, locale) {
  const ua = locale === "ua";
  const model = ua ? p.modelUa : p.modelEn;
  const config = ua ? p.configUa : p.configEn;
  return `Fi EXHAUST - ${model} - ${config}`;
}

function metaTitle(p, locale) {
  const ua = locale === "ua";
  const model = ua ? p.modelUa : p.modelEn;
  const config = ua ? p.configShortUa : p.configShortEn;
  let text = ua ? `${model} ${config} | Fi EXHAUST` : `Fi EXHAUST ${model} ${config}`;
  if (text.length > 60) text = text.slice(0, 57).trimEnd() + "...";
  if (text.length < 30) text = `${text} Exhaust System`;
  return text;
}

function metaDescription(p, locale) {
  const ua = locale === "ua";
  const model = ua ? p.modelUa : p.modelEn;
  const config = ua ? p.configShortUa : p.configShortEn;
  let text = ua
    ? `Fi EXHAUST для ${model}: ${config}, точний SKU та підбір за VIN. Перевірте двигун і OPF перед замовленням у OneCompany.`
    : `Fi EXHAUST for ${model}: ${config}, exact SKU and VIN-based fitment. Confirm engine and OPF before ordering from OneCompany.`;
  if (text.length < 120) text += ua ? " Офіційні фото та відео доступні в картці." : " See official product photos and sound video in the listing.";
  if (text.length > 160) text = text.slice(0, 157).trimEnd() + "...";
  return text;
}

function application(a) {
  return {
    vehicleType: "car",
    make: a.make,
    model: a.model,
    chassisCode: a.chassisCode,
    yearFrom: a.yearFrom,
    yearTo: a.yearTo,
    engine: a.engine,
    fuel: null,
    bodyStyle: a.bodyStyle ?? null,
    drivetrain: null,
    transmission: null,
    market: a.market ?? null,
    opfGpf: a.opfGpf ?? "unknown",
  };
}

function fitmentContract(p) {
  return {
    version: 1,
    mode: p.fitmentMode ?? "vehicle_specific",
    scope: "auto",
    applications: p.apps.map(application),
    parentSku: null,
    source: { supplier: "Fi EXHAUST", sourceRef: p.source, sourceUpdatedAt: null },
    note: p.draftNoteEn ?? (p.fitmentNoteEn || null),
  };
}

function targetPricing(msrp) {
  const add = msrp < 3000 ? 1200 : msrp < 6000 ? 1400 : 1600;
  const usd = msrp + add;
  return { add, usd, uah: usd * 46 };
}

const output = [];
const audit = [];
for (const p of products) {
  const price = targetPricing(p.msrp);
  const titleUa = titleFor(p, "ua");
  const titleEn = titleFor(p, "en");
  p.titleUa = titleUa;
  p.titleEn = titleEn;
  const seoUa = ensureProductDepth(buildBody(p, "ua"), p, "ua");
  const seoEn = ensureProductDepth(buildBody(p, "en"), p, "en");
  const wordsUa = words(seoUa);
  const wordsEn = words(seoEn);
  p.seoUaWords = wordsUa;
  p.seoEnWords = wordsEn;
  const slugSuffix = slugify(p.baseSku);
  const handle = slugify(`fi-exhaust-${p.make}-${p.modelEn}-${p.configShortEn}-${slugSuffix}`);
  const tags = ["Fi EXHAUST", p.typeEn === "Exhaust Component" ? "Exhaust Component" : "Exhaust System", p.make, p.chassis, p.opf === "with" ? "OPF" : p.opf === "without" ? "Non-OPF" : "Fitment Check", "Pre-order"].filter(Boolean).join(", ");
  const published = p.status !== "draft";
  const row = {
    "Handle": handle,
    "Title": titleUa,
    "Title (EN)": titleEn,
    "Body (HTML)": seoUa,
    "Body (HTML) (EN)": seoEn,
    "Vendor": "Fi EXHAUST",
    "Type": p.typeUa,
    "Type (EN)": p.typeEn,
    "Product Category": p.typeEn === "Exhaust Component" ? "Exhaust Component" : "Vehicle Exhaust System",
    "Tags": tags,
    "Published": published ? "true" : "false",
    "Status": published ? "active" : "draft",
    "Variant SKU": p.sku,
    "Variant Grams": "",
    "Variant Inventory Tracker": "",
    "Variant Inventory Qty": "0",
    "Variant Inventory Policy": "continue",
    "Variant Fulfillment Service": "manual",
    "Variant Price": String(price.uah),
    "Variant Requires Shipping": "true",
    "Variant Taxable": "true",
    "Image Src": p.image,
    "Image Position": "1",
    "Image Alt Text": p.alt,
    "SEO Title": metaTitle(p, "ua"),
    "SEO Title (EN)": metaTitle(p, "en"),
    "SEO Description": metaDescription(p, "ua"),
    "SEO Description (EN)": metaDescription(p, "en"),
    "brand (product.metafields.custom.brand)": "Fi EXHAUST",
    "vehicle (product.metafields.custom.vehicle)": p.modelUa,
    "vehicle_en (product.metafields.custom.vehicle_en)": p.modelEn,
    "onecompany.supplier_fitment (product.metafields.onecompany.supplier_fitment)": JSON.stringify(fitmentContract(p)),
  };
  output.push(columns.map((column) => csvCell(row[column])).join(","));
  audit.push({ sku: p.baseSku, completeSku: p.sku, page: p.page, status: row.Status, manufacturerMsrpUsd: p.msrp, markupUsd: price.add, siteUsd: price.usd, siteUah: price.uah, uaWords: wordsUa, enWords: wordsEn, handle, titleUa, titleEn, image: p.image, video: p.video ? `https://www.youtube.com/watch?v=${p.video}` : "" });
}

const csv = `${columns.map(csvCell).join(",")}\r\n${output.join("\r\n")}\r\n`;
const csvPath = path.join(outputDir, "fi-exhaust-non-titanium-import-2026-09-25.csv");
fs.writeFileSync(csvPath, csv, "utf8");
const auditPath = path.join(outputDir, "fi-exhaust-non-titanium-import-review-2026-09-25.json");
fs.writeFileSync(auditPath, JSON.stringify({ generatedAt: new Date().toISOString(), fxUahPerUsd: 46, rule: "MSRP<3000 +1200; 3000-5999 +1400; >=6000 +1600", excluded: "All Titanium/Titanium Signature positions", rows: audit }, null, 2), "utf8");
const b64 = Buffer.from(csv, "utf8").toString("base64");
const chunkSize = 5000;
const chunks = [];
for (let i = 0; i < b64.length; i += chunkSize) chunks.push(b64.slice(i, i + chunkSize));
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Fi EXHAUST CSV transfer</title></head><body><h1>Fi EXHAUST CSV transfer payload</h1>${chunks.map((chunk, i) => `<pre>__CSV_CHUNK_${String(i).padStart(3,"0")}__${chunk}__END_${String(i).padStart(3,"0")}__</pre>`).join("")}</body></html>`;
const transferPath = path.join(outputDir, "fi-exhaust-csv-transfer-2026-09-25.html");
fs.writeFileSync(transferPath, html, "utf8");
console.log(JSON.stringify({ rows: products.length, active: audit.filter((item) => item.status === "active").length, drafts: audit.filter((item) => item.status === "draft").length, csvPath, auditPath, transferPath, bytes: Buffer.byteLength(csv), minUaWords: Math.min(...audit.map((item) => item.uaWords)), minEnWords: Math.min(...audit.map((item) => item.enWords)), maxUaWords: Math.max(...audit.map((item) => item.uaWords)), maxEnWords: Math.max(...audit.map((item) => item.enWords)), uniqueHandles: new Set(audit.map((item) => item.handle)).size }, null, 2));
