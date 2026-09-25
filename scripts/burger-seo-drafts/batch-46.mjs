// Source-checked flex-fuel sensors, harnesses and BMW/GM fitment copy; local draft only.
export default {
  'fuel-it-bluetooth-ethanol-e85-sensor-c8-chevrolet-corvette-stingray': {
    sourceUrl: 'https://burgertuning.com/products/fuel-it-bluetooth-ethanol-e85-sensor-c8-chevrolet-corvette-stingray',
    titleUa: 'Fuel-It! Bluetooth Flex Fuel Kit для Chevrolet Corvette C8 Stingray 2020+', titleEn: 'Fuel-It! Bluetooth Flex Fuel Kit for 2020+ Chevrolet Corvette C8 Stingray',
    shortUa: 'Повний комплект із Continental sensor, Bluetooth analyzer, двома армованими лініями та billet фітингами; 5V вихід для JB4.',
    shortEn: 'Complete kit with Continental sensor, Bluetooth analyzer, two braided lines and billet fittings; 5V output for JB4.',
    descUa: `<h3>Моніторинг E85 на Corvette C8</h3>
<p>Комплект вимірює фактичний вміст етанолу через Continental sensor і передає показник у Fuel-It!/JB4 app. Bluetooth та 5V analog вихід забезпечують відображення й інтеграцію з сумісним flash тюнером. Це допомагає підібрати налаштування під реальну суміш, яка може різнитися між заправками.</p>
<h3>Що входить</h3>
<p>Опис включає Continental sensor, дві stainless braided fuel lines із чорним nylon покриттям, спеціальні billet фітинги, Bluetooth analyzer та extension harness. Мобільний додаток потрібно завантажити окремо. Установлення приблизно за 30 хвилин наведене як оцінка Burger.</p>
<h3>Сумісність</h3>
<p>Для Chevrolet Corvette Stingray C8 2020+. Перевірте рік, паливну лінію та спосіб інтеграції сигналу до тюнера.</p>`,
    descEn: `<h3>E85 monitoring on the Corvette C8</h3>
<p>The kit measures actual ethanol content with a Continental sensor and sends the reading to the Fuel-It!/JB4 app. Bluetooth and 5V analog output support display and integration with compatible flash tuning. This helps choose calibration for the actual blend, which can vary by fill-up.</p>
<h3>Package contents</h3>
<p>The listing includes a Continental sensor, two black-sheathed stainless braided fuel lines, custom billet fittings, Bluetooth analyzer and extension harness. The mobile app must be downloaded separately. Burger's roughly 30-minute installation time is an estimate.</p>
<h3>Fitment</h3>
<p>For 2020+ Chevrolet Corvette Stingray C8. Verify year, fuel line and signal integration to the tuner.</p>`,
  },
  'fuel-it-bmw-f-chassis-n55-s55-b58-gen1-rear-mount-flex-fuel-low-fuel-pressure-sensor-kit': {
    sourceUrl: 'https://burgertuning.com/products/fuel-it-bmw-f-chassis-n55-s55-b58-gen1-rear-mount-flex-fuel-low-fuel-pressure-sensor-kit',
    titleUa: 'CANFlex rear-mount Flex Fuel + низький тиск пального для BMW N20 / N55 / S55', titleEn: 'CANFlex rear-mount flex fuel + low fuel pressure kit for BMW N20 / N55 / S55',
    shortUa: 'Задній модуль під сидінням вимірює етанол і низький тиск через CANbus; JB4 може використовувати тиск як safety-map trigger.',
    shortEn: 'Rear-mounted unit reads ethanol and low fuel pressure over CANbus; JB4 can use pressure as a safety-map trigger.',
    descUa: `<h3>Два показники пального через CANbus</h3>
<p>Комплект встановлюється над паливним насосом під заднім сидінням і передає вміст етанолу та низький тиск пального до ECU через CANbus. CANFlex ECA використовує стандартний 0xEC ethanol format; сигнал низького тиску передається окремим байтом. Сумісний JB4 може використовувати його для safety map trigger, а портове впорскування — у паливному контролі.</p>
<h3>Комплект та інтеграція</h3>
<p>Комплект призначений для сумісного flash tuning чи JB4 і включає rear-mount сенсорний модуль. Потрібна підтримка CANbus формату та правильне налаштування адреси сигналу. Перевірте сумісність з вашим flash tune або JB4 прошивкою.</p>
<h3>Сумісність</h3>
<p>Для BMW F-Chassis N20, N55 і S55 за списком Burger. Перед замовленням уточніть кузов, ECU і наявність port-injection конфігурації.</p>`,
    descEn: `<h3>Two fuel readings over CANbus</h3>
<p>The kit mounts above the fuel pump under the rear seat and sends ethanol content and low fuel pressure to the ECU over CANbus. CANFlex ECA uses the standard 0xEC ethanol format; low pressure is transmitted in a separate byte. Compatible JB4 firmware can use it as a safety-map trigger, and port-injection mapping can use the pressure signal.</p>
<h3>Package and integration</h3>
<p>The rear-mount sensor module is intended for compatible flash tuning or JB4. CANbus format support and correct signal addressing are required. Verify compatibility with your flash tune or JB4 firmware.</p>
<h3>Fitment</h3>
<p>For BMW F-Chassis N20, N55 and S55 applications listed by Burger. Confirm chassis, ECU and whether port injection is installed.</p>`,
  },
  'bms-universal-canbus-e85-analyzer-eca': {
    sourceUrl: 'https://burgertuning.com/products/bms-universal-canbus-e85-analyzer-eca',
    titleUa: 'Універсальний BMS CANFlex E85 Analyzer — harness та LFP sensor опції', titleEn: 'Universal BMS CANFlex E85 Analyzer — harness and LFP sensor options',
    shortUa: 'Оберіть Universal або BMW Gen2 B58/S58 PnP harness і чи додавати low fuel pressure sensor; flex fuel sensor продається окремо.',
    shortEn: 'Select Universal or BMW Gen2 B58/S58 PnP harness and whether to add a low fuel pressure sensor; ethanol sensor sold separately.',
    descUa: `<h3>Для чого потрібен CANFlex ECA</h3>
<p>Аналізатор підключається до окремо придбаного flex-fuel sensor і передає виміряний етанол через CANbus до сумісного JB4 або flash-only DME. LED дисплей та Bluetooth застосунок дають змогу бачити значення. ECA — це analyzer/інтеграційний модуль, а не сам ethanol sensor.</p>
<h3>Оберіть harness і датчик низького тиску</h3>
<p>Опції harness: CANFlex LED з Universal harness або PnP harness для BMW Gen2 B58/S58. Другий селектор додає або не додає low fuel pressure sensor kit. LFP датчик може бути корисним для платформ без штатного сенсора. LED дисплей не є waterproof — встановіть його в салоні або під захистом.</p>
<h3>Сумісність</h3>
<p>Для систем JB4 і сумісних flash tunes, що читають CANFlex ethanol format. Перевірте CAN адреси, harness і вхідні дані вашого ECU.</p>`,
    descEn: `<h3>What the CANFlex ECA is for</h3>
<p>The analyzer connects to a separately purchased flex-fuel sensor and sends measured ethanol over CANbus to compatible JB4 or flash-only DME systems. The LED display and Bluetooth app show the reading. ECA is the analyzer/integration module, not the ethanol sensor itself.</p>
<h3>Select harness and low-pressure sensor</h3>
<p>Harness options are CANFlex LED with Universal harness or PnP harness for BMW Gen2 B58/S58. The second selector adds or omits a low fuel pressure sensor kit. LFP sensing can help platforms without a factory sensor. The LED display is not waterproof; mount it in the cabin or under protection.</p>
<h3>Compatibility</h3>
<p>For JB4 and compatible flash tunes that read the CANFlex ethanol format. Verify CAN addressing, harness and ECU input requirements.</p>`,
  },
  'fuel-it-flex-fuel-kit-for-2018-2-7l-f-150': {
    sourceUrl: 'https://burgertuning.com/products/fuel-it-flex-fuel-kit-for-2018-2-7l-f-150',
    titleUa: 'Fuel-It! Bluetooth Flex Fuel Kit для Ford F-150 2.7L EcoBoost 2018+', titleEn: 'Fuel-It! Bluetooth Flex Fuel Kit for 2018+ Ford F-150 2.7L EcoBoost',
    shortUa: 'Continental sensor і Bluetooth ECA вимірюють етанол та передають 5V сигнал до JB4/flash; комплект для F-150 2.7T.',
    shortEn: 'Continental sensor and Bluetooth ECA read ethanol and provide 5V data to JB4/flash; kit for the F-150 2.7T.',
    descUa: `<h3>Вимірювання етанолу на F-150 2.7 EcoBoost</h3>
<p>Сенсор Continental відстежує частку етанолу у паливі; Bluetooth analyzer показує значення в Fuel-It! або JB4 застосунку. 5V analog вихід передає дані сумісному JB4 чи flash tune. Це допомагає налаштувати карту на фактичний склад суміші, що може змінюватись на різних E85 станціях.</p>
<h3>Що включає комплект</h3>
<p>За описом Burger, комплект містить ethanol sensor, Bluetooth analyzer, custom harness, паливну лінію, fitting та інструмент для зняття штатної лінії. Монтаж оцінений приблизно у 30 хвилин; виконуйте його згідно з процедурою паливної системи.</p>
<h3>Сумісність</h3>
<p>Для Ford F-150 2018+ із 2.7L EcoBoost. Перевірте двигун, рік і вхід тюнера для 5V сигналу.</p>`,
    descEn: `<h3>Ethanol measurement on the F-150 2.7 EcoBoost</h3>
<p>The Continental sensor reads ethanol fraction in the fuel, and the Bluetooth analyzer displays it in the Fuel-It! or JB4 app. A 5V analog output sends data to a compatible JB4 or flash tune. This helps calibrate for the actual blend, which can vary between E85 stations.</p>
<h3>Package contents</h3>
<p>Burger lists an ethanol sensor, Bluetooth analyzer, custom harness, fuel line, fitting and factory-line removal tool. Installation is estimated at about 30 minutes; follow fuel-system procedures.</p>
<h3>Fitment</h3>
<p>For 2018+ Ford F-150 with the 2.7L EcoBoost. Confirm engine, year and the tuner’s 5V input.</p>`,
  },
  'fuel-it-flex-fuel-kit-for-ford-bronco': {
    sourceUrl: 'https://burgertuning.com/products/fuel-it-flex-fuel-kit-for-ford-bronco',
    titleUa: 'Fuel-It! Bluetooth Flex Fuel Kit для Ford Bronco 2.7L EcoBoost 2021+', titleEn: 'Fuel-It! Bluetooth Flex Fuel Kit for 2021+ Ford Bronco 2.7L EcoBoost',
    shortUa: 'CANFlex/Continental сенсор показує етанол для Bronco 2.7T у застосунку та дає analog вихід для сумісного тюнера.',
    shortEn: 'CANFlex/Continental sensor reads ethanol on the Bronco 2.7T in-app and provides analog output for compatible tuning.',
    descUa: `<h3>Flex-fuel дані для Ford Bronco</h3>
<p>Fuel-It! комплект вимірює етанол у баку за допомогою Continental sensor і показує його у Bluetooth застосунку. 0–5V analog вихід інтегрується з JB4 чи сумісною flash системою, щоб можна було налаштовувати карту за виміряною сумішшю.</p>
<h3>Монтаж і комплектність</h3>
<p>У комплекті описані Bluetooth analyzer, сенсор, custom fittings, паливна лінія та проводка plug-and-play. Burger зазначає приблизно 30 хвилин на монтаж і відсутність постійної модифікації. Після встановлення перевірте показник сенсора та сигнал у тюнері.</p>
<h3>Сумісність</h3>
<p>Для Ford Bronco 2021+ із 2.7L EcoBoost. Підтвердіть рік, двигун і лінію тюнера до замовлення.</p>`,
    descEn: `<h3>Flex-fuel data for the Ford Bronco</h3>
<p>The Fuel-It! kit measures ethanol in the tank with a Continental sensor and displays it in the Bluetooth app. A 0–5V analog output integrates with JB4 or compatible flash tuning so the map can use the measured blend.</p>
<h3>Installation and contents</h3>
<p>The listing describes a Bluetooth analyzer, sensor, custom fittings, fuel line and plug-and-play wiring. Burger estimates about 30 minutes and no permanent modification. After installation, confirm the sensor reading and tuner input.</p>
<h3>Fitment</h3>
<p>For 2021+ Ford Bronco with the 2.7L EcoBoost. Verify year, engine and tuning-system connection.</p>`,
  },
  'fuel-it-cam-lock-fittings-and-parts': {
    sourceUrl: 'https://burgertuning.com/products/fuel-it-cam-lock-fittings-and-parts',
    titleUa: 'Fuel-It! quick-connect фітинги та лінії — вибір типу з’єднання', titleEn: 'Fuel-It! quick-connect fittings and lines — select connection type',
    shortUa: 'Оберіть окремий cam-lock, AN6 barb, quick-connect, elbow або 1/8″ NPT fitting за діаметром і статтю різьби.',
    shortEn: 'Select a cam-lock, AN6 barb, quick-connect, elbow or 1/8″ NPT fitting by diameter and connector gender.',
    descUa: `<h3>Фітинги для паливних і ethanol-sensor ліній</h3>
<p>Ця картка об’єднує запасні quick-connect adapters, cam-locks, barb/AN фітинги, elbows та ethanol-sensor fittings. Деталі допомагають відновити або переробити паливну лінію відповідно до конфігурації авто. Це окремі з’єднувачі, а не повний flex-fuel kit.</p>
<h3>Зіставте розмір і тип роз’єму</h3>
<p>Доступні 5/16″ і 3/8″, male/female, straight/elbow/180° sensor фітинги, 4AN різьба та окремі варіанти з 1/8″ NPT портом. Опція “Cam-lock only” прямо зазначає, що сам fitting не входить. Виберіть exact connector type за лінією та компонентом.</p>
<h3>Перед замовленням</h3>
<p>Перевірте діаметр шланга, quick-connect стать, різьбу й потрібний кут за існуючою деталлю. Не використовуйте невідповідний fitting у паливній системі.</p>`,
    descEn: `<h3>Fittings for fuel and ethanol-sensor lines</h3>
<p>This listing groups replacement quick-connect adapters, cam-locks, barb/AN fittings, elbows and ethanol-sensor fittings. Parts can repair or adapt a fuel line for a specific vehicle setup. These are individual connectors, not a complete flex-fuel kit.</p>
<h3>Match size and connector type</h3>
<p>Options include 5/16-inch and 3/8-inch, male/female, straight/elbow/180-degree sensor fittings, 4AN thread and some 1/8-inch NPT ports. “Cam-lock only” explicitly means the fitting itself is not included. Select the exact connector type for the line and component.</p>
<h3>Before ordering</h3>
<p>Check hose diameter, quick-connect gender, thread and angle against the existing part. Do not use a mismatched fitting in a fuel system.</p>`,
  },
  'fuel-it-bluetooth-flex-fuel-kit-for-b58-bmw-x3-x4': {
    sourceUrl: 'https://burgertuning.com/products/fuel-it-bluetooth-flex-fuel-kit-for-b58-bmw-x3-x4',
    titleUa: 'Fuel-It! Flex Fuel Kit для BMW X3 / X4 B58 — вибір насоса та harness', titleEn: 'Fuel-It! Flex Fuel Kit for BMW X3 / X4 B58 — select pump and harness',
    shortUa: 'Оберіть OE/TU або Fuel-It!/Dorch pump і ECA з PnP/Universal harness чи Bluetooth; комплект прив’язаний до X3/X4 кузова.',
    shortEn: 'Select OE/TU or Fuel-It!/Dorch pump and ECA with PnP/Universal harness or Bluetooth; choose the X3/X4 chassis.',
    descUa: `<h3>Flex-fuel моніторинг для BMW X3 / X4 B58</h3>
<p>CANFlex комплект вимірює етанол Continental сенсором і передає інформацію до сумісного тюнера. ECA може надсилати CANbus, Bluetooth, LED дисплей або 5V analog дані залежно від конфігурації. Система допомагає контролювати E85 для налаштування, але не змінює map самостійно.</p>
<h3>Оберіть насос і спосіб підключення</h3>
<p>Перша частина селектора: OE/TU pump або Fuel-It!/Dorch pump. Для кожного насоса є CANbus ECA з PnP harness, CANbus ECA з Universal harness або Bluetooth ECA. Варіанти відрізняються паливним обладнанням і проводкою; оберіть наявний насос та відповідний тюнер/harness.</p>
<h3>Сумісність</h3>
<p>Для BMW X3/X4 з B58 у поколіннях кузова, перелічених Burger. Підтвердіть chassis, HPFP тип і спосіб CAN/analog інтеграції.</p>`,
    descEn: `<h3>Flex-fuel monitoring for BMW X3 / X4 B58</h3>
<p>The CANFlex kit measures ethanol with a Continental sensor and sends readings to a compatible tuner. Depending on configuration, ECA provides CANbus, Bluetooth, LED display or 5V analog data. It helps monitor E85 for tuning but does not change the map itself.</p>
<h3>Select pump and connection method</h3>
<p>The first selector offers OE/TU pump or Fuel-It!/Dorch pump. Each has CANbus ECA with PnP harness, CANbus ECA with Universal harness or Bluetooth ECA. Options differ in fuel hardware and wiring; choose the installed pump and matching tuner/harness.</p>
<h3>Fitment</h3>
<p>For BMW X3/X4 B58 in chassis generations listed by Burger. Confirm chassis, HPFP type and CAN/analog integration method.</p>`,
  },
};
