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
  | 'Switzerland'
  | 'Hungary'
  | 'Canada'
  | 'UAE'
  | 'Norway'
  | 'Romania'
  | 'South Korea'
  | 'Ukraine'
  | 'Latvia';

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
  'Switzerland': { en: 'Switzerland', ua: 'Швейцарія' },
  'Hungary': { en: 'Hungary', ua: 'Угорщина' },
  'Canada': { en: 'Canada', ua: 'Канада' },
  'UAE': { en: 'UAE', ua: 'ОАЕ' },
  'Norway': { en: 'Norway', ua: 'Норвегія' },
  'Romania': { en: 'Romania', ua: 'Румунія' },
  'South Korea': { en: 'South Korea', ua: 'Південна Корея' },
  'Ukraine': { en: 'Ukraine', ua: 'Україна' },
  'Latvia': { en: 'Latvia', ua: 'Латвія' },
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
  { name: '1221 wheels', description: 'Handcrafted forged wheels from California, delivering bespoke three-piece designs that combine aerospace-grade materials with artisan craftsmanship.', descriptionUA: 'Ковані диски ручної роботи з Каліфорнії, що пропонують ексклюзивні трьохскладові конструкції, поєднуючи аерокосмічні матеріали з ремісничою майстерністю.', website: 'https://1221wheels.com' },
  { name: '034 Motorsport', description: 'Motorsport-grade performance upgrades for Audi and Volkswagen, delivering track-proven engineering and refined street drivability.', descriptionUA: 'Апгрейди гоночного рівня для Audi та Volkswagen, що забезпечують перевірену на треку інженерію та вишукану керованість на вулиці.', website: 'https://www.034motorsport.com' },
  { name: '1016 Industries', description: 'Luxury carbon fiber body components and aerodynamic solutions for exotic supercars, transforming Lamborghini and McLaren into bespoke masterpieces.', descriptionUA: 'Розкішні карбонові кузовні компоненти та аеродинамічні рішення для екзотичних суперкарів, що перетворюють Lamborghini та McLaren на ексклюзивні шедеври.', website: 'https://www.1016industries.com' },
  { name: '5150 Autosport', description: 'High-performance engine components and turbo systems engineered for maximum power output on BMW and European performance platforms.', descriptionUA: 'Високопродуктивні компоненти двигуна та турбо-системи, розроблені для максимальної потужності на платформах BMW та європейських автомобілях.', website: 'https://5150autosport.com' },
  { name: 'ADV.1 wheels', description: 'Iconic custom forged wheels renowned for aggressive concave profiles and precision engineering that define modern automotive luxury.', descriptionUA: 'Легендарні ковані диски на замовлення, відомі агресивними увігнутими профілями та точною інженерією, що визначають сучасну автомобільну розкіш.', website: 'https://www.adv1wheels.com' },
  { name: 'Airlift Performance', description: 'Industry-leading air suspension systems delivering perfect stance and ride quality, trusted by enthusiasts worldwide for show and daily driving.', descriptionUA: 'Провідні пневмопідвіски, що забезпечують ідеальну посадку та якість їзди, яким довіряють ентузіасти по всьому світу для шоу та щоденної їзди.', website: 'https://www.airliftperformance.com' },
  { name: 'AL13 wheels', description: 'Ultra-lightweight forged monoblock and multi-piece wheels crafted in the USA, combining motorsport heritage with contemporary design excellence.', descriptionUA: 'Ультралегкі ковані моноблочні та багатоскладові диски, виготовлені в США, що поєднують гоночну спадщину з сучасною дизайнерською досконалістю.', website: 'https://al13wheels.com' },
  { name: 'AMS / Alpha Performance', description: 'The benchmark in GT-R and turbocharged performance tuning, engineering record-breaking power packages that redefine performance limits.', descriptionUA: 'Еталон тюнінгу GT-R та турбованих систем, розробка рекордних пакетів потужності, що переосмислюють межі продуктивності.', website: 'https://www.amsperformance.com' },
  { name: 'American Racing Headers', description: 'Premium stainless steel exhaust headers and complete systems, handcrafted for American muscle and European performance vehicles.', descriptionUA: 'Преміальні нержавіючі випускні колектори та повні системи, виготовлені вручну для американських маслкарів та європейських спортивних автомобілів.', website: 'https://www.americanracingheaders.com' },
  { name: 'ANRKY wheels', description: 'Bold forged wheel designs featuring deep concave faces and aggressive fitments, engineered for the modern performance enthusiast.', descriptionUA: 'Сміливі ковані дизайни дисків з глибокими увігнутими поверхнями та агресивними посадками, розроблені для сучасного ентузіаста продуктивності.', website: 'https://anrkywheels.com' },
  { name: 'APR', description: 'Precision aerodynamic components and carbon fiber wings designed with professional motorsport technology for ultimate downforce and stability.', descriptionUA: 'Прецизійні аеродинамічні компоненти та карбонові антикрила, розроблені з професійними технологіями автоспорту для максимальної притискної сили та стабільності.', website: 'https://www.goapr.com' },
  { name: 'Avantgarde Wheels', description: 'Fashion-forward forged wheel designs that push creative boundaries, offering unique finishes and custom specifications for discerning enthusiasts.', descriptionUA: 'Передові дизайни кованих дисків, що розширюють творчі межі, пропонуючи унікальні покриття та індивідуальні специфікації для вимогливих ентузіастів.', website: 'https://www.avantgardewheels.com' },
  { name: 'BE bearings', description: 'Race-proven engine bearings engineered specifically for BMW powertrains, delivering superior durability under extreme boost and RPM conditions.', descriptionUA: 'Перевірені на гонках підшипники двигуна, розроблені спеціально для BMW, що забезпечують чудову довговічність при екстремальному бусті та обертах.', website: 'https://www.bebearings.com' },
  { name: 'BBi Autosport', description: 'Elite Porsche tuning and racing specialists, engineering championship-winning packages from street performance to full race builds.', descriptionUA: 'Елітні спеціалісти з тюнінгу та гонок Porsche, що розробляють чемпіонські пакети від вуличної продуктивності до повних гоночних збірок.', website: 'https://bbiautosport.com' },
  { name: 'Big Boost', description: 'High-performance turbo upgrade kits for BMW platforms, delivering significant power gains with bolt-on simplicity and proven reliability.', descriptionUA: 'Високопродуктивні турбо-кіти для платформ BMW, що забезпечують значний приріст потужності з простотою встановлення та перевіреною надійністю.', website: 'https://bigboostllc.com' },
  { name: 'BimmerWorld', description: 'Comprehensive BMW performance parts and racing expertise, supporting enthusiasts from weekend track days to professional motorsport competition.', descriptionUA: 'Комплексні деталі для BMW та гоночна експертиза, що підтримують ентузіастів від вихідних на треку до професійних змагань.', website: 'https://www.bimmerworld.com' },
  { name: 'BootMod3', description: 'Revolutionary flash tuning platform for BMW and Toyota Supra, enabling professional-grade calibrations through an intuitive mobile interface.', descriptionUA: 'Революційна платформа для флеш-тюнінгу BMW та Toyota Supra, що дозволяє професійне калібрування через інтуїтивний мобільний інтерфейс.', website: 'https://www.bootmod3.net' },
  { name: 'Borla', description: 'Legendary American exhaust craftsmanship with a heritage of motorsport excellence, delivering unmistakable sound and performance gains.', descriptionUA: 'Легендарна американська майстерність вихлопних систем з гоночною спадщиною, що забезпечує неповторний звук та приріст продуктивності.', website: 'https://www.borla.com' },
  { name: 'Brixton wheels', description: 'Contemporary forged wheel designs offering sophisticated aesthetics and lightweight construction for luxury and performance vehicles.', descriptionUA: 'Сучасні ковані дизайни дисків, що пропонують витончену естетику та легку конструкцію для розкішних та спортивних автомобілів.', website: 'https://www.brixtonforged.com' },
  { name: 'Burger Motorsport', description: 'Innovative JB4 tuning systems and performance electronics, delivering plug-and-play power gains for turbocharged European vehicles.', descriptionUA: 'Інноваційні системи тюнінгу JB4 та електроніка продуктивності, що забезпечують приріст потужності без складного встановлення для турбованих європейських авто.', website: 'https://burgertuning.com' },
  { name: 'Circle D', description: 'Expert torque converter and automatic transmission specialists, engineering high-performance drivetrain solutions for American muscle.', descriptionUA: 'Експерти з гідротрансформаторів та АКПП, що розробляють високопродуктивні рішення трансмісії для американських маслкарів.', website: 'https://www.circledspecialties.com' },
  { name: 'Cobb tuning', description: 'The industry standard in Accessport tuning, providing comprehensive ECU calibrations and monitoring for Subaru, Ford, and Nissan platforms.', descriptionUA: 'Галузевий стандарт тюнінгу Accessport, що забезпечує комплексні калібрування ECU та моніторинг для платформ Subaru, Ford та Nissan.', website: 'https://www.cobbtuning.com' },
  { name: 'CSF', description: 'Race-proven cooling solutions featuring high-performance radiators, intercoolers, and heat exchangers for demanding motorsport applications.', descriptionUA: 'Перевірені на гонках рішення охолодження з високопродуктивними радіаторами, інтеркулерами та теплообмінниками для вимогливого автоспорту.', website: 'https://csfrace.com' },
  { name: 'DarwinPro', description: 'Premium carbon fiber aerodynamic components and body kits, bringing exotic styling to luxury and performance vehicles worldwide.', descriptionUA: 'Преміальні карбонові аеродинамічні компоненти та бодікіти, що привносять екзотичний стиль розкішним та спортивним автомобілям.', website: 'https://www.darwinproaero.com' },
  { name: 'Deatschwerks', description: 'Precision fuel system components engineered for high-horsepower builds, from injectors to complete fuel delivery solutions.', descriptionUA: 'Прецизійні компоненти паливної системи для потужних збірок, від форсунок до комплексних рішень подачі палива.', website: 'https://www.deatschwerks.com' },  { name: 'Dinan', description: 'Premier BMW performance tuner in North America, engineering comprehensive hardware and software solutions backed by a factory-matching warranty.', descriptionUA: 'Провідний тюнер BMW у Північній Америці, що розробляє комплексні апаратні та програмні рішення з гарантією, що відповідає заводській.', website: 'https://www.dinancars.com' },  { name: 'Dorch Engineering', description: 'Advanced fuel system engineering for turbocharged BMW platforms, delivering reliable fuel delivery for extreme power applications.', descriptionUA: 'Передова інженерія паливних систем для турбованих BMW, що забезпечує надійну подачу палива для екстремальних застосувань.', website: 'https://dorchengineering.com' },
  { name: 'Driveshaftshop', description: 'Motorsport-grade driveshafts and axles engineered to withstand extreme power, trusted by drag racers and track enthusiasts worldwide.', descriptionUA: 'Приводні вали та півосі гоночного рівня, розроблені витримувати екстремальну потужність, яким довіряють дрег-рейсери та трекові ентузіасти.', website: 'https://www.driveshaftshop.com' },
  { name: 'Duke Dynamics', description: 'Aggressive wide-body kits and aerodynamic components that transform supercars into track-focused weapons with motorsport DNA.', descriptionUA: 'Агресивні розширювачі кузова та аеродинамічні компоненти, що перетворюють суперкари на трекові снаряди з гоночним ДНК.', website: 'https://dukedynamics.com' },
  { name: 'Eterna Motorworks', description: 'Bespoke carbon fiber bodywork and aerodynamic components for exotic vehicles, handcrafted with meticulous attention to detail.', descriptionUA: 'Ексклюзивні карбонові кузовні панелі та аеродинамічні компоненти для екзотичних автомобілів, виготовлені вручну з увагою до деталей.', website: 'https://www.eternamotorworks.com' },
  { name: 'Fabspeed', description: 'Premium exhaust systems and performance tuning for exotic European vehicles, unleashing the true potential of Porsche, Ferrari, and Lamborghini.', descriptionUA: 'Преміальні вихлопні системи та тюнінг для екзотичних європейських авто, що розкривають справжній потенціал Porsche, Ferrari та Lamborghini.', website: 'https://www.fabspeed.com' },
  { name: 'Fall-Line Motorsports', description: 'Professional BMW tuning and motorsport preparation, delivering track-proven performance solutions with decades of racing experience.', descriptionUA: 'Професійний тюнінг та підготовка BMW до автоспорту, перевірені на треку рішення з десятиліттями гоночного досвіду.', website: 'https://www.fall-linemotorsports.com' },
  { name: 'Fore Innovations', description: 'Industry-leading fuel system components and surge tanks, engineered for reliable fuel delivery in high-performance and racing applications.', descriptionUA: 'Провідні компоненти паливних систем та накопичувальні баки для надійної подачі палива у високопродуктивних та гоночних застосуваннях.', website: 'https://www.foreinnovations.com' },
  { name: 'Fragola Performance Systems', description: 'Premium AN fittings and fuel system plumbing, trusted by professional racing teams for leak-free performance under pressure.', descriptionUA: 'Преміальні AN-фітинги та паливні магістралі, яким довіряють професійні гоночні команди за герметичну роботу під тиском.', website: 'https://www.fragolaperformance.com' },
  { name: 'Full-Race', description: 'Complete turbo systems and exhaust manifolds engineered for maximum power, supporting builds from street performance to full race.', descriptionUA: 'Комплексні турбо-системи та випускні колектори для максимальної потужності, підтримка збірок від вуличних до повністю гоночних.', website: 'https://www.full-race.com' },
  { name: 'Girodisc', description: 'Precision two-piece brake rotors designed for optimal cooling and consistent performance in high-demand track and street applications.', descriptionUA: 'Прецизійні двокомпонентні гальмівні диски для оптимального охолодження та стабільної продуктивності на треку та вулиці.', website: 'https://girodisc.com' },
  { name: 'GTHaus', description: 'Luxury exhaust systems crafted for BMW M vehicles, delivering an intoxicating soundtrack and refined performance enhancement.', descriptionUA: 'Розкішні вихлопні системи для BMW M, що забезпечують захоплюючий звук та вишукане покращення продуктивності.', website: 'https://www.gthaus.com' },
  { name: 'HRE wheels', description: 'The pinnacle of forged wheel craftsmanship, engineering lightweight masterpieces that define automotive excellence and racing heritage.', descriptionUA: 'Вершина майстерності кованих дисків, легкі шедеври, що визначають автомобільну досконалість та гоночну спадщину.', website: 'https://www.hrewheels.com' },
  { name: 'Injector Dynamics', description: 'Precision fuel injectors engineered for accurate fuel delivery across all operating conditions, from idle to wide-open throttle.', descriptionUA: 'Прецизійні паливні форсунки для точної подачі палива у всіх режимах роботи, від холостого ходу до повного газу.', website: 'https://injectordynamics.com' },
  { name: 'Integrated Engineering', description: 'High-performance software and hardware solutions for VW and Audi, specializing in intake manifolds, connecting rods, and ECU tuning.', descriptionUA: 'Високопродуктивні програмні та апаратні рішення для VW та Audi, спеціалізація на впускних колекторах, шатунах та тюнінгу ECU.', website: 'https://performancebyie.com' },
  { name: 'JXB Performance', description: 'High-performance transmission and differential components, delivering bulletproof drivetrain solutions for serious power applications.', descriptionUA: 'Високопродуктивні компоненти трансмісії та диференціалів, надійні рішення приводу для серйозних потужних застосувань.', website: 'https://jxbperformance.com' },
  { name: 'Killer B Motorsport', description: 'Precision-engineered Subaru performance parts, from oil pickup systems to complete engine builds for demanding applications.', descriptionUA: 'Прецизійні деталі для Subaru, від систем маслозабору до повних збірок двигунів для вимогливих застосувань.', website: 'https://www.killerbmotorsport.com' },
  { name: 'KLM Race', description: 'Advanced turbo systems and engine components for serious power builds, trusted by record-setting drag racers and time attack competitors.', descriptionUA: 'Передові турбо-системи та компоненти двигуна для серйозних потужних збірок, яким довіряють рекордні дрег-рейсери та тайм-атаківці.', website: 'https://klmrace.com' },
  { name: 'Kooks Headers', description: 'American-made stainless steel headers and exhaust systems, delivering performance gains and an aggressive exhaust note for muscle cars.', descriptionUA: 'Американські нержавіючі колектори та вихлопні системи, що забезпечують приріст потужності та агресивний звук для маслкарів.', website: 'https://www.kooksheaders.com' },
  { name: 'Lingenfelter', description: 'Legendary Corvette and GM performance specialists with decades of engineering excellence, creating some of America\'s fastest street cars.', descriptionUA: 'Легендарні спеціалісти Corvette та GM з десятиліттями інженерної досконалості, що створюють найшвидші американські вуличні автомобілі.', website: 'https://www.lingenfelter.com' },
  { name: 'Mickey Thompson', description: 'Iconic drag racing tire manufacturer with a rich motorsport heritage, delivering proven traction for street and strip performance.', descriptionUA: 'Легендарний виробник гумових шин для дрег-рейсингу з багатою гоночною спадщиною, перевірене зчеплення для вулиці та стріпу.', website: 'https://www.mickeythompsontires.com' },
  { name: 'Motiv Motorsport', description: 'Precision fuel system components and performance accessories engineered for reliable operation in high-horsepower applications.', descriptionUA: 'Прецизійні компоненти паливної системи та аксесуари для надійної роботи у високопотужних застосуваннях.', website: 'https://motivmotorsport.com' },
  { name: 'Moser Engineering', description: 'Premium axles, differentials, and drivetrain components built for extreme durability in drag racing and high-performance street applications.', descriptionUA: 'Преміальні півосі, диференціали та компоненти приводу для екстремальної довговічності в дрег-рейсингу та на вулиці.', website: 'https://www.moserengineering.com' },
  { name: 'Mountune', description: 'Official Ford Performance partner delivering factory-quality upgrades and tuning packages for Focus, Fiesta, and Mustang platforms.', descriptionUA: 'Офіційний партнер Ford Performance, що забезпечує заводську якість апгрейдів та тюнінг-пакетів для Focus, Fiesta та Mustang.', website: 'https://www.mountune.com' },
  { name: 'MV Forged', description: 'Custom forged wheels featuring unique designs and premium finishes, crafted for luxury vehicles and exotic supercars.', descriptionUA: 'Ковані диски на замовлення з унікальними дизайнами та преміальними покриттями для розкішних автомобілів та екзотичних суперкарів.', website: 'https://mvforged.com' },
  { name: 'Paragon brakes', description: 'Track-developed brake upgrades and components delivering consistent performance and superior fade resistance for demanding driving.', descriptionUA: 'Трекові гальмівні апгрейди та компоненти, що забезпечують стабільну продуктивність та чудову стійкість до перегріву.', website: 'https://paragonperformancebrakes.com' },
  { name: 'Paramount transmissions', description: 'Expert transmission building and performance upgrades for ZF automatic transmissions, delivering smooth shifts under extreme power.', descriptionUA: 'Експертна збірка трансмісій та апгрейди для АКПП ZF, що забезпечують плавні перемикання при екстремальній потужності.', website: 'https://www.paramountperformanceproducts.com' },
  { name: 'Premier Tuning Group', description: 'Elite Mercedes-Benz performance specialists, engineering comprehensive power packages that elevate AMG vehicles to new heights.', descriptionUA: 'Елітні спеціалісти Mercedes-Benz, що розробляють комплексні пакети потужності для підняття автомобілів AMG на новий рівень.', website: 'https://premiertuninggroup.com' },
  { name: 'Project 6GR', description: 'Lightweight flow-formed wheels designed specifically for Ford Mustang, optimizing performance and aggressive stance.', descriptionUA: 'Легкі литі диски, розроблені спеціально для Ford Mustang, що оптимізують продуктивність та агресивну посадку.', website: 'https://project6gr.com' },
  { name: 'Pure Drivetrain Solutions', description: 'Specialized ZF transmission upgrades and rebuilds, delivering enhanced reliability and performance for BMW and high-powered vehicles.', descriptionUA: 'Спеціалізовані апгрейди та ребілди трансмісій ZF для підвищення надійності та продуктивності BMW та потужних автомобілів.', website: 'https://puredrivetrain.com' },
  { name: 'Pure Turbos', description: 'Drop-in turbo upgrades engineered for significant power gains while maintaining factory reliability and drivability.', descriptionUA: 'Турбо-апгрейди прямої заміни для значного приросту потужності зі збереженням заводської надійності та керованості.', website: 'https://www.pureturbos.com' },
  { name: 'Renntech', description: 'The ultimate Mercedes-Benz tuning authority, engineering comprehensive performance packages that transform AMG vehicles into supercars.', descriptionUA: 'Найвищий авторитет тюнінгу Mercedes-Benz, комплексні пакети продуктивності, що перетворюють AMG на суперкари.', website: 'https://www.renntechmercedes.com' },
  { name: 'RK Autowerks', description: 'BMW turbo specialists delivering quality upgrade packages and tuning solutions for N54, N55, and S55 powered vehicles.', descriptionUA: 'Спеціалісти з турбо BMW, що пропонують якісні апгрейди та тюнінг для автомобілів з двигунами N54, N55 та S55.', website: 'https://rkautowerks.com' },
  { name: 'RPM Transmissions', description: 'High-performance manual and sequential transmission builds engineered for racing applications and extreme power levels.', descriptionUA: 'Високопродуктивні механічні та секвентальні трансмісії для гоночних застосувань та екстремальних рівнів потужності.', website: 'https://rpmtransmissions.com' },
  { name: 'RKP', description: 'Premium carbon fiber aerodynamic components for BMW, delivering motorsport-inspired styling with functional performance benefits.', descriptionUA: 'Преміальні карбонові аеродинамічні компоненти для BMW, гоночний стиль з функціональними перевагами продуктивності.', website: 'https://rkpcomposites.com' },
  { name: 'RW Carbon', description: 'Affordable carbon fiber styling components and aerodynamic upgrades, bringing the look of luxury modifications to enthusiasts.', descriptionUA: 'Доступні карбонові стилістичні компоненти та аеродинамічні апгрейди, що привносять вигляд розкішних модифікацій.', website: 'https://www.rwcarbon.com' },
  { name: 'RYFT', description: 'Handcrafted titanium exhaust systems for exotic supercars, delivering exceptional weight savings and an unforgettable acoustic experience.', descriptionUA: 'Титанові вихлопні системи ручної роботи для екзотичних суперкарів, виняткове зменшення ваги та незабутній акустичний досвід.', website: 'https://ryft.co' },
  { name: 'Seibon Carbon', description: 'Industry-leading carbon fiber body panels and aerodynamic components, offering OEM-quality fitment at competitive pricing.', descriptionUA: 'Провідні карбонові кузовні панелі та аеродинамічні компоненти з посадкою заводської якості за конкурентними цінами.', website: 'https://www.seibon.com' },
  { name: 'ShepTrans', description: 'Expert transmission rebuilding and performance upgrades, specializing in automatic transmissions for drag racing and street performance.', descriptionUA: 'Експертний ребілд трансмісій та апгрейди, спеціалізація на АКПП для дрег-рейсингу та вуличної продуктивності.', website: 'https://sheptrans.com' },
  { name: 'Silly Rabbit Motorsport', description: 'Comprehensive tuning solutions and performance parts for VAG platforms, delivering proven power gains and driving excitement.', descriptionUA: 'Комплексні рішення тюнінгу та деталі для платформ VAG, що забезпечують перевірений приріст потужності та задоволення від водіння.', website: 'https://sillyrabbitmotorsport.com' },
  { name: 'Southern Hotrod', description: 'Specialized transmission and torque converter builds for GM vehicles, engineered to handle extreme power in drag racing applications.', descriptionUA: 'Спеціалізовані збірки трансмісій та гідротрансформаторів для GM, розроблені витримувати екстремальну потужність у дрег-рейсингу.', website: 'https://www.southernhotrod.com' },
  { name: 'Spool Performance', description: 'Advanced fuel system components and billet accessories engineered for maximum reliability in high-boost turbocharged applications.', descriptionUA: 'Передові компоненти паливних систем та фрезеровані аксесуари для максимальної надійності у високобустових застосуваннях.', website: 'https://spoolperformance.com' },
  { name: 'SPL Parts', description: 'Precision suspension components and adjustable arms, allowing perfect alignment setup for track performance and aggressive fitments.', descriptionUA: 'Прецизійні компоненти підвіски та регульовані важелі для ідеального налаштування на треку та агресивних посадок.', website: 'https://www.splparts.com' },
  { name: 'Strasse wheels', description: 'Luxurious forged wheels featuring distinctive designs and impeccable craftsmanship for discerning automotive enthusiasts.', descriptionUA: 'Розкішні ковані диски з характерними дизайнами та бездоганною майстерністю для вимогливих автомобільних ентузіастів.', website: 'https://strassewheels.com' },
  { name: 'Stoptech', description: 'High-performance brake systems developed through motorsport engineering, delivering consistent stopping power for street and track.', descriptionUA: 'Високопродуктивні гальмівні системи, розроблені через гоночну інженерію, стабільна гальмівна потужність для вулиці та треку.', website: 'https://www.stoptech.com' },
  { name: 'Stillen', description: 'Comprehensive Nissan and Infiniti performance specialists, offering complete tuning solutions from intake to exhaust.', descriptionUA: 'Комплексні спеціалісти з Nissan та Infiniti, що пропонують повні рішення тюнінгу від впуску до вихлопу.', website: 'https://www.stillen.com' },
  { name: 'Titan Motorsport', description: 'Professional-grade engine and drivetrain components engineered for serious motorsport applications and high-power street builds.', descriptionUA: 'Професійні компоненти двигуна та приводу для серйозного автоспорту та потужних вуличних збірок.', website: 'https://www.titanmotorsports.com' },
  { name: 'TireRack', description: 'America\'s premier destination for tires and wheels, offering expert guidance and an extensive selection for all applications.', descriptionUA: 'Преміальний американський постачальник шин та дисків з експертними консультаціями та широким вибором для всіх застосувань.', website: 'https://www.tirerack.com' },
  { name: 'Turner Motorsport', description: 'BMW racing specialists with championship pedigree, offering performance parts developed through decades of track success.', descriptionUA: 'Гоночні спеціалісти BMW з чемпіонською родословною, деталі продуктивності, розроблені через десятиліття трекових успіхів.', website: 'https://www.turnermotorsport.com' },
  { name: 'Vargas Turbo', description: 'BMW turbo technology specialists offering upgraded turbochargers and supporting modifications for significant power gains.', descriptionUA: 'Спеціалісти з турбо-технологій BMW, що пропонують оновлені турбіни та підтримуючі модифікації для значного приросту потужності.', website: 'https://vargasturbo.com' },
  { name: 'Velos Wheels', description: 'Bespoke forged wheels handcrafted to exact specifications, combining engineering excellence with artistic design vision.', descriptionUA: 'Ексклюзивні ковані диски ручної роботи за точними специфікаціями, поєднуючи інженерну досконалість з художнім баченням дизайну.', website: 'https://velosdesignwerks.com' },
  { name: 'Verus Engineering', description: 'Engineering-focused aerodynamics and cooling solutions, utilizing CFD validation and carbon composites to deliver functional downforce for track enthusiasts.', descriptionUA: 'Інженерно-орієнтовані рішення з аеродинаміки та охолодження, що використовують CFD-валідацію та вуглецеві композити для забезпечення функціональної притискної сили для трекових ентузіастів.', website: 'https://www.verus-engineering.com' },
  { name: 'VF Engineering', description: 'Supercharger systems and performance packages for exotic vehicles, delivering proven power gains with OEM-level reliability.', descriptionUA: 'Компресорні системи та пакети продуктивності для екзотичних авто, перевірений приріст потужності з надійністю заводського рівня.', website: 'https://vfengineering.com' },
  { name: 'VP Racing Fuel', description: 'The world leader in race fuel technology, providing championship-winning fuels optimized for maximum performance and power.', descriptionUA: 'Світовий лідер у технології гоночного палива, чемпіонські палива, оптимізовані для максимальної продуктивності та потужності.', website: 'https://vpracingfuels.com' },
  { name: 'Vorsteiner', description: 'Premium carbon fiber aerodynamics and forged wheels, transforming luxury vehicles with motorsport-inspired engineering excellence.', descriptionUA: 'Преміальна карбонова аеродинаміка та ковані диски, що трансформують розкішні авто з гоночною інженерною досконалістю.', website: 'https://vorsteiner.com' },
  { name: 'Wavetrac', description: 'Advanced limited-slip differential technology delivering superior traction and predictable handling in all driving conditions.', descriptionUA: 'Передова технологія диференціалів підвищеного тертя для чудового зчеплення та передбачуваної керованості в усіх умовах.', website: 'https://www.wavetrac.net' },
  { name: 'Weistec Engineering', description: 'The authority in Mercedes-AMG performance, engineering comprehensive supercharger and turbo packages that redefine power limits.', descriptionUA: 'Авторитет у продуктивності Mercedes-AMG, комплексні компресорні та турбо-пакети, що переосмислюють межі потужності.', website: 'https://www.weistec.com' },
  { name: 'Whipple Superchargers', description: 'Twin-screw supercharger excellence delivering massive power gains with outstanding drivability and factory-like reliability.', descriptionUA: 'Досконалість двогвинтових компресорів, що забезпечують масивний приріст потужності з чудовою керованістю та заводською надійністю.', website: 'https://www.whipplesuperchargers.com' },
  { name: 'XDI fuel systems', description: 'Advanced direct injection fuel system components engineered for reliable operation in extreme high-boost applications.', descriptionUA: 'Передові компоненти паливних систем прямого вприскування для надійної роботи в екстремальних високобустових застосуваннях.', website: 'https://xtreme-di.com' },
];

export const brandsEurope: LocalBrand[] = [
  { name: '3D Design', description: 'Japanese precision aerodynamics for BMW, delivering elegant carbon fiber components that enhance both aesthetics and performance.', descriptionUA: 'Японська прецизійна аеродинаміка для BMW, що пропонує елегантні карбонові компоненти для покращення естетики та продуктивності.', website: 'https://www.3ddesign.jp' },
  { name: 'ABT', description: 'Legendary German tuning house transforming Audi and VW vehicles with comprehensive performance packages and distinctive styling.', descriptionUA: 'Легендарний німецький тюнінг-ательє, що трансформує Audi та VW комплексними пакетами продуктивності та характерним стилем.', website: 'https://www.abt-sportsline.com' },
  { name: 'AC Schnitzer', description: 'German engineering excellence for BMW and MINI, creating performance upgrades that maintain factory refinement and reliability.', descriptionUA: 'Німецька інженерна досконалість для BMW та MINI, апгрейди продуктивності, що зберігають заводську вишуканість та надійність.', website: 'https://www.ac-schnitzer.de' },
  { name: 'ADRO', description: 'Korean aerodynamic design studio creating bold, aggressive body kits and carbon fiber components for modern sports cars.', descriptionUA: 'Корейська студія аеродинамічного дизайну, що створює сміливі, агресивні бодікіти та карбонові компоненти для сучасних спорткарів.', website: 'https://www.adro.com' },
  { name: 'Akrapovic', description: 'Slovenian exhaust engineering mastery, crafting titanium and carbon fiber systems that deliver championship-winning performance and sound.', descriptionUA: 'Словенська майстерність вихлопних систем, титанові та карбонові системи, що забезпечують чемпіонську продуктивність та звук.', website: 'https://www.akrapovic.com' },
  { name: 'Alpha-N', description: 'German carbon fiber specialists creating lightweight aerodynamic components that combine motorsport function with elegant design.', descriptionUA: 'Німецькі спеціалісти з карбону, що створюють легкі аеродинамічні компоненти, поєднуючи гоночну функціональність з елегантним дизайном.', website: 'https://alpha-n.de' },
  { name: 'ARMA Speed', description: 'Taiwanese carbon fiber intake systems engineered for optimal airflow and stunning under-hood aesthetics.', descriptionUA: 'Тайванські карбонові впускні системи, розроблені для оптимального повітряного потоку та приголомшливої естетики підкапотного простору.', website: 'https://www.armaspeed.com' },
  { name: 'Armytrix', description: 'Taiwanese exhaust innovation featuring valvetronic technology, delivering adjustable sound profiles from refined to aggressive.', descriptionUA: 'Тайванська інновація вихлопних систем з вальветронною технологією, регульовані звукові профілі від вишуканих до агресивних.', website: 'https://www.armytrix.com' },
  { name: 'Black Boost', description: 'UAE-based Mercedes tuning specialists delivering comprehensive performance upgrades for AMG vehicles in the Middle East market.', descriptionUA: 'Спеціалісти з тюнінгу Mercedes з ОАЕ, комплексні апгрейди продуктивності для автомобілів AMG на ринку Близького Сходу.', website: 'https://blackboost.ae' },
  { name: 'BMC filters', description: 'Italian air filter excellence providing motorsport-proven filtration technology for enhanced engine breathing and performance.', descriptionUA: 'Італійська досконалість повітряних фільтрів з гоночною технологією фільтрації для покращеного дихання двигуна та продуктивності.', website: 'https://www.bmcairfilters.com' },
  { name: 'Brabus', description: 'The ultimate Mercedes-Benz transformation specialists, engineering extreme power and luxury refinements that push boundaries.', descriptionUA: 'Найвищі спеціалісти трансформації Mercedes-Benz, екстремальна потужність та розкішні вдосконалення, що розширюють межі.', website: 'https://www.brabus.com' },
  { name: 'Brembo', description: 'Italian braking excellence trusted by Formula 1 and supercar manufacturers, delivering uncompromising stopping power and control.', descriptionUA: 'Італійська гальмівна досконалість, якій довіряють у Формулі-1 та виробники суперкарів, безкомпромісна гальмівна потужність.', website: 'https://www.brembo.com' },
  { name: 'BC Racing', description: 'Taiwanese coilover suspension systems offering adjustable performance at accessible pricing for street and track enthusiasts.', descriptionUA: 'Тайванські койловери з регульованою продуктивністю за доступною ціною для вуличних та трекових ентузіастів.', website: 'https://www.bcracing-na.com' },
  { name: 'Capristo', description: 'German exhaust artistry crafting premium systems for exotic supercars, delivering exhilarating sound and performance gains.', descriptionUA: 'Німецьке мистецтво вихлопних систем для екзотичних суперкарів, захоплюючий звук та приріст продуктивності.', website: 'https://capristo.de' },
  { name: 'Cobra Sport', description: 'British-made performance exhausts, engineered to deliver increased power, reduced weight, and a deep, aggressive exhaust note.', descriptionUA: 'Британські продуктивні вихлопи, розроблені для збільшення потужності, зменшення ваги та глибокого, агресивного вихлопного звуку.', website: 'https://cobrasport.com' },
  { name: 'CT Carbon', description: 'British carbon fiber specialists creating high-quality aerodynamic components with exceptional fitment and finish quality.', descriptionUA: 'Британські спеціалісти з карбону, що створюють високоякісні аеродинамічні компоненти з винятковою посадкою та якістю покриття.', website: 'https://www.ct-carbon.co.uk' },
  { name: 'Dahler', description: 'Swiss-German precision tuning for BMW and MINI, delivering comprehensive performance packages with meticulous attention to detail.', descriptionUA: 'Швейцарсько-німецький прецизійний тюнінг для BMW та MINI, комплексні пакети продуктивності з увагою до деталей.', website: 'https://www.dahler.com' },
  { name: 'DMC', description: 'German luxury tuning house specializing in exotic supercar transformations with bold carbon fiber aerodynamics and bespoke interiors.', descriptionUA: 'Німецький тюнінг-ательє, що спеціалізується на трансформації екзотичних суперкарів з карбоновою аеродинамікою та ексклюзивними інтерєрами.', website: 'https://dmc.ag' },
  { name: 'do88', description: 'Swedish cooling specialists engineering high-performance intercoolers, radiators, and silicone hoses for demanding applications.', descriptionUA: 'Шведські спеціалісти з охолодження, високопродуктивні інтеркулери, радіатори та силіконові шланги для вимогливих застосувань.', website: 'https://www.do88.se' },
  { name: 'DTE Systems', description: 'German chip tuning excellence providing plug-and-play performance boxes that safely unlock additional power and torque.', descriptionUA: 'Німецька досконалість чіп-тюнінгу, блоки продуктивності plug-and-play, що безпечно розблоковують додаткову потужність та крутний момент.', website: 'https://www.dte-systems.com' },
  { name: 'ESS Tuning', description: 'Norwegian BMW specialists renowned for supercharger systems that deliver reliable, substantial power gains with daily drivability.', descriptionUA: 'Норвезькі спеціалісти BMW, відомі компресорними системами, що забезпечують надійний приріст потужності зі щоденною керованістю.', website: 'https://www.esstuning.com' },
  { name: 'Eventuri', description: 'British intake innovation featuring unique carbon fiber designs that maximize airflow while creating stunning visual impact.', descriptionUA: 'Британська інновація впусків з унікальними карбоновими дизайнами, що максимізують повітряний потік та створюють приголомшливий візуальний ефект.', website: 'https://eventuri.shop/' },
  { name: 'FI Exhaust', description: 'Taiwanese exhaust engineering excellence featuring advanced valvetronic systems and distinctive sound profiles for exotic vehicles.', descriptionUA: 'Тайванська інженерна досконалість вихлопних систем з вальветронними системами та характерними звуковими профілями для екзотичних авто.', website: 'https://fiexhaust.shop/' },
  { name: 'Gruppe-M', description: 'Japanese intake perfection combining carbon fiber artistry with performance engineering for ultimate engine breathing.', descriptionUA: 'Японська досконалість впусків, що поєднує карбонове мистецтво з інженерією продуктивності для максимального дихання двигуна.', website: 'https://www.gruppem.co.jp/en' },
  { name: 'Hamann', description: 'German luxury tuning specialists transforming BMW, Ferrari, and Range Rover with distinctive styling and performance upgrades.', descriptionUA: 'Німецькі спеціалісти розкішного тюнінгу, що трансформують BMW, Ferrari та Range Rover характерним стилем та апгрейдами продуктивності.', website: 'https://www.hamann-motorsport.de' },
  { name: 'Heico', description: 'German Volvo tuning authority delivering comprehensive performance and styling packages that enhance Scandinavian engineering.', descriptionUA: 'Німецький авторитет тюнінгу Volvo, комплексні пакети продуктивності та стайлінгу, що покращують скандинавську інженерію.', website: 'https://www.heicosportiv.de' },
  { name: 'Hardrace', description: 'Taiwanese suspension components engineered for precise handling and durability in demanding street and track conditions.', descriptionUA: 'Тайванські компоненти підвіски для точної керованості та довговічності у вимогливих вуличних та трекових умовах.', website: 'https://www.hardrace.com' },
  { name: 'Harrop', description: 'Australian supercharger specialists engineering proven forced induction systems that deliver massive power gains with reliability.', descriptionUA: 'Австралійські спеціалісти з компресорів, перевірені системи наддуву, що забезпечують масивний приріст потужності з надійністю.', website: 'https://www.harrop.com.au' },
  { name: 'iPE exhaust', description: 'Taiwanese exhaust innovation featuring valvetronic technology and titanium construction for ultimate sound and weight reduction.', descriptionUA: 'Тайванська інновація вихлопних систем з вальветронною технологією та титановою конструкцією для звуку та зменшення ваги.', website: 'https://www.ipe-innotech.com' },
  { name: 'ItalianRP', description: 'Italian engine specialists delivering precision cylinder head porting and performance builds for exotic European vehicles.', descriptionUA: 'Італійські спеціалісти з двигунів, прецизійне портування головок та збірки продуктивності для екзотичних європейських авто.', website: 'https://www.italianrp.it' },
  { name: 'KAHN design', description: 'British luxury automotive design creating bespoke wheel designs and comprehensive vehicle transformation packages.', descriptionUA: 'Британський розкішний автомобільний дизайн, ексклюзивні дизайни дисків та комплексні пакети трансформації автомобілів.', website: 'https://www.kahndesign.com' },
  { name: 'Karbonius', description: 'Spanish carbon fiber artisans crafting motorsport-derived components for BMW M vehicles with exceptional quality and fitment.', descriptionUA: 'Іспанські карбонові майстри, що створюють гоночні компоненти для BMW M з винятковою якістю та посадкою.', website: 'https://karbonius.net' },
  { name: 'Keyvany', description: 'German luxury tuning atelier transforming exotic supercars with dramatic carbon fiber aerodynamics and bespoke refinements.', descriptionUA: 'Німецьке розкішне тюнінг-ательє, що трансформує екзотичні суперкари драматичною карбоновою аеродинамікою та ексклюзивними вдосконаленнями.', website: 'https://keyvany.com' },
  { name: 'Kline Innovation', description: 'Romanian exhaust craftsmanship creating premium systems for exotic vehicles with exceptional sound and performance characteristics.', descriptionUA: 'Румунська майстерність вихлопних систем для екзотичних автомобілів з винятковими звуковими та продуктивними характеристиками.', website: 'https://klineinnovation.com' },
  { name: 'KW Suspension', description: 'German suspension engineering excellence delivering adjustable coilovers trusted by professional motorsport teams worldwide.', descriptionUA: 'Німецька інженерна досконалість підвісок, регульовані койловери, яким довіряють професійні гоночні команди світу.', website: 'https://kwsuspension.shop/' },
  { name: 'Lamspeed', description: 'Australian turbo specialists engineering high-performance upgrade kits and custom turbo solutions for serious power builds.', descriptionUA: 'Австралійські спеціалісти з турбо, високопродуктивні кіти апгрейдів та кастомні турбо-рішення для серйозних потужних збірок.', website: 'https://www.lamspeed.com.au' },
  { name: 'Larte Design', description: 'German aerodynamic design studio creating bold body kits and carbon fiber components for luxury SUVs and supercars.', descriptionUA: 'Німецька студія аеродинамічного дизайну, сміливі бодікіти та карбонові компоненти для розкішних SUV та суперкарів.', website: 'https://larte-design.com' },
  { name: 'Liberty Walk', description: 'Japanese wide-body revolution creating dramatic fender flares and aggressive styling that defines modern car culture.', descriptionUA: 'Японська революція широкого кузова, драматичні розширювачі та агресивний стайлінг, що визначає сучасну автокультуру.', website: 'https://libertywalk.co.jp' },
  { name: 'LOBA Motorsport', description: 'German VAG specialists engineering upgraded turbochargers and performance components that deliver substantial power gains.', descriptionUA: 'Німецькі спеціалісти VAG, оновлені турбіни та компоненти продуктивності, що забезпечують суттєвий приріст потужності.', website: 'https://www.loba-motorsport.com' },
  { name: 'Lorinser', description: 'German Mercedes-Benz tuning tradition delivering comprehensive styling and performance packages with decades of heritage.', descriptionUA: 'Німецька традиція тюнінгу Mercedes-Benz, комплексні пакети стайлінгу та продуктивності з десятиліттями спадщини.', website: 'https://www.lorinser.com' },
  { name: 'Lumma', description: 'German luxury tuning specialists creating dramatic visual transformations for Range Rover and BMW vehicles.', descriptionUA: 'Німецькі спеціалісти розкішного тюнінгу, драматичні візуальні трансформації для Range Rover та BMW.', website: 'https://www.lumma-design.com' },
  { name: 'Manhart', description: 'German performance specialists engineering extreme power packages that push BMW, Mercedes, and supercar limits to new heights.', descriptionUA: 'Німецькі спеціалісти продуктивності, екстремальні пакети потужності, що підіймають BMW, Mercedes та суперкари на нові висоти.', website: 'https://manhart-performance.de' },
  { name: 'Mansory', description: 'German ultra-luxury tuning house creating the most exclusive vehicle transformations with carbon fiber mastery and bespoke craftsmanship.', descriptionUA: 'Німецький ультрарозкішний тюнінг-ательє, найексклюзивніші трансформації авто з карбоновою майстерністю та ексклюзивним ремеслом.', website: 'https://www.mansory.com' },
  { name: 'Mamba turbo', description: 'Taiwanese turbocharger specialists producing high-quality upgrade units that deliver reliable performance at competitive pricing.', descriptionUA: 'Тайванські спеціалісти з турбін, що виробляють якісні апгрейди з надійною продуктивністю за конкурентними цінами.', website: 'https://mambaturbo.com' },
  { name: "Matt's carbon", description: 'Polish carbon fiber craftsmen creating premium aerodynamic components with motorsport-derived quality and precision.', descriptionUA: 'Польські майстри карбону, що створюють преміальні аеродинамічні компоненти з гоночною якістю та точністю.', website: 'https://mattscarbon.com' },
  { name: 'Milltek', description: 'British exhaust excellence delivering performance systems with sophisticated sound engineering for European vehicles.', descriptionUA: 'Британська вихлопна досконалість, системи продуктивності з витонченою звуковою інженерією для європейських авто.', website: 'https://www.millteksport.com' },
  { name: 'MST Performance', description: 'Taiwanese intake specialists creating carbon fiber and aluminum cold air systems that maximize engine performance.', descriptionUA: 'Тайванські спеціалісти впусків, карбонові та алюмінієві системи холодного впуску для максимальної продуктивності двигуна.', website: 'https://www.mst-performance.com' },
  { name: 'Novitec', description: 'German supercar specialists transforming Ferrari, Lamborghini, and McLaren with comprehensive performance and styling packages.', descriptionUA: 'Німецькі спеціалісти суперкарів, що трансформують Ferrari, Lamborghini та McLaren комплексними пакетами продуктивності та стайлінгу.', website: 'https://www.novitecgroup.com' },
  { name: 'Nitron Suspension', description: 'British suspension engineering delivering race-proven dampers and coilover systems for track-focused performance enthusiasts.', descriptionUA: 'Британська інженерія підвісок, перевірені на гонках амортизатори та койловери для ентузіастів трекової продуктивності.', website: 'https://www.nitron.co.uk' },
  { name: 'ONE COMPANY forged', description: 'Ukrainian premium forged wheel manufacturer crafting bespoke designs with European quality standards and competitive pricing.', descriptionUA: 'Український виробник преміальних кованих дисків, ексклюзивні дизайни з європейськими стандартами якості та конкурентними цінами.', website: 'https://one-company.com.ua' },
  { name: 'Onyx Concept', description: 'British luxury vehicle transformation specialists creating comprehensive body kits and performance packages for Range Rover and supercars.', descriptionUA: 'Британські спеціалісти трансформації розкішних авто, комплексні бодікіти та пакети продуктивності для Range Rover та суперкарів.', website: 'https://www.onyxconcept.com' },
  { name: 'Paktechz Design', description: 'High-end exterior modification brand crafting carbon fiber body kits and aerodynamic styling for supercars and luxury vehicles.', descriptionUA: 'Бренд преміальних обвісів, що створює карбонові бодікіти та аеродинамічний стайлінг для суперкарів і розкішних авто.', website: 'https://www.paktechz.com' },
  { name: 'Power Division', description: 'Polish VAG tuning specialists delivering high-quality performance upgrades and comprehensive tuning solutions for enthusiast builds.', descriptionUA: 'Польські спеціалісти з тюнінгу VAG, високоякісні апгрейди та комплексні рішення тюнінгу для ентузіастів.', website: 'https://power-division.pl' },
  { name: 'ProTrack Wheels', description: 'German wheel manufacturer producing lightweight flow-formed and forged wheels optimized for track performance and aggressive styling.', descriptionUA: 'Німецький виробник дисків, легкі литі та ковані диски, оптимізовані для трекової продуктивності та агресивного стайлінгу.', website: 'https://protrackwheels.de' },
  { name: 'Pulsar turbo', description: 'Chinese turbocharger manufacturer producing high-performance upgrade units with modern aerodynamics and reliable construction.', descriptionUA: 'Китайський виробник турбін, високопродуктивні апгрейди з сучасною аеродинамікою та надійною конструкцією.', website: 'https://pulsarturbo.com' },
  { name: 'R44 Performance', description: 'British BMW specialists delivering quality performance parts and tuning solutions for the enthusiast community.', descriptionUA: 'Британські спеціалісти BMW, якісні деталі продуктивності та рішення тюнінгу для спільноти ентузіастів.', website: 'https://r44performance.com' },
  { name: 'Raliw Forged', description: 'Romanian forged wheel craftsmanship creating custom designs with premium materials and exceptional attention to detail.', descriptionUA: 'Румунська майстерність кованих дисків, кастомні дизайни з преміальних матеріалів та виняткова увага до деталей.', website: 'https://raliwforged.com' },
  { name: 'Remus', description: 'Austrian exhaust engineering heritage delivering refined performance systems with sophisticated sound character and quality construction.', descriptionUA: 'Австрійська спадщина вихлопної інженерії, вишукані системи продуктивності з витонченим звуком та якісною конструкцією.', website: 'https://www.remus.eu' },
  { name: 'RS-R', description: 'Japanese suspension specialists with decades of motorsport heritage, delivering adjustable coilovers and performance springs.', descriptionUA: 'Японські спеціалісти з підвісок з десятиліттями гоночної спадщини, регульовані койловери та спортивні пружини.', website: 'https://www.rs-r.com' },
  { name: 'Sachs Performance', description: 'German clutch and transmission specialists delivering motorsport-derived components for demanding performance applications.', descriptionUA: 'Німецькі спеціалісти зі зчеплень та трансмісій, гоночні компоненти для вимогливих продуктивних застосувань.', website: 'https://www.sachsperformance.com' },
  { name: 'Schrick', description: 'German engine component specialists manufacturing high-performance camshafts and valve train components for European engines.', descriptionUA: 'Німецькі спеціалісти компонентів двигуна, високопродуктивні розподілвали та компоненти клапанного механізму для європейських двигунів.', website: 'https://www.schrick.com' },
  { name: 'Sterckenn', description: 'Polish carbon fiber artisans creating motorsport-quality aerodynamic components for BMW M vehicles with exceptional precision.', descriptionUA: 'Польські карбонові майстри, аеродинамічні компоненти гоночної якості для BMW M з винятковою точністю.', website: 'https://sterckenn.com' },
  { name: 'STOPART ceramic', description: 'Chinese carbon-ceramic brake specialists providing high-performance braking solutions with significant weight reduction.', descriptionUA: 'Китайські спеціалісти з карбон-керамічних гальм, високопродуктивні гальмівні рішення зі значним зменшенням ваги.', website: 'http://www.stopartcn.com' },
  { name: 'STOPFLEX', description: 'Chinese carbon-ceramic brake manufacturer delivering premium braking performance at accessible pricing for performance enthusiasts.', descriptionUA: 'Китайський виробник карбон-керамічних гальм, преміальна гальмівна продуктивність за доступною ціною для ентузіастів.', website: 'https://stopflex-ccb.com' },
  { name: 'Supersprint', description: 'Italian exhaust craftsmanship with decades of motorsport heritage, delivering performance systems with distinctive Italian character.', descriptionUA: 'Італійська майстерність вихлопних систем з десятиліттями гоночної спадщини, системи продуктивності з характерним італійським характером.', website: 'https://www.supersprint.com' },
  { name: 'Tubi Style', description: 'Italian exhaust artistry creating premium systems for exotic supercars with unmistakable sound character and racing heritage.', descriptionUA: 'Італійське мистецтво вихлопних систем для екзотичних суперкарів з неповторним звуком та гоночною спадщиною.', website: 'https://www.tubistyle.it' },
  { name: 'TTH turbos', description: 'German turbo specialists creating custom and upgraded turbochargers for European performance vehicles.', descriptionUA: 'Німецькі спеціалісти з турбо, кастомні та оновлені турбіни для європейських спортивних автомобілів.', website: 'https://tth-turbo.de' },
  { name: 'Urban Automotive', description: 'British luxury vehicle specialists creating premium carbon fiber components and comprehensive packages for Range Rover and Mercedes.', descriptionUA: 'Британські спеціалісти розкішних авто, преміальні карбонові компоненти та комплексні пакети для Range Rover та Mercedes.', website: 'https://urbanautomotive.shop/' },
  { name: 'Wagner Tuning', description: 'German intercooler specialists engineering high-performance cooling solutions that maximize turbocharged engine efficiency.', descriptionUA: 'Німецькі спеціалісти з інтеркулерів, високопродуктивні рішення охолодження для максимальної ефективності турбованих двигунів.', website: 'https://www.wagner-tuning.com' },
  { name: 'WALD', description: 'Japanese luxury styling pioneers creating elegant body kits that blend aggressive presence with refined sophistication.', descriptionUA: 'Японські піонери розкішного стайлінгу, елегантні бодікіти, що поєднують агресивну присутність з вишуканою витонченістю.', website: 'https://www.wald.co.jp' },
  { name: 'WheelForce', description: 'German wheel manufacturer producing lightweight flow-formed wheels designed for optimal track performance and street presence.', descriptionUA: 'Німецький виробник дисків, легкі литі диски для оптимальної трекової продуктивності та вуличної присутності.', website: 'https://wheelforce.de' },
  { name: 'YPG', description: 'UAE-based performance specialists delivering comprehensive tuning solutions for high-performance vehicles in the Middle East market.', descriptionUA: 'Спеціалісти з продуктивності з ОАЕ, комплексні рішення тюнінгу для високопродуктивних авто на ринку Близького Сходу.', website: 'https://ypg.ae' },
  { name: 'Zacoe', description: 'Taiwanese carbon fiber specialists creating premium aerodynamic components with exceptional quality and aggressive styling.', descriptionUA: 'Тайванські спеціалісти з карбону, преміальні аеродинамічні компоненти з винятковою якістю та агресивним стайлінгом.', website: 'https://www.zacoe.com' },
];

export const brandsOem: LocalBrand[] = [
  { name: 'Aston Martin', description: 'British ultra-luxury grand touring manufacturer creating handcrafted masterpieces that blend timeless elegance with exhilarating performance.', descriptionUA: 'Британський ультра-розкішний виробник гранд-турерів, що створює рукотворні шедеври, поєднуючи вічну елегантність із захоплюючою продуктивністю.', website: 'https://www.astonmartin.com' },
  { name: 'Ferrari', description: 'The legendary Italian marque defining automotive passion with uncompromising performance, racing heritage, and iconic design excellence.', descriptionUA: 'Легендарна італійська марка, що визначає автомобільну пристрасть безкомпромісною продуктивністю, гоночною спадщиною та знаковою досконалістю дизайну.', website: 'https://www.ferrari.com' },
  { name: 'Lamborghini', description: 'Italian supercar icon creating dramatic, aggressive machines that push the boundaries of design and deliver breathtaking performance.', descriptionUA: 'Італійська ікона суперкарів, що створює драматичні, агресивні машини, які розширюють межі дизайну та забезпечують захоплюючу продуктивність.', website: 'https://www.lamborghini.com' },
  { name: 'Maserati', description: 'Historic Italian luxury manufacturer blending grand touring refinement with racing DNA and distinctive Mediterranean character.', descriptionUA: 'Історичний італійський виробник розкоші, що поєднує вишуканість гранд-турінгу з гоночним ДНК та характерним середземноморським характером.', website: 'https://www.maserati.com' },
  { name: 'McLaren', description: 'British Formula 1-derived supercar manufacturer engineering precision driving machines with uncompromising focus on performance and lightweight construction.', descriptionUA: 'Британський виробник суперкарів з коренями у Формулі-1, прецизійні машини з безкомпромісним фокусом на продуктивність та легкість конструкції.', website: 'https://www.mclaren.com' },
  { name: 'Rolls Royce', description: 'The pinnacle of automotive luxury and craftsmanship, creating bespoke motor cars that represent the ultimate expression of refinement and prestige.', descriptionUA: 'Вершина автомобільної розкоші та майстерності, ексклюзивні автомобілі, що втілюють найвищу вишуканість та престиж.', website: 'https://www.rolls-roycemotorcars.com' },
];

export const brandsRacing: LocalBrand[] = [
  { name: 'AIM Sportline', description: 'Professional-grade data acquisition and telemetry systems, providing championship-winning teams with precise performance analytics.', descriptionUA: 'Професійні системи збору даних та телеметрії, що забезпечують чемпіонські команди точною аналітикою продуктивності.', website: 'https://www.aim-sportline.com' },
  { name: 'ARE dry sump', description: 'Precision dry sump lubrication systems engineered for high-performance racing applications requiring sustained G-force reliability.', descriptionUA: 'Прецизійні системи мащення з сухим картером для гоночних застосувань, що вимагають надійності при тривалих перевантаженнях.', website: 'https://drysump.com' },
  { name: 'Bell Intercoolers', description: 'American intercooler specialists engineering high-efficiency cooling solutions for demanding motorsport and street performance applications.', descriptionUA: 'Американські спеціалісти з інтеркулерів, високоефективні рішення охолодження для вимогливих гоночних та вуличних застосувань.', website: 'https://bellintercoolers.com' },
  { name: 'Drenth Gearboxes', description: 'Dutch sequential gearbox specialists crafting motorsport transmissions renowned for bulletproof reliability and lightning-fast shifts.', descriptionUA: 'Голландські спеціалісти з секвентальних КПП, гоночні трансмісії, відомі бездоганною надійністю та блискавичними перемиканнями.', website: 'https://www.drenth.nl' },
  { name: 'Extreme tyres', description: 'High-performance slick and compound tires engineered specifically for track-day enthusiasts and amateur racing competition.', descriptionUA: 'Високопродуктивні слік-шини, розроблені спеціально для трек-дей ентузіастів та аматорських гоночних змагань.', website: 'https://extreme-tyres.com' },
  { name: 'Kotouc', description: 'Czech motorsport brake specialists manufacturing high-performance racing brake discs with advanced materials and precision engineering.', descriptionUA: 'Чеські спеціалісти з гоночних гальм, високопродуктивні гальмівні диски з передовими матеріалами та прецизійною інженерією.', website: 'https://kotouc-racing.cz' },
  { name: 'Link ECU', description: 'New Zealand-based engine management specialists providing advanced standalone ECU systems trusted by professional motorsport teams worldwide.', descriptionUA: 'Новозеландські спеціалісти з керування двигуном, передові автономні ECU, яким довіряють професійні гоночні команди світу.', website: 'https://www.linkecu.com' },
  { name: 'Lithiumax batteries', description: 'Australian lightweight lithium battery technology delivering exceptional power-to-weight ratio for motorsport weight reduction programs.', descriptionUA: 'Австралійські легкі літієві батареї з винятковим співвідношенням потужності до ваги для гоночних програм полегшення.', website: 'https://lithiumax.com.au' },
  { name: 'MCA Suspension', description: 'Australian coilover specialists engineering track-focused suspension systems with extensive development in competitive motorsport environments.', descriptionUA: 'Австралійські спеціалісти з койловерів, трек-орієнтовані системи підвіски з розширеною розробкою у конкурентному гоночному середовищі.', website: 'https://mcasuspension.com' },
  { name: 'Modena Engineering', description: 'Italian exotic car specialists providing comprehensive servicing, restoration, and performance upgrades for Ferrari and Lamborghini.', descriptionUA: 'Італійські спеціалісти з екзотичних авто, комплексне обслуговування, реставрація та апгрейди продуктивності для Ferrari та Lamborghini.', website: 'https://modena-engineering.com' },
  { name: 'Samsonas Motorsport', description: 'Lithuanian sequential gearbox excellence delivering bulletproof racing transmissions trusted by professional drift and time attack competitors.', descriptionUA: 'Литовська досконалість секвентальних КПП, бездоганні гоночні трансмісії, яким довіряють професійні дріфтери та тайм-атак учасники.', website: 'https://samsonas.com' },
  { name: 'Xshift', description: 'Advanced sequential shifter technology providing precision gear selection systems for motorsport and high-performance applications.', descriptionUA: 'Передова технологія секвентальних перемикачів, прецизійні системи вибору передач для гоночних та високопродуктивних застосувань.', website: 'https://xshift.eu' },
];

export const brandsMoto: LocalBrand[] = [
  { name: 'Accossato', description: 'Italian excellence in braking systems and racing controls, delivering MotoGP-grade precision and stopping power for the most demanding riders.', descriptionUA: 'Італійська досконалість у гальмівних системах та гоночних органах керування, що забезпечує точність рівня MotoGP та гальмівну потужність для найвимогливіших райдерів.', website: 'https://accossato.com/?locale=en' },
  { name: 'AEM Factory', description: 'Exquisite Italian craftsmanship meets high-performance engineering, creating premium billet aluminum components that redefine motorcycle aesthetics and functionality.', descriptionUA: 'Витончена італійська майстерність поєднується з високопродуктивною інженерією, створюючи преміальні алюмінієві компоненти, які переосмислюють естетику та функціональність мотоциклів.', website: 'https://www.aem-factory.com' },
  { name: 'AIM Tech', description: 'The global leader in data acquisition and racing technology, empowering champions with precise telemetry and advanced dashboard displays.', descriptionUA: 'Світовий лідер у збиранні даних та гоночних технологіях, надаючи чемпіонам точну телеметрію та передові дисплеї приладової панелі.', website: 'https://www.aim-sportline.com' },
  { name: 'Akrapovic', description: 'World-leading manufacturer of premium titanium and carbon fiber exhaust systems for motorcycles and performance cars. Based in Slovenia, Akrapovič delivers race-proven power increases, weight reduction, and signature sound for MotoGP, Superbike, and road vehicles.', descriptionUA: 'Світовий лідер у виробництві преміальних титанових та карбонових вихлопних систем для мотоциклів та спортивних авто. Базуючись у Словенії, Akrapovič забезпечує перевірене в перегонах збільшення потужності, зменшення ваги та фірмовий звук.', website: 'https://www.akrapovic.com/en/moto' },
  { name: 'Alpha Racing', description: 'The definitive authority on BMW Motorrad performance, engineering professional-grade racing components for the S1000RR and M1000RR platforms.', descriptionUA: 'Беззаперечний авторитет у продуктивності BMW Motorrad, розробка професійних гоночних компонентів для платформ S1000RR та M1000RR.', website: 'https://www.alpharacing.com/en/' },
  { name: 'ARP Racingparts', description: 'Precision-machined racing rearsets and clip-ons, designed and tested on the track to provide ultimate control and durability.', descriptionUA: 'Прецизійно оброблені гоночні підніжки та кліп-они, розроблені та випробувані на треку для максимального контролю та довговічності.', website: 'https://www.arp-racingparts.com/en/' },
  { name: 'Arrow', description: 'Leading Italian producer of exhaust systems and racing parts for off-road and track motorcycles. Arrow Special Parts designs lightweight, performance-oriented exhausts used by world champions in Motocross, Enduro, and Superbike.', descriptionUA: 'Провідний італійський виробник вихлопних систем та гоночних деталей для позашляхових та трекових мотоциклів. Arrow розробляє легкі, орієнтовані на результат вихлопи, які використовують чемпіони світу.', website: 'https://www.arrow.it/en/' },
  { name: 'Austin Racing', description: 'Bespoke, hand-crafted exhaust systems from the UK, renowned for their aggressive GP styling and phenomenal sound.', descriptionUA: 'Ексклюзивні, виготовлені вручну вихлопні системи з Великобританії, відомі своїм агресивним стилем GP та феноменальним звуком.', website: 'https://www.austinracing.com' },
  { name: 'AXP', description: 'The ultimate protection for off-road adventures, manufacturing high-density skid plates and guards to conquer the toughest terrains.', descriptionUA: 'Максимальний захист для позашляхових пригод, виробництво високоміцних захисних пластин для подолання найскладніших місцевостей.', website: 'https://www.axp-racing.com/en/' },
  { name: 'Bikesplast', description: 'Premium lightweight fiberglass and carbon fairings, trusted by racing teams worldwide for their aerodynamic efficiency and perfect fit.', descriptionUA: 'Преміальні легкі скловолоконні та карбонові обтічники, яким довіряють гоночні команди світу за їх аеродинамічну ефективність та ідеальну посадку.', website: 'https://www.bikesplast.com' },
  { name: 'Bitubo', description: 'Advanced Italian suspension technology, offering race-proven damping solutions that deliver superior handling and stability on track and street.', descriptionUA: 'Передові італійські технології підвіски, що пропонують перевірені на треку демпферні рішення для чудової керованості та стабільності.', website: 'https://www.bitubo.com/en' },
  { name: 'Bonamici', description: 'Italian engineering at its finest, producing CNC-machined racing components and rearsets used by World Superbike teams.', descriptionUA: 'Італійська інженерія у найкращому вигляді, виробництво фрезерованих гоночних компонентів та підніжок, що використовуються командами World Superbike.', website: 'https://www.bonamiciracing.it/en/' },
  { name: 'Brembo', description: 'The global standard in high-performance braking technology. Italian manufacturer of advanced brake calipers, discs, and master cylinders trusted by Formula 1, MotoGP teams, and OEM supercar manufacturers for unmatched stopping power and safety.', descriptionUA: 'Світовий стандарт у технологіях високоефективного гальмування. Італійський виробник передових гальмівних супортів, дисків та головних циліндрів, якому довіряють команди Формули-1, MotoGP та виробники суперкарів.', website: 'https://www.brembo.com/en/solutions/for-your-bike' },
  { name: 'BT Moto', description: 'Industry-leading ECU flashing and tuning solutions, unlocking the full potential and power of modern high-performance motorcycles.', descriptionUA: 'Провідні рішення для прошивки ECU та тюнінгу, розкриваючи повний потенціал та потужність сучасних високопродуктивних мотоциклів.', website: 'https://bt-moto.com' },
  { name: 'Capit', description: 'The world\'s premier manufacturer of professional tire warmers, trusted by MotoGP and F1 teams to ensure optimal grip from the very first corner.', website: 'https://www.capitshop.com/eng/' },
  { name: 'Ceracarbon', description: 'Revolutionary ultra-lightweight technology, combining carbon fiber and ceramic coatings to create the world\'s most advanced sprockets and forks.', website: 'https://ceracarbon-racing.com' },
  { name: 'CNC Racing', description: 'The pinnacle of Italian accessory design, crafting exquisite billet parts that enhance both the performance and beauty of Ducati and MV Agusta machines.', descriptionUA: 'Вершина італійського дизайну аксесуарів, створення вишуканих фрезерованих деталей, що покращують продуктивність та красу мотоциклів Ducati та MV Agusta.', website: 'https://www.cncracing.com/en/' },
  { name: 'Cobra Sport', description: 'British-made performance exhausts, engineered to deliver increased power, reduced weight, and a deep, aggressive exhaust note.', descriptionUA: 'Британські продуктивні вихлопи, розроблені для збільшення потужності, зменшення ваги та глибокого, агресивного вихлопного звуку.', website: 'https://cobrasport.com' },
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
  { name: 'Ohlins', description: 'Premium Swedish suspension technology for motorcycles, cars, and mountain bikes. Öhlins advanced shock absorbers, forks, and steering dampers offer superior handling, adjustability, and traction, proven in MotoGP, F1, and World Superbike.', descriptionUA: 'Преміальні шведські технології підвіски для мотоциклів, авто та велосипедів. Передові амортизатори, вилки та демпфери Öhlins забезпечують чудову керованість, можливості налаштування та зчеплення, перевірені в MotoGP та Ф1.', website: 'https://www.ohlins.com/motorcycle' },
  { name: 'OZ Racing', description: 'Championship-winning wheel technology, engineering lightweight forged aluminum and magnesium rims for peak performance.', descriptionUA: 'Чемпіонська технологія дисків, розробка легких кованих алюмінієвих та магнієвих ободів для пікової продуктивності.', website: 'https://www.ozmotorbike.com/en/' },
  { name: 'P3 Carbon', description: 'Hand-crafted carbon fiber protection, building the most durable pipe guards and skid plates to withstand the rigors of extreme enduro.', descriptionUA: 'Ручне виготовлення карбонового захисту, створення найміцніших захистів труб та захисних пластин для витримування суворих екстремальних ендуро.', website: 'https://p3carbon.com' },
  { name: 'Racefoxx', description: 'Your partner in the paddock, offering a wide range of high-quality racing accessories, tire warmers, and carbon parts.', descriptionUA: 'Ваш партнер у paddock, пропонуючи широкий асортимент високоякісних гоночних аксесуарів, підігрівачів шин та карбонових деталей.', website: 'https://www.racefoxx.com/?lang=eng' },
  { name: 'R&G Racing', description: 'The world leader in motorcycle crash protection, designing innovative sliders and guards to minimize damage and keep you on track.', descriptionUA: 'Світовий лідер у захисті мотоциклів від падіння, розробка інноваційних слайдерів та захистів для мінімізації пошкоджень та утримання вас на треку.', website: 'https://www.rg-racing.com' },
  { name: 'Rizoma', description: 'The essence of Italian style, transforming motorcycles into unique masterpieces with meticulously designed billet aluminum accessories.', descriptionUA: 'Суть італійського стилю, трансформація мотоциклів у унікальні шедеври з ретельно розробленими фрезерованими алюмінієвими аксесуарами.', website: 'https://www.rizoma.com/en/' },
  { name: 'Rotobox', description: 'Pushing the boundaries of wheel technology with ultra-lightweight carbon fiber rims that redefine acceleration and handling.', descriptionUA: 'Подолання меж технології дисків з ультралегкими карбоновими ободами, що переосмислюють прискорення та керованість.', website: 'https://www.rotobox-wheels.com/en' },
  { name: 'S2 Concept', description: 'French design flair, creating unique fairing kits and aesthetic parts that give your motorcycle a distinctive, custom look.', descriptionUA: 'Французький дизайнерський стиль, створення унікальних комплектів обтічників та естетичних деталей, що надають вашому мотоциклу характерний, індивідуальний вигляд.', website: 'https://www.s2-concept.com/en/' },
  { name: 'Samco Sport', description: 'The world leader in performance silicone hoses, ensuring maximum cooling efficiency and reliability under extreme racing conditions.', descriptionUA: 'Світовий лідер у продуктивних силіконових шлангах, що забезпечують максимальну ефективність охолодження та надійність в екстремальних гоночних умовах.', website: 'https://samcosport.com/bike/' },
  { name: 'SC-Project', description: 'Advanced exhaust systems manufactured in Milan, Italy. As the official technical supplier for MotoGP and Moto2 teams, SC-Project creates ultra-lightweight titanium and carbon fiber exhausts designed for maximum performance and racing aesthetics.', descriptionUA: 'Передові вихлопні системи, виготовлені в Мілані. Як офіційний технічний постачальник команд MotoGP та Moto2, SC-Project створює надлегкі титанові та карбонові вихлопи для максимальної продуктивності.', website: 'https://sc-project.com' },
  { name: 'Sebimoto', description: 'European racing tradition, producing high-quality fiberglass and carbon fiber fairings for track day enthusiasts and professional teams.', descriptionUA: 'Європейська гоночна традиція, виробництво високоякісних скловолоконних та карбонових обтічників для ентузіастів трек-днів та професійних команд.', website: 'https://www.sebimoto.com' },
  { name: 'SparkExhaust', description: 'High-quality Italian exhaust systems combining artisanal craftsmanship with modern technology. Spark designs dyno-tested exhausts for Ducati, BMW, and other brands, focusing on rich sound, design precision, and performance optimization.', descriptionUA: 'Високоякісні італійські вихлопні системи, що поєднують ремісничу майстерність із сучасними технологіями. Spark розробляє перевірені на стенді вихлопи з фокусом на насичений звук та оптимізацію продуктивності.', website: 'https://www.sparkexhaust.com/en' },
  { name: 'Sprint Filter', description: 'Innovative polyester air filter technology, providing the highest airflow and filtration efficiency for maximum engine performance.', descriptionUA: 'Інноваційна технологія поліестерових повітряних фільтрів, що забезпечує найвищий повітряний потік та ефективність фільтрації для максимальної продуктивності двигуна.', website: 'https://www.sprintfilter.net/motorcycle/' },
  { name: 'Starlane', description: 'Precision GPS laptimers and data acquisition systems, helping riders analyze and improve their performance on the track.', descriptionUA: 'Точні GPS-ляпометри та системи збору даних, що допомагають райдерам аналізувати та покращувати свою продуктивність на треку.', website: 'https://www.starlane.com' },
  { name: 'STM Italy', description: 'The inventors of the slipper clutch, continuing to lead the market with advanced drivetrain components for racing applications.', descriptionUA: 'Винахідники зчеплення з ковзним механізмом, продовжують лідирувати на ринку з передовими трансмісійними компонентами для гоночних застосувань.', website: 'https://www.stmitaly.com/index_en.html' },
  { name: 'Stompgrip', description: 'The original traction pad, providing riders with superior grip and control to reduce fatigue and improve cornering confidence.', descriptionUA: 'Оригінальні накладки для зчеплення, що надають райдерам чудове зчеплення та контроль для зменшення втоми та покращення впевненості в поворотах.', website: 'https://stompgrip.com' },
  { name: 'Termignoni', description: 'Iconic Italian exhaust manufacturer with a legendary racing heritage. Specializing in high-performance exhaust systems for Ducati, Honda, and Yamaha, Termignoni delivers distinctive sound and power gains optimized for track and street use.', descriptionUA: 'Культовий італійський виробник вихлопних систем з легендарною гоночною спадщиною. Спеціалізуючись на високопродуктивних вихлопах для Ducati, Honda та Yamaha, Termignoni забезпечує характерний звук та приріст потужності.', website: 'https://termignoni.it' },
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
  '034 Motorsport': { country: 'USA', subcategory: 'Engine' },
  '1016 Industries': { country: 'USA', subcategory: 'Exterior' },
  '5150 Autosport': { country: 'USA', subcategory: 'Engine' },
  'ADV.1 wheels': { country: 'USA', subcategory: 'Wheels' },
  'Airlift Performance': { country: 'USA', subcategory: 'Suspension' },
  'AL13 wheels': { country: 'USA', subcategory: 'Wheels' },
  'AMS / Alpha Performance': { country: 'USA', subcategory: 'Engine' },
  'American Racing Headers': { country: 'USA', subcategory: 'Exhaust' },
  'ANRKY wheels': { country: 'USA', subcategory: 'Wheels' },
  'APR': { country: 'USA', subcategory: 'Aero' },
  'Avantgarde Wheels': { country: 'USA', subcategory: 'Wheels' },
  'BE bearings': { country: 'USA', subcategory: 'Engine' },
  'BBi Autosport': { country: 'USA', subcategory: 'Engine' },
  'Big Boost': { country: 'USA', subcategory: 'Engine' },
  'BimmerWorld': { country: 'USA', subcategory: 'Engine' },
  'BootMod3': { country: 'Canada', subcategory: 'Electronics' },
  'Borla': { country: 'USA', subcategory: 'Exhaust' },
  'Brixton wheels': { country: 'USA', subcategory: 'Wheels' },
  'Burger Motorsport': { country: 'USA', subcategory: 'Electronics' },
  'Circle D': { country: 'USA', subcategory: 'Drivetrain' },
  'Cobb tuning': { country: 'USA', subcategory: 'Electronics' },
  'CSF': { country: 'USA', subcategory: 'Cooling' },
  'DarwinPro': { country: 'USA', subcategory: 'Exterior' },
  'Deatschwerks': { country: 'USA', subcategory: 'Fuel Systems' },
  'Dinan': { country: 'USA', subcategory: 'Engine' },
  'Dorch Engineering': { country: 'USA', subcategory: 'Fuel Systems' },
  'Driveshaftshop': { country: 'USA', subcategory: 'Drivetrain' },
  'Duke Dynamics': { country: 'Canada', subcategory: 'Exterior' },
  'Eterna Motorworks': { country: 'USA', subcategory: 'Exterior' },
  'Fabspeed': { country: 'USA', subcategory: 'Engine' },
  'Fall-Line Motorsports': { country: 'USA', subcategory: 'Engine' },
  'Fore Innovations': { country: 'USA', subcategory: 'Fuel Systems' },
  'Fragola Performance Systems': { country: 'USA', subcategory: 'Fuel Systems' },
  'Full-Race': { country: 'USA', subcategory: 'Engine' },
  'Girodisc': { country: 'USA', subcategory: 'Brakes' },
  'GTHaus': { country: 'USA', subcategory: 'Exhaust' },
  'HRE wheels': { country: 'USA', subcategory: 'Wheels' },
  'Injector Dynamics': { country: 'USA', subcategory: 'Fuel Systems' },
  'Integrated Engineering': { country: 'USA', subcategory: 'Engine' },
  'JXB Performance': { country: 'USA', subcategory: 'Drivetrain' },
  'Killer B Motorsport': { country: 'USA', subcategory: 'Engine' },
  'KLM Race': { country: 'USA', subcategory: 'Engine' },
  'Kooks Headers': { country: 'USA', subcategory: 'Exhaust' },
  'Lingenfelter': { country: 'USA', subcategory: 'Engine' },
  'Mickey Thompson': { country: 'USA', subcategory: 'Wheels' },
  'Motiv Motorsport': { country: 'USA', subcategory: 'Fuel Systems' },
  'Moser Engineering': { country: 'USA', subcategory: 'Drivetrain' },
  'Mountune': { country: 'UK', subcategory: 'Engine' },
  'MV Forged': { country: 'USA', subcategory: 'Wheels' },
  'Paragon brakes': { country: 'USA', subcategory: 'Brakes' },
  'Paramount transmissions': { country: 'USA', subcategory: 'Drivetrain' },
  'Premier Tuning Group': { country: 'USA', subcategory: 'Engine' },
  'Project 6GR': { country: 'USA', subcategory: 'Wheels' },
  'Pure Drivetrain Solutions': { country: 'USA', subcategory: 'Drivetrain' },
  'Pure Turbos': { country: 'USA', subcategory: 'Engine' },
  'Renntech': { country: 'USA', subcategory: 'Engine' },
  'RK Autowerks': { country: 'USA', subcategory: 'Engine' },
  'RPM Transmissions': { country: 'USA', subcategory: 'Drivetrain' },
  'RKP': { country: 'USA', subcategory: 'Aero' },
  'RW Carbon': { country: 'USA', subcategory: 'Exterior' },
  'RYFT': { country: 'USA', subcategory: 'Engine' },
  'Seibon Carbon': { country: 'USA', subcategory: 'Exterior' },
  'ShepTrans': { country: 'USA', subcategory: 'Drivetrain' },
  'Silly Rabbit Motorsport': { country: 'USA', subcategory: 'Engine' },
  'Southern Hotrod': { country: 'USA', subcategory: 'Drivetrain' },
  'Spool Performance': { country: 'USA', subcategory: 'Fuel Systems' },
  'SPL Parts': { country: 'USA', subcategory: 'Suspension' },
  'Strasse wheels': { country: 'USA', subcategory: 'Wheels' },
  'Stoptech': { country: 'USA', subcategory: 'Brakes' },
  'Stillen': { country: 'USA', subcategory: 'Engine' },
  'Titan Motorsport': { country: 'USA', subcategory: 'Engine' },
  'TireRack': { country: 'USA', subcategory: 'Wheels' },
  'Turner Motorsport': { country: 'USA', subcategory: 'Engine' },
  'Vargas Turbo': { country: 'USA', subcategory: 'Engine' },
  'Velos Wheels': { country: 'USA', subcategory: 'Wheels' },
  'Verus Engineering': { country: 'USA', subcategory: 'Aero' },
  'VF Engineering': { country: 'USA', subcategory: 'Engine' },
  'VP Racing Fuel': { country: 'USA', subcategory: 'Fuel Systems' },
  'Vorsteiner': { country: 'USA', subcategory: 'Exterior' },
  'Wavetrac': { country: 'USA', subcategory: 'Drivetrain' },
  'Weistec Engineering': { country: 'USA', subcategory: 'Engine' },
  'Whipple Superchargers': { country: 'USA', subcategory: 'Engine' },
  'XDI fuel systems': { country: 'USA', subcategory: 'Fuel Systems' },

  // Europe & World Brands
  '3D Design': { country: 'Japan', subcategory: 'Aero' },
  'ABT': { country: 'Germany', subcategory: 'Engine' },
  'AC Schnitzer': { country: 'Germany', subcategory: 'Engine' },
  'ADRO': { country: 'South Korea', subcategory: 'Aero' },
  'Akrapovic': { country: 'Slovenia', subcategory: 'Exhaust' },
  'Alpha-N': { country: 'Germany', subcategory: 'Aero' },
  'ARMA Speed': { country: 'Taiwan', subcategory: 'Engine' },
  'Armytrix': { country: 'Taiwan', subcategory: 'Exhaust' },
  'Black Boost': { country: 'UAE', subcategory: 'Engine' },
  'BMC filters': { country: 'Italy', subcategory: 'Engine' },
  'Brabus': { country: 'Germany', subcategory: 'Engine' },
  'Brembo': { country: 'Italy', subcategory: 'Brakes' },
  'BC Racing': { country: 'Taiwan', subcategory: 'Suspension' },
  'Capristo': { country: 'Germany', subcategory: 'Exhaust' },
  'CT Carbon': { country: 'UK', subcategory: 'Exterior' },
  'Dahler': { country: 'Switzerland', subcategory: 'Engine' },
  'DMC': { country: 'Germany', subcategory: 'Aero' },
  'do88': { country: 'Sweden', subcategory: 'Cooling' },
  'DTE Systems': { country: 'Germany', subcategory: 'Electronics' },
  'ESS Tuning': { country: 'Norway', subcategory: 'Engine' },
  'Eventuri': { country: 'UK', subcategory: 'Engine' },
  'FI Exhaust': { country: 'Taiwan', subcategory: 'Exhaust' },
  'Gruppe-M': { country: 'Japan', subcategory: 'Engine' },
  'Hamann': { country: 'Germany', subcategory: 'Engine' },
  'Heico': { country: 'Germany', subcategory: 'Engine' },
  'Hardrace': { country: 'Taiwan', subcategory: 'Suspension' },
  'Harrop': { country: 'Australia', subcategory: 'Engine' },
  'iPE exhaust': { country: 'Taiwan', subcategory: 'Exhaust' },
  'ItalianRP': { country: 'Italy', subcategory: 'Engine' },
  'KAHN design': { country: 'UK', subcategory: 'Engine' },
  'Karbonius': { country: 'Spain', subcategory: 'Engine' },
  'Keyvany': { country: 'Germany', subcategory: 'Engine' },
  'Kline Innovation': { country: 'Romania', subcategory: 'Exhaust' },
  'KW Suspension': { country: 'Germany', subcategory: 'Suspension' },
  'Lamspeed': { country: 'Australia', subcategory: 'Engine' },
  'Larte Design': { country: 'Germany', subcategory: 'Aero' },
  'Liberty Walk': { country: 'Japan', subcategory: 'Aero' },
  'LOBA Motorsport': { country: 'Germany', subcategory: 'Engine' },
  'Lorinser': { country: 'Germany', subcategory: 'Engine' },
  'Lumma': { country: 'Germany', subcategory: 'Engine' },
  'Manhart': { country: 'Germany', subcategory: 'Engine' },
  'Mansory': { country: 'Germany', subcategory: 'Engine' },
  'Mamba turbo': { country: 'Taiwan', subcategory: 'Engine' },
  "Matt's carbon": { country: 'Poland', subcategory: 'Exterior' },
  'Milltek': { country: 'UK', subcategory: 'Exhaust' },
  'MST Performance': { country: 'Taiwan', subcategory: 'Engine' },
  'Novitec': { country: 'Germany', subcategory: 'Engine' },
  'Nitron Suspension': { country: 'UK', subcategory: 'Suspension' },
  'ONE COMPANY forged': { country: 'Ukraine', subcategory: 'Wheels' },
  'Onyx Concept': { country: 'UK', subcategory: 'Engine' },
  'Power Division': { country: 'Poland', subcategory: 'Engine' },
  'ProTrack Wheels': { country: 'Germany', subcategory: 'Wheels' },
  'Pulsar turbo': { country: 'China', subcategory: 'Engine' },
  'Paktechz Design': { country: 'China', subcategory: 'Exterior' },
  'R44 Performance': { country: 'UK', subcategory: 'Engine' },
  'Raliw Forged': { country: 'Romania', subcategory: 'Wheels' },
  'Remus': { country: 'Austria', subcategory: 'Exhaust' },
  'Sachs Performance': { country: 'Germany', subcategory: 'Drivetrain' },
  'Schrick': { country: 'Germany', subcategory: 'Engine' },
  'STOPART ceramic': { country: 'China', subcategory: 'Brakes' },
  'STOPFLEX': { country: 'China', subcategory: 'Brakes' },
  'Supersprint': { country: 'Italy', subcategory: 'Exhaust' },
  'Tubi Style': { country: 'Italy', subcategory: 'Exhaust' },
  'Urban Automotive': { country: 'UK', subcategory: 'Exterior' },
  'Wagner Tuning': { country: 'Germany', subcategory: 'Cooling' },
  'WALD': { country: 'Japan', subcategory: 'Aero' },
  'WheelForce': { country: 'Germany', subcategory: 'Wheels' },
  'YPG': { country: 'UAE', subcategory: 'Engine' },
  'Zacoe': { country: 'Taiwan', subcategory: 'Aero' },

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
  'Extreme tyres': { country: 'Poland', subcategory: 'Wheels' },
  'Kotouc': { country: 'Czech Republic', subcategory: 'Drivetrain' },
  'Link ECU': { country: 'New Zealand', subcategory: 'Electronics' },
  'Lithiumax batteries': { country: 'Australia', subcategory: 'Electronics' },
  'MCA Suspension': { country: 'Australia', subcategory: 'Suspension' },
  'Modena Engineering': { country: 'Australia', subcategory: 'Drivetrain' },
  'Samsonas Motorsport': { country: 'Lithuania', subcategory: 'Drivetrain' },
  'Xshift': { country: 'Czech Republic', subcategory: 'Drivetrain' },

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
