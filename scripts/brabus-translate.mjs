/**
 * Apply hand-translated descriptions to product data
 * Uses fuzzy key matching (first 40 chars of description) to find translations
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// All translations inline - no separate JSON files needed
const TRANSLATIONS = {
  // DESC 1 - BRABUS WIDESTAR
  "Durch integrierte LEDs werden die Trittbretter": {
    en: "Integrated LEDs illuminate the running boards and the BRABUS logos on the fender attachments. The BRABUS WIDESTAR body conversion also includes distinctive new bumpers at front and rear. The integrated LED marker lights beneath the side air intakes not only set visual accents but also enhance active safety.",
    ua: "Вбудовані світлодіоди підсвічують підніжки та логотипи BRABUS на розширеннях крил. Кузовне перетворення BRABUS WIDESTAR також включає виразні нові бампери спереду та ззаду. Інтегровані LED-габаритні вогні під бічними повітрозабірниками створюють не лише візуальні акценти, а й підвищують активну безпеку."
  },
  // DESC 2 - Hood Scoop
  "Power bis ins Detail: Der Motorhaubenaufsatz": {
    en: "Power in every detail: the carbon hood scoop completes the striking front view and underlines the imposing presence of your G-Class.",
    ua: "Потужність у кожній деталі: карбонова накладка на капот завершує виразний фронтальний вигляд та підкреслює масивну присутність вашого G-Class."
  },
  // DESC 3 - Front bumper attachment
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Der Frontsch": {
    en: "Sporty, dynamic appearance and improved aerodynamics: the front bumper attachment completes the BRABUS identity of your vehicle. Made from high-quality PUR-R-RIM plastic and mounted in combination with the front spoiler.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: накладка на передній бампер завершує ідентичність BRABUS вашого автомобіля. Виготовлена з високоякісного пластику PUR-R-RIM та монтується в комбінації з переднім спойлером."
  },
  // DESC 4 - Rear diffuser
  "Der Heckdiffusor": {
    en: "The rear diffuser, designed like a classic motorsport diffuser, fits perfectly into the overall look. It replaces the original rear bumper insert. The rear diffuser is made from premium carbon fiber.",
    ua: "Задній дифузор, розроблений як класичний гоночний дифузор, ідеально вписується у загальний вигляд. Він замінює оригінальну вставку заднього бампера. Виготовлений з преміального карбонового волокна."
  },
  // DESC 5 - Rear spoiler PUR
  "Elegant, dezent, sportlich: Der BRABUS Heckspoiler aus hochwertigem PUR": {
    en: "Elegant, understated, sporty: the BRABUS rear spoiler made from premium PUR-R-RIM provides enhanced downforce and driving stability through improved aerodynamics.",
    ua: "Елегантний, стриманий, спортивний: задній спойлер BRABUS з преміального PUR-R-RIM забезпечує покращений притиск та стабільність руху завдяки вдосконаленій аеродинаміці."
  },
  // DESC 6 - Rear spoiler Carbon
  "Elegant, dezent, sportlich: Der BRABUS Heckspoiler kombiniert": {
    en: "Elegant, understated, sporty: the BRABUS rear spoiler combined with premium carbon inserts provides enhanced downforce and driving stability through improved aerodynamics.",
    ua: "Елегантний, стриманий, спортивний: задній спойлер BRABUS у поєднанні з преміальними карбоновими вставками забезпечує покращений притиск та стабільність завдяки вдосконаленій аеродинаміці."
  },
  // DESC 7 - License plate holder
  "Durch die flexible Wechselleiste": {
    en: "The flexible interchangeable strip makes removing the license plate effortless. Suitable for all single-line license plates in standard size (520x110 mm).",
    ua: "Гнучка змінна планка дозволяє легко знімати номерний знак. Підходить для всіх однорядних номерних знаків стандартного розміру (520x110 мм)."
  },
  // DESC 8 - License plate holder Carbon
  "Das Set besteht aus zwei Basistr": {
    en: "The set consists of two base carriers and vehicle-contoured mounting frames for front and rear. The stainless steel frames feature the signature BRABUS carbon coating and BRABUS lettering.",
    ua: "Комплект складається з двох базових кріплень та рамок, адаптованих до контуру автомобіля. Рамки з нержавіючої сталі мають фірмове карбонове покриття BRABUS та напис BRABUS."
  },
  // DESC 9 - Roof attachment Carbon
  "Aufregende Optik und ein weiteres Plus an Sicherheit": {
    en: "Striking appearance and additional safety through increased light output: the BRABUS carbon roof attachment. This precision-fit carbon part is equipped with twelve powerful LEDs on each side, providing enhanced road illumination when activating the high beams.",
    ua: "Вражаючий вигляд та додатковий бонус до безпеки завдяки підвищеній світловіддачі: карбоновий даховий елемент BRABUS. Оснащений дванадцятьма потужними LED з кожного боку для покращеного освітлення дороги при увімкненні далекого світла."
  },
  // DESC 10 - Radiator grille
  "Ein Blickfang f\u00fcr Ihre G-Klasse - Der BRABUS K\u00fchlergrill": {
    en: "An eye-catcher for your G-Class: the BRABUS radiator grille attachment made from premium carbon impresses with its clean structure and elegance.",
    ua: "Окраса вашого G-Class: накладка на решітку радіатора BRABUS з преміального карбону вражає чіткою структурою та елегантністю."
  },
  // DESC 11 - Door handles
  "Mit den T\u00fcrgriffen mit BRABUS-Schriftzug": {
    en: "Sign of Excellence: the BRABUS hallmark. With door handles featuring the BRABUS lettering, you complete the unmistakable BRABUS look down to the finest detail.",
    ua: "Знак досконалості — печатка BRABUS. Дверні ручки з написом BRABUS завершують неповторний стиль BRABUS до найдрібніших деталей."
  },
  // DESC 12 - Door handles Carbon
  "Carbon bis ins kleinste Detail": {
    en: "Carbon down to the smallest detail: the striking appearance is completed by five premium carbon door handles. The exquisite carbon parts are complemented by inlaid BRABUS logos.",
    ua: "Карбон до найдрібніших деталей: виразний вигляд завершують п'ять преміальних карбонових дверних ручок доповнених вбудованими логотипами BRABUS."
  },
  // DESC 13 - Spare wheel cover
  "Mit der BRABUS Reserverad-Abdeckung": {
    en: "Sign of Excellence: the BRABUS hallmark. With the BRABUS spare wheel cover made from premium carbon, you complete the unmistakable BRABUS look.",
    ua: "Знак досконалості — печатка BRABUS. Кришка запасного колеса BRABUS з преміального карбону завершує неповторний стиль BRABUS."
  },
  // DESC 14 - Easy entry
  "Die speziellen T\u00fcrfangb": {
    en: "The special door check straps for the rear doors enable easier entry. The door opens with an enlarged opening angle (89 degrees).",
    ua: "Спеціальні обмежувачі задніх дверей забезпечують легший вхід. Двері відкриваються зі збільшеним кутом відкриття (89 градусів)."
  },
  // DESC 15 - Light Carpet
  "Ein Blickfang beim Einstieg": {
    en: "An eye-catcher when entering your G-Class: the BRABUS Light Carpet illuminates your vehicle together with the WIDESTAR lighting, creating an impressive entry experience.",
    ua: "Окраса при вході у ваш G-Class: BRABUS Light Carpet підсвічує ваш автомобіль разом з освітленням WIDESTAR, створюючи вражаючий ефект при посадці."
  },
  // DESC 16 - INVICTO armoring
  "Die INVICTO Shelter Cell": {
    en: "The INVICTO Shelter Cell with its zero-gap design was engineered for maximum protection, matching OEM factory armoring level. Every material combination and bolt connection was tested from multiple angles with projectile velocities far exceeding standard. Fully certified by the German Proof House in Ulm according to VPAM guidelines.",
    ua: "Бронекапсула INVICTO з дизайном нульового зазору розроблена для максимального захисту на рівні заводського бронювання. Кожне з'єднання матеріалів було обстріляне з різних кутів зі швидкостями, що значно перевищують нормативні. Повна сертифікація Німецьким відомством в Ульмі за стандартами VPAM."
  },
  // DESC 17 - Car Cover
  "Die hochwertige Abdeckung aus schwarzem Premiumstoff": {
    en: "The premium cover made from black high-end fabric impresses with its unique quilted design, subtly accentuated by a red contour liner. The BRABUS logo is embroidered in red, adding unmistakable elegance. Designed for a perfect fit tailored to your BRABUS model, it provides outstanding protection.",
    ua: "Преміальний чохол з чорної тканини вищого ґатунку вражає унікальним стьобаним дизайном з червоною контурною лінією. Логотип BRABUS вишитий червоним. Розроблений для ідеальної посадки під вашу модель BRABUS, забезпечує чудовий захист."
  },
  // DESC 18 - Adventure Package
  "Das BRABUS ADVENTURE Zubeh": {
    en: "The BRABUS ADVENTURE accessory package combines spectacular appearance with enhanced off-road capability. A comprehensive equipment package was developed to make the off-roader even more spectacular and capable for harsh terrain use.",
    ua: "Пакет аксесуарів BRABUS ADVENTURE поєднує вражаючий вигляд з покращеною прохідністю. Комплексний пакет обладнання розроблений для ще ефектнішого та більш придатного для бездоріжжя позашляховика."
  },
  // DESC 19 - Valve exhaust AMG G63
  "Unverkennbarer BRABUS Sound auf Knopfdruck": {
    en: "Unmistakable BRABUS sound at the push of a button: the valve-controlled sport exhaust system delivers thrilling acoustics and optimized power delivery. Valve control from the cockpit lets the driver precisely adjust the engine sound. Completed by two angled 90mm tailpipes in chrome or black-chrome finish.",
    ua: "Незабутній звук BRABUS одним натисканням кнопки: спортивна вихлопна система з клапанним управлінням забезпечує захоплюючу акустику та оптимізовану потужність. Управління клапанами з кокпіту для точного налаштування звуку. Два патрубки 90 мм у хромованому або чорно-хромованому виконанні."
  },
  // DESC 20 - Blow Off Valve
  "Der BRABUS Blow Off": {
    en: "The BRABUS Blow Off Valve Adapter vents bypass air freely into the engine bay, producing the characteristic blow-off sound of a turbocharged engine that modern turbo systems no longer generate.",
    ua: "Адаптер перепускного клапана BRABUS вивільняє перепускне повітря у моторний відсік, створюючи характерний звук blow-off турбодвигуна, який сучасні системи більше не генерують."
  },
  // DESC 21 - Rocket 900
  "Ultimative Performance garantiert": {
    en: "Ultimate performance guaranteed: the BRABUS engine conversion includes displacement increase to 4.5 liters, two special turbochargers with larger compressor units (52mm), reinforced thrust bearings, high-pressure fuel pumps, 75mm downpipes, high-performance catalytic system, BRABUS valve exhaust (76mm), and specially calibrated ECU mapping.",
    ua: "Гарантована максимальна продуктивність: конверсія двигуна BRABUS включає збільшення об'єму до 4,5 л, два спеціальні турбокомпресори (52 мм), посилені підшипники, паливні насоси високого тиску, даунпайпи 75 мм, високопродуктивну каталітичну систему, вихлоп BRABUS з клапанами (76 мм) та спеціально відкалібрований ЕБУ."
  },
  // DESC 22 - PowerXtra B40S-800
  "Imposante BRABUS Power": {
    en: "Imposing BRABUS power for an incomparable driving experience: the PowerXtra B40S-800 kit with Vmax 220/240 km/h. Two special turbochargers with larger compressors (52mm), reinforced thrust bearings, and BRABUS PowerXtra ECU. Torque: 850 to 1000 Nm. Power: 430 kW/585 PS to 588 kW/800 PS. Plug-and-play connection.",
    ua: "Вражаюча потужність BRABUS для неперевершеного водіння: PowerXtra B40S-800 з Vmax 220/240 км/год. Два спеціальні турбокомпресори (52 мм), посилені підшипники, ЕБУ BRABUS PowerXtra. Крутний момент: з 850 до 1000 Нм. Потужність: з 430 кВт/585 к.с. до 588 кВт/800 к.с. Підключення Plug & Play."
  },
  // DESC 23 - PowerXtra B40-700
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B40-700": {
    en: "BRABUS extra power: the PowerXtra B40-700 performance kit for the G63 (W463A). Processor-controlled auxiliary ECU. Torque: 850 to 950 Nm. Power increase by 85 kW/115 PS, from 430 kW/585 PS to 515 kW/700 PS. Plug-and-play connection.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra B40-700 для G63 (W463A). Процесорний додатковий ЕБУ. Крутний момент: з 850 до 950 Нм. Потужність збільшується на 85 кВт/115 к.с. — до 515 кВт/700 к.с. Підключення Plug & Play."
  },
  // DESC 24 - Start-Stop Memory
  "Das BRABUS Start-Stop Memory": {
    en: "The BRABUS Start-Stop Memory system deactivates the Start-Stop function until manually re-enabled. The system saves the last switch setting. Plug-and-play connection. Ready for shipping.",
    ua: "Система BRABUS Start-Stop Memory деактивує функцію Start-Stop до ручного увімкнення. Система зберігає налаштування. Підключення Plug & Play."
  },
  // DESC 25-36 - Monoblock wheels
  "Monoblock ZV": {
    en: "Monoblock ZV Platinum Edition: high-tech forged wheel from BRABUS. State-of-the-art manufacturing with classic Signature Black finish and exclusive 20-spoke design. Maximum strength with minimal weight through high-tech forging technology.",
    ua: "Monoblock ZV Platinum Edition: високотехнологічне коване колесо від BRABUS. Найсучасніші виробничі процеси з класичним покриттям Signature Black та 20-спицевим дизайном. Максимальна міцність з мінімальною вагою."
  },
  "Monoblock ZM": {
    en: "Monoblock ZM Platinum Edition: forged through state-of-the-art CNC machining in high-strength lightweight construction. Signature BRABUS Black and Bold center disc with 20 polished spokes. Lockable hub cap with center-lock styling.",
    ua: "Monoblock ZM Platinum Edition: виготовлене за CNC-технологією у полегшеному виконанні. Фірмовий дизайн центрального диска BRABUS Black and Bold з 20 полірованими спицями. Ковпак маточини із замком."
  },
  "Monoblock Z \"Platinum": {
    en: "Monoblock Z Platinum Edition: high-tech forged wheel from BRABUS. Innovative ten-spoke styling. Maximum strength with minimal weight through high-tech forging technology.",
    ua: "Monoblock Z Platinum Edition: високотехнологічне коване колесо від BRABUS. Інноваційний десятиспицевий дизайн. Максимальна міцність з мінімальною вагою."
  },
  "Monoblock Y \"Platinum": {
    en: "Monoblock Y Platinum Edition: forged wheel with striking Y-spoke design in fully polished finish. Extreme lightness and outstanding material quality. Significant driving dynamics advantages and improved road holding.",
    ua: "Monoblock Y Platinum Edition: коване колесо з Y-подібним дизайном у полірованому покритті. Екстремальна легкість та чудова якість матеріалу. Значні переваги у динаміці та зчепленні."
  },
  "Monoblock Y \"Gold": {
    en: "Monoblock Y Gold Platinum: forged wheel with striking Y-spoke design in Gold Platinum finish. Extreme lightness and outstanding material quality for improved driving dynamics.",
    ua: "Monoblock Y Gold Platinum: коване колесо з Y-подібним дизайном у покритті Gold Platinum. Екстремальна легкість та якість матеріалу для покращеної динаміки."
  },
  "Monoblock Y \"Black": {
    en: "Monoblock Y Black Platinum: forged wheel with striking Y-spoke design in Black Platinum finish. Extreme lightness and outstanding material quality for improved driving dynamics.",
    ua: "Monoblock Y Black Platinum: коване колесо з Y-подібним дизайном у покритті Black Platinum. Екстремальна легкість та якість матеріалу для покращеної динаміки."
  },
  "Monoblock T": {
    en: "Monoblock T: exclusive eye-catcher from BRABUS. Carbon-look inlays enhance the 5-spoke cast alloy wheel design. Sterling Silver high gloss finish completes the elegant look.",
    ua: "Monoblock T: ексклюзивна окраса від BRABUS. Вставки під карбон підкреслюють 5-спицевий дизайн литого колеса. Покриття Sterling Silver high gloss завершує елегантний вигляд."
  },
  "Das in modernster Gusstechnik gefertigte Leichtmetallrad Monoblock R": {
    en: "Monoblock R: state-of-the-art cast alloy wheel in 5-double-spoke design with Liquid Titanium smoked finish. Recessed spoke elements create expressive accents. Undercut achieves weight optimization.",
    ua: "Monoblock R: легкосплавне колесо з 5-подвійним спицевим дизайном у покритті Liquid Titanium smoked. Заглиблені елементи спиць створюють виразні акценти. Підріз оптимізує вагу."
  },
  "Das BRABUS Monoblock M \"Shadow": {
    en: "BRABUS Monoblock M Shadow Platinum: forged wheel with unmistakable signature styling. Ten larger and smaller openings optimize brake ventilation. Exclusive Shadow Platinum finish.",
    ua: "BRABUS Monoblock M Shadow Platinum: коване колесо з неповторним фірмовим стилем. Десять великих та малих отворів оптимізують вентиляцію гальм. Ексклюзивне покриття Shadow Platinum."
  },
  "Das geschmiedete Monoblock M Rad": {
    en: "Monoblock M Platinum Edition: forged wheel with large-format disc design and ten ventilation openings. Schwarz Vollpoliert (black fully polished) finish.",
    ua: "Monoblock M Platinum Edition: коване колесо з широким дисковим дизайном та десятьма вентиляційними отворами. Покриття Schwarz Vollpoliert (чорний повністю полірований)."
  },
  "Monoblock HD": {
    en: "Monoblock HD: designed for extreme off-road use. Eight-spoke design engineered for maximum strength. 9.5Jx20 in Gunmetal Black finish. Only 15.4 kg through state-of-the-art forging technology — surprisingly light for this load class.",
    ua: "Monoblock HD: для екстремального бездоріжжя. Восьмиспицевий дизайн максимальної міцності. 9.5Jx20 у покритті Gunmetal Black. Лише 15,4 кг завдяки технології кування — вражаюче легкі для цього класу навантаження."
  },
  "Monoblock G \"Platinum": {
    en: "Monoblock G Platinum Edition: forged wheels in elegant five-spoke design. Anthracite titanium fully polished with matte finish. Extreme lightness and outstanding material quality.",
    ua: "Monoblock G Platinum Edition: ковані колеса в п'ятиспицевому дизайні. Антрацит-титан полірований з матовим покриттям. Екстремальна легкість та чудова якість матеріалу."
  },
  "Monoblock F \"Titanium Gunmetal\"": {
    en: "Monoblock F Titanium Gunmetal: high-tech forged wheel with cross-spoke design in Titanium Gunmetal matte finish. Offset spokes emphasize three-dimensionality. Significantly lighter than cast wheels of same size.",
    ua: "Monoblock F Titanium Gunmetal: високотехнологічне коване колесо з перехресним дизайном спиць у матовому покритті. Зміщені спиці підкреслюють тривимірність. Значно легше за литі аналоги."
  },
  "Monoblock F \"Platinum Edition\"": {
    en: "Monoblock F Platinum Edition: high-tech forged wheel with cross-spoke design in brushed silver finish. Offset spokes emphasize three-dimensionality. Significantly lighter than cast wheels.",
    ua: "Monoblock F Platinum Edition: високотехнологічне коване колесо з перехресним дизайном у покритті brushed silver. Зміщені спиці підкреслюють тривимірність. Значно легше за литі аналоги."
  },
  "Monoblock F \"Black Platinum\"": {
    en: "Monoblock F Black Platinum: high-tech forged wheel with cross-spoke design in Black Platinum finish. Significantly lighter than cast wheels of same size.",
    ua: "Monoblock F Black Platinum: високотехнологічне коване колесо з перехресним дизайном у покритті Black Platinum. Значно легше за литі аналоги."
  },
  // DESC 40-42 Hub caps
  "Die BRABUS Aluminium Nabenkappen": {
    en: "BRABUS aluminum hub caps complete the overall appearance of the wheels. Supplied as a set of four with embossed BRABUS logo.",
    ua: "Алюмінієві ковпаки маточини BRABUS завершують загальний вигляд коліс. Комплект з чотирьох штук з тисненим логотипом BRABUS."
  },
  "Die feststehenden BRABUS Nabenkappen D70": {
    en: "BRABUS D70 fixed hub caps keep the iconic Double-B logo perfectly upright while driving. Compatible with Monoblock ZM, ZV, P wheels (70mm). Four-piece set.",
    ua: "Нерухомі ковпаки маточини BRABUS D70: логотип Double-B залишається вертикальним під час руху. Сумісні з Monoblock ZM, ZV, P (70 мм). Комплект з 4 шт."
  },
  "Die feststehenden BRABUS Nabenkappen D75": {
    en: "BRABUS D75 fixed hub caps keep the iconic Double-B logo perfectly upright while driving. Compatible with Monoblock Z, Y, R, M, HD, ZHD wheels (75mm). Four-piece set.",
    ua: "Нерухомі ковпаки маточини BRABUS D75: логотип Double-B залишається вертикальним під час руху. Сумісні з Monoblock Z, Y, R, M, HD, ZHD (75 мм). Комплект з 4 шт."
  },
  // DESC 43-49 - Interiors
  "Erleben Sie moderne Eleganz, inspiriert vom Ozean": {
    en: "Experience modern elegance inspired by the ocean. Masterpiece interior in Deep Blue Style with leather and premium carbon. Color-coordinated piping in Deep Blue and Slate Grey stitching. Dynamic shell-diamond quilting with embossed 77 signets referencing the 1977 founding year.",
    ua: "Сучасна елегантність, натхненна океаном. Masterpiece інтер'єр у стилі Deep Blue зі шкірою та преміальним карбоном. Канти Deep Blue та прострочка Slate Grey. Стьобка мушля-ромб з тисненням 77 — рік заснування BRABUS 1977."
  },
  "Moderner Lifestyle, coole Hotspots": {
    en: "Modern lifestyle, cool hotspots, and the New York skyline. Masterpiece interior in Upper East Side Style: vanilla-colored leather, black leather, and orange piping. Shell-diamond quilting.",
    ua: "Сучасний стиль, модні локації та горизонт Нью-Йорка. Masterpiece інтер'єр Upper East Side: ванільна шкіра, чорна шкіра та помаранчеві канти. Стьобка мушля-ромб."
  },
  "Blaues Wasser, strahlend blauer Himmel": {
    en: "Blue water, radiant blue skies, and the blue roofs of the Greek archipelago. Masterpiece interior in Santorini Style: leather, Alcantara, and premium carbon. Dynamic diamond quilting.",
    ua: "Блакитна вода, яскраво-блакитне небо та сині дахи грецького архіпелагу. Masterpiece інтер'єр Santorini: шкіра, алькантара та преміальний карбон. Динамічна ромбоподібна стьобка."
  },
  "Atemberaubende Aussichten": {
    en: "Breathtaking views, beautiful beaches, and the adventurous spirit of South Africa. Masterpiece interior in Capetown Style: Cuoio-colored leather, black piping, and breathable BRABUS Mastik leather. Rising Diamond quilting.",
    ua: "Захоплюючі краєвиди та дух пригод Південної Африки. Masterpiece інтер'єр Capetown: шкіра Cuoio, чорні канти та дихаюча шкіра BRABUS Mastik. Стьобка Rising Diamond."
  },
  "Hochglanzversiegelte Carbon-Blenden": {
    en: "High-gloss carbon panels in the cockpit with gold-colored BRABUS labels. Aluminum pedals and door lock pins. Carbon door sills. BRABUS individual rear seat system with comfort and multimedia capabilities.",
    ua: "Високоглянцеві карбонові панелі з золотистими лейблами BRABUS. Алюмінієві педалі та фіксатори замків. Карбонові порогові накладки. Індивідуальна система задніх сидінь BRABUS з комфортом та мультимедіа."
  },
  "The best of both Worlds": {
    en: "The best of both worlds. Inspired by Shadow Superboats: black, light grey, and red leather with square-quilted, perforated center panels. Highlight: integrated red shine-through effect continuing on A-pillar inner surfaces.",
    ua: "Найкраще з двох світів. Натхненний Shadow Superboats: чорна, світло-сіра та червона шкіра зі стьобкою та перфорацією. Родзинка: ефект червоного просвічування на внутрішніх поверхнях стійок A."
  },
  "Dezent sportlich. Schwarzes Leder": {
    en: "Understated sporty. Black leather with red accents and stitched BRABUS lettering. Precision-perforated leather surfaces with BRABUS Red piping and starry sky headliner.",
    ua: "Стримано спортивний. Чорна шкіра з червоними акцентами та вишитими написами BRABUS. Перфоровані шкіряні поверхні з кантами BRABUS Red та зоряним небом на стелі."
  },
  // DESC 50-60 - Interior accessories
  "Sch\u00fctzen Sie Ihren Schl\u00fcssel": {
    en: "Protect your key with this exclusive BRABUS key cover. Premium leather with black stitching, B embossing on the front and BRABUS lettering on the back.",
    ua: "Захистіть свій ключ ексклюзивним чохлом BRABUS. Преміальна шкіра з чорною прострочкою, тиснення B спереду та напис BRABUS ззаду."
  },
  "RACE-Design bis ins letzte Detail": {
    en: "Race design to the last detail: BRABUS paddle shifters in matte aluminum with leather inserts. Plug-and-play installation. Premium manual shifting experience with genuine race car feel.",
    ua: "Гоночний дизайн до останньої деталі: підрульові лепестки BRABUS з матового алюмінію зі шкіряними вставками. Встановлення Plug & Play. Преміальне ручне перемикання з гоночним відчуттям."
  },
  "Design bis ins letzte Detail: Die BRABUS Schaltwippen aus gl": {
    en: "Design to the last detail: BRABUS paddle shifters in glossy carbon. Plug-and-play installation for a genuine racing experience.",
    ua: "Дизайн до останньої деталі: підрульові лепестки BRABUS з глянцевого карбону. Встановлення Plug & Play для справжнього гоночного досвіду."
  },
  "Immer Griffbereit": {
    en: "Always within reach: carbon-look grab handles complete the unmistakable BRABUS look of your G-Class.",
    ua: "Завжди під рукою: ручки у карбоновому стилі завершують неповторний вигляд BRABUS вашого G-Class."
  },
  "Sportliche Optik, sicherer Grip": {
    en: "Sporty appearance, secure grip: premium BRABUS pedal covers in matte anodized aluminum. Two-piece set for automatic transmission.",
    ua: "Спортивний вигляд, надійне зчеплення: преміальні накладки на педалі BRABUS з матового анодованого алюмінію. Комплект з двох штук для АКПП."
  },
  "Mit den BRABUS T\u00fcrverriegelungsstiften": {
    en: "BRABUS door lock pins demonstrate attention to detail. Four-piece anodized aluminum set with embossed BRABUS Double-B logo.",
    ua: "Фіксатори дверних замків BRABUS — увага до деталей. Комплект з 4 шт. з анодованого алюмінію з тисненим логотипом Double-B."
  },
  "Ein Blickfang f\u00fcr Ihre G-Klasse - Die Einstiegsleisten aus hochwertigem Carbon": {
    en: "An eye-catcher for your G-Class: premium carbon door sills with LED-illuminated BRABUS logo in up to 64 colors matching ambient lighting.",
    ua: "Окраса вашого G-Class: преміальні карбонові порогові накладки з LED-підсвіченим логотипом BRABUS до 64 кольорів із синхронізацією з амбієнтним підсвічуванням."
  },
  "Die BRABUS Einstiegsleisten in Edelstahl": {
    en: "BRABUS stainless steel door sills on premium plastic carriers. Four-piece set with white LED-illuminated BRABUS logo.",
    ua: "Порогові накладки BRABUS з нержавіючої сталі. Комплект з 4 шт. з LED-підсвіченим логотипом BRABUS білого кольору."
  },
  "Die BRABUS Einstiegsleiste f\u00fcr die Heckt\u00fcr": {
    en: "BRABUS rear door sill in stainless steel with LED-illuminated BRABUS logo in up to 64 ambient lighting colors.",
    ua: "Порогова накладка BRABUS для задніх дверей з нержавіючої сталі з LED-логотипом BRABUS до 64 кольорів."
  },
  "Mit der Panerai": {
    en: "The Panerai Luminor Watch completes your interior with class and style. The black dial blends seamlessly with your interior, radiating timeless elegance.",
    ua: "Годинник Panerai Luminor Watch завершить ваш інтер'єр класом та стилем. Чорний циферблат бездоганно вписується у салон, випромінюючи позачасову елегантність."
  },
  "Wir definieren Komfort neu": {
    en: "Redefining comfort: individual seat system with exclusive center console replaces the rear bench. Multi-contour adjustment, memory, ventilation, and heating. BRABUS touch control panel. USB multimedia interface. Electrically adjustable fold tables. Integrated security safe with code entry.",
    ua: "Переосмислення комфорту: індивідуальна система сидінь з ексклюзивною центральною консоллю замість заднього дивана. Мультиконтурне регулювання, пам'ять, вентиляція, підігрів. Сенсорна панель BRABUS. USB-мультимедіа. Електричні столики. Вбудований сейф з кодовим замком."
  },
  "Sicher und komfortabel: Die elektrisch ausfahrbaren": {
    en: "Safe and comfortable: electrically extending running boards at the front doors enable easy and safe entry and exit.",
    ua: "Безпечно та комфортно: електричні висувні підніжки біля передніх дверей для легкої та безпечної посадки."
  },
  // DESC 62-75 remaining
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Frontsch\u00fcrzenaufs\u00e4tze": {
    en: "Sporty, dynamic appearance and improved aerodynamics: the front bumper attachments complete the BRABUS identity. Made from high-quality PUR-R-RIM plastic.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: накладки на передній бампер завершують ідентичність BRABUS. З високоякісного пластику PUR-R-RIM."
  },
  "Beeindruckende Optik: Der Sportauspuff aus Edelstahl": {
    en: "Impressive appearance: stainless steel sport exhaust with first-class craftsmanship. Includes silencer and angled double tailpipes (76mm diameter).",
    ua: "Вражаючий вигляд: спортивний вихлоп з нержавіючої сталі першокласної якості. Глушник та косо зрізані подвійні патрубки 76 мм."
  },
  "Rassiger Sound auf Knopfdruck": {
    en: "Thrilling sound at the push of a button: BRABUS valve sport exhaust with electrically adjustable valve control (loud/quiet). Two angled chrome 76mm tailpipes.",
    ua: "Захоплюючий звук одним натисканням: спортивний вихлоп BRABUS з електричним клапанним управлінням (гучно/тихо). Два хромовані патрубки 76 мм."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B40-500": {
    en: "BRABUS extra power: PowerXtra B40-500 kit for G 500. Processor-controlled auxiliary ECU. Torque: 610 to 710 Nm. Power: 310 kW/422 PS to 368 kW/500 PS. Plug-and-play. Ready for shipping.",
    ua: "Додаткова потужність BRABUS: PowerXtra B40-500 для G 500. Процесорний ЕБУ. Момент: з 610 до 710 Нм. Потужність: з 310 кВт/422 к.с. до 368 кВт/500 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra D35": {
    en: "BRABUS extra power: PowerXtra D35 kit for G 350 d. Processor-controlled auxiliary ECU. Torque: 600 to 660 Nm. Power: 210 kW/286 PS to 243 kW/330 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra D35 для G 350 d. Процесорний ЕБУ. Момент: з 600 до 660 Нм. Потужність: з 210 кВт/286 к.с. до 243 кВт/330 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra D40": {
    en: "BRABUS extra power: PowerXtra D40 kit for G 400d. Processor-controlled auxiliary ECU. Torque: 700 to 750 Nm. Power: 243 kW/330 PS to 272 kW/370 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra D40 для G 400d. Процесорний ЕБУ. Момент: з 700 до 750 Нм. Потужність: з 243 кВт/330 к.с. до 272 кВт/370 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra D45": {
    en: "BRABUS extra power: PowerXtra D45 kit for G450d (W465). Processor-controlled auxiliary ECU. Torque: 750 to 800 Nm. Power: 270 kW/367 PS to 305 kW/415 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra D45 для G450d (W465). Процесорний ЕБУ. Момент: з 750 до 800 Нм. Потужність: з 270 кВт/367 к.с. до 305 кВт/415 к.с. Plug & Play."
  },
  "Die PUR-Rim Variante des neuen BRABUS WIDESTAR": {
    en: "The PUR-RIM variant of the BRABUS WIDESTAR body concept: dynamic front and rear bumpers, fender extensions, and custom running board corners. Optionally refineable with exposed carbon components for an even more exclusive flair.",
    ua: "Варіант PUR-RIM кузовного концепту BRABUS WIDESTAR: динамічні бампери, розширення крил та індивідуальні кути підніжок. Можливість доповнення карбоновими компонентами для ще ексклюзивнішого стилю."
  },
  "Das BRABUS WIDESTAR Karosseriekonzept f\u00fcr Masterpiece": {
    en: "The BRABUS WIDESTAR body concept for Masterpiece Supercars: new widebody design entirely in premium exposed carbon fiber. Dynamic bumpers, fender extensions, and custom running board corners deliver precision engineering with an unmistakable 1-second-wow effect.",
    ua: "Кузовний концепт BRABUS WIDESTAR для Masterpiece Supercars: widebody-дизайн повністю з преміального відкритого карбону. Динамічні бампери, розширення крил та кути підніжок — прецизійна інженерія з ефектом wow з першої секунди."
  },
  "Adventure-Proof: Der WIDESTAR Frontschutzb": {
    en: "Adventure-Proof: WIDESTAR front protection bar in premium aluminum with matte black BRABUS finish. Maximum durability for Mercedes-AMG G 63 W 465. Fully compatible with 360-degree camera system.",
    ua: "Adventure-Proof: захисна дуга WIDESTAR з преміального алюмінію з матово-чорним покриттям BRABUS. Максимальна витривалість для G 63 W 465. Повна сумісність з камерами 360 градусів."
  },
  "Die BRABUS Adventure Axt": {
    en: "BRABUS Adventure Axe with mounting bracket: robust functionality in modern design. Premium materials for maximum durability, strength, and control. Precision-made bracket for secure, stylish vehicle integration.",
    ua: "Сокира BRABUS Adventure з кріпленням: надійна функціональність та сучасний дизайн. Преміальні матеріали для максимальної довговічності та контролю. Прецизійне кріплення для стильної інтеграції."
  },
  "Der BRABUS Adventure Spaten": {
    en: "BRABUS Adventure Shovel with mounting bracket: built for off-road use. Premium materials for maximum durability and reliability. Custom BRABUS bracket for seamless vehicle integration combining performance with bold design.",
    ua: "Лопата BRABUS Adventure з кріпленням: для бездоріжжя. Преміальні матеріали для максимальної витривалості. Кріплення BRABUS для бездоганної інтеграції, що поєднує продуктивність із сучасним дизайном."
  },
  "Die Sportfedern sorgen f\u00fcr eine sportlichere Optik": {
    en: "Sport springs create a sportier appearance while maintaining ride comfort. Height-adjustable via threaded adjustment, allowing variable lowering levels. The desired lowering can be set while installed.",
    ua: "Спортивні пружини для спортивнішого вигляду зі збереженням комфорту. Регулювання висоти різьбовим механізмом дозволяє варіювати рівень зниження у встановленому стані."
  },
  "Die BRABUS Dachkonsole optimiert das Fahrerlebnis": {
    en: "BRABUS roof console: real-time performance data on two high-resolution displays. Touchscreen controls for speed, RPM, time, temperature, and G-forces. Available in Alcantara microfiber or exclusive BRABUS leather.",
    ua: "Стельова консоль BRABUS: дані продуктивності в реальному часі на двох дисплеях. Сенсорне управління: швидкість, обороти, час, температура, перевантаження. Доступна в алькантарі або шкірі BRABUS."
  },
  // ─── NEW: Monoblock variants not yet covered ───
  "Monoblock F \"Liquid Titanium\"": {
    en: "Monoblock F Liquid Titanium: cast alloy wheel with cross-spoke design in Liquid Titanium color. Offset spokes emphasize three-dimensionality. Undercut achieves weight optimization with forged-wheel look.",
    ua: "Monoblock F Liquid Titanium: литий легкосплавний диск з перехресним дизайном спиць у кольорі Liquid Titanium. Зміщені спиці підкреслюють тривимірність. Підріз оптимізує вагу зі стилем кованого диска."
  },
  "Monoblock II Evo": {
    en: "Monoblock II Evo Platinum Edition: inspired by the iconic BRABUS retro styling of the 1980s and the legendary Monoblock II design. High-tech forging and CNC machining for ultimate lightness, agility, and strength.",
    ua: "Monoblock II Evo Platinum Edition: натхненний легендарним ретро-стилем BRABUS 1980-х та культовим дизайном Monoblock II. Кування та CNC-обробка для максимальної легкості, маневреності та міцності."
  },
  "Extravaganz trifft Eleganz": {
    en: "Monoblock R Red Black: extravagance meets elegance. Cast alloy wheel in 5-double-spoke design with Red Black finish. Recessed spoke elements create expressive accents. Undercut achieves weight optimization.",
    ua: "Monoblock R Red Black: екстравагантність зустрічається з елегантністю. Литий диск з 5-подвійними спицями у покритті Red Black. Заглиблені елементи спиць створюють виразні акценти."
  },
  "Das geschmiedete Leichtmetallrad Monoblock R": {
    en: "Monoblock R forged wheel in 5-double-spoke design with anthracite Titan matte fully polished finish. Recessed spoke elements create expressive accents highlighting the exceptional design.",
    ua: "Кований диск Monoblock R з 5-подвійним спицевим дизайном у покритті антрацит Titan матовий полірований. Заглиблені елементи спиць підкреслюють виняткових дизайн."
  },
  "BRABUS Monoblock X": {
    en: "BRABUS Monoblock X wheels in double-spoke design, black glossy fully polished. Seven double-spoke pairs offer optimal load capacity and attractive design.",
    ua: "Диски BRABUS Monoblock X з подвійним спицевим дизайном, чорні глянцеві повністю поліровані. Сім пар подвійних спиць — оптимальне навантаження та привабливий дизайн."
  },
  "Das BRABUS Monoblock ZM": {
    en: "BRABUS Monoblock ZM Platinum Edition: large-format black disc with 20 filigree spokes and center-lock design. Innovative forging and CNC machining for optimal balance of lightweight and strength.",
    ua: "BRABUS Monoblock ZM Platinum Edition: великоформатний чорний диск з 20 спицями та дизайном центрального замка. Кування та CNC для оптимального балансу легкості та міцності."
  },
  "Monoblock Z  \"Platinum Edition\"": {
    en: "Monoblock Z Platinum Edition: high-tech forged wheel from BRABUS. Innovative ten-spoke styling. Maximum strength with minimal weight through high-tech forging.",
    ua: "Monoblock Z Platinum Edition: високотехнологічне коване колесо від BRABUS. Інноваційний десятиспицевий дизайн. Максимальна міцність з мінімальною вагою."
  },
  // ─── NEW: Aerodynamics & Body ───
  "Der Eyecatcher f\u00fcr verbesserte Aerodynamik": {
    en: "Eye-catcher for improved aerodynamics: sleek, modern, with outstanding fit. The front spoiler corners (2-piece) impress with their appearance and optimal construction and high stability.",
    ua: "Окраса для покращеної аеродинаміки: елегантні, сучасні, з ідеальною посадкою. Кути переднього спойлера (2 частини) вражають виглядом та оптимальною конструкцією."
  },
  "Der Heckspoiler verleiht dem Fahrzeug": {
    en: "The rear spoiler gives the vehicle a sporty and elegant look while improving aerodynamics through increased downforce and traction.",
    ua: "Задній спойлер надає автомобілю спортивного та елегантного вигляду, покращуючи аеродинаміку завдяки збільшеному притискному зусиллю."
  },
  "Der Heckspoiler aus hochwertigem Carbon verleiht": {
    en: "Carbon rear spoiler gives the vehicle a sporty and elegant look while improving aerodynamics through increased downforce.",
    ua: "Карбоновий задній спойлер надає спортивного та елегантного вигляду з покращеною аеродинамікою завдяки збільшеному притиску."
  },
  "Elegant, dezent, sportlich: Der Signature": {
    en: "Elegant, understated, sporty: the Signature rear spoiler in premium PUR-R-RIM improves aerodynamics with increased downforce.",
    ua: "Елегантний, стриманий, спортивний: задній спойлер Signature з PUR-R-RIM покращує аеродинаміку завдяки збільшеному притиску."
  },
  "Sportliche und dynamische Optik: Der Hecksch\u00fcrzenaufsatz": {
    en: "Sporty and dynamic appearance: carbon rear bumper attachment in matte/glossy finish completes the BRABUS identity of your vehicle.",
    ua: "Спортивний та динамічний вигляд: карбонова накладка на задній бампер у матовому/глянцевому виконанні завершує ідентичність BRABUS."
  },
  "Der Hecksch\u00fcrzenaufsatz besteht aus hochwertigem Carbon": {
    en: "Premium carbon rear bumper attachment. Combined with the rear bumper insert for a complete sporty, dynamic appearance.",
    ua: "Накладка на задній бампер з преміального карбону. У поєднанні зі вставкою заднього бампера — завершений спортивний, динамічний вигляд."
  },
  "Der Hecksch\u00fcrzenaufsatz rundet das Gesamtbild": {
    en: "Rear bumper attachment perfects the overall look. Together with four carbon-titanium exhaust tips, it delivers dynamic sportiness.",
    ua: "Накладка на задній бампер завершує загальний вигляд. Разом із чотирма карбон-титановими патрубками — динамічна спортивність."
  },
  "Der Heckdiffusor f\u00fcgt sich perfekt": {
    en: "The rear diffuser fits perfectly into the overall look. Made from PUR-R-RIM, with exhaust tips available in chrome or black chrome.",
    ua: "Задній дифузор ідеально вписується у загальний вигляд. З PUR-R-RIM, патрубки в хромованому або чорно-хромованому виконанні."
  },
  "Der Heckdiffusor im sportlichen Design": {
    en: "Sporty rear diffuser made in proven PUR-R-RIM process, perfectly completing the BRABUS identity of your vehicle.",
    ua: "Спортивний задній дифузор, виготовлений за технологією PUR-R-RIM, ідеально завершує ідентичність BRABUS вашого автомобіля."
  },
  "Der Heckdiffusor in Carbon": {
    en: "Carbon rear diffuser designed like a classic racing diffuser. Includes four individual carbon-titanium exhaust tips. Compatible with factory exhaust system.",
    ua: "Карбоновий задній дифузор у стилі класичного гоночного. Чотири карбон-титанові патрубки. Сумісний із заводською вихлопною системою."
  },
  "Der Hecksch\u00fcrzeneinsatz f\u00fcgt sich perfekt": {
    en: "Rear bumper insert in premium carbon. Replaces the original insert for a perfect fit.",
    ua: "Вставка заднього бампера з преміального карбону. Замінює оригінальну вставку з ідеальною посадкою."
  },
  "Ein Blickfang f\u00fcr Ihre GLE-Klasse": {
    en: "Eye-catcher for your GLE-Class: premium carbon fender extensions with clear structure and elegance. Adapted to factory fenders for an extravagant appearance.",
    ua: "Окраса вашого GLE-Class: карбонові розширення крил з чіткою структурою та елегантністю. Адаптовані до заводських крил для екстравагантного вигляду."
  },
  "Ein Blickfang f\u00fcr Ihre GLS-Klasse": {
    en: "Eye-catcher for your GLS-Class: premium carbon fender extensions with clear structure and elegance. Adapted to factory fenders for an extravagant appearance.",
    ua: "Окраса вашого GLS-Class: карбонові розширення крил з чіткою структурою та елегантністю. Адаптовані до заводських крил для екстравагантного вигляду."
  },
  "Die Kotfl\u00fcgelaufs\u00e4tze (8-teilig)": {
    en: "Premium carbon fender extensions (8-piece set) with clear structure and elegance. Available for long and short wheelbase vehicles, adapted to factory fenders.",
    ua: "Карбонові розширення крил (комплект з 8 шт.) з чіткою структурою. Для довгої та короткої колісної бази, адаптовані до заводських крил."
  },
  "Die Seitenschwelleraufs\u00e4tze werden aus hochwertigem Carbon": {
    en: "Premium carbon side skirt attachments made using the prepreg process. They improve aerodynamics and create a sporty, dynamic overall appearance.",
    ua: "Карбонові накладки на бічні пороги, виготовлені за технологією prepreg. Покращують аеродинаміку та створюють спортивний, динамічний вигляд."
  },
  "Die auff\u00e4llige Frontsch\u00fcrze": {
    en: "Striking front bumper: front spoiler and 3-piece front attachments with LED lighting improve aerodynamics. Premium PUR-R-RIM with optimal design and high stability.",
    ua: "Виразний передній бампер: спойлер та 3-компонентні накладки з LED-підсвічуванням покращують аеродинаміку. PUR-R-RIM з оптимальним дизайном та високою стабільністю."
  },
  "Verleihen Sie mit den Endrohrblenden": {
    en: "Give your vehicle the unmistakable BRABUS style with exhaust tips. 90mm dual pipes left and right emphasize the powerful, massive appearance.",
    ua: "Надайте автомобілю неповторний стиль BRABUS з насадками на вихлоп. Подвійні труби 90 мм з обох боків підкреслюють потужний, масивний вигляд."
  },
  "Beeindruckende 4-Rohr-Optik: Die Endrohr-Blenden": {
    en: "Impressive 4-pipe appearance: exhaust tip covers with first-class craftsmanship. Compatible with factory exhaust and AMG Line Exterior package. Two non-flow-through 90mm tips per side in black chrome.",
    ua: "Вражаючий 4-трубний вигляд: накладки на патрубки першокласної якості. Сумісні із заводським вихлопом та пакетом AMG Line Exterior. Два патрубки 90 мм з кожного боку в чорному хромі."
  },
  "Beeindruckende 4-Rohr-Optik: Die Auspuffblenden": {
    en: "Impressive 4-pipe appearance: exhaust tip covers with first-class craftsmanship. Compatible with factory exhaust. Two non-flow-through 90mm tips per side in black chrome.",
    ua: "Вражаючий 4-трубний вигляд: накладки на вихлоп першокласної якості. Сумісні із заводським вихлопом. Два патрубки 90 мм з кожного боку в чорному хромі."
  },
  // ─── NEW: Suspension & Performance ───
  "Mit dem BRABUS SportXtra erreichen Sie ein tiefergelegtes": {
    en: "BRABUS SportXtra: achieve a lowered vehicle level on vehicles with Airmatic/ABC suspension. Lowering up to 25mm.",
    ua: "BRABUS SportXtra: знижений рівень автомобіля для підвіски Airmatic/ABC. Зниження до 25 мм."
  },
  "Mit der BRABUS SportXtra erreichen Sie ein tiefergelegtes": {
    en: "BRABUS SportXtra: achieve a lowered vehicle level on vehicles with Airmatic suspension. Lowering up to 25mm in Comfort mode.",
    ua: "BRABUS SportXtra: знижений рівень автомобіля для підвіски Airmatic. Зниження до 25 мм у режимі Комфорт."
  },
  "Mit dem BRABUS SportXtra Tieferlegungsmodul erreichen Sie": {
    en: "BRABUS SportXtra lowering module for a sporty lowered ride. Lowering up to 15mm depending on driving mode. Plug-and-play. Ready for shipping.",
    ua: "Модуль зниження BRABUS SportXtra для спортивнішої посадки. До 15 мм залежно від режиму. Plug & Play."
  },
  "Mit dem BRABUS SportXtra f\u00fcr den S 580": {
    en: "BRABUS SportXtra for S 580 4Matic: achieve a sportier ride with Airmatic suspension lowering up to 20mm by driving mode.",
    ua: "BRABUS SportXtra для S 580 4Matic: спортивніша посадка зі зниженням підвіски Airmatic до 20 мм."
  },
  "Mit dem BRABUS SportXtra f\u00fcr den S 680": {
    en: "BRABUS SportXtra for S 680 Maybach: achieve a sportier ride with Airmatic suspension lowering up to 17mm by driving mode.",
    ua: "BRABUS SportXtra для S 680 Maybach: спортивніша посадка зі зниженням Airmatic до 17 мм."
  },
  "Mit dem BRABUS SportXtra f\u00fcr Porsche Taycan": {
    en: "BRABUS SportXtra for Porsche Taycan Turbo S / Turbo / 4S: lowered ride level adjustable via cockpit display for Lift, Medium, Lowered, and Deep modes.",
    ua: "BRABUS SportXtra для Porsche Taycan Turbo S / Turbo / 4S: зниження з керуванням через дисплей: Lift, Medium, Lowered, Deep."
  },
  "Mit dem BRABUS Sport Xtra erreichen Sie ein tiefer": {
    en: "BRABUS Sport Xtra: lowered vehicle level adjustable via cockpit switch. Plug-and-play, ready for shipping.",
    ua: "BRABUS Sport Xtra: зниження автомобіля з керуванням через кнопку в салоні. Plug & Play."
  },
  "Alle Optionen der serienm\u00e4\u00dfigen elektronischen": {
    en: "All factory electronic damping options are fully retained and harmonize with the new BRABUS spring configuration.",
    ua: "Усі заводські опції електронного демпфування повністю збережені та гармонують із новою конфігурацією пружин BRABUS."
  },
  "Bei Fahrzeugen mit dem AMG RIDE CONTROL": {
    en: "AMG RIDE CONTROL adjustable damper options are fully retained and harmonize with the new BRABUS spring configuration.",
    ua: "Опції регульованих амортизаторів AMG RIDE CONTROL повністю збережені та гармонують із пружинами BRABUS."
  },
  "Die BRABUS Sportfedern sorgen": {
    en: "BRABUS sport springs for a sportier look with maintained ride comfort. Height-adjustable lowering of 10-20mm. All factory adjustable damper options retained.",
    ua: "Спортивні пружини BRABUS для спортивнішого вигляду зі збереженням комфорту. Регулювання висоти 10-20 мм. Заводські амортизатори повністю збережені."
  },
  "Das BRABUS Tieferlegungsmodul senkt": {
    en: "BRABUS lowering module: reduces ride height by up to 20mm via four modified links for the ride height sensors. Lowers center of gravity for improved handling and stability.",
    ua: "Модуль зниження BRABUS: зменшує висоту до 20 мм через модифіковані тяги датчиків висоти. Нижчий центр тяжіння для кращої керованості."
  },
  // ─── NEW: PowerXtra kits for various models ───
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der B30 Leistungskit": {
    en: "BRABUS extra power: B30 performance kit. Processor-controlled auxiliary ECU. Torque: 400 to 450 Nm. Power: 190 kW/258 PS to 221 kW/300 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: комплект B30. Процесорний ЕБУ. Момент: з 400 до 450 Нм. Потужність: з 190 кВт/258 к.с. до 221 кВт/300 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der D30 Leistungskit": {
    en: "BRABUS extra power: D30 performance kit. Processor-controlled auxiliary ECU. Torque: 550 to 600 Nm. Power: 195 kW/265 PS to 228 kW/310 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: комплект D30. Процесорний ЕБУ. Момент: з 550 до 600 Нм. Потужність: з 195 кВт/265 к.с. до 228 кВт/310 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der B53-700": {
    en: "BRABUS extra power: B53-700 performance kit. Processor-controlled auxiliary ECU. Torque: 750 to 850 Nm. Power: 450 kW/612 PS to 515 kW/700 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: комплект B53-700. Процесорний ЕБУ. Момент: з 750 до 850 Нм. Потужність: з 450 кВт/612 к.с. до 515 кВт/700 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der B20E-730": {
    en: "BRABUS extra power: B20E-730 performance kit. Processor-controlled auxiliary ECU. Torque: 545 to 645 Nm. Power: 500 kW/680 PS to 537 kW/730 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: B20E-730. Процесорний ЕБУ. Момент: з 545 до 645 Нм. Потужність: з 500 кВт/680 к.с. до 537 кВт/730 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der RR68-700": {
    en: "BRABUS extra power: RR68-700 kit for Rolls Royce Cullinan (also Facelift). Processor-controlled auxiliary ECU. Torque: 850 to 950 Nm. Power: 420 kW/571 PS to 514 kW/700 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: RR68-700 для Rolls Royce Cullinan. Процесорний ЕБУ. Момент: з 850 до 950 Нм. Потужність: з 420 кВт/571 к.с. до 514 кВт/700 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der P38-720": {
    en: "BRABUS extra power: P38-720 kit for Porsche 992 Turbo S. Torque: 800 to 900 Nm. Power: 478 kW/650 PS to 530 kW/720 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: P38-720 для Porsche 992 Turbo S. Момент: з 800 до 900 Нм. Потужність: з 478 кВт/650 к.с. до 530 кВт/720 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Die BRABUS Le": {
    en: "BRABUS extra power for Porsche 992 Turbo S: two special turbochargers with larger compressors, modified VTG, BRABUS PowerXtra ECU. Torque: 800 to 950 Nm. Power: 478 kW/650 to 603 kW/820 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS для Porsche 992 Turbo S: два спеціальні турбокомпресори, модифікований VTG, ЕБУ BRABUS PowerXtra. Момент: з 800 до 950 Нм. Потужність: з 478 кВт до 603 кВт/820 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Das PowerXtra B40-550": {
    en: "BRABUS extra power: PowerXtra B40-550 for S580 4Matic. Two auxiliary ECUs. Torque: 700 to 750 Nm. Power: 370 kW/503 PS to 405 kW/550 PS. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra B40-550 для S580 4Matic. Два додаткові ЕБУ. Момент: з 700 до 750 Нм. Потужність: з 370 кВт/503 до 405 кВт/550 к.с. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Das BRABUS Po": {
    en: "BRABUS extra power: PowerXtra B40S-600 for S580 4Matic with two special turbochargers (52mm) and auxiliary ECUs. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra B40S-600 для S580 4Matic з двома спецтурбокомпресорами (52 мм) та додатковими ЕБУ. Plug & Play."
  },
  "Erleben Sie die \u00fcberragende BRABUS Power": {
    en: "Experience outstanding BRABUS power: PowerXtra B40-700 Vmax 250/300 for S63. Torque: 850 to 950 Nm. Power: 450 kW/612 PS to 515 kW/700 PS. Plug-and-play.",
    ua: "Відчуйте неперевершену потужність BRABUS: PowerXtra B40-700 Vmax 250/300 для S63. Момент: з 850 до 950 Нм. Потужність: з 450 кВт/612 до 515 кВт/700 к.с. Plug & Play."
  },
  "Der BRABUS PowerXtra LR44-600": {
    en: "BRABUS PowerXtra LR44-600 for Range Rover P530. Processor-controlled auxiliary ECU with plug-and-play wiring harness. Ready for shipping, easy installation.",
    ua: "BRABUS PowerXtra LR44-600 для Range Rover P530. Процесорний ЕБУ з Plug & Play кабелем. Готовий до відправки, легка установка."
  },
  "Der BRABUS PowerXtra LR44-700": {
    en: "BRABUS PowerXtra LR44-700 for Range Rover P615 (L460). Processor-controlled auxiliary ECU with plug-and-play wiring harness. Ready for shipping.",
    ua: "BRABUS PowerXtra LR44-700 для Range Rover P615 (L460). Процесорний ЕБУ з Plug & Play кабелем. Готовий до відправки."
  },
  // ─── NEW: Body packages ───
  "Das BRABUS Carbon Package Body & Sound: Frontsch\u00fcrzenaufs\u00e4tze": {
    en: "BRABUS Carbon Package Body & Sound: carbon front bumper attachments, rear spoiler, front spoiler lip, and rear diffuser for a unique sporty-exclusive look. Combined with BRABUS valve sport exhaust for an unmatched driving experience.",
    ua: "BRABUS Carbon Package Body & Sound: карбонові накладки переднього бампера, задній спойлер, спойлерна губа та задній дифузор. У поєднанні з клапанним вихлопом BRABUS — неперевершений досвід водіння."
  },
  "Das BRABUS Carbon Package Body & Sound:  Frontspoiler": {
    en: "BRABUS Carbon Package Body & Sound: carbon front spoiler, front bumper attachments, rear bumper attachments, and rear diffuser for a unique sporty-exclusive look. Combined with BRABUS valve sport exhaust.",
    ua: "BRABUS Carbon Package Body & Sound: карбоновий передній спойлер, накладки на бампери та задній дифузор. У поєднанні з клапанним вихлопом BRABUS."
  },
  "Das BRABUS PUR-R-RIM Package Body & Sound": {
    en: "BRABUS PUR-R-RIM Package Body & Sound: front bumper attachments, inserts, rear spoiler, and stainless steel-carbon exhaust tips. Combined with BRABUS PowerXtra B 35S and valve sport exhaust.",
    ua: "BRABUS PUR-R-RIM Package Body & Sound: накладки на бампери, вставки, задній спойлер та патрубки зі сталі-карбону. З PowerXtra B 35S та клапанним вихлопом."
  },
  // ─── NEW: Interior accessories ───
  "Sportliche Optik, hohe Funktionalit\u00e4t": {
    en: "Sporty appearance, high functionality: illuminated BRABUS footrest in matte anodized aluminum, matching your pedal covers.",
    ua: "Спортивний вигляд, висока функціональність: підсвічувана підставка для ноги BRABUS з матового анодованого алюмінію."
  },
  "Coole Optik, sicherer Grip": {
    en: "Cool appearance, secure grip: premium BRABUS pedal covers in matte anodized aluminum. Two-piece set for automatic transmission.",
    ua: "Стильний вигляд, надійне зчеплення: преміальні накладки BRABUS з матового анодованого алюмінію. Комплект з 2 шт. для АКПП."
  },
  "Elegante BRABUS Pedalauflagen": {
    en: "Elegant BRABUS pedal covers in premium matte anodized aluminum for a BRABUS-typical look and perfect grip. Two-piece set.",
    ua: "Елегантні накладки на педалі BRABUS з матового анодованого алюмінію. Фірмовий стиль та ідеальне зчеплення. Комплект з 2 шт."
  },
  "BRABUS Fu\u00dfst\u00fctze aus hochwertigem Aluminium": {
    en: "BRABUS footrest in premium aluminum with matte anodized finish and illuminated BRABUS logo. Color adjustable to match vehicle ambient lighting.",
    ua: "Підставка для ноги BRABUS з преміального алюмінію з підсвіченим логотипом. Колір синхронізується з амбієнтним підсвічуванням салону."
  },
  "Die BRABUS Einstiegsleisten hergestellt aus hochwertigem Carbon": {
    en: "BRABUS door sills in premium carbon, two-piece set. LED-illuminated BRABUS logo matches ambient lighting in up to 64 colors.",
    ua: "Порогові накладки BRABUS з преміального карбону, комплект з 2 шт. LED-логотип BRABUS у до 64 кольорах амбієнтного підсвічування."
  },
  "Die BRABUS Einstiegsleisten in eloxiertem Aluminium": {
    en: "BRABUS door sills in anodized aluminum on premium carriers, two-piece set. LED-illuminated BRABUS logo in up to 64 ambient colors.",
    ua: "Порогові накладки BRABUS з анодованого алюмінію, комплект з 2 шт. LED-логотип BRABUS у до 64 кольорах."
  },
  "BRABUS Einstiegsleisten aus hochwertigem Sicht-Carbon": {
    en: "BRABUS door sills in premium exposed carbon with backlit BRABUS logo. Adjustable to white or vehicle ambient lighting colors.",
    ua: "Порогові накладки BRABUS з відкритого карбону з підсвіченим логотипом. Білий або синхронізація з амбієнтним підсвічуванням."
  },
  "Die Einstiegsleisten aus hochwertigem Carbon (2-teilig)": {
    en: "Premium carbon door sills (2-piece set) with clear structure and elegance. LED-illuminated BRABUS logo transitions from white to red.",
    ua: "Карбонові порогові накладки (комплект з 2 шт.) з LED-логотипом BRABUS, що змінює колір з білого на червоний."
  },
  "Die Einstiegsleisten aus hochwertigem Carbon (4-teilig)": {
    en: "Premium carbon door sills (4-piece set) with clear structure and elegance. LED-illuminated BRABUS logo transitions from white to red.",
    ua: "Карбонові порогові накладки (комплект з 4 шт.) з LED-логотипом BRABUS, що змінює колір з білого на червоний."
  },
  "Die Einstiegsleisten aus hochwertigem Carbon bestechen": {
    en: "Premium carbon door sills with clear structure and elegance. LED-illuminated BRABUS logo with automatic white-to-red color transition.",
    ua: "Карбонові порогові накладки з чіткою структурою та елегантністю. LED-логотип BRABUS з автоматичним переходом білий-червоний."
  },
  // ─── NEW: Floor mats & trunk ───
  "Kofferraummatte aus Velour mit Nubuk-Keder": {
    en: "Velour trunk mat with Nubuk edging, silver piping, silver stitching, and embroidered BRABUS logo. Custom versions available on request.",
    ua: "Килимок для багажника з велюру з окантовкою Nubuk, сріблястим кантом та вишитим логотипом BRABUS. Індивідуальні версії за запитом."
  },
  "Kofferraummatte aus Velours mit Nubuk-Keder Kante in schwarz": {
    en: "Velour trunk mat with black Nubuk edging, piping, stitching, and embroidered BRABUS logo in red.",
    ua: "Килимок для багажника з велюру з чорною окантовкою Nubuk та вишитим логотипом BRABUS червоного кольору."
  },
  "Kofferraummatte aus Velours mit Nubuk-Kante schwarz": {
    en: "Velour trunk mat with black Nubuk edge, silver piping, and embroidered BRABUS logo. For vehicles with through-loading (SA 287).",
    ua: "Килимок для багажника з велюру з окантовкою Nubuk та логотипом BRABUS. Для автомобілів зі складною спинкою (SA 287)."
  },
  "BRABUS Kofferraummatte aus Velour": {
    en: "BRABUS velour trunk mat with Nubuk edge and embroidered BRABUS logo. Also available in custom BRABUS Fine Leather versions.",
    ua: "BRABUS килимок для багажника з велюру з окантовкою Nubuk та логотипом. Також доступний у шкіряному виконанні BRABUS Fine Leather."
  },
  "Fu\u00dfbodenschoner aus Velours (dreiteilig)": {
    en: "Velour floor mats (3-piece set) with Nubuk edging, black piping, red stitching, and embroidered BRABUS logo in red.",
    ua: "Велюрові килимки (3 шт.) з окантовкою Nubuk, чорним кантом, червоною прострочкою та логотипом BRABUS червоного кольору."
  },
  "BRABUS Fu\u00dfbodenschoner (4-fach)": {
    en: "BRABUS velour floor mats (4-piece set) in black with Nubuk edge, red piping, red stitching, and embroidered BRABUS logo.",
    ua: "BRABUS велюрові килимки (4 шт.) чорні з окантовкою Nubuk, червоним кантом та логотипом BRABUS."
  },
  // ─── NEW: Interior packages ───
  "Das Paket Innenausstattung Leder": {
    en: "Leather interior package: unique comfort and sporty-elegant appearance in BRABUS fine leather. Includes front/rear seats and headrests. Customizable leather, piping, and stitching colors with BRABUS quilting patterns.",
    ua: "Пакет шкіряного інтер'єру: унікальний комфорт та спортивна елегантність зі шкіри BRABUS. Передні/задні сидіння та підголівники. Індивідуальні кольори шкіри, кантів та стьобки."
  },
  "BRABUS Masterpiece Vollleder-Komplettausstattung": {
    en: "BRABUS Masterpiece full-leather interior for cockpit and rear. Front/rear seats, door panels, dashboard, center consoles. Fully customizable leather, piping, and stitching options with BRABUS quilting patterns.",
    ua: "BRABUS Masterpiece повношкіряний інтер'єр. Сидіння, дверні панелі, приладова панель, консолі. Повністю індивідуальні кольори шкіри, кантів та стьобки BRABUS."
  },
  "F\u00fcr ein vollendetes Innenraumambiente": {
    en: "For a refined interior ambience: two front seats with headrests, rear bench with headrests. Customizable leather, piping, and stitching in your color of choice. BRABUS quilting patterns.",
    ua: "Для витонченої атмосфери салону: два передні сидіння та задній диван з підголівниками. Індивідуальні кольори шкіри, кантів та стьобки BRABUS."
  },
  "Handarbeit, h\u00f6chste Pr\u00e4zision": {
    en: "Handcrafted precision in finest BRABUS fine leather / BRABUS Mastik leather. Custom-stitched seat surfaces. Executive seats with integrated leg rest and footrest for supreme comfort.",
    ua: "Ручна робота найвищої точності зі шкіри BRABUS fine leather / Mastik. Індивідуальна стьобка сидінь. Executive сидіння з підніжкою для максимального комфорту."
  },
  // ─── NEW: Car covers & accessories ───
  "Sch\u00fctzen Sie Ihr Masterpiece mit dem brandneuen BRABUS Car Cover": {
    en: "Protect your Masterpiece: BRABUS car cover in premium black fabric with unique quilted design and red contour liner. Embroidered red BRABUS logo. Precision-fitted to your specific BRABUS model.",
    ua: "Захистіть ваш Masterpiece: чохол BRABUS з преміальної чорної тканини з унікальним стьобаним дизайном та червоним контуром. Вишитий червоний логотип BRABUS. Точна посадка під вашу модель."
  },
  "Die hochwertige Abdeckung aus schwarzem Premiumstoff": {
    en: "Premium black fabric car cover with unique quilted design and red contour liner accent. Embroidered red BRABUS logo. Precision-fitted for outstanding protection.",
    ua: "Преміальний чохол з чорної тканини з стьобаним дизайном та червоним контуром. Вишитий логотип BRABUS. Точна посадка для ідеального захисту."
  },
  "Das Set besteht aus zwei Basistr\u00e4gern": {
    en: "Set of two base carriers and vehicle-contoured mounting frames for front and rear. Stainless steel frames with BRABUS carbon coating and lettering.",
    ua: "Комплект з двох базових кріплень та рамок для переднього та заднього номерів. Рамки з нержавіючої сталі з карбоновим покриттям BRABUS."
  },
  "Durch die flexible Wechselleiste": {
    en: "The flexible interchangeable strip enables effortless license plate removal. Fits all standard single-line plates (520x110mm).",
    ua: "Гнучка змінна планка для легкого зняття номерного знака. Підходить для всіх стандартних однорядних номерів (520x110 мм)."
  },
  // ─── NEW: Bentley ───
  "Gefertigt aus hochwertigem Sicht-Carbon setzt der BRABUS Heckdiffusor f\u00fcr den Bentley": {
    en: "Premium exposed carbon rear diffuser for Bentley Continental GT Speed and GTC Speed. Aerodynamic design showcases four titanium/carbon exhaust tips. Available in high-gloss or matte finish.",
    ua: "Карбоновий задній дифузор для Bentley Continental GT Speed / GTC Speed. Аеродинамічний дизайн з чотирма титан/карбон патрубками. Глянцеве або матове виконання."
  },
  "Gefertigt aus hochwertigem Sicht-Carbon, verleiht der BRABUS Heckspoileraufsatz f\u00fcr den Bentley": {
    en: "Premium exposed carbon rear spoiler attachment for Bentley Continental GT Speed. Understated yet sporty accent with improved aerodynamic downforce. High-gloss or matte finish.",
    ua: "Карбонова накладка на задній спойлер для Bentley Continental GT Speed. Стримано-спортивний акцент з покращеним притиском. Глянцеве або матове виконання."
  },
  "Gefertigt aus hochwertigem Sicht-Carbon verleiht der BRABUS Frontspoiler mit integrierten Dive Planes": {
    en: "Premium exposed carbon front spoiler with integrated dive planes. Motorsport-inspired appearance with reduced front-axle lift and optimized airflow for maximum stability at high speeds.",
    ua: "Карбоновий передній спойлер з інтегрованими dive planes. Моторспорт-натхненний вигляд зі зниженим підйомом передньої осі та оптимізованим потоком повітря."
  },
  "Der aus hochwertigem Sicht-Carbon gefertigte BRABUS Heckspoiler": {
    en: "Premium exposed carbon BRABUS rear spoiler with 1-second-wow effect and functional design. Enhances rear-axle downforce and aerodynamic performance. High-gloss or matte finish.",
    ua: "Карбоновий задній спойлер BRABUS з ефектом wow з першої секунди. Покращує притиск задньої осі. Глянцеве або матове виконання."
  },
  "Die BRABUS-Frontsch\u00fcrze aus Carbon verleiht dem Bentley": {
    en: "BRABUS carbon front bumper for Bentley Continental GT Speed and GTC Speed. Optimized air intake for radiators and front brakes. Carbon lower section with integrated spoiler and side air inlets. Reduced front-axle lift. High-gloss or matte finish.",
    ua: "Карбоновий передній бампер BRABUS для Bentley Continental GT Speed / GTC Speed. Оптимізоване повітрозабір для радіаторів та гальм. Карбонова нижня секція зі спойлером. Глянцеве або матове виконання."
  },
  "Das BRABUS PowerXtra BC40-900": {
    en: "BRABUS PowerXtra BC40-900 for Bentley Continental GT Speed / GTC Speed: two high-performance turbochargers, auxiliary ECU, carbon air filter box. System power: 662 kW/900 PS. Torque: 1,100 Nm. 0-100 km/h in 2.9 seconds.",
    ua: "BRABUS PowerXtra BC40-900 для Bentley Continental GT Speed / GTC Speed: два високопродуктивні турбо, ЕБУ, карбоновий фільтр. Потужність: 662 кВт/900 к.с. Момент: 1100 Нм. 0-100 за 2,9 с."
  },
  // ─── NEW: Lamborghini ───
  "Die BRABUS Frontsch\u00fcrze aus Carbon verleiht dem Lamborghini": {
    en: "BRABUS carbon front bumper for Lamborghini Urus. Optimized air intake, carbon lower section with integrated spoiler and side inlets. Reduced front-axle lift. High-gloss or matte finish.",
    ua: "Карбоновий передній бампер BRABUS для Lamborghini Urus. Оптимізоване повітрозабір, карбонова нижня секція зі спойлером. Зменшений підйом передньої осі. Глянцеве або матове виконання."
  },
  "Die BRABUS Radhausverbreiterungen verleihen dem Lamborghini": {
    en: "BRABUS fender extensions for Lamborghini Urus SE: dominant appearance with space for 24-inch Kingsize wheel-tire combinations. Lightweight carbon construction. Exposed carbon with high-gloss or matte finish.",
    ua: "Розширення крил BRABUS для Lamborghini Urus SE: домінуючий вигляд з місцем для 24-дюймових коліс Kingsize. Легкий карбон. Глянцеве або матове виконання."
  },
  "Das BRABUS PowerXtra LG40-900": {
    en: "BRABUS PowerXtra LG40-900 for Lamborghini Urus SE: ECU tuned for hybrid powertrain. System power: 662 kW/900 PS. Torque: 1,050 Nm. 0-100 km/h in 3.2 seconds. Top speed: 312 km/h.",
    ua: "BRABUS PowerXtra LG40-900 для Lamborghini Urus SE: ЕБУ для гібридного привода. Потужність: 662 кВт/900 к.с. Момент: 1050 Нм. 0-100 за 3,2 с. Макс.: 312 км/год."
  },
  "Das BRABUS SportXtra-Tieferlegungsmodul senkt den Lamborghini": {
    en: "BRABUS SportXtra lowering module for Lamborghini Urus SE: up to 20mm lowering by driving mode. Plug-and-play. Improved handling stability and driving dynamics.",
    ua: "Модуль зниження BRABUS SportXtra для Lamborghini Urus SE: до 20 мм залежно від режиму. Plug & Play. Покращена стабільність та динаміка."
  },
  // ─── NEW: Range Rover ───
  "Die BRABUS WIDESTAR Front schafft einen perfekten": {
    en: "BRABUS WIDESTAR front creates a perfect transition to carbon fender extensions for Kingsize BRABUS Monoblock M Platinum Edition wheels. Carbon elements for all four doors. Rear diffuser completes the extravagant appearance.",
    ua: "Передній бампер BRABUS WIDESTAR з переходом до карбонових розширень крил для дисків Monoblock M Platinum Edition. Карбонові елементи на чотирьох дверях. Задній дифузор завершує вигляд."
  },
  "Die BRABUS WIDESTAR Front inkl. LED Auffindelicht": {
    en: "BRABUS WIDESTAR front with LED locator lights creates a perfect transition to carbon fender extensions. Carbon elements for all four doors. Rear diffuser in BRABUS design completes the look.",
    ua: "Передній бампер BRABUS WIDESTAR з LED-підсвічуванням та карбоновими розширеннями крил. Карбонові елементи на чотирьох дверях. Задній дифузор BRABUS."
  },
  // ─── NEW: Rolls-Royce exhaust ───
  "Rassiger Sound auf Knopfdruck: Die High Performance": {
    en: "Thrilling sound at the push of a button: High Performance valve sport exhaust in Inconel with four connecting pipes (two valve-controlled). Inconel exhaust tips for exceptional acoustic and visual impact.",
    ua: "Захоплюючий звук одним натисканням: високопродуктивний клапанний вихлоп з Inconel. Чотири з'єднувальні труби та патрубки з Inconel для виняткового звуку та вигляду."
  },
  "Rassiger Sound auf Knopfdruck: Die Klappen-Sportauspuffanlage": {
    en: "Thrilling sound at the push of a button: valve sport exhaust with refined acoustics. Combined with BRABUS carbon rear diffuser for a unique presence.",
    ua: "Захоплюючий звук одним натисканням: клапанний вихлоп з витонченою акустикою. У поєднанні з карбоновим дифузором BRABUS для унікальної присутності."
  },
  // ─── NEW: V-Klasse ───
  "Ein Blickfang f\u00fcr Ihre V-Klasse": {
    en: "Eye-catcher for your V-Class: the Signature Exclusive front grille with chrome look for elegant presence.",
    ua: "Окраса вашого V-Class: фірмова решітка Signature Exclusive з хромованим виглядом для елегантної присутності."
  },
  "Die Signature Seitenschwelleraufs\u00e4tze Exclusive": {
    en: "Signature Exclusive side skirt attachments improve aerodynamics and create an exclusive, dynamic appearance with chrome finish.",
    ua: "Бічні накладки Signature Exclusive покращують аеродинаміку та створюють ексклюзивний динамічний вигляд з хромованим покриттям."
  },
  "Ihre V-Klasse als perfektes Reisemobil": {
    en: "Your V-Class as the perfect travel vehicle: partition wall with electrically retractable dividing glass, optional 21.5-inch monitor, and integrated speed/temperature/time display.",
    ua: "V-Class як ідеальний подорожній автомобіль: перегородка з електричним склом, монітор 21,5 дюймів, дисплей швидкості/температури/часу."
  },
  // ─── NEW: Miscellaneous ───
  "Der Eyecatcher f\u00fcr mehr Individualit\u00e4t": {
    en: "Eye-catcher for individuality and quality: premium carbon trunk lid in prepreg process for elegant appearance. Choose between glossy or matte finish. Integrated lettering completes the exterior.",
    ua: "Окраса для індивідуальності: преміальна карбонова кришка багажника (prepreg). Глянцеве або матове покриття. Інтегровані написи завершують екстер'єр."
  },
  "Die INVICTO Shelter Cell": {
    en: "INVICTO Shelter Cell: zero-gap design engineered for maximum protection at OEM armor level. Every material pairing and bolt connection tested with projectile velocities far exceeding standard caliber speeds. Fully certified by German Proof House Ulm per VPAM guidelines.",
    ua: "INVICTO Shelter Cell: бронекапсула з нульовим зазором для максимального захисту. Кожне з'єднання протестовано зі швидкостями снарядів, що значно перевищують стандарт. Сертифіковано Beschussamt Ulm за VPAM."
  },
  "Das BRABUS ADVENTURE Zubeh\u00f6rpaket": {
    en: "BRABUS ADVENTURE accessory package: spectacular appearance combined with enhanced off-road capability. Extensive equipment for extreme ground clearance and rugged off-road conditions.",
    ua: "Пакет аксесуарів BRABUS ADVENTURE: вражаючий вигляд з покращеною прохідністю. Розширене оснащення для екстремального бездоріжжя."
  },
  "Bei dem Design und der Konstruktion wurde besonders": {
    en: "Aerodynamic optimization: reduced drag coefficient decreases driving resistance and positively impacts range, increasing by an average of 7% between 100 and 140 km/h.",
    ua: "Аеродинамічна оптимізація: знижений коефіцієнт опору зменшує супротив руху та збільшує запас ходу на 7% при 100-140 км/год."
  },
  "Das BRABUS Start-Stop Memory System ab Modelljahr 2024": {
    en: "BRABUS Start-Stop Memory System (from MY 2024): deactivates the Start-Stop function until manually re-enabled. Plug-and-play. Ready for shipping.",
    ua: "Система BRABUS Start-Stop Memory (з 2024 модельного року): деактивує Start-Stop до ручного увімкнення. Plug & Play."
  },
  "Die speziellen T\u00fcrfangb\u00e4nder": {
    en: "Special door check straps for rear doors enable easier entry with an enlarged opening angle (89 degrees).",
    ua: "Спеціальні обмежувачі задніх дверей для легшої посадки зі збільшеним кутом відкривання (89 градусів)."
  },
  "Ein Blickfang beim Einstieg in Ihre G-Klasse": {
    en: "Eye-catcher when entering your G-Class: the BRABUS Light Carpet combined with WIDESTAR lighting creates an impressive entry experience.",
    ua: "Окраса при посадці в G-Class: BRABUS Light Carpet з підсвічуванням WIDESTAR створює вражаючий вхід."
  },
  "Aufregende Optik und ein weiteres Plus an Sicherheit": {
    en: "Exciting appearance and enhanced safety with increased illumination: BRABUS carbon roof attachment with 24 high-performance LEDs (12 per side) for superior road illumination.",
    ua: "Вражаючий вигляд та покращена безпека: карбонова накладка на дах BRABUS з 24 потужними LED (12 з кожного боку) для кращого освітлення дороги."
  },
  "Hinweis: Nur in Verbindung mit WIDESTAR erh\u00e4ltlich": {
    en: "",
    ua: ""
  },
  "Hinweis: Dieser Artikel ist ausschlie\u00dflich f\u00fcr den smart": {
    en: "",
    ua: ""
  },
  // ─── FINAL BATCH: remaining 24 ───
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Fronteins\u00e4tze mit LED": {
    en: "Sporty, dynamic appearance and improved aerodynamics: front inserts with LED daytime running lights (2-piece) complete the BRABUS identity of your vehicle. Made from high-quality PUR-R-RIM with optimal design and stability.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: передні вставки з LED денними вогнями (2 шт.) завершують ідентичність BRABUS. З високоякісного PUR-R-RIM з оптимальним дизайном та стабільністю."
  },
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Frontsch\u00fcrzeneins\u00e4tze": {
    en: "Sporty, dynamic appearance and improved aerodynamics: front bumper inserts complete the BRABUS identity. Made from high-quality PUR-R-RIM plastic.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: вставки переднього бампера завершують ідентичність BRABUS. З високоякісного пластику PUR-R-RIM."
  },
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Frontspoilerecken": {
    en: "Sporty, dynamic appearance and improved aerodynamics: front spoiler corners complete the BRABUS identity. Made from premium PUR-R-RIM.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: кути переднього спойлера завершують ідентичність BRABUS. З преміального PUR-R-RIM."
  },
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Der Signature Heckeinsatz": {
    en: "Sporty, dynamic appearance: the Signature rear insert completes the BRABUS identity. Complemented by two stainless steel-carbon exhaust tips for a distinctive sound and premium look.",
    ua: "Спортивний, динамічний вигляд: задня вставка Signature завершує ідентичність BRABUS. Доповнена двома патрубками зі сталі-карбону для виразного звуку та преміального вигляду."
  },
  "Elegant, dezent, sportlich: Der BRABUS Heckspoiler aus hochwertigem Carbon sorgt": {
    en: "Elegant, understated, sporty: the BRABUS carbon rear spoiler improves aerodynamics with increased downforce and traction.",
    ua: "Елегантний, стриманий, спортивний: карбоновий задній спойлер BRABUS покращує аеродинаміку завдяки збільшеному притиску."
  },
  "Der BRABUS Heckspoiler aus hochwertigem Carbon sorgt": {
    en: "BRABUS carbon rear spoiler improves aerodynamics with increased downforce and traction.",
    ua: "Карбоновий задній спойлер BRABUS покращує аеродинаміку завдяки збільшеному притиску та силі тяги."
  },
  "Design bis ins letzte Detail: Die BRABUS Schaltwippen aus Aluminium": {
    en: "Design to the last detail: BRABUS aluminum paddle shifters with leather inserts. Plug-and-play installation for a premium manual shifting experience.",
    ua: "Дизайн до останньої деталі: підрульові лепестки BRABUS з алюмінію зі шкіряними вставками. Встановлення Plug & Play для преміального перемикання."
  },
  "Gefertigt aus hochwertigem Sicht-Carbon setzt der BRABUS Heckdiffusor f\u00fcr den Lamborghini": {
    en: "Premium exposed carbon rear diffuser for Lamborghini Urus. High-performance aerodynamic accent with four titanium/carbon exhaust tips. High-gloss or matte finish.",
    ua: "Карбоновий задній дифузор для Lamborghini Urus. Аеродинамічний акцент з чотирма титан/карбон патрубками. Глянцеве або матове виконання."
  },
  // ─── PowerXtra variants for remaining models ───
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B35 Leistungskit": {
    en: "BRABUS extra power: PowerXtra B35 performance kit. Processor-controlled auxiliary ECU for increased torque and power. Plug-and-play connection.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra B35. Процесорний ЕБУ для збільшення моменту та потужності. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B35 S Leistungskit": {
    en: "BRABUS extra power: PowerXtra B35 S performance kit with enhanced tuning. Processor-controlled auxiliary ECU. Plug-and-play connection.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra B35 S з посиленим тюнінгом. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B18": {
    en: "BRABUS extra power: PowerXtra B18 performance kit. Processor-controlled auxiliary ECU. Plug-and-play connection.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra B18. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B25": {
    en: "BRABUS extra power: PowerXtra B25 performance kit. Processor-controlled auxiliary ECU. Plug-and-play connection.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra B25. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B53-500": {
    en: "BRABUS extra power: PowerXtra B53-500 performance kit. Processor-controlled auxiliary ECU for significant torque and power increase. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra B53-500. Процесорний ЕБУ для значного збільшення моменту та потужності. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B40E-930": {
    en: "BRABUS extra power: PowerXtra B40E-930 for the AMG GT 63S E-Performance. Processor-controlled auxiliary ECU optimized for the hybrid powertrain. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra B40E-930 для AMG GT 63S E-Performance. ЕБУ для гібридного привода. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra D22": {
    en: "BRABUS extra power: PowerXtra D22 diesel performance kit. Processor-controlled auxiliary ECU. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra D22 для дизеля. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra D25": {
    en: "BRABUS extra power: PowerXtra D25 diesel performance kit. Processor-controlled auxiliary ECU. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra D25 для дизеля. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra D4": {
    en: "BRABUS extra power: PowerXtra D4 diesel performance kit. Processor-controlled auxiliary ECU. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra D4 для дизеля. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra D6": {
    en: "BRABUS extra power: PowerXtra D6 diesel performance kit. Processor-controlled auxiliary ECU. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra D6 для дизеля. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B20E-730 Leistungskit auf Basis Mercedes-AMG GLC": {
    en: "BRABUS extra power: PowerXtra B20E-730 for Mercedes-AMG GLC 63 S E Performance. Processor-controlled auxiliary ECU. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra B20E-730 для Mercedes-AMG GLC 63 S E Performance. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B30-300": {
    en: "BRABUS extra power: PowerXtra B30-300 performance kit. Processor-controlled auxiliary ECU. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: комплект PowerXtra B30-300. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B40-550 Leistungskit auf Basis GLS 580": {
    en: "BRABUS extra power: PowerXtra B40-550 for GLS 580. Processor-controlled auxiliary ECU. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra B40-550 для GLS 580. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B40-650": {
    en: "BRABUS extra power: PowerXtra B40-650 for GLS 600 Maybach. Processor-controlled auxiliary ECU. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra B40-650 для GLS 600 Maybach. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B40 Leistungskit besteht": {
    en: "BRABUS extra power: PowerXtra B40 kit with two auxiliary ECUs. Significant torque and power increase. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra B40 з двома ЕБУ. Значне збільшення моменту та потужності. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B40S-750": {
    en: "BRABUS extra power: PowerXtra B40S-750 with two special turbochargers (52mm) and reinforced thrust bearings. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra B40S-750 з двома спеціальними турбокомпресорами (52 мм) та посиленими підшипниками. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra B50-500": {
    en: "BRABUS extra power: PowerXtra B50-500 for S 500 W/V 223. Processor-controlled auxiliary ECU. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra B50-500 для S 500 W/V 223. Процесорний ЕБУ. Plug & Play."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra D30 Leistungskit auf Basis GLE": {
    en: "BRABUS extra power: PowerXtra D30 for GLE 300d. Processor-controlled auxiliary ECU for diesel performance. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra D30 для GLE 300d дизель. Процесорний ЕБУ. Plug & Play."
  },
  // ─── ABSOLUTE FINAL: last 3 ───
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Eins\u00e4tze f\u00fcr den Front Grill": {
    en: "Sporty, dynamic appearance and improved aerodynamics: premium carbon front grille inserts complete the BRABUS identity of your vehicle.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: карбонові вставки передньої решітки завершують ідентичність BRABUS вашого автомобіля."
  },
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Der mittlere Frontsch\u00fcrzenaufsatz": {
    en: "Sporty, dynamic appearance and improved aerodynamics: the center front bumper attachment completes the BRABUS identity. Made from high-quality PUR-R-RIM.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: центральна накладка переднього бампера завершує ідентичність BRABUS. З PUR-R-RIM."
  },
  "BRABUS Extra Power f\u00fcr Ihr Fahrzeug: Der PowerXtra D30 Leistungskit auf Basis V300": {
    en: "BRABUS extra power: PowerXtra D30 for V300d. Processor-controlled auxiliary ECU for diesel performance. Plug-and-play.",
    ua: "Додаткова потужність BRABUS: PowerXtra D30 для V300d дизель. Процесорний ЕБУ. Plug & Play."
  },
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Frontspoiler-Aufs\u00e4tze": {
    en: "Sporty, dynamic appearance and improved aerodynamics: front spoiler attachments complete the BRABUS identity. Made from premium materials with optimal design.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: накладки переднього спойлера завершують ідентичність BRABUS. З преміальних матеріалів."
  },
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Frontsch\u00fcrzen-Aufs\u00e4tze": {
    en: "Sporty, dynamic appearance and improved aerodynamics: front bumper overlay attachments complete the BRABUS identity. High-quality construction.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: накладки на передню панель завершують ідентичність BRABUS."
  },
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Carbon Frontsch\u00fcrzen": {
    en: "Sporty, dynamic appearance and improved aerodynamics: carbon front bumper components complete the BRABUS identity with premium exposed carbon finish.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: карбонові компоненти переднього бампера завершують ідентичність BRABUS."
  },
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Frontsch\u00fcrze komplettiert": {
    en: "Sporty, dynamic appearance and improved aerodynamics: the front bumper completes the BRABUS identity of your vehicle.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: передній бампер завершує ідентичність BRABUS вашого автомобіля."
  },
  "Sportliche, dynamische Optik und verbesserte Aerodynamik: Die Frontaufs\u00e4tze": {
    en: "Sporty, dynamic appearance and improved aerodynamics: front attachments complete the BRABUS identity. Made from premium construction materials.",
    ua: "Спортивний, динамічний вигляд та покращена аеродинаміка: передні накладки завершують ідентичність BRABUS. З преміальних матеріалів."
  },
};

// Main: read raw products and apply translations
const rawPath = join(process.cwd(), 'data', 'brabus-products-raw.json');
const products = JSON.parse(readFileSync(rawPath, 'utf-8'));

const keys = Object.keys(TRANSLATIONS);
let matched = 0, unmatched = 0;

for (const p of products) {
  const desc = (p.descriptionDe || '').trim();
  if (!desc || desc.length < 10) {
    p.descriptionEn = '';
    p.descriptionUa = '';
    continue;
  }

  // Find matching translation by prefix
  let found = false;
  for (const key of keys) {
    if (desc.startsWith(key) || desc.includes(key)) {
      p.descriptionEn = TRANSLATIONS[key].en;
      p.descriptionUa = TRANSLATIONS[key].ua;
      found = true;
      matched++;
      break;
    }
  }

  if (!found) {
    // Check if it's a blacklisted description
    const blacklisted = [
      'Der Artikel ist anfragbar',
      'Dieser Artikel ist beratungsintensiv',
      'Wir schaffen modernen',
      'Hinweis: Bei Kauf',
      'Hinweis: Nur in Verbindung',
      'Hinweis: Dieser Artikel ist',
    ];
    if (blacklisted.some(b => desc.includes(b))) {
      p.descriptionEn = '';
      p.descriptionUa = '';
      matched++;
    } else {
      unmatched++;
      if (unmatched <= 10) {
        console.log(`UNMATCHED: ${desc.substring(0, 80)}...`);
      }
    }
  }
}

// Save translated data
const outPath = join(process.cwd(), 'data', 'brabus-products-translated.json');
writeFileSync(outPath, JSON.stringify(products, null, 2));
console.log(`\nDone! Matched: ${matched}/${products.length}, Unmatched: ${unmatched}`);
console.log(`Saved to: ${outPath}`);

