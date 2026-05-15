/**
 * Insert May 2026 blog posts (5 IG posts, manual EN translations).
 * Excludes DTsKmdmjFgF (company intro / "Хто ми").
 */
import fs from "fs";
import path from "path";

const SITE_CONTENT = path.resolve("public/config/site-content.json");

// Manual translations, ordered newest first.
// Tags preserved as-is (mix of EN + Cyrillic, matching existing site-content style).
const NEW_POSTS = [
  {
    shortcode: "DYUTmKAMy6s",
    slug: "stopflex-carbon-ceramic-brakes-bmw-7-g12",
    date: "2026-05-14T11:25:26.000Z",
    titleUA: "STOPFLEX для BMW 7 G12 - карбоново-керамічні гальмівні диски",
    titleEN: "STOPFLEX carbon-ceramic brakes for BMW 7 G12",
    captionUA:
      "STOPFLEX для BMW 7 G12 - карбоново-керамічні гальмівні диски для тих, хто хоче більше контролю, стабільності та впевненості на швидкості.\n\nІнженерне рішення для потужних авто, де гальмування має бути таким же серйозним, як і динаміка.\n\nГальмівні системи STOPFLEX доступні для замовлення в One Company.\n\n#onecompany #stopflex #bmw7g12 #luxurycars #cartuning",
    captionEN:
      "STOPFLEX for BMW 7 G12 — carbon-ceramic brake discs for those who want more control, stability, and confidence at speed.\n\nAn engineering solution for high-performance cars, where braking should be as serious as the dynamics.\n\nSTOPFLEX brake systems are available to order at One Company.\n\n#onecompany #stopflex #bmw7g12 #luxurycars #cartuning",
    tags: ["onecompany", "stopflex", "bmw7g12", "luxurycars", "cartuning"],
    media: [{ type: "video", src: "/videos/blog/DYUTmKAMy6s-v5-1.mp4" }],
  },
  {
    shortcode: "DYSD4QNDCvi",
    slug: "ipe-exhaust-porsche-992-gt3",
    date: "2026-05-13T14:28:24.000Z",
    titleUA: "IPE Exhaust для Porsche 992 GT3 - система, де кожна деталь говорить сама за себе",
    titleEN: "IPE Exhaust for Porsche 992 GT3",
    captionUA:
      "IPE Exhaust для Porsche 992 GT3 - система, де кожна деталь говорить сама за себе.\n\nСталева геометрія, карбонові насадки, акуратні зварні шви та фірмовий характер звуку. Саме такі компоненти формують відчуття автомобіля ще до першого запуску двигуна.\n\nOne Company підбирає та постачає оригінальні преміальні рішення для авто - від вихлопних систем до повних тюнінг-проєктів.\n\n#onecompany #ipeexhaust #porsche992gt3 #exhaustsystem #cartuning",
    captionEN:
      "IPE Exhaust for the Porsche 992 GT3 — a system where every detail speaks for itself.\n\nSteel geometry, carbon tips, precise welds, and a signature sound character. These are the components that shape how a car feels before the engine even starts.\n\nOne Company sources and supplies genuine premium solutions for performance cars — from exhaust systems to complete tuning projects.\n\n#onecompany #ipeexhaust #porsche992gt3 #exhaustsystem #cartuning",
    tags: ["onecompany", "ipeexhaust", "porsche992gt3", "exhaustsystem", "cartuning"],
    media: [
      { type: "image", src: "/images/blog/DYSD4QNDCvi-v5-1.jpg" },
      { type: "image", src: "/images/blog/DYSD4QNDCvi-v5-2.jpg" },
      { type: "image", src: "/images/blog/DYSD4QNDCvi-v5-3.jpg" },
      { type: "image", src: "/images/blog/DYSD4QNDCvi-v5-4.jpg" },
      { type: "image", src: "/images/blog/DYSD4QNDCvi-v5-5.jpg" },
      { type: "image", src: "/images/blog/DYSD4QNDCvi-v5-6.jpg" },
    ],
  },
  {
    shortcode: "DX9N9mFDPGs",
    slug: "kw-height-adjustable-springs-bmw-m5-f90",
    date: "2026-05-05T12:12:28.000Z",
    titleUA: "KW Height Adjustable Springs для BMW M5 F90 - в наявності",
    titleEN: "KW Height Adjustable Springs for BMW M5 F90 — in stock",
    captionUA:
      "✅ В НАЯВНОСТІ. Готові до відправки.\n\nKW Height Adjustable Springs - регульовані пружини для BMW M5 F90.\n\nБільше контролю над посадкою авто без втрати заводської логіки підвіски. KW HAS дозволяють налаштувати висоту, зберегти EDC та залишити комфорт для щоденної експлуатації.\n\nДля BMW M5 F90 це один із найкращих варіантів, якщо потрібен нижчий, зібраніший та візуально правильний силует без жорсткого переходу на спортивну підвіску.\n\n#kwsuspension #bmwm5 #suspensiontuning #tuning #onecompany",
    captionEN:
      "✅ IN STOCK. Ready to ship.\n\nKW Height Adjustable Springs — adjustable springs for the BMW M5 F90.\n\nMore control over the car's stance without losing the factory suspension logic. KW HAS lets you dial in ride height, retain EDC, and keep daily-driving comfort.\n\nFor the BMW M5 F90 it's one of the best options when you want a lower, more composed, visually correct silhouette without the harsh switch to a full sport setup.\n\n#kwsuspension #bmwm5 #suspensiontuning #tuning #onecompany",
    tags: ["kwsuspension", "bmwm5", "suspensiontuning", "tuning", "onecompany"],
    media: [
      { type: "image", src: "/images/blog/DX9N9mFDPGs-v5-1.jpg" },
      { type: "image", src: "/images/blog/DX9N9mFDPGs-v5-2.jpg" },
    ],
  },
  {
    shortcode: "DXyrwK6sV1b",
    slug: "rizoma-premium-italian-moto-accessories",
    date: "2026-05-01T10:02:36.000Z",
    titleUA: "RIZOMA - італійські преміальні мотоаксесуари",
    titleEN: "RIZOMA — premium Italian motorcycle accessories",
    captionUA:
      "RIZOMA 🇮🇹 Легендарний італійський бренд, що створює преміальні мотоаксесуари, де кожна деталь - це поєднання функціональності та мистецтва.\n\nВід мінімалістичних LED поворотників до агресивних дзеркал Stealth. Rizoma перетворює стоковий байк на унікальний витвір.\n\nдоступний для замовлення в One Company - оновіть свій мотоцикл деталями, які говорять самі за себе.\n\n#rizoma #rizomaaccessories #мотоцикл #мототюнінг #onecompany",
    captionEN:
      "RIZOMA 🇮🇹 The legendary Italian brand crafts premium motorcycle accessories where every detail is a fusion of function and art.\n\nFrom minimalist LED indicators to the aggressive Stealth mirrors — Rizoma turns a stock bike into a unique build.\n\nAvailable to order at One Company — upgrade your motorcycle with parts that speak for themselves.\n\n#rizoma #rizomaaccessories #motorcycle #motorcycletuning #onecompany",
    tags: ["rizoma", "rizomaaccessories", "мотоцикл", "мототюнінг", "onecompany"],
    media: [{ type: "video", src: "/videos/blog/DXyrwK6sV1b-v5-1.mp4" }],
  },
  {
    shortcode: "DXqyWeeDMzC",
    slug: "nitron-suspension-bmw-m2",
    date: "2026-04-28T08:24:52.000Z",
    titleUA: "NITRON - британська точність у кожному повороті",
    titleEN: "NITRON — British suspension precision for BMW M2",
    captionUA:
      "NITRON - британська точність у кожному повороті ⚡\nМонотрубна конструкція, 24 режимів регулювання, алюмінієвий корпус і характер, який відчувається з першого метра. Створено для тих, хто керує, а не просто їде.\n📍 One Company Global - офіційне замовлення в Україні\n#nitron #nitronr1 #автотюнінг #bmwm2 #onecompany",
    captionEN:
      "NITRON — British precision in every corner ⚡\nA monotube design, 24 levels of adjustment, an aluminium body, and a character you feel from the first metre. Built for those who drive, not just commute.\n📍 One Company Global — official ordering in Ukraine\n#nitron #nitronr1 #cartuning #bmwm2 #onecompany",
    tags: ["nitron", "nitronr1", "автотюнінг", "bmwm2", "onecompany"],
    media: [
      { type: "image", src: "/images/blog/DXqyWeeDMzC-v5-1.jpg" },
      { type: "image", src: "/images/blog/DXqyWeeDMzC-v5-2.jpg" },
    ],
  },
];

function buildPost(p) {
  const idLc = p.shortcode.toLowerCase();
  return {
    id: `ig-${idLc}`,
    slug: p.slug,
    title: { ua: p.titleUA, en: p.titleEN },
    caption: { ua: p.captionUA, en: p.captionEN },
    date: p.date,
    location: { ua: "Україна", en: "Ukraine" },
    tags: p.tags,
    status: "published",
    media: p.media.map((m, i) => ({
      id: `media-ig-${idLc}-${i + 1}`,
      type: m.type,
      src: m.src,
      alt: p.titleEN,
    })),
  };
}

const content = JSON.parse(fs.readFileSync(SITE_CONTENT, "utf8"));

// Pre-flight: ensure none of the new posts already exist
const existingIds = new Set(content.blog.posts.map((p) => p.id));
const collisions = NEW_POSTS.map((p) => `ig-${p.shortcode.toLowerCase()}`).filter((id) =>
  existingIds.has(id)
);
if (collisions.length > 0) {
  console.error(`Collisions detected: ${collisions.join(", ")}`);
  process.exit(1);
}

// Pre-flight: ensure each media file exists on disk
const missingFiles = [];
for (const p of NEW_POSTS) {
  for (const m of p.media) {
    const fp = path.resolve("public" + m.src);
    if (!fs.existsSync(fp)) missingFiles.push(fp);
  }
}
if (missingFiles.length > 0) {
  console.error(`Missing media files:\n${missingFiles.join("\n")}`);
  process.exit(1);
}

// Build new post objects
const built = NEW_POSTS.map(buildPost);

// Prepend (newest first), then sort the entire posts list by date desc for safety
content.blog.posts = [...built, ...content.blog.posts];
content.blog.posts.sort((a, b) => new Date(b.date) - new Date(a.date));

// Write with stable 2-space indent + trailing newline
fs.writeFileSync(SITE_CONTENT, JSON.stringify(content, null, 2) + "\n");

console.log(`✅ Inserted ${built.length} posts:`);
for (const p of built) {
  console.log(`   ${p.date.slice(0, 10)} ${p.slug} (${p.media.length} media)`);
}
console.log(`Total posts now: ${content.blog.posts.length}`);
