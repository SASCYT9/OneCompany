// src/lib/brands.ts

export type BrandCategory = 'usa' | 'europe' | 'oem' | 'racing' | 'moto' | 'auto';

export type CountryOfOrigin = 
  | 'USA' 
  | 'Japan' 
  | 'Germany' 
  | 'Italy' 
  | 'UK' 
  | 'Australia' 
  | 'Netherlands'
  | 'Czech Republic'
  | 'Spain'
  | 'Austria'
  | 'France'
  | 'Belgium'
  | 'Hong Kong'
  | 'Slovenia'
  | 'Taiwan'
  | 'Sweden'
  | 'Poland'
  | 'China'
  | 'New Zealand'
  | 'Lithuania'
  | 'Hungary';

export type ProductSubcategory = 
  | 'Engine'
  | 'Exterior'
  | 'Suspension'
  | 'Brakes'
  | 'Wheels'
  | 'Exhaust'
  | 'Electronics'
  | 'Interior'
  | 'Drivetrain'
  | 'Cooling'
  | 'Fuel Systems'
  | 'Aero'
  | 'Racing Components'
  | 'Full Vehicle';

export interface BrandMetadata {
  country: CountryOfOrigin;
  subcategory: ProductSubcategory;
}

// Localized country names
export const countryNames: Record<CountryOfOrigin, { en: string; ua: string }> = {
  'USA': { en: 'USA', ua: 'США' },
  'Japan': { en: 'Japan', ua: 'Японія' },
  'Germany': { en: 'Germany', ua: 'Німеччина' },
  'Italy': { en: 'Italy', ua: 'Італія' },
  'UK': { en: 'UK', ua: 'Велика Британія' },
  'Australia': { en: 'Australia', ua: 'Австралія' },
  'Netherlands': { en: 'Netherlands', ua: 'Нідерланди' },
  'Czech Republic': { en: 'Czech Republic', ua: 'Чехія' },
  'Spain': { en: 'Spain', ua: 'Іспанія' },
  'Austria': { en: 'Austria', ua: 'Австрія' },
  'France': { en: 'France', ua: 'Франція' },
  'Belgium': { en: 'Belgium', ua: 'Бельгія' },
  'Hong Kong': { en: 'Hong Kong', ua: 'Гонконг' },
  'Slovenia': { en: 'Slovenia', ua: 'Словенія' },
  'Taiwan': { en: 'Taiwan', ua: 'Тайвань' },
  'Sweden': { en: 'Sweden', ua: 'Швеція' },
  'Poland': { en: 'Poland', ua: 'Польща' },
  'China': { en: 'China', ua: 'Китай' },
  'New Zealand': { en: 'New Zealand', ua: 'Нова Зеландія' },
  'Lithuania': { en: 'Lithuania', ua: 'Литва' },
  'Hungary': { en: 'Hungary', ua: 'Угорщина' },
};

// Localized subcategory names
export const subcategoryNames: Record<ProductSubcategory, { en: string; ua: string }> = {
  'Engine': { en: 'Engine', ua: 'Двигун' },
  'Exterior': { en: 'Exterior', ua: 'Екстер\'єр' },
  'Suspension': { en: 'Suspension', ua: 'Підвіска' },
  'Brakes': { en: 'Brakes', ua: 'Гальма' },
  'Wheels': { en: 'Wheels', ua: 'Диски' },
  'Exhaust': { en: 'Exhaust', ua: 'Вихлоп' },
  'Electronics': { en: 'Electronics', ua: 'Електроніка' },
  'Interior': { en: 'Interior', ua: 'Інтер\'єр' },
  'Drivetrain': { en: 'Drivetrain', ua: 'Трансмісія' },
  'Cooling': { en: 'Cooling', ua: 'Охолодження' },
  'Fuel Systems': { en: 'Fuel Systems', ua: 'Паливна система' },
  'Aero': { en: 'Aero', ua: 'Аеродинаміка' },
  'Racing Components': { en: 'Racing Components', ua: 'Спортивні компоненти' },
  'Full Vehicle': { en: 'Full Vehicle', ua: 'Комплексні рішення' },
};

// Local simplified brand type for static data
export interface LocalBrand {
  name: string;
  slug?: string;
  description?: string; // Optional description (English default)
  descriptionUA?: string; // Optional description (Ukrainian)
  logoUrl?: string; // Optional path to logo
  category?: BrandCategory;
  website?: string;
  specialties?: string[];
}

// Helper function to generate slug from brand name
export function getBrandSlug(brand: LocalBrand | string): string {
  const name = typeof brand === 'string' ? brand : brand.slug || brand.name;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper function to find a brand by slug
export function getBrandBySlug(slug: string): LocalBrand | undefined {
  const allBrands = [...allAutomotiveBrands, ...allMotoBrands];
  return allBrands.find(brand => getBrandSlug(brand) === slug);
}

// Helper to get brand with category info
export function getBrandWithCategory(slug: string): (LocalBrand & { category: BrandCategory }) | undefined {
  // Check automotive categories
  const automotiveCategories = ['usa', 'europe', 'oem', 'racing', 'auto'] as const;
  for (const category of automotiveCategories) {
    const brands = getBrandsByCategory(category);
    const brand = brands.find(b => getBrandSlug(b) === slug);
    if (brand) {
      return { ...brand, category };
    }
  }
  
  // Check moto
  const motoBrand = brandsMoto.find(b => getBrandSlug(b) === slug);
  if (motoBrand) {
    return { ...motoBrand, category: 'moto' };
  }
  
  return undefined;
}

export const brandsUsa: LocalBrand[] = [
  { name: '1221 wheels' },
  { name: '1016 Industries' },
  { name: '5150 Autosport' },
  { name: 'AE Design' },
  { name: 'ADV.1 wheels' },
  { name: 'Agency Power' },
  { name: 'Airlift Performance' },
  { name: 'AL13 wheels' },
  { name: 'AMS / Alpha Performance' },
  { name: 'American Racing Headers' },
  { name: 'ANRKY wheels' },
  { name: 'APR' },
  { name: 'Avantgarde Wheels' },
  { name: 'BE bearings' },
  { name: 'BBi Autosport' },
  { name: 'Big Boost' },
  { name: 'BimmerWorld' },
  { name: 'BootMod3' },
  { name: 'Borla' },
  { name: 'Brixton wheels' },
  { name: 'Burger Motorsport' },
  { name: 'Circle D' },
  { name: 'Cobb tuning' },
  { name: 'CMST' },
  { name: 'CSF' },
  { name: 'DarwinPro' },
  { name: 'Deatschwerks' },
  { name: 'Dorch Engineering' },
  { name: 'Driveshaftshop' },
  { name: 'Duke Dynamics' },
  { name: 'Eterna Motorworks' },
  { name: 'Fabspeed' },
  { name: 'Fall-Line Motorsports' },
  { name: 'Fore Innovations' },
  { name: 'Fragola Performance Systems' },
  { name: 'Full-Race' },
  { name: 'Future Design' },
  { name: 'Girodisc' },
  { name: 'HRE wheels' },
  { name: 'Injector Dynamics' },
  { name: 'JXB Performance' },
  { name: 'Karbel' },
  { name: 'Killer B Motorsport' },
  { name: 'KLM Race' },
  { name: 'Kooks Headers' },
  { name: 'Lingenfelter' },
  { name: 'Mega3 Performance' },
  { name: 'Mickey Thompson' },
  { name: 'Motiv Motorsport' },
  { name: 'Moser Engineering' },
  { name: 'Mountune' },
  { name: 'MV Forged' },
  { name: 'Paragon brakes' },
  { name: 'Premier Tuning Group' },
  { name: 'Project 6GR' },
  { name: 'Pure Drivetrain Solutions' },
  { name: 'Pure Turbos' },
  { name: 'Renntech' },
  { name: 'RK Autowerks' },
  { name: 'RPM Transmissions' },
  { name: 'RKP' },
  { name: 'RYFT' },
  { name: 'Seibon' },
  { name: 'ShepTrans' },
  { name: 'Southern Hotrod' },
  { name: 'Spool Performance' },
  { name: 'SPL Parts' },
  { name: 'Strasse wheels' },
  { name: 'Stoptech' },
  { name: 'Stillen' },
  { name: 'Titan Motorsport' },
  { name: 'TireRack' },
  { name: 'Turner Motorsport' },
  { name: 'Vargas Turbo' },
  { name: 'Velos Wheels' },
  { name: 'VF Engineering' },
  { name: 'VP Racing Fuel' },
  { name: 'VR Aero' },
  { name: 'VR Bespoke' },
  { name: 'VR Forged' },
  { name: 'VR Performance' },
  { name: 'Vorsteiner' },
  { name: 'Wavetrac' },
  { name: 'Weistec Engineering' },
  { name: 'Whipple Superchargers' },
  { name: 'XDI fuel systems' },
];

export const brandsEurope: LocalBrand[] = [
  { name: '3D Design' },
  { name: 'ABT' },
  { name: 'AC Schnitzer' },
  { name: 'ADRO' },
  { name: 'Akrapovic' },
  { name: 'Alpha-N' },
  { name: 'ARMA Speed' },
  { name: 'Armytrix' },
  { name: 'Black Boost' },
  { name: 'BMC filters' },
  { name: 'Brabus' },
  { name: 'Brembo' },
  { name: 'BC Racing' },
  { name: 'Capristo' },
  { name: 'CT Carbon' },
  { name: 'Custom Cages' },
  { name: 'Dahler' },
  { name: 'DMC' },
  { name: 'do88' },
  { name: 'DTE Systems' },
  { name: 'ESS Tuning' },
  { name: 'Eventuri' },
  { name: 'FI Exhaust' },
  { name: 'GTHaus' },
  { name: 'Gruppe-M' },
  { name: 'Hamann' },
  { name: 'Hardrace' },
  { name: 'Harrop' },
  { name: 'IPe exhaust' },
  { name: 'ItalianRP' },
  { name: 'KAHN design' },
  { name: 'Karbonius' },
  { name: 'Keyvany' },
  { name: 'Kline Innovation' },
  { name: 'KW Suspension' },
  { name: 'Lamspeed' },
  { name: 'Larte Design' },
  { name: 'Liberty Walk' },
  { name: 'LOBA Motorsport' },
  { name: 'Lorinser' },
  { name: 'Lumma' },
  { name: 'Manhart' },
  { name: 'Mansory' },
  { name: 'Mamba turbo' },
  { name: "Matts Carbon" },
  { name: 'Milltek' },
  { name: 'MST Performance' },
  { name: 'Novitec' },
  { name: 'Nitron Suspension' },
  { name: 'Onyx Concept' },
  { name: 'Pagid' },
  { name: 'Power Division' },
  { name: 'ProTrack Wheels' },
  { name: 'R44 Performance' },
  { name: 'Remus' },
  { name: 'RES Exhaust' },
  { name: 'RS-R' },
  { name: 'RW Carbon' },
  { name: 'Sachs Performance' },
  { name: 'Schrick' },
  { name: 'Sterckenn' },
  { name: 'STOPART ceramic' },
  { name: 'Supersprint' },
  { name: 'Tubi Style' },
  { name: 'TTE Turbos' },
  { name: 'TTH turbos' },
  { name: 'Urban Automotive' },
  { name: 'Wagner Tuning' },
  { name: 'WALD' },
  { name: 'WheelForce' },
  { name: 'xHP' },
  { name: 'Zacoe' },
];

export const brandsOem: LocalBrand[] = [
  { name: 'Aston Martin' },
  { name: 'Ferrari' },
  { name: 'Lamborghini' },
  { name: 'Maserati' },
  { name: 'McLaren' },
  { name: 'Rolls Royce' },
];

export const brandsRacing: LocalBrand[] = [
  { name: 'AIM Sportline' },
  { name: 'ARE dry sump' },
  { name: 'Bell Intercoolers' },
  { name: 'Drenth Gearboxes' },
  { name: 'Driftworks' },
  { name: 'Extreme tyres' },
  { name: 'ISA Racing' },
  { name: 'Link ECU' },
  { name: 'Lithiumax batteries' },
  { name: 'MCA Suspension' },
  { name: 'Modena Engineering' },
  { name: 'Samsonas Motorsport' },
  { name: 'Sandtler' },
  { name: 'Summit Racing' },
  { name: 'Team Oreca' },
];

export const brandsMoto: LocalBrand[] = [
  { name: 'Accossato', description: 'Italian excellence in braking systems and racing controls, delivering MotoGP-grade precision and stopping power for the most demanding riders.', descriptionUA: 'Італійська досконалість у гальмівних системах та гоночних органах керування, що забезпечує точність рівня MotoGP та гальмівну потужність для найвимогливіших райдерів.', website: 'https://accossato.com/?locale=en' },
  { name: 'AEM Factory', description: 'Exquisite Italian craftsmanship meets high-performance engineering, creating premium billet aluminum components that redefine motorcycle aesthetics and functionality.', descriptionUA: 'Витончена італійська майстерність поєднується з високопродуктивною інженерією, створюючи преміальні алюмінієві компоненти, які переосмислюють естетику та функціональність мотоциклів.', website: 'https://www.aem-factory.com' },
  { name: 'AIM Tech', description: 'The global leader in data acquisition and racing technology, empowering champions with precise telemetry and advanced dashboard displays.', descriptionUA: 'Світовий лідер у збиранні даних та гоночних технологіях, надаючи чемпіонам точну телеметрію та передові дисплеї приладової панелі.', website: 'https://www.aim-sportline.com' },
  { name: 'Akrapovic', description: 'A pioneer in material science and innovative design, crafting the world\'s finest exhaust systems for championship-winning performance.', descriptionUA: 'Піонер у матеріалознавстві та інноваційному дизайні, що створює найкращі у світі вихлопні системи для чемпіонських перемог.', website: 'https://www.akrapovic.com/en/moto' },
  { name: 'Alpha Racing', description: 'The definitive authority on BMW Motorrad performance, engineering professional-grade racing components for the S1000RR and M1000RR platforms.', descriptionUA: 'Беззаперечний авторитет у продуктивності BMW Motorrad, розробка професійних гоночних компонентів для платформ S1000RR та M1000RR.', website: 'https://www.alpharacing.com/en/' },
  { name: 'ARP Racingparts', description: 'Precision-machined racing rearsets and clip-ons, designed and tested on the track to provide ultimate control and durability.', descriptionUA: 'Прецизійно оброблені гоночні підніжки та кліп-они, розроблені та випробувані на треку для максимального контролю та довговічності.', website: 'https://www.arp-racingparts.com/en/' },
  { name: 'Arrow', description: 'Iconic Italian exhaust systems with a rich racing heritage, delivering superior performance and the unmistakable sound of victory.', descriptionUA: 'Легендарні італійські вихлопні системи з багатою гоночною спадщиною, що забезпечують чудову продуктивність та неповторний звук перемоги.', website: 'https://www.arrow.it/en/' },
  { name: 'Austin Racing', description: 'Bespoke, hand-crafted exhaust systems from the UK, renowned for their aggressive GP styling and phenomenal sound.', descriptionUA: 'Ексклюзивні, виготовлені вручну вихлопні системи з Великобританії, відомі своїм агресивним стилем GP та феноменальним звуком.', website: 'https://www.austinracing.com' },
  { name: 'AXP', description: 'The ultimate protection for off-road adventures, manufacturing high-density skid plates and guards to conquer the toughest terrains.', descriptionUA: 'Максимальний захист для позашляхових пригод, виробництво високоміцних захисних пластин для подолання найскладніших місцевостей.', website: 'https://www.axp-racing.com/en/' },
  { name: 'Bikesplast', description: 'Premium lightweight fiberglass and carbon fairings, trusted by racing teams worldwide for their aerodynamic efficiency and perfect fit.', descriptionUA: 'Преміальні легкі скловолоконні та карбонові обтічники, яким довіряють гоночні команди світу за їх аеродинамічну ефективність та ідеальну посадку.', website: 'https://www.bikesplast.com' },
  { name: 'Bitubo', description: 'Advanced Italian suspension technology, offering race-proven damping solutions that deliver superior handling and stability on track and street.', descriptionUA: 'Передові італійські технології підвіски, що пропонують перевірені на треку демпферні рішення для чудової керованості та стабільності.', website: 'https://www.bitubo.com/en' },
  { name: 'Bonamici', description: 'Italian engineering at its finest, producing CNC-machined racing components and rearsets used by World Superbike teams.', descriptionUA: 'Італійська інженерія у найкращому вигляді, виробництво фрезерованих гоночних компонентів та підніжок, що використовуються командами World Superbike.', website: 'https://www.bonamiciracing.it/en/' },
  { name: 'Brembo', description: 'The undisputed global leader in high-performance braking systems, delivering race-proven stopping power and precision engineering.', descriptionUA: 'Незаперечний світовий лідер у високопродуктивних гальмівних системах, що забезпечують перевірену на треку гальмівну потужність та точну інженерію.', website: 'https://www.brembo.com/en/solutions/for-your-bike' },
  { name: 'BT Moto', description: 'Industry-leading ECU flashing and tuning solutions, unlocking the full potential and power of modern high-performance motorcycles.', descriptionUA: 'Провідні рішення для прошивки ECU та тюнінгу, розкриваючи повний потенціал та потужність сучасних високопродуктивних мотоциклів.', website: 'https://bt-moto.com' },
  { name: 'Capit', description: 'The world\'s premier manufacturer of professional tire warmers, trusted by MotoGP and F1 teams to ensure optimal grip from the very first corner.', website: 'https://www.capitshop.com/eng/' },
  { name: 'Ceracarbon', description: 'Revolutionary ultra-lightweight technology, combining carbon fiber and ceramic coatings to create the world\'s most advanced sprockets and forks.', website: 'https://ceracarbon-racing.com' },
  { name: 'CNC Racing', description: 'The pinnacle of Italian accessory design, crafting exquisite billet parts that enhance both the performance and beauty of Ducati and MV Agusta machines.', descriptionUA: 'Вершина італійського дизайну аксесуарів, створення вишуканих фрезерованих деталей, що покращують продуктивність та красу мотоциклів Ducati та MV Agusta.', website: 'https://www.cncracing.com/en/' },
  { name: 'Cobra Sport', description: 'British-made performance exhausts, engineered to deliver increased power, reduced weight, and a deep, aggressive exhaust note.', descriptionUA: 'Британські продуктивні вихлопи, розроблені для збільшення потужності, зменшення ваги та глибокого, агресивного вихлопного звуку.', website: 'https://cobrasport.com/pages/motorcycle-exhaust-systems' },
  { name: 'Cordona', description: 'Precision quickshifter technology developed for the highest levels of racing, ensuring seamless, lightning-fast gear changes.', descriptionUA: 'Прецизійна технологія швидкого перемикання, розроблена для найвищих рівнів гонок, що забезпечує безперебійні блискавично швидкі перемикання передач.', website: 'https://cordona.net' },
  { name: 'DB-Race', description: 'Innovative Italian design, specializing in high-end billet mirrors and accessories that blend futuristic aesthetics with functional excellence.', descriptionUA: 'Інноваційний італійський дизайн, спеціалізація на високоякісних фрезерованих дзеркалах та аксесуарах, що поєднують футуристичну естетику з функціональною досконалістю.', website: 'https://www.db-race.com/en/' },
  { name: 'Dominator Exhaust', description: 'Aggressive sound and performance, offering high-quality, handcrafted exhaust systems that transform the riding experience.', descriptionUA: 'Агресивний звук та продуктивність, пропонуючи високоякісні вихлопні системи ручної роботи, що трансформують досвід їзди.', website: 'https://dominator.pl' },
  { name: 'Domino', description: 'The world standard in motorcycle controls, supplying championship-winning grips, throttles, and levers to the top racing teams.', descriptionUA: 'Світовий стандарт в органах керування мотоциклом, постачання чемпіонських грипс, дросел��в та важелів провідним гоночним командам.', website: 'https://www.domino-group.com/tommaselli/en/home.html' },
  { name: 'ECUStudio', description: 'Advanced engine management solutions, providing professional-grade tuning software and hardware for total control over bike performance.', descriptionUA: 'Передові рішення для управління двигуном, надаючи професійне програмне забезпечення та обладнання для повного контролю над продуктивністю байка.', website: 'https://shop.ecustudio.com' },
  { name: 'EVR', description: 'Italian innovation in drivetrain technology, famous for their slipper clutches and carbon fiber airboxes that maximize engine efficiency.', descriptionUA: 'Італійська інновація в трансмісійних технологіях, відомі своїми зчепленнями з ковзним механізмом та карбоновими повітряними коробками, що максимізують ефективність двигуна.', website: 'https://www.edovignaracing.com/en/index.html' },
  { name: 'Evotech', description: 'Superior protection and style, engineering high-quality radiator guards and accessories that seamlessly integrate with your motorcycle\'s design.', website: 'https://evotech-performance.com' },
  { name: 'Evolution Bike', description: 'Specialized racing components and electronics, developed through years of competition to enhance the performance of Italian superbikes.', descriptionUA: 'Спеціалізовані гоночні компоненти та електроніка, розроблені через роки змагань для покращення продуктивності італійських суперспортів.', website: 'https://www.evolutionbike.it' },
  { name: 'Febur', description: 'World-class cooling systems and racing swingarms, chosen by top World Superbike teams for their exceptional thermal efficiency and weight reduction.', descriptionUA: 'Світового класу системи охолодження та гоночні маятники, обрані провідними командами World Superbike за їх виняткову теплову ефективність та зменшення ваги.', website: 'https://www.febur.it/1920x1080en.html' },
  { name: 'FlashTune', description: 'The industry standard for ECU interface technology, empowering tuners and riders to unlock the true performance of their motorcycles.', descriptionUA: 'Галузевий стандарт технології інтерфейсу ECU, надаючи тюнерам та райдерам можливість розкрити справжню продуктивність їхніх мотоциклів.', website: 'https://ftecu.com' },
  { name: 'Fullsix Carbon', description: 'The benchmark for structural carbon fiber, producing autoclave-cured bodywork that combines stunning visual perfection with immense strength.', descriptionUA: 'Еталон структурного карбонового волокна, виробництво автоклавних обтічників, що поєднують приголомшливу візуальну досконалість з неймовірною міцністю.', website: 'https://www.fullsixcarbon.com/en' },
  { name: 'GBracing', description: 'The FIM-approved standard for engine protection, providing high-impact composite covers that safeguard your engine in the event of a crash.', descriptionUA: 'Затверджений FIM стандарт захисту двигуна, надаючи високоударні композитні кришки, що захищають ваш двигун у разі падіння.', website: 'https://www.gbracing.eu/default.aspx' },
  { name: 'Gilles Tooling', description: 'German engineering precision, creating adjustable rearsets and ergonomic parts that offer the perfect balance of comfort, control, and style.', descriptionUA: 'Німецька інженерна точність, створення регульованих підніжок та ергономічних деталей, що пропонують ідеальний баланс комфорту, контролю та стилю.', website: 'https://www.gillestooling.com/en/' },
  { name: 'GPR Stabilizer', description: 'The original rotary steering damper, providing unmatched stability and control for high-speed racing and off-road riding.', descriptionUA: 'Оригінальний роторний демпфер кермового керування, що забезпечує неперевершену стабільність та контроль для високошвидкісних гонок та позашляхової їзди.', website: 'https://www.gprstabilizer.com' },
  { name: 'Healtech', description: 'Smart electronic solutions for modern motorcycles, from advanced quickshifters to diagnostic tools that simplify maintenance and tuning.', descriptionUA: 'Розумні електронні рішення для сучасних мотоциклів, від передових систем швидкого перемикання до діагностичних інструментів, що спрощують обслуговування та тюнінг.', website: 'https://www.healtech-electronics.com' },
  { name: 'HM Quickshifter', description: 'Strain gauge technology at its finest, delivering the smoothest and most reliable quickshifting experience for professional racing.', descriptionUA: 'Технологія тензодатчиків у найкращому вигляді, забезпечуючи найплавніший та найнадійніший досвід швидкого перемикання для професійних гонок.', website: 'https://hmquickshifter.com.au' },
  { name: 'HyperPro', description: 'Experts in progressive suspension technology, offering steering dampers and springs that adapt to road conditions for a safer, smoother ride.', descriptionUA: 'Експерти в прогресивних технологіях підвіски, пропонуючи демпфери кермового керування та пружини, що адаптуються до дорожніх умов для безпечнішої та плавнішої їзди.', website: 'https://hyperpro.com' },
  { name: 'Ilmberger Carbon', description: 'TUV-certified carbon fiber excellence, manufacturing the highest quality autoclave parts with a focus on durability and flawless finish.', descriptionUA: 'Сертифікована TUV досконалість карбонового волокна, виробництво найвищої якості автоклавних деталей з фокусом на довговічність та бездоганне покриття.', website: 'https://ilmberger-carbon.com/en/Home' },
  { name: 'IXIL', description: 'Distinctive Spanish design and performance, creating exhaust systems with unique silencer shapes and a deep, sporty sound.', descriptionUA: 'Характерний іспанський дизайн та продуктивність, створення вихлопних систем з унікальними формами глушників та глибоким, спортивним звуком.', website: 'https://ixil.com/en/' },
  { name: 'Jetprime', description: 'High-performance electronic components and racing switch panels, designed to replace standard controls with race-ready precision.', descriptionUA: 'Високопродуктивні електронні компоненти та гоночні панелі перемикачів, розроблені для заміни стандартних органів керування з гоночною точністю.', website: 'https://jetprimeshop.it/en/' },
  { name: 'Marchesini', description: 'Legendary forged magnesium and aluminum wheels, synonymous with racing victory and reducing unsprung weight for ultimate agility.', descriptionUA: 'Легендарні ковані магнієві та алюмінієві диски, синонім гоночних перемог та зменшення непідресореної маси для максимальної маневреності.', website: 'https://www.marchesiniwheels.com/en/pages/default.aspx' },
  { name: 'Melotti Racing', description: 'Exquisite Italian craftsmanship, producing CNC-milled racing components and dashboard protections that are functional works of art.', descriptionUA: 'Вишукана італійська майстерність, виробництво фрезерованих гоночних компонентів та захистів приладової панелі, що є функціональними витворами мистецтва.', website: 'https://www.melottiracing.com/en/' },
  { name: 'New Rage Cycles', description: 'Innovative plug-and-play design, revolutionizing fender eliminators and turn signals with sleek, modern aesthetics.', descriptionUA: 'Інноваційний plug-and-play дизайн, революціонізація елімінаторів крила та поворотників з елегантною сучасною естетикою.', website: 'https://newragecycles.com' },
  { name: 'Ohlins', description: 'The gold standard in advanced suspension technology, providing superior handling and control for the world\'s most demanding riders.', website: 'https://www.ohlins.com/motorcycle' },
  { name: 'OZ Racing', description: 'Championship-winning wheel technology, engineering lightweight forged aluminum and magnesium rims for peak performance.', descriptionUA: 'Чемпіонська технологія дисків, розробка легких кованих алюмінієвих та магнієвих ободів для пікової продуктивності.', website: 'https://www.ozmotorbike.com/en/' },
  { name: 'P3 Carbon', description: 'Hand-crafted carbon fiber protection, building the most durable pipe guards and skid plates to withstand the rigors of extreme enduro.', descriptionUA: 'Ручне виготовлення карбонового захисту, створення найміцніших захистів труб та захисних пластин для витримування суворих екстремальних ендуро.', website: 'https://p3carbon.com' },
  { name: 'Racefoxx', description: 'Your partner in the paddock, offering a wide range of high-quality racing accessories, tire warmers, and carbon parts.', descriptionUA: 'Ваш партнер у paddock, пропонуючи широкий асортимент високоякісних гоночних аксесуарів, підігрівачів шин та карбонових деталей.', website: 'https://www.racefoxx.com/?lang=eng' },
  { name: 'R&G Racing', description: 'The world leader in motorcycle crash protection, designing innovative sliders and guards to minimize damage and keep you on track.', descriptionUA: 'Світовий лідер у захисті мотоциклів від падіння, розробка інноваційних слайдерів та захистів для мінімізації пошкоджень та утримання вас на треку.', website: 'https://www.rg-racing.com' },
  { name: 'Rizoma', description: 'The essence of Italian style, transforming motorcycles into unique masterpieces with meticulously designed billet aluminum accessories.', descriptionUA: 'Суть італійського стилю, трансформація мотоциклів у унікальні шедеври з ретельно розробленими фрезерованими алюмінієвими аксесуарами.', website: 'https://www.rizoma.com/en/' },
  { name: 'Rotobox', description: 'Pushing the boundaries of wheel technology with ultra-lightweight carbon fiber rims that redefine acceleration and handling.', descriptionUA: 'Подолання меж технології дисків з ультралегкими карбоновими ободами, що переосмислюють прискорення та керованість.', website: 'https://www.rotobox-wheels.com/en' },
  { name: 'S2 Concept', description: 'French design flair, creating unique fairing kits and aesthetic parts that give your motorcycle a distinctive, custom look.', descriptionUA: 'Французький дизайнерський стиль, створення унікальних комплектів обтічників та естетичних деталей, що надають вашому мотоциклу характерний, індивідуальний вигляд.', website: 'https://www.s2-concept.com/en/' },
  { name: 'Samco Sport', description: 'The world leader in performance silicone hoses, ensuring maximum cooling efficiency and reliability under extreme racing conditions.', descriptionUA: 'Світовий лідер у продуктивних силіконових шлангах, що забезпечують максимальну ефективність охолодження та надійність в екстремальних гоночних умовах.', website: 'https://samcosport.com/bike/' },
  { name: 'SC-Project', description: 'The sound of MotoGP champions, manufacturing exhaust systems that deliver unrivaled performance, weight savings, and a spine-tingling exhaust note.', descriptionUA: 'Звук чемпіонів MotoGP, виробництво вихлопних систем, що забезпечують неперевершену продуктивність, зменшення ваги та приголомшливий вихлопний звук.', website: 'https://sc-project.com' },
  { name: 'Sebimoto', description: 'European racing tradition, producing high-quality fiberglass and carbon fiber fairings for track day enthusiasts and professional teams.', descriptionUA: 'Європейська гоночна традиція, виробництво високоякісних скловолоконних та карбонових обтічників для ентузіастів трек-днів та професійних команд.', website: 'https://www.sebimoto.com' },
  { name: 'SparkExhaust', description: 'Italian passion for performance, crafting exhaust systems that combine dyno-proven power gains with elegant design and rich sound.', descriptionUA: 'Італійська пристрасть до продуктивності, створення вихлопних систем, що поєднують доведені на динамометрі прирости потужності з елегантним дизайном та насиченим звуком.', website: 'https://www.sparkexhaust.com/en' },
  { name: 'Sprint Filter', description: 'Innovative polyester air filter technology, providing the highest airflow and filtration efficiency for maximum engine performance.', descriptionUA: 'Інноваційна технологія поліестерових повітряних фільтрів, що забезпечує найвищий повітряний потік та ефективність фільтрації для максимальної продуктивності двигуна.', website: 'https://www.sprintfilter.net/motorcycle/' },
  { name: 'Starlane', description: 'Precision GPS laptimers and data acquisition systems, helping riders analyze and improve their performance on the track.', descriptionUA: 'Точні GPS-ляпометри та системи збору даних, що допомагають райдерам аналізувати та покращувати свою продуктивність на треку.', website: 'https://www.starlane.com' },
  { name: 'STM Italy', description: 'The inventors of the slipper clutch, continuing to lead the market with advanced drivetrain components for racing applications.', descriptionUA: 'Винахідники зчеплення з ковзним механізмом, продовжують лідирувати на ринку з передовими трансмісійними компонентами для гоночних застосувань.', website: 'https://www.stmitaly.com/index_en.html' },
  { name: 'Stompgrip', description: 'The original traction pad, providing riders with superior grip and control to reduce fatigue and improve cornering confidence.', descriptionUA: 'Оригінальні накладки для зчеплення, що надають райдерам чудове зчеплення та контроль для зменшення втоми та покращення впевненості в поворотах.', website: 'https://stompgrip.com' },
  { name: 'Termignoni', description: 'The historic sound of Italian racing, delivering exhaust systems with a legacy of winning and a character that is impossible to ignore.', descriptionUA: 'Історичний звук італійських гонок, постачання вихлопних систем зі спадщиною перемог та характером, який неможливо ігнорувати.', website: 'https://termignoni.it' },
  { name: 'Thermal Technology', description: 'Cutting-edge heating technology, producing the most advanced tire warmers used by top teams in MotoGP and World Superbike.', descriptionUA: 'Передові технології нагріву, виробництво найпередовіших підігрівачів шин, що використовуються провідними командами в MotoGP та World Superbike.', website: 'https://www.tt-race.com/en' },
  { name: 'TOCE Exhaust', description: 'Aggressive American styling and sound, famous for their signature multi-outlet designs that make a bold statement.', descriptionUA: 'Агресивний американський стиль та звук, відомі своїми фірмовими багатовипускними дизайнами, що роблять сміливу заяву.', website: 'https://toceperformance.com' },
  { name: 'Translogic', description: 'World-leading quickshifter systems, trusted by factory teams for their reliability and seamless gear changing performance.', descriptionUA: 'Провідні у світі системи швидкого перемикання, яким довіряють заводські команди за їх надійність та безперебійну продуктивність перемикання передач.', website: 'https://translogicuk.com' },
  { name: 'TSS', description: 'Czech engineering excellence, specializing in slipper clutches and lightweight racing subframes for track-focused motorcycles.', descriptionUA: 'Чеська інженерна досконалість, спеціалізація на зчепленнях з ковзним механізмом та легких гоночних підрамниках для трек-орієнтованих мотоциклів.', website: 'https://www.tss.cz/en/' },
  { name: 'TWM', description: 'High-quality Italian components, known for their quick-action fuel caps and folding levers used by riders worldwide.', descriptionUA: 'Високоякісні італійські компоненти, відомі своїми швидкодіючими кришками паливних баків та складними важелями, що використовуються райдерами по всьому світу.', website: 'https://www.twm-sc.com' },
  { name: 'ValterMoto', description: 'Comprehensive racing solutions, from precision rearsets to paddock equipment, designed to meet the needs of professional teams.', descriptionUA: 'Комплексні гоночні рішення, від прецизійних підніжок до обладнання paddock, розроблені для задоволення потреб професійних команд.', website: 'https://www.valtermoto.com/en/' },
  { name: 'Vandemon', description: 'Premium titanium exhaust systems, combining exotic materials with expert welding to create lightweight, high-performance art.', descriptionUA: 'Преміальні титанові вихлопні системи, що поєднують екзотичні матеріали з експертним зварюванням для створення легкого, високопродуктивного мистецтва.', website: 'https://vandemonperformance.com.au' },
  { name: 'X-GRIP', description: 'Off-road dominance, developing high-performance tires and mousses that provide unbeatable traction in the most extreme conditions.', descriptionUA: 'Позашляхове домінування, розробка високопродуктивних шин та муссів, що забезпечують неперевершене зчеплення в найекстремальніших умовах.', website: 'https://www.x-grip.at' },
  { name: 'ZARD Exhaust', description: 'Handcrafted Italian artistry, creating exhaust systems with unique, unconventional designs and a soulful sound.', descriptionUA: 'Італійська майстерність ручної роботи, створення вихлопних систем з унікальними, нетрадиційними дизайнами та душевним звуком.', website: 'https://officineitalianezard.it/en/' },
];

export const allAutomotiveBrands: LocalBrand[] = [
  ...brandsUsa,
  ...brandsEurope,
  ...brandsOem,
  ...brandsRacing,
].sort((a, b) => a.name.localeCompare(b.name));

export const allMotoBrands: LocalBrand[] = [...brandsMoto].sort((a, b) => a.name.localeCompare(b.name));

export function getBrandsByCategory(category: BrandCategory): LocalBrand[] {
  switch (category) {
    case 'usa':
      return brandsUsa;
    case 'europe':
      return brandsEurope;
    case 'oem':
      return brandsOem;
    case 'racing':
      return brandsRacing;
    case 'moto':
      return brandsMoto;
    case 'auto':
      return allAutomotiveBrands;
  }
  // Fallback for unexpected values
  return allAutomotiveBrands;
}

export function getBrandsByNames(names: string[], category: BrandCategory = 'auto'): LocalBrand[] {
  const pool = category === 'moto' ? allMotoBrands : getBrandsByCategory(category);
  return names
    .map(name => {
      const normalized = name.trim().toLowerCase();
      return pool.find(brand => brand.name.trim().toLowerCase() === normalized);
    })
    .filter((brand): brand is LocalBrand => Boolean(brand));
}

export function getBrandMetadata(brandName: string): BrandMetadata | undefined {
  return brandMetadata[brandName];
}

export function getLocalizedCountry(country: CountryOfOrigin, locale: 'en' | 'ua'): string {
  return countryNames[country]?.[locale] || country;
}

export function getLocalizedSubcategory(subcategory: ProductSubcategory, locale: 'en' | 'ua'): string {
  return subcategoryNames[subcategory]?.[locale] || subcategory;
}

// Brand metadata mapping (country of origin and product subcategory)
export const brandMetadata: Record<string, BrandMetadata> = {
  // USA Brands
  '1221 wheels': { country: 'USA', subcategory: 'Wheels' },
  '1016 Industries': { country: 'USA', subcategory: 'Exterior' },
  '5150 Autosport': { country: 'USA', subcategory: 'Engine' },
  'AE Design': { country: 'USA', subcategory: 'Exterior' },
  'ADV.1 wheels': { country: 'USA', subcategory: 'Wheels' },
  'Agency Power': { country: 'USA', subcategory: 'Engine' },
  'Airlift Performance': { country: 'USA', subcategory: 'Suspension' },
  'AL13 wheels': { country: 'USA', subcategory: 'Wheels' },
  'AMS / Alpha Performance': { country: 'USA', subcategory: 'Engine' },
  'American Racing Headers': { country: 'USA', subcategory: 'Exhaust' },
  'ANRKY wheels': { country: 'USA', subcategory: 'Wheels' },
  'APR': { country: 'USA', subcategory: 'Engine' },
  'Avantgarde Wheels': { country: 'USA', subcategory: 'Wheels' },
  'BE bearings': { country: 'USA', subcategory: 'Drivetrain' },
  'BBi Autosport': { country: 'USA', subcategory: 'Engine' },
  'Big Boost': { country: 'USA', subcategory: 'Engine' },
  'BimmerWorld': { country: 'USA', subcategory: 'Engine' },
  'BootMod3': { country: 'USA', subcategory: 'Electronics' },
  'Borla': { country: 'USA', subcategory: 'Exhaust' },
  'Brixton wheels': { country: 'USA', subcategory: 'Wheels' },
  'Burger Motorsport': { country: 'USA', subcategory: 'Electronics' },
  'Circle D': { country: 'USA', subcategory: 'Drivetrain' },
  'Cobb tuning': { country: 'USA', subcategory: 'Electronics' },
  'CMST': { country: 'USA', subcategory: 'Exterior' },
  'CSF': { country: 'USA', subcategory: 'Cooling' },
  'DarwinPro': { country: 'USA', subcategory: 'Exterior' },
  'Deatschwerks': { country: 'USA', subcategory: 'Fuel Systems' },
  'Dorch Engineering': { country: 'USA', subcategory: 'Engine' },
  'Driveshaftshop': { country: 'USA', subcategory: 'Drivetrain' },
  'Duke Dynamics': { country: 'USA', subcategory: 'Exterior' },
  'Eterna Motorworks': { country: 'USA', subcategory: 'Engine' },
  'Fabspeed': { country: 'USA', subcategory: 'Exhaust' },
  'Fall-Line Motorsports': { country: 'USA', subcategory: 'Engine' },
  'Fore Innovations': { country: 'USA', subcategory: 'Fuel Systems' },
  'Fragola Performance Systems': { country: 'USA', subcategory: 'Fuel Systems' },
  'Full-Race': { country: 'USA', subcategory: 'Engine' },
  'Future Design': { country: 'USA', subcategory: 'Exterior' },
  'Girodisc': { country: 'USA', subcategory: 'Brakes' },
  'HRE wheels': { country: 'USA', subcategory: 'Wheels' },
  'Injector Dynamics': { country: 'USA', subcategory: 'Fuel Systems' },
  'JXB Performance': { country: 'USA', subcategory: 'Engine' },
  'Karbel': { country: 'USA', subcategory: 'Exterior' },
  'Killer B Motorsport': { country: 'USA', subcategory: 'Engine' },
  'KLM Race': { country: 'USA', subcategory: 'Engine' },
  'Kooks Headers': { country: 'USA', subcategory: 'Exhaust' },
  'Lingenfelter': { country: 'USA', subcategory: 'Engine' },
  'Mega3 Performance': { country: 'USA', subcategory: 'Engine' },
  'Mickey Thompson': { country: 'USA', subcategory: 'Wheels' },
  'Motiv Motorsport': { country: 'USA', subcategory: 'Wheels' },
  'Moser Engineering': { country: 'USA', subcategory: 'Drivetrain' },
  'Mountune': { country: 'USA', subcategory: 'Engine' },
  'MV Forged': { country: 'USA', subcategory: 'Wheels' },
  'Paragon brakes': { country: 'USA', subcategory: 'Brakes' },
  'Premier Tuning Group': { country: 'USA', subcategory: 'Engine' },
  'Project 6GR': { country: 'USA', subcategory: 'Wheels' },
  'Pure Drivetrain Solutions': { country: 'USA', subcategory: 'Drivetrain' },
  'Pure Turbos': { country: 'USA', subcategory: 'Engine' },
  'Renntech': { country: 'USA', subcategory: 'Engine' },
  'RK Autowerks': { country: 'USA', subcategory: 'Engine' },
  'RPM Transmissions': { country: 'USA', subcategory: 'Drivetrain' },
  'RKP': { country: 'USA', subcategory: 'Engine' },
  'RYFT': { country: 'USA', subcategory: 'Suspension' },
  'Seibon': { country: 'USA', subcategory: 'Exterior' },
  'ShepTrans': { country: 'USA', subcategory: 'Drivetrain' },
  'Southern Hotrod': { country: 'USA', subcategory: 'Engine' },
  'Spool Performance': { country: 'USA', subcategory: 'Drivetrain' },
  'SPL Parts': { country: 'USA', subcategory: 'Suspension' },
  'Strasse wheels': { country: 'USA', subcategory: 'Wheels' },
  'Stoptech': { country: 'USA', subcategory: 'Brakes' },
  'Stillen': { country: 'USA', subcategory: 'Engine' },
  'Titan Motorsport': { country: 'USA', subcategory: 'Engine' },
  'TireRack': { country: 'USA', subcategory: 'Wheels' },
  'Turner Motorsport': { country: 'USA', subcategory: 'Engine' },
  'Vargas Turbo': { country: 'USA', subcategory: 'Engine' },
  'Velos Wheels': { country: 'USA', subcategory: 'Wheels' },
  'VF Engineering': { country: 'USA', subcategory: 'Engine' },
  'VP Racing Fuel': { country: 'USA', subcategory: 'Fuel Systems' },
  'VR Aero': { country: 'USA', subcategory: 'Aero' },
  'VR Bespoke': { country: 'USA', subcategory: 'Exterior' },
  'VR Forged': { country: 'USA', subcategory: 'Wheels' },
  'VR Performance': { country: 'USA', subcategory: 'Engine' },
  'Vorsteiner': { country: 'USA', subcategory: 'Exterior' },
  'Wavetrac': { country: 'USA', subcategory: 'Drivetrain' },
  'Weistec Engineering': { country: 'USA', subcategory: 'Engine' },
  'Whipple Superchargers': { country: 'USA', subcategory: 'Engine' },
  'XDI fuel systems': { country: 'USA', subcategory: 'Fuel Systems' },

  // Europe Brands
  '3D Design': { country: 'Japan', subcategory: 'Exterior' },
  'ABT': { country: 'Germany', subcategory: 'Engine' },
  'AC Schnitzer': { country: 'Germany', subcategory: 'Exterior' },
  'ADRO': { country: 'USA', subcategory: 'Exterior' },
  'Akrapovic': { country: 'Slovenia', subcategory: 'Exhaust' },
  'Alpha-N': { country: 'Germany', subcategory: 'Exterior' },
  'ARMA Speed': { country: 'Taiwan', subcategory: 'Engine' },
  'Armytrix': { country: 'Taiwan', subcategory: 'Exhaust' },
  'Black Boost': { country: 'Germany', subcategory: 'Engine' },
  'BMC filters': { country: 'Italy', subcategory: 'Engine' },
  'Brabus': { country: 'Germany', subcategory: 'Full Vehicle' },
  'Brembo': { country: 'Italy', subcategory: 'Brakes' },
  'BC Racing': { country: 'Taiwan', subcategory: 'Suspension' },
  'Capristo': { country: 'Germany', subcategory: 'Exhaust' },
  'CT Carbon': { country: 'UK', subcategory: 'Exterior' },
  'Custom Cages': { country: 'UK', subcategory: 'Interior' },
  'Dahler': { country: 'Germany', subcategory: 'Engine' },
  'DMC': { country: 'Germany', subcategory: 'Exterior' },
  'do88': { country: 'Sweden', subcategory: 'Cooling' },
  'DTE Systems': { country: 'Germany', subcategory: 'Electronics' },
  'ESS Tuning': { country: 'USA', subcategory: 'Engine' },
  'Eventuri': { country: 'UK', subcategory: 'Engine' },
  'FI Exhaust': { country: 'Taiwan', subcategory: 'Exhaust' },
  'GTHaus': { country: 'USA', subcategory: 'Exhaust' },
  'Gruppe-M': { country: 'Japan', subcategory: 'Engine' },
  'Hamann': { country: 'Germany', subcategory: 'Exterior' },
  'Hardrace': { country: 'Taiwan', subcategory: 'Suspension' },
  'Harrop': { country: 'Australia', subcategory: 'Engine' },
  'IPe exhaust': { country: 'Taiwan', subcategory: 'Exhaust' },
  'ItalianRP': { country: 'Italy', subcategory: 'Engine' },
  'KAHN design': { country: 'UK', subcategory: 'Exterior' },
  'Karbonius': { country: 'Spain', subcategory: 'Exterior' },
  'Keyvany': { country: 'Germany', subcategory: 'Exterior' },
  'Kline Innovation': { country: 'Germany', subcategory: 'Exhaust' },
  'KW Suspension': { country: 'Germany', subcategory: 'Suspension' },
  'Lamspeed': { country: 'Australia', subcategory: 'Engine' },
  'Larte Design': { country: 'Germany', subcategory: 'Exterior' },
  'Liberty Walk': { country: 'Japan', subcategory: 'Exterior' },
  'LOBA Motorsport': { country: 'Germany', subcategory: 'Engine' },
  'Lorinser': { country: 'Germany', subcategory: 'Exterior' },
  'Lumma': { country: 'Germany', subcategory: 'Exterior' },
  'Manhart': { country: 'Germany', subcategory: 'Full Vehicle' },
  'Mansory': { country: 'Germany', subcategory: 'Full Vehicle' },
  'Mamba turbo': { country: 'Taiwan', subcategory: 'Engine' },
  "Matts Carbon": { country: 'UK', subcategory: 'Exterior' },
  'Milltek': { country: 'UK', subcategory: 'Exhaust' },
  'MST Performance': { country: 'Taiwan', subcategory: 'Engine' },
  'Novitec': { country: 'Germany', subcategory: 'Exterior' },
  'Nitron Suspension': { country: 'UK', subcategory: 'Suspension' },
  'Onyx Concept': { country: 'UK', subcategory: 'Exterior' },
  'Pagid': { country: 'Germany', subcategory: 'Brakes' },
  'Power Division': { country: 'Poland', subcategory: 'Engine' },
  'ProTrack Wheels': { country: 'Germany', subcategory: 'Wheels' },
  'R44 Performance': { country: 'UK', subcategory: 'Exterior' },
  'Remus': { country: 'Austria', subcategory: 'Exhaust' },
  'RES Exhaust': { country: 'China', subcategory: 'Exhaust' },
  'RS-R': { country: 'Japan', subcategory: 'Suspension' },
  'RW Carbon': { country: 'USA', subcategory: 'Exterior' },
  'Sachs Performance': { country: 'Germany', subcategory: 'Suspension' },
  'Schrick': { country: 'Germany', subcategory: 'Engine' },
  'Sterckenn': { country: 'UK', subcategory: 'Exterior' },
  'STOPART ceramic' : { country: 'Poland', subcategory: 'Brakes' },
  'Supersprint': { country: 'Italy', subcategory: 'Exhaust' },
  'Tubi Style': { country: 'Italy', subcategory: 'Exhaust' },
  'TTE Turbos': { country: 'Germany', subcategory: 'Engine' },
  'TTH turbos': { country: 'Germany', subcategory: 'Engine' },
  'Urban Automotive': { country: 'UK', subcategory: 'Exterior' },
  'Wagner Tuning': { country: 'Germany', subcategory: 'Engine' },
  'WALD': { country: 'Japan', subcategory: 'Exterior' },
  'WheelForce': { country: 'Germany', subcategory: 'Wheels' },
  'xHP': { country: 'Germany', subcategory: 'Electronics' },
  'Zacoe': { country: 'Taiwan', subcategory: 'Exterior' },

  // OEM Brands
  'Aston Martin': { country: 'UK', subcategory: 'Full Vehicle' },
  'Ferrari': { country: 'Italy', subcategory: 'Full Vehicle' },
  'Lamborghini': { country: 'Italy', subcategory: 'Full Vehicle' },
  'Maserati': { country: 'Italy', subcategory: 'Full Vehicle' },
  'McLaren': { country: 'UK', subcategory: 'Full Vehicle' },
  'Rolls Royce': { country: 'UK', subcategory: 'Full Vehicle' },

  // Racing Brands
  'AIM Sportline': { country: 'Italy', subcategory: 'Electronics' },
  'ARE dry sump': { country: 'USA', subcategory: 'Engine' },
  'Bell Intercoolers': { country: 'USA', subcategory: 'Cooling' },
  'Drenth Gearboxes': { country: 'Netherlands', subcategory: 'Drivetrain' },
  'Driftworks': { country: 'UK', subcategory: 'Suspension' },
  'Extreme tyres': { country: 'Germany', subcategory: 'Wheels' },
  'ISA Racing': { country: 'Germany', subcategory: 'Racing Components' },
  'Link ECU': { country: 'New Zealand', subcategory: 'Electronics' },
  'Lithiumax batteries': { country: 'Australia', subcategory: 'Electronics' },
  'MCA Suspension': { country: 'Australia', subcategory: 'Suspension' },
  'Modena Engineering': { country: 'Australia', subcategory: 'Drivetrain' },
  'Samsonas Motorsport': { country: 'Lithuania', subcategory: 'Drivetrain' },
  'Sandtler': { country: 'Germany', subcategory: 'Racing Components' },
  'Summit Racing': { country: 'USA', subcategory: 'Racing Components' },
  'Team Oreca': { country: 'France', subcategory: 'Racing Components' },

  // Moto Brands
  'Accossato': { country: 'Italy', subcategory: 'Brakes' },
  'AEM Factory': { country: 'Italy', subcategory: 'Racing Components' },
  'AIM Tech': { country: 'Italy', subcategory: 'Electronics' },
  'Alpha Racing': { country: 'Germany', subcategory: 'Racing Components' },
  'ARP Racingparts': { country: 'Czech Republic', subcategory: 'Racing Components' },
  'Arrow': { country: 'Italy', subcategory: 'Exhaust' },
  'Austin Racing': { country: 'UK', subcategory: 'Exhaust' },
  'AXP': { country: 'France', subcategory: 'Exterior' },
  'Bikesplast': { country: 'Czech Republic', subcategory: 'Exterior' },
  'Bitubo': { country: 'Italy', subcategory: 'Suspension' },
  'Bonamici': { country: 'Italy', subcategory: 'Racing Components' },
  'BT Moto': { country: 'USA', subcategory: 'Electronics' },
  'Capit': { country: 'Italy', subcategory: 'Racing Components' },
  'Ceracarbon': { country: 'Netherlands', subcategory: 'Drivetrain' },
  'CNC Racing': { country: 'Italy', subcategory: 'Racing Components' },
  'Cobra Sport': { country: 'UK', subcategory: 'Exhaust' },
  'Cordona': { country: 'Italy', subcategory: 'Electronics' },
  'DB-Race': { country: 'Italy', subcategory: 'Exterior' },
  'Dominator Exhaust': { country: 'Poland', subcategory: 'Exhaust' },
  'Domino': { country: 'Italy', subcategory: 'Racing Components' },
  'ECUStudio': { country: 'Italy', subcategory: 'Electronics' },
  'EVR': { country: 'Italy', subcategory: 'Drivetrain' },
  'Evotech': { country: 'UK', subcategory: 'Racing Components' },
  'Evolution Bike': { country: 'Italy', subcategory: 'Racing Components' },
  'Febur': { country: 'Italy', subcategory: 'Cooling' },
  'FlashTune': { country: 'USA', subcategory: 'Electronics' },
  'Fullsix Carbon': { country: 'Slovenia', subcategory: 'Exterior' },
  'GBracing': { country: 'UK', subcategory: 'Engine' },
  'Gilles Tooling': { country: 'Germany', subcategory: 'Racing Components' },
  'GPR Stabilizer': { country: 'USA', subcategory: 'Suspension' },
  'Healtech': { country: 'Hungary', subcategory: 'Electronics' },
  'HM Quickshifter': { country: 'UK', subcategory: 'Electronics' },
  'HyperPro': { country: 'Netherlands', subcategory: 'Suspension' },
  'Ilmberger Carbon': { country: 'Germany', subcategory: 'Exterior' },
  'IXIL': { country: 'Spain', subcategory: 'Exhaust' },
  'Jetprime': { country: 'Italy', subcategory: 'Electronics' },
  'Marchesini': { country: 'Italy', subcategory: 'Wheels' },
  'Melotti Racing': { country: 'Italy', subcategory: 'Racing Components' },
  'New Rage Cycles': { country: 'USA', subcategory: 'Exterior' },
  'Ohlins': { country: 'Sweden', subcategory: 'Suspension' },
  'OZ Racing': { country: 'Italy', subcategory: 'Wheels' },
  'P3 Carbon': { country: 'USA', subcategory: 'Exterior' },
  'Racefoxx': { country: 'Germany', subcategory: 'Racing Components' },
  'R&G Racing': { country: 'UK', subcategory: 'Racing Components' },
  'Rizoma': { country: 'Italy', subcategory: 'Racing Components' },
  'Rotobox': { country: 'Slovenia', subcategory: 'Wheels' },
  'S2 Concept': { country: 'France', subcategory: 'Exterior' },
  'Samco Sport': { country: 'UK', subcategory: 'Cooling' },
  'SC-Project': { country: 'Italy', subcategory: 'Exhaust' },
  'Sebimoto': { country: 'Czech Republic', subcategory: 'Exterior' },
  'SparkExhaust': { country: 'Italy', subcategory: 'Exhaust' },
  'Sprint Filter': { country: 'Italy', subcategory: 'Engine' },
  'Starlane': { country: 'Italy', subcategory: 'Electronics' },
  'STM Italy': { country: 'Italy', subcategory: 'Drivetrain' },
  'Stompgrip': { country: 'USA', subcategory: 'Exterior' },
  'Termignoni': { country: 'Italy', subcategory: 'Exhaust' },
  'Thermal Technology': { country: 'Italy', subcategory: 'Racing Components' },
  'TOCE Exhaust': { country: 'USA', subcategory: 'Exhaust' },
  'Translogic': { country: 'UK', subcategory: 'Electronics' },
  'TSS': { country: 'Czech Republic', subcategory: 'Drivetrain' },
  'TWM': { country: 'Italy', subcategory: 'Racing Components' },
  'ValterMoto': { country: 'Italy', subcategory: 'Racing Components' },
  'Vandemon': { country: 'Australia', subcategory: 'Exhaust' },
  'X-GRIP': { country: 'Austria', subcategory: 'Wheels' },
  'ZARD Exhaust': { country: 'Italy', subcategory: 'Exhaust' },
};
