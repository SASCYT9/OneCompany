/**
 * Adds the Instagram posts published after the September 2026 sync
 * (22 Sep - 10 Oct 2026) to public/config/site-content.json.
 *
 * Media were downloaded beforehand from the Instagram CDN into
 * public/images/blog (*-v4-N.jpg) and public/videos/blog (*-v4-1.mp4);
 * reel posters are frames extracted from the videos into
 * public/images/blog/covers. The script is idempotent: a post whose id is
 * already present is skipped.
 *
 * Usage: node scripts/add-instagram-posts-oct2026.mjs
 *        npx prettier --write public/config/site-content.json
 */
import fs from "node:fs";
import path from "node:path";

const FILE = "public/config/site-content.json";
const content = JSON.parse(fs.readFileSync(FILE, "utf8"));

const LOCATION = { ua: "Україна", en: "Ukraine" };

const posts = [
  {
    shortcode: "DdljaRSjIGn",
    date: "2026-09-22T10:46:28.000Z",
    slug: "urban-widetrack-defender-octa",
    title: {
      ua: "Urban Widetrack для Defender OCTA",
      en: "Urban Widetrack for Defender OCTA",
    },
    caption: {
      ua: "Купуючи Defender OCTA, ви вже обираєте автомобіль, який не губиться в потоці. Але іноді хочеться, щоб саме ваш автомобіль заявляв про себе ще голосніше.\n\nUrban Widetrack додає OCTA ще більше характеру: карбоновий капот, розширені арки, нові передні та бокові елементи, задній спойлер, оформлення вихлопу й задня накладка на запасне колесо з карбоновими вставками змінюють увесь силует авто. Ковані Urban Vossen UV-9 завершують образ.\n\nКомплект розроблений спеціально для Defender OCTA та вже доступний для замовлення. Якщо хочеться більшої індивідуальності — можливо, Urban Widetrack саме те, чого бракувало вашому автомобілю.\n\nДізнатися про комплектацію та замовити Urban Widetrack можна в One Company.\n\n#urban #defenderocta #onecompany #tuning #тюнінг",
      en: "By choosing a Defender OCTA, you have already picked a car that does not get lost in traffic. But sometimes you want your own car to make an even louder statement.\n\nUrban Widetrack gives the OCTA even more character: a carbon-fibre bonnet, widened arches, new front and side elements, a rear spoiler, exhaust finishers and a rear spare-wheel cover with carbon inserts change the entire silhouette. Forged Urban Vossen UV-9 wheels complete the look.\n\nThe kit was developed specifically for the Defender OCTA and is already available to order. If you want more individuality, Urban Widetrack may be exactly what your car was missing.\n\nYou can find out about the configuration and order Urban Widetrack through One Company.\n\n#urban #defenderocta #onecompany #tuning",
    },
    media: [
      { type: "image", file: "DdljaRSjIGn-v4-1.jpg" },
      { type: "image", file: "DdljaRSjIGn-v4-2.jpg" },
      { type: "image", file: "DdljaRSjIGn-v4-3.jpg" },
    ],
    cover: { file: "DdljaRSjIGn-v4-1.jpg", width: 1088, height: 1344 },
  },
  {
    shortcode: "Dd1I7ZJDDC1",
    date: "2026-09-28T12:02:54.000Z",
    slug: "eventuri-b58n2-gen3-bmw-m340i-m440i",
    title: {
      ua: "Eventuri B58N2 Gen 3 для BMW M340i та M440i",
      en: "Eventuri B58N2 Gen 3 Intake for BMW M340i and M440i",
    },
    caption: {
      ua: "Карбон під капотом - це красиво. А коли він ще й допомагає двигуну дихати вільніше — ще краще.\n\nEventuri B58N2 Gen 3 для BMW M340i та M440i 2025+ захищає фільтр від гарячого повітря, а збільшена впускна труба допомагає подавати до турбіни більше свіжого. У комплекті - dry-фільтр і додатковий теплозахист. Виглядає акуратно, стильно й добре вписується в підкапотний простір. І все це виглядає так, ніби завжди мало стояти під капотом цього BMW.\n\nПідібрати конфігурацію та дізнатися про замовлення можна в One Company.\n\n#eventuri #bmwm340i #bmwm440i #onecompany #bmwtuning",
      en: "Carbon under the bonnet looks great. And when it also helps the engine breathe more freely, it is even better.\n\nThe Eventuri B58N2 Gen 3 for the 2025+ BMW M340i and M440i shields the filter from hot air, while the enlarged intake tube helps feed more fresh air to the turbo. The kit includes a dry filter and additional heat shielding. It looks neat and stylish and sits well in the engine bay, as if it had always belonged under this BMW's bonnet.\n\nYou can choose the configuration and find out how to order through One Company.\n\n#eventuri #bmwm340i #bmwm440i #onecompany #bmwtuning",
    },
    media: [
      { type: "image", file: "Dd1I7ZJDDC1-v4-1.jpg" },
      { type: "image", file: "Dd1I7ZJDDC1-v4-2.jpg" },
      { type: "image", file: "Dd1I7ZJDDC1-v4-3.jpg" },
    ],
    cover: { file: "Dd1I7ZJDDC1-v4-1.jpg", width: 1080, height: 1350 },
  },
  {
    shortcode: "Dd8gnh2sGcP",
    date: "2026-10-01T17:14:43.000Z",
    slug: "moto-corse-new-shipment",
    title: {
      ua: "Нова поставка Moto Corse",
      en: "New Moto Corse Shipment",
    },
    caption: {
      ua: "Нова поставка @motocorseofficial вже у нас. ✅\n\nБренд, який давно став еталоном преміального тюнінгу для європейських мотоциклів. Moto Corse створює деталі, де інженерія зустрічається з ювелірною точністю: титан, карбон, авіаційний алюміній та високоточна CNC-обробка.\n\nКожен елемент має своє призначення - від підвищення продуктивності до найменших деталей, які формують характер мотоцикла. Саме за цю увагу до матеріалів, конструкції та виконання Moto Corse часто називають «ювеліркою для мотоциклів».\n\nВелику поставку вже отримали та готові підбирати деталі під конкретний мотоцикл.\n\nЩодо наявності, підбору та замовлення деталей Moto Corse — пишіть у Direct або у коментарях. ⤵️⤵️⤵️\n\n#motocorse #mototuning #onecompany #motorcycle",
      en: 'The new shipment from @motocorseofficial has arrived. ✅\n\nA brand that has long been the benchmark for premium tuning of European motorcycles. Moto Corse creates parts where engineering meets jewellery-grade precision: titanium, carbon, aircraft-grade aluminium and high-precision CNC machining.\n\nEvery element has its purpose, from improving performance to the smallest details that shape a motorcycle\'s character. For this attention to materials, design and execution, Moto Corse is often called "the jeweller of motorcycles".\n\nWe have received a large shipment and are ready to select parts for your specific motorcycle.\n\nFor availability, selection and ordering of Moto Corse parts, message us in Direct or in the comments. ⤵️⤵️⤵️\n\n#motocorse #mototuning #onecompany #motorcycle',
    },
    media: [
      {
        type: "video",
        file: "Dd8gnh2sGcP-v4-1.mp4",
        poster: "moto-corse-new-shipment-frame.jpg",
      },
    ],
    cover: { file: "covers/moto-corse-new-shipment-frame.jpg", width: 720, height: 1280 },
  },
  {
    shortcode: "DeHdBudjFuD",
    date: "2026-10-05T15:47:09.000Z",
    slug: "bonamici-racing-cf01-psc1-cfmoto-675-sr-r",
    title: {
      ua: "Bonamici Racing CF01 і PSC1 для CFMOTO 675 SR-R",
      en: "Bonamici Racing CF01 Rearsets and PSC1 Triple Clamp for CFMOTO 675 SR-R",
    },
    caption: {
      ua: "🏁 Новинка для CFMOTO 675 SR-R від @bonamiciracing\n\nПосадка на спортбайку має бути зручною саме тобі - але стандартне положення підніжок не завжди підходить під зріст і стиль їзди. Нова CF01 від Bonamici Racing для CFMOTO 675 SR-R дає 12 варіантів налаштування, щоб підібрати положення ніг під себе. А стандартне чи реверсивне перемикання можна обрати відповідно до звичного стилю керування.\n\nУ цій новій лінійці також є PSC1 - верхня траверса у чорному або сріблястому кольорі, щоб оновити вигляд передньої частини мотоцикла.\n\nПідібрати аксесуари з нової лінійки Bonamici Racing для CFMOTO 675 SR-R та дізнатися про замовлення можна в One Company.\n\n#cfmoto #cfmoto675srr #bonamiciracing #mototuning #onecompany",
      en: "🏁 New for the CFMOTO 675 SR-R from @bonamiciracing\n\nYour riding position on a sportbike should fit you, but the standard footpeg position does not always suit your height and riding style. The new CF01 from Bonamici Racing for the CFMOTO 675 SR-R offers 12 adjustment positions so you can set the footpegs exactly where you want them. You can choose standard or reverse shifting to match your usual riding style.\n\nThe new range also includes the PSC1, a top triple clamp in black or silver, to refresh the look of the front of the motorcycle.\n\nYou can select accessories from the new Bonamici Racing range for the CFMOTO 675 SR-R and find out how to order through One Company.\n\n#cfmoto #cfmoto675srr #bonamiciracing #mototuning #onecompany",
    },
    media: [
      { type: "image", file: "DeHdBudjFuD-v4-1.jpg" },
      { type: "image", file: "DeHdBudjFuD-v4-2.jpg" },
      { type: "image", file: "DeHdBudjFuD-v4-3.jpg" },
      { type: "image", file: "DeHdBudjFuD-v4-4.jpg" },
      { type: "image", file: "DeHdBudjFuD-v4-5.jpg" },
    ],
    cover: { file: "DeHdBudjFuD-v4-1.jpg", width: 1080, height: 1350 },
  },
  {
    shortcode: "DeTvfbvsQ5Q",
    date: "2026-10-10T09:23:57.000Z",
    slug: "eventuri-carbon-intake-technology",
    title: {
      ua: "Eventuri — технології, які відчуваєш за кермом",
      en: "Eventuri: Technology You Feel Behind the Wheel",
    },
    caption: {
      ua: "@eventuri_ технології, які відчуваєш за кермом.\n\nБританський бренд, який змінив уявлення про системи впуску повітря для автомобілів.\n\nEventuri поєднує інноваційні технології, передові аеродинамічні рішення та преміальні матеріали, створюючи карбонові системи впуску, де кожна деталь працює на результат.\n\nВ основі технології - запатентована конструкція корпусу фільтра, що забезпечує плавний потік повітря, зменшує турбулентність і сприяє реальному приросту потужності. Покращений відгук на педаль газу, виразний звук впуску та бездоганний вигляд підкапотного простору - усе це Eventuri.\n\nКожна система Eventuri - це результат ретельної розробки, де інноваційні технології та увага до найменших деталей забезпечують гармонійне поєднання продуктивності, функціональності й естетики.\n\nВідкривайте нові можливості свого автомобіля разом із Eventuri.\n\nДеталі щодо асортименту, сумісності та замовлення - у Direct або в коментарях.\n\n#eventuri #eventuriintakes #cartuning #тюнінг #onecompany",
      en: "@eventuri_ technology you feel behind the wheel.\n\nThe British brand that changed the way people think about car air intake systems.\n\nEventuri combines innovative technology, advanced aerodynamic solutions and premium materials to create carbon intake systems in which every detail works for the result.\n\nAt the core of the technology is a patented filter-housing design that delivers smooth airflow, reduces turbulence and contributes to a real power gain. Improved throttle response, a distinctive intake sound and a flawless engine bay look: that is Eventuri.\n\nEvery Eventuri system is the result of careful development, where innovative technology and attention to the smallest details combine performance, function and aesthetics.\n\nDiscover new possibilities for your car with Eventuri.\n\nFor details on the range, compatibility and ordering, contact us in Direct or in the comments.\n\n#eventuri #eventuriintakes #cartuning #onecompany",
    },
    media: [
      {
        type: "video",
        file: "DeTvfbvsQ5Q-v4-1.mp4",
        poster: "eventuri-carbon-intake-technology-frame.jpg",
      },
    ],
    cover: {
      file: "covers/eventuri-carbon-intake-technology-frame.jpg",
      width: 720,
      height: 1280,
    },
  },
];

function toPost(entry) {
  const id = `ig-${entry.shortcode.toLowerCase()}`;
  const tags = [...new Set([...entry.caption.ua.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]))];
  const media = entry.media.map((item, index) => {
    const base = item.type === "video" ? "/videos/blog/" : "/images/blog/";
    const out = {
      id: `media-${id}-${index + 1}`,
      type: item.type,
      src: `${base}${item.file}`,
      alt: entry.title.en,
    };
    if (item.poster) out.poster = `/images/blog/covers/${item.poster}`;
    return out;
  });
  return {
    id,
    slug: entry.slug,
    title: entry.title,
    caption: entry.caption,
    date: entry.date,
    location: LOCATION,
    tags,
    status: "published",
    media,
    cover: {
      src: `/images/blog/${entry.cover.file}`,
      width: entry.cover.width,
      height: entry.cover.height,
      alt: entry.title,
    },
  };
}

const existingIds = new Set(content.blog.posts.map((post) => post.id));
const existingSlugs = new Set(content.blog.posts.map((post) => post.slug));
let added = 0;

for (const entry of posts) {
  const post = toPost(entry);
  if (existingIds.has(post.id)) {
    console.log(`skip ${post.id} (already present)`);
    continue;
  }
  if (existingSlugs.has(post.slug)) throw new Error(`slug already used: ${post.slug}`);
  for (const item of [
    ...post.media.map((m) => m.src),
    ...post.media.map((m) => m.poster),
    post.cover.src,
  ]) {
    if (item && !fs.existsSync(path.join("public", item)))
      throw new Error(`missing asset: ${item}`);
  }
  // Keep the archive newest-first without reordering the existing posts.
  let index = content.blog.posts.findIndex((p) => Date.parse(p.date) < Date.parse(post.date));
  if (index === -1) index = content.blog.posts.length;
  content.blog.posts.splice(index, 0, post);
  existingIds.add(post.id);
  existingSlugs.add(post.slug);
  added += 1;
  console.log(`added ${post.id} -> ${post.slug} (${post.media.length} media)`);
}

if (added === 0) {
  // A rerun must leave the checked-in file byte-for-byte untouched.
  console.log("Done: 0 post(s) added; site-content.json left untouched.");
  process.exit(0);
}

fs.writeFileSync(FILE, `${JSON.stringify(content, null, 2)}\n`);
console.log(
  `Done: ${added} post(s) added. Run "npx prettier --write ${FILE}" to match the repository formatting.`
);
