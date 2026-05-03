import fs from 'fs';

const scrapedFile = 'scripts/ig-scraped-posts-v2.json';
const siteContentFile = 'public/config/site-content.json';

const scrapedData = JSON.parse(fs.readFileSync(scrapedFile, 'utf8'));
const siteContent = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));

// Prepare the new posts
const newPosts = [];

const postsData = [
  {
    id: "DW3qRqdDO4l",
    slug: "liberty-walk-lb-works-toyota-land-cruiser-250",
    titleUA: "Liberty Walk LB-WORKS для Toyota Land Cruiser 250",
    titleEN: "Liberty Walk LB-WORKS for Toyota Land Cruiser 250",
    captionUA: "Liberty Walk LB-WORKS для Toyota Land Cruiser 250.\n\nАгресивне фірмове розширення кузова від японського ательє.\n\nДо повного комплекту входять:\n▪️ Передній бампер з LED-ДХВ\n▪️ Накладка на задній бампер\n▪️ Розширювачі колісних арок (Widebody)\n▪️ Спойлери на дах та багажник\n▪️ Накладка на капот\n\nТакож доступні ковані диски LB Wheel у розмірах 22” та 24”.\n\nОригінальна продукція Liberty Walk доступна до замовлення в ONE COMPANY.",
    captionEN: "Liberty Walk LB-WORKS for Toyota Land Cruiser 250.\n\nAggressive signature widebody kit from the Japanese tuner.\n\nThe complete kit includes:\n▪️ Front bumper with LED DRLs\n▪️ Rear bumper add-on\n▪️ Widebody fender flares\n▪️ Roof and trunk spoilers\n▪️ Hood add-on\n\nLB Wheel forged wheels are also available in 22” and 24” sizes.\n\nGenuine Liberty Walk products are available for order at ONE COMPANY.",
    tags: ["onecompany", "libertywalk", "lbworks", "landcruiser250", "tuning"]
  },
  {
    id: "DWzAIIoDHb4",
    slug: "exclusive-forged-wheels-al13-style-and-quality",
    titleUA: "Ексклюзивні ковані диски AL13 - стиль та досконала якість",
    titleEN: "Exclusive forged AL13 wheels - style and perfect quality",
    captionUA: "Ексклюзивні ковані диски @al13wheels - це про стиль, досконалу якість, індивідуальний підхід та преміальний статус вашого авто.\n\nВиготовлені з високоміцного авіаційного алюмінію 6061-T6, вони поєднують мінімальну вагу, необхідну для кращої керованості, з максимальною міцністю.\n\nВаш автомобіль заслуговує на найкраще. Ми допоможемо підібрати ідеальний дизайн, параметри та унікальний фініш, який виділятиме вас на дорозі.\n\nДиски AL13 доступні для замовлення в ONE COMPANY.",
    captionEN: "Exclusive forged wheels by @al13wheels are about style, perfect quality, individual approach, and the premium status of your car.\n\nCrafted from high-strength aerospace-grade 6061-T6 aluminum, they combine the minimum weight necessary for better handling with maximum durability.\n\nYour vehicle deserves the best. We will help you select the ideal design, specs, and a unique finish that will make you stand out on the road.\n\nAL13 wheels are available to order at ONE COMPANY.",
    tags: ["onecompany", "al13wheels", "ferrari", "tuning"]
  },
  {
    id: "DWn0fWMjB1t",
    slug: "jb4-tuner-performance-upgrade",
    titleUA: "JB4 tuner - сучасне рішення для підвищення продуктивності авто",
    titleEN: "JB4 tuner - a modern solution for upgrading car performance",
    captionUA: "JB4 tuner - це сучасне рішення для підвищення продуктивності авто без складного втручання в систему.\n\nМодуль підключається до штатних сенсорів і в реальному часі коригує параметри двигуна, підвищуючи потужність і ефективність.\n\nЧерез додаток можливо:\n🏁 перемикати карти\n🏁 контролювати систему турбонаддуву\n🏁 переглядати всі показники двигуна\n\nІдеальне рішення для гарантійних авто. Доступно в One Company.",
    captionEN: "The JB4 tuner is a modern solution to increase your car's performance without complex system modifications.\n\nThe module connects to factory sensors and adjusts engine parameters in real-time, boosting power and efficiency.\n\nThrough the app, you can:\n🏁 Switch maps\n🏁 Monitor the turbocharger system\n🏁 View all engine telemetry\n\nThe perfect solution for vehicles under warranty. Available at One Company.",
    tags: ["jb4", "burgermotorsports", "cartuning", "tuning", "onecompany"]
  },
  {
    id: "DWlaTXVjBNO",
    slug: "brabus-widestar-for-g63-w465",
    titleUA: "BRABUS Widestar для Mercedes G63 (W465)",
    titleEN: "BRABUS Widestar for Mercedes G63 (W465)",
    captionUA: "BRABUS Widestar для G63 (W465)\n\nКомплексний аеродинамічний обвіс, який повністю змінює сприйняття G-Class. Розширені крила, новий передній бампер, виразний задній дифузор і фірмова геометрія Widestar формують агресивний, впізнаваний силует. Кожна деталь продумана не лише з точки зору дизайну, а й балансу пропорцій і аеродинаміки.\n\nЦе вибір для тих, хто звик бути попереду - у бізнесі, у стилі, у сприйнятті. Автомобіль стає відображенням статусу, де кожен елемент підкреслює впевненість і рівень власника.\n\nДоступно для замовлення в One Company.",
    captionEN: "BRABUS Widestar for the G63 (W465)\n\nA comprehensive aerodynamic kit that completely changes the perception of the G-Class. Extended fenders, a new front bumper, a striking rear diffuser, and the signature Widestar geometry form an aggressive, recognizable silhouette. Every detail is carefully considered not only in terms of design but also the balance of proportions and aerodynamics.\n\nThis is a choice for those who are used to being ahead - in business, in style, in perception. The car becomes a reflection of status, where every element emphasizes the owner's confidence and level.\n\nAvailable to order at One Company.",
    tags: ["brabus", "widestar", "mercedesg63", "tuning", "onecompany"]
  },
  {
    id: "DWTU9BsDEJC",
    slug: "kw-variant-3-4-5-suspensions",
    titleUA: "KW Variant 3, 4, 5 - три рівні налаштування підвіски",
    titleEN: "KW Variant 3, 4, 5 - three levels of suspension tuning",
    captionUA: "KW Variant 3, 4, 5 - три рівні налаштування підвіски для різних задач і різного рівня вимог.\n\n🏁 Variant 3 - оптимальний вибір для тих, хто хоче поєднати щоденний комфорт із точнішою керованістю та більшим вибором можливостей налаштування.\n🏁 Variant 4 - рішення для більш вимогливих street та performance-проєктів, де важливі вища точність, гнучкість і контроль поведінки авто.\n🏁 Variant 5 - топовий рівень у лінійці KW для тих, хто шукає максимум налаштувань, максимальну точність і безкомпромісний підхід до контролю авто.\n\nУ One Company допоможемо підібрати саме той варіант KW, який найкраще відповідатиме вашому автомобілю.",
    captionEN: "KW Variant 3, 4, 5 - three levels of suspension tuning for different tasks and requirement levels.\n\n🏁 Variant 3 - the optimal choice for those who want to combine daily comfort with more precise handling and a wider range of setup possibilities.\n🏁 Variant 4 - the solution for more demanding street and performance projects, where higher precision, flexibility, and control over car behavior are crucial.\n🏁 Variant 5 - the top tier in the KW lineup for those seeking maximum adjustability, ultimate precision, and a no-compromise approach to vehicle control.\n\nAt One Company, we will help you select the exact KW variant that best fits your vehicle.",
    tags: ["KWAutomotive", "KWSuspension", "Coilovers", "PerformanceSuspension", "OneCompany"]
  },
  {
    id: "DVG3S66DAgX",
    slug: "quicksilver-exhaust-tradition-and-technology",
    titleUA: "QuickSilver - вихлопна система, що поєднує традиції та передові технології",
    titleEN: "QuickSilver - an exhaust system combining traditions and advanced technologies",
    captionUA: "Якщо ви шукаєте вихлопну систему, яка поєднує в собі багаторічні традиції та передові технології, QuickSilver-це ваш вибір. З 1973 року цей бренд створює «голоси» для найкращих автомобілів світу.\n\nЧому QuickSilver-це особливий рівень?\n—Heritage & Modern: Бренд пропонує рішення як для новітніх гіперкарів, так і автентичні системи для класичних моделей (Aston Martin, Jaguar, Ferrari).\n—Матеріали: Використання авіаційного титану, нержавіючої сталі T304 та навіть інконелю для екстремальних навантажень.\n—Sound Architecture: Кожна система проєктується так, щоб підкреслити унікальний тембр двигуна, уникаючи при цьому набридливого гулу (drone) на трасі.\n—Вага: Системи QuickSilver значно легші за заводські, що покращує розваговку та динаміку авто.\n\nМи в One Company є офіційним постачальником QuickSilver. Ми привеземо будь-яку систему прямо з Британії- від спортивного «кетбеку» до колекційного вихлопу для вашого раритету.\n\nВаше авто готове зазвучати по-новому? Пишіть марку та модель у Direct-ми запропонуємо найкращий варіант від QuickSilver!",
    captionEN: "If you are looking for an exhaust system that combines years of tradition with advanced technologies, QuickSilver is your choice. Since 1973, this brand has been crafting 'voices' for the world's finest cars.\n\nWhy is QuickSilver a special level?\n— Heritage & Modern: The brand offers solutions for both the latest hypercars and authentic systems for classic models (Aston Martin, Jaguar, Ferrari).\n— Materials: Utilizing aerospace titanium, T304 stainless steel, and even Inconel for extreme loads.\n— Sound Architecture: Every system is designed to emphasize the engine's unique tonality while avoiding annoying drone on the highway.\n— Weight: QuickSilver systems are significantly lighter than factory ones, improving weight distribution and car dynamics.\n\nWe at One Company are an official distributor of QuickSilver. We can import any system directly from the UK - from a sporty cat-back to a collector's exhaust for your rare gem.\n\nIs your car ready to sound different? DM us the make and model, and we'll suggest the best option from QuickSilver!",
    tags: ["onecompany", "quicksilverexhaust", "exhaustsystem", "tuning"]
  }
];

// Helper to format newly scraped posts
for (const pd of postsData) {
  const scrapedItem = scrapedData.find(s => s.shortcode === pd.id);
  if (!scrapedItem) continue;
  
  const postHtml = {
    id: "ig-" + pd.id.toLowerCase(),
    slug: pd.slug,
    title: {
      ua: pd.titleUA,
      en: pd.titleEN
    },
    caption: {
      ua: pd.captionUA,
      en: pd.captionEN
    },
    date: scrapedItem.date,
    location: {
      ua: "Україна",
      en: "Ukraine"
    },
    tags: pd.tags,
    status: "published",
    media: scrapedItem.images.map((img, idx) => ({
      id: "media-ig-" + pd.id.toLowerCase() + "-" + (idx + 1),
      type: "image", // Everything we grabbed is jpg right now from DOM
      src: img,
      alt: pd.titleEN
    }))
  };
  // Prepend to array
  newPosts.push(postHtml);
}

// Add to the front of the blog posts list
const currentPosts = siteContent.blog.posts || [];
siteContent.blog.posts = [...newPosts, ...currentPosts];

fs.writeFileSync(siteContentFile, JSON.stringify(siteContent, null, 2));
console.log(`Added ${newPosts.length} new posts to the blog.`);
