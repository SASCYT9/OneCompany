// Source-checked JB4 harnesses, sensors and bypass adapters; local draft only.
export default {
  'jb4pro-add-on-harnesses': {
    sourceUrl: 'https://burgertuning.com/products/jb4pro-add-on-harnesses',
    titleUa: 'Додаткові harness для JB4PRO — FLEX / PI / CPI / WMI / LFP', titleEn: 'JB4PRO Add-On Harnesses — FLEX / PI / CPI / WMI / LFP',
    shortUa: 'Оберіть harness для B58/S58 FLEX/PI, Kia 3.3T CPI/WMI або LFP sensor extension.',
    shortEn: 'Select harness for B58/S58 FLEX/PI, Kia 3.3T CPI/WMI or LFP sensor extension.',
    descUa: `<h3>Розширення JB4PRO проводки</h3>
<p>Додаткові harness підключають аксесуари до JB4PRO для вимірювання fuel content/pressure або керування PI, CPI чи WMI обладнанням. Це джгути для відповідної системи, а не самі sensors, injectors чи controller, якщо окремо не зазначено.</p>
<h3>Оберіть потрібний harness</h3>
<p>Опції: B58/S58 FLEX для ethanol/pressure sensor; B58/S58 PI для портового впорскування; Kia 3.3T CPI Add-On; Kia 3.3T WMI Add-On; LFP Extension Harness для віддаленого монтажу low-fuel-pressure sensor. B58/S58 PI підключається до FLEX harness за описом постачальника.</p>
<h3>Сумісність</h3>
<p>Перевірте JB4PRO revision, платформу, controller та тип аксесуара перед вибором. Підключайте й активуйте налаштування за інструкцією Burger.</p>`,
    descEn: `<h3>Expanding JB4PRO wiring</h3>
<p>Add-on harnesses connect accessories to JB4PRO for fuel-content/pressure sensing or PI, CPI and WMI control. They are wiring pieces for a matching system, not sensors, injectors or controller unless specifically listed.</p>
<h3>Select the required harness</h3>
<p>Options are B58/S58 FLEX for ethanol/pressure sensors; B58/S58 PI for port injection; Kia 3.3T CPI Add-On; Kia 3.3T WMI Add-On; and LFP Extension Harness for remotely mounting a low-fuel-pressure sensor. Burger states the B58/S58 PI harness connects through the FLEX harness.</p>
<h3>Compatibility</h3>
<p>Check JB4PRO revision, platform, controller and accessory type before selection. Connect and enable settings according to Burger's instructions.</p>`,
  },
  'b58-s58-bmw-5bar-sensor-kit': {
    sourceUrl: 'https://burgertuning.com/products/b58-s58-bmw-5bar-sensor-kit',
    titleUa: 'BMW B58 / S58 Drop-In 5-Bar TMAP Sensor для high-boost build', titleEn: 'BMW B58 / S58 Drop-In 5-Bar TMAP Sensor for high-boost builds',
    shortUa: '5-bar sensor підвищує діапазон вимірювання наддуву приблизно з 42 до 58 psi; software rescaling обов’язковий.',
    shortEn: '5-bar sensor extends boost-reading range from about 42 to 58 psi; software rescaling is required.',
    descUa: `<h3>Діапазон вимірювання для B58/S58</h3>
<p>Замість заводського 4-bar TMAP sensor цей drop-in BMW OEM сенсор вимірює наддув до приблизно 58 psi за описом виробника, порівняно з близько 42 psi у штатного сенсора. Його застосовують у builds з великою турбіною та високим наддувом.</p>
<h3>Калібрування перед використанням</h3>
<p>Після встановлення потрібні прості sensor calibration/rescale зміни у MHD, BM3, EcuTek або JB4 software. Без правильного масштабу блок керування може некоректно інтерпретувати показник наддуву. Harness modification не потрібна за описом Burger.</p>
<h3>Сумісність</h3>
<p>Для перелічених BMW B58/S58 поколінь і шасі. Перевірте покоління двигуна й оберіть відповідне калібрування у своєму тюнері.</p>`,
    descEn: `<h3>Measurement range for B58/S58</h3>
<p>This drop-in genuine BMW 5-bar TMAP sensor replaces the factory 4-bar sensor and is described as measuring up to about 58 psi boost, versus approximately 42 psi on stock. It is intended for larger-turbo and higher-boost builds.</p>
<h3>Calibration is required</h3>
<p>After installation, rescale/calibrate the sensor in MHD, BM3, EcuTek or JB4 software. Without correct scaling, the control unit may misread boost. Burger says no harness changes are needed.</p>
<h3>Fitment</h3>
<p>For listed BMW B58/S58 generations and chassis. Verify engine generation and select the matching calibration in your tuning platform.</p>`,
  },
  'kia-stinger-genesis-g70-g90-4-bar-tmap-adapter-kit': {
    sourceUrl: 'https://burgertuning.com/products/kia-stinger-genesis-g70-g90-4-bar-tmap-adapter-kit',
    titleUa: '4-Bar TMAP Adapter Kit для Kia Stinger / Genesis 3.3T', titleEn: '4-Bar TMAP Adapter Kit for Kia Stinger / Genesis 3.3T',
    shortUa: 'Plug-and-play kit замінює 3-bar MAP на Bosch 4-bar sensor для більшого діапазону наддуву; потрібне ECU/JB4 rescale.',
    shortEn: 'Plug-and-play kit replaces 3-bar MAP with Bosch 4-bar sensor for higher boost range; ECU/JB4 rescaling required.',
    descUa: `<h3>Розширення діапазону MAP sensor</h3>
<p>Комплект замінює 3-bar TMAP/MAP sensor у charge pipe на Bosch 4-bar sensor, що призначений для високого наддуву на модифікованих turbo kit. У коробці за описом Burger: Bosch 4-bar sensor, plug-and-play billet adapter, O-rings та монтажне hardware.</p>
<h3>Потрібне налаштування ECU</h3>
<p>Після встановлення потрібно rescale сигналу у JB4 або flash calibration для 4-bar sensor. Без коректного scaling показники тиску можуть бути неправильними; комплект сам по собі не збільшує boost.</p>
<h3>Сумісність</h3>
<p>Для Kia Stinger GT 3.3T, Genesis G70/G80 3.3T та G90 3.3T у роках, перелічених Burger. Переконайтеся, що ваша charge pipe має відповідний sensor port.</p>`,
    descEn: `<h3>Extending MAP sensor range</h3>
<p>The kit replaces the 3-bar charge-pipe TMAP/MAP sensor with a Bosch 4-bar sensor intended for higher boost on modified turbo setups. Burger lists the Bosch sensor, plug-and-play billet adapter, O-rings and installation hardware.</p>
<h3>ECU calibration required</h3>
<p>After installation, rescale the signal for a 4-bar sensor in JB4 or compatible flash calibration. Without correct scaling, pressure readings may be wrong; the kit does not increase boost by itself.</p>
<h3>Fitment</h3>
<p>For Kia Stinger GT 3.3T, Genesis G70/G80 3.3T and G90 3.3T for listed years. Confirm the charge pipe has the matching sensor port.</p>`,
  },
  'coolant-pressure-sensor-adapter-for-bmw': {
    sourceUrl: 'https://burgertuning.com/products/coolant-pressure-sensor-adapter-for-bmw',
    titleUa: 'Coolant Pressure Sensor Adapter для BMW / Supra — JB4 чи JB4PRO', titleEn: 'Coolant Pressure Sensor Adapter for BMW / Supra — JB4 or JB4PRO',
    shortUa: 'Моніторить coolant pressure у реальному часі; оберіть JB4 kit, JB4PRO kit або fitting only для власного sensor.',
    shortEn: 'Monitors coolant pressure in real time; select JB4 kit, JB4PRO kit or fitting only for a supplied sensor.',
    descUa: `<h3>Навіщо контролювати coolant pressure</h3>
<p>Adapter встановлюється inline на coolant overflow tank hose та додає порт 1/8″ NPT для sensor. У JB4 система може відстежувати підвищення тиску охолоджувальної рідини, що постачальник вказує як ранній сигнал потенційного head-gasket lift на high-boost двигунах.</p>
<h3>Оберіть версію</h3>
<p>Опції: повний kit із sensor/harness для JB4, повний kit для JB4PRO або fitting only для власного сумісного sensor. Підключення використовує Posi-Tap для живлення та DSUB pin для сигналу. Не використовуйте fitting-only опцію, якщо немає потрібного датчика й проводки.</p>
<h3>Сумісність</h3>
<p>Для BMW/Supra з відповідним JB4/JB4PRO harness. Перевірте діаметр coolant hose, тип системи та доступний sensor input до встановлення.</p>`,
    descEn: `<h3>Why monitor coolant pressure</h3>
<p>The adapter installs inline on the coolant overflow-tank hose and adds a 1/8-inch NPT sensor port. With JB4, the system can monitor rising coolant pressure, which the supplier describes as an early indicator of potential head-gasket lift on high-boost engines.</p>
<h3>Select the version</h3>
<p>Options are a complete kit with sensor/harness for JB4, complete kit for JB4PRO or fitting only for a compatible customer-supplied sensor. Connection uses a Posi-Tap for power and DSUB pin for signal. Do not choose fitting-only without the required sensor/wiring.</p>
<h3>Fitment</h3>
<p>For BMW/Supra with the matching JB4/JB4PRO harness. Verify coolant-hose diameter, system and available sensor input before installation.</p>`,
  },
  'kia-coolant-pressure-gauge-adapter': {
    sourceUrl: 'https://burgertuning.com/products/kia-coolant-pressure-gauge-adapter',
    titleUa: 'Coolant Pressure Adapter для Kia / Genesis 3.3T — JB4 або JB4PRO', titleEn: 'Coolant Pressure Adapter for Kia / Genesis 3.3T — JB4 or JB4PRO',
    shortUa: 'Вбудовується в coolant hose та передає pressure sensor сигнал до JB4/JB4PRO для моніторингу двигуна.',
    shortEn: 'Installs inline in coolant hose and sends pressure-sensor data to JB4/JB4PRO for engine monitoring.',
    descUa: `<h3>Моніторинг тиску охолодження на Kia 3.3T</h3>
<p>Adapter додає coolant pressure sensor у контур охолодження та передає показник у JB4, що дозволяє спостерігати за тиском під навантаженням. Постачальник описує підвищення тиску як можливу ознаку проблеми з ущільненням головки на high-boost двигуні; датчик не запобігає поломці гарантовано.</p>
<h3>Оберіть модель системи</h3>
<p>Версії призначені для JB4 або JB4PRO та мають відповідний harness. У комплекті fitting, проводка, Posi-Tap і DSUB signal pin за описом Burger; під’єднуйте inline до coolant hose за інструкцією.</p>
<h3>Сумісність</h3>
<p>Для Kia/Genesis 3.3L Turbo платформ, сумісних із відповідною JB4 системою. Підтвердіть harness type, hose layout і model year.</p>`,
    descEn: `<h3>Coolant-pressure monitoring on Kia 3.3T</h3>
<p>The adapter adds a coolant pressure sensor to the cooling circuit and sends its reading to JB4 for monitoring under load. The supplier describes rising pressure as a possible sign of head-sealing issues on high-boost engines; the sensor is not a guarantee against failure.</p>
<h3>Select the system version</h3>
<p>Versions are designed for JB4 or JB4PRO with matching harness. Burger lists fitting, wiring, Posi-Tap and DSUB signal pin; install inline on the coolant hose as directed.</p>
<h3>Fitment</h3>
<p>For compatible Kia/Genesis 3.3L Turbo platforms using the matching JB4 system. Confirm harness type, hose layout and model year.</p>`,
  },
  'kia-hyundai-plug-play-fuel-wire-adapters': {
    sourceUrl: 'https://burgertuning.com/products/kia-hyundai-plug-play-fuel-wire-adapters',
    titleUa: 'JB4 PNP Fuel Wire Adapter для Kia / Hyundai / Genesis — 4 або 6 циліндрів', titleEn: 'JB4 PNP Fuel Wire Adapter for Kia / Hyundai / Genesis — 4 or 6 cylinders',
    shortUa: 'Оберіть один adapter для 4-cyl або пару для 6-cyl; з’єднання fuel-control wire без проколювання штатного O2 harness.',
    shortEn: 'Select one adapter for 4-cyl or a pair for 6-cyl; connects fuel-control wire without piercing factory O2 harness.',
    descUa: `<h3>Підключення JB4 fuel-control без splice</h3>
<p>PNP adapter створює знімне підключення паливного сигналу без проколювання штатної O2 sensor проводки. Це спрощує встановлення й повернення до заводської проводки.</p>
<h3>Оберіть кількість адаптерів</h3>
<p>Для 6-циліндрового двигуна потрібні два adapter, для 4-циліндрового — один. Для Kia/Hyundai 3.3T та 1.6T Burger вказує червоний signal wire; для 2.0T — чорний дріт у позиції #2 на adapter. Перевірте рік та ECU, особливо для 1.6T.</p>
<h3>Сумісність</h3>
<p>Лише з JB4 Kia/Hyundai V1, за приміткою постачальника; V2–V4 не використовують цей O2 sensor connection. Звірте версію JB4 перед замовленням.</p>`,
    descEn: `<h3>JB4 fuel-control connection without splicing</h3>
<p>The PNP adapter creates a removable fuel-signal connection without piercing the factory O2 sensor wiring. This simplifies installation and allows the original wiring to be restored.</p>
<h3>Select adapter quantity</h3>
<p>Six-cylinder engines require two adapters; four-cylinder engines use one. Burger identifies the red signal wire for Kia/Hyundai 3.3T and 1.6T, and the black wire at position #2 for 2.0T. Verify model year and ECU, especially on 1.6T.</p>
<h3>Fitment</h3>
<p>For Kia/Hyundai JB4 V1 only, per the supplier; V2–V4 do not use this O2 sensor connection. Confirm JB4 version before ordering.</p>`,
  },
};
