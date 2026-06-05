import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Ducati Performance & Akrapovič / Termignoni official exhaust system specifications:
 *
 * 1. Ducati Diavel 1260 (Sku: 96481581A):
 *    - Product: Ducati Performance Racing Complete Exhaust System by Termignoni
 *    - MSRP Reference: $3,726.93 USD / ~€3,158.42 EUR (excl. VAT)
 *    - Source: https://ducatiomaha.com/products/96481581a-racing-complete-exhaust-system-diavel-1260
 *
 * 2. Ducati Diavel V4 (Sku: 96482172AA):
 *    - Product: Ducati Performance Complete Racing Exhaust System by Akrapovič
 *    - MSRP Reference: $7,184.28 USD / ~€6,088.37 EUR (excl. VAT)
 *    - Source: https://amsducati.com/ducati-diavel-v4-akrapovic-full-race-exhaust-system
 *
 * 3. Ducati Streetfighter V4 (Sku: 96482551AA):
 *    - Product: Ducati Performance Racing Slip-On Silencers by Akrapovič
 *    - MSRP Reference: $5,542.43 USD / ~€4,696.97 EUR (excl. VAT)
 *    - Source: https://amsducati.com/ducati-streetfighter-v4-2025-akrapovic-race-slip-on-exhaust
 */
const NEW_DUCATI_PRODUCTS = [
  {
    sku: "96482172AA", // Official Ducati/Akrapovič part number for Diavel V4 Complete Racing System
    slug: "ducati-performance-complete-racing-exhaust-system-akrapovic-diavel-v4",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Ducati Performance Racing Exhaust System by Akrapovič for Ducati Diavel V4",
    titleUa: "Гоночна вихлопна система Ducati Performance від Akrapovič для Ducati Diavel V4",
    categoryEn: "Full Exhaust Systems",
    categoryUa: "Повні вихлопні системи",
    shortDescEn:
      "Official Ducati Performance complete racing exhaust system developed by Akrapovič. Unleashes +7.0% power, +6.0% torque, and reduces weight by -11.0 kg.",
    shortDescUa:
      "Офіційна повністю титанова гоночна вихлопна система Ducati Performance, розроблена Akrapovič. Збільшує потужність на +7.0%, крутний момент на +6.0% та знижує вагу на -11.0 кг.",
    longDescEn:
      "Constructed exclusively for the Diavel V4. Features a titanium silencer assembly and carbon fiber cover in a distinct 4:4 layout. Removes the catalytic converter to reduce overall weight by 11 kg (approx. 24 lbs) and unlock the full potential of the V4 Granturismo engine, increasing peak power by 7% and torque by 6%. Designed for track use only. VIN registration is required at an authorized dealer to install the specific Up-Map engine mapping.",
    longDescUa:
      "Створена спеціально для Diavel V4. Оснащена титановим глушником та карбоновим кожухом у конфігурації 4:4. Видалення каталізатора дозволило знизити вагу мотоцикла на 11 кг (близько 24 фунтів) та розкрити потенціал двигуна V4 Granturismo (+7% потужності, +6% крутного моменту). Тільки для закритих треків. Установка потребує прив'язки VIN-коду та прошивки Up-Map через дилера.",
    priceEur: 6088.37,
    weight: 5.6,
    powerGain: "+7.0% (+11.8 HP)",
    weightReduction: "-11.0 kg",
    soundLevel: "108 dB (with dB-killer) / 109 dB (without dB-killer)",
    gallery: [
      "/images/shop/akrapovic/ducati-diavel-v4-exhaust.webp",
      "/images/shop/akrapovic/ducati-diavel-v4.webp",
    ],
    tags: [
      "Akrapovic",
      "Akrapovič",
      "Moto",
      "Ducati",
      "Diavel V4",
      "fits-make:ducati",
      "fits-model:ducati:diavel-v4",
      "fits:ducati-diavel-v4",
      "fits-year:2023",
      "fits-year:2024",
      "fits-year:2025",
      "fits-year:2026",
    ],
  },
  {
    sku: "96482551AA", // Official Ducati/Akrapovič part number for Streetfighter V4 2025 Racing Slip-On
    slug: "ducati-performance-racing-slip-on-silencers-akrapovic-streetfighter-v4",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Ducati Performance Racing Slip-On Silencers by Akrapovič for Ducati Streetfighter V4",
    titleUa:
      "Гоночні глушники Slip-On Ducati Performance від Akrapovič для Ducati Streetfighter V4",
    categoryEn: "Slip-On Exhausts",
    categoryUa: "Глушники Slip-On",
    shortDescEn:
      "Official Ducati Performance racing slip-on silencer system developed by Akrapovič. Optimizes torque delivery, saves weight, and delivers an aggressive note.",
    shortDescUa:
      "Офіційні гоночні глушники Slip-On від Ducati Performance, розроблені Akrapovič. Оптимізують крутний момент, знижують вагу та забезпечують агресивний звук.",
    longDescEn:
      "Constructed entirely from high-grade titanium and paired with carbon fiber heat guards. Tailored for the Streetfighter V4 (2025+). Delivers power and torque optimization across the entire RPM band while significantly reducing exhaust weight. Sound output is rated at 107 dB @ 5500 rpm with dB-killer installed (112 dB without). Race use only. VIN registration at an authorized dealer is mandatory to load the specific engine mapping and calibrate the DTC, DPL, and DWC electronic aids.",
    longDescUa:
      "Виготовлені повністю з титану преміальної якості та оснащені карбоновими тепловими екранами. Розроблені для моделей Streetfighter V4 (2025+). Забезпечують оптимізацію потужності та крутного моменту у всьому діапазоні обертів зі значним зниженням ваги. Гучність звуку становить 107 дБ при 5500 об/хв зі встановленим dB-killer (112 дБ без нього). Тільки для гоночного використання. Встановлення потребує обов'язкової дилерської реєстрації VIN-коду та прошивки для адаптації електроніки DTC, DPL та DWC.",
    priceEur: 4696.97,
    weight: 4.2,
    powerGain: "+4.5 HP",
    weightReduction: "-3.5 kg",
    soundLevel: "107 dB (with dB-killer) / 112 dB (without dB-killer)",
    gallery: [
      "/images/shop/akrapovic/ducati-streetfighter-v4-exhaust.webp",
      "/images/shop/akrapovic/ducati-streetfighter-v4.webp",
    ],
    tags: [
      "Akrapovic",
      "Akrapovič",
      "Moto",
      "Ducati",
      "Streetfighter V4 2025",
      "fits-make:ducati",
      "fits-model:ducati:streetfighter-v4-2025",
      "fits:ducati-streetfighter-v4-2025",
      "fits-year:2025",
      "fits-year:2026",
    ],
  },
];

async function main() {
  console.log("=== Seeding Official Ducati Exhaust Products with Specs & Multi-Image Gallery ===");

  // Explicitly purge Termignoni product (Diavel 1260 - 96481581A) to ensure it is completely deleted from the database
  const termignoniSku = "96481581A";
  const existingTermignoni = await prisma.shopProduct.findFirst({
    where: { sku: termignoniSku },
  });
  if (existingTermignoni) {
    console.log(
      `Purging Termignoni product by SKU "${termignoniSku}" (ID: ${existingTermignoni.id})...`
    );
    await prisma.shopProductMedia.deleteMany({ where: { productId: existingTermignoni.id } });
    await prisma.shopProductVariant.deleteMany({ where: { productId: existingTermignoni.id } });
    await prisma.shopProduct.delete({ where: { id: existingTermignoni.id } });
    console.log("  Purged successfully.");
  }

  for (const item of NEW_DUCATI_PRODUCTS) {
    console.log(`Processing SKU: ${item.sku} - ${item.titleEn}...`);

    // Clean up by old SKU or slug to prevent unique constraint conflicts
    const cleanupSkus = [item.sku, "S-D12SO1-HZT"];
    for (const skuToDel of cleanupSkus) {
      const existing = await prisma.shopProduct.findFirst({
        where: { sku: skuToDel },
      });
      if (existing) {
        console.log(`  Deleting existing product by SKU "${skuToDel}" (ID: ${existing.id})...`);
        await prisma.shopProductMedia.deleteMany({ where: { productId: existing.id } });
        await prisma.shopProductVariant.deleteMany({ where: { productId: existing.id } });
        await prisma.shopProduct.delete({ where: { id: existing.id } });
      }
    }

    const cleanupSlugs = [
      item.slug,
      "ducati-performance-racing-exhaust-system-akrapovic-diavel-v4",
      "akrapovic-slip-on-line-titanium-ducati-diavel-1260",
      "ducati-performance-racing-exhaust-system-akrapovic-streetfighter-v4-2025",
    ];
    for (const slugToDel of cleanupSlugs) {
      const existing = await prisma.shopProduct.findUnique({
        where: { slug: slugToDel },
      });
      if (existing) {
        console.log(`  Deleting existing product by slug "${slugToDel}" (ID: ${existing.id})...`);
        await prisma.shopProductMedia.deleteMany({ where: { productId: existing.id } });
        await prisma.shopProductVariant.deleteMany({ where: { productId: existing.id } });
        await prisma.shopProduct.delete({ where: { id: existing.id } });
      }
    }

    const specListEn = `<ul>
      <li>Part Number: ${item.sku}</li>
      <li>Brand: Akrapovič (Ducati Performance)</li>
      <li>Power Gain: ${item.powerGain}</li>
      <li>Weight Reduction: ${item.weightReduction}</li>
      <li>Sound Level: ${item.soundLevel}</li>
    </ul>`;

    const specListUa = `<ul>
      <li>Артикул: ${item.sku}</li>
      <li>Бренд: Akrapovič (Ducati Performance)</li>
      <li>Приріст потужності: ${item.powerGain}</li>
      <li>Зниження ваги: ${item.weightReduction}</li>
      <li>Рівень звуку: ${item.soundLevel}</li>
    </ul>`;

    const bodyHtmlEn = `<h2>${item.titleEn}</h2><p>${item.longDescEn}</p><h3>Specifications:</h3>${specListEn}`;
    const bodyHtmlUa = `<h2>${item.titleUa}</h2><p>${item.longDescUa}</p><h3>Технічні характеристики:</h3>${specListUa}`;

    const mainImage = item.gallery[0];

    const product = await prisma.shopProduct.create({
      data: {
        slug: item.slug,
        sku: item.sku,
        scope: item.scope,
        brand: item.brand,
        vendor: item.vendor,
        titleEn: item.titleEn,
        titleUa: item.titleUa,
        categoryEn: item.categoryEn,
        categoryUa: item.categoryUa,
        shortDescEn: item.shortDescEn,
        shortDescUa: item.shortDescUa,
        longDescEn:
          item.longDescEn +
          "\n\nSpecifications:\n" +
          `• Power Gain: ${item.powerGain}\n• Weight Reduction: ${item.weightReduction}\n• Sound Level: ${item.soundLevel}`,
        longDescUa:
          item.longDescUa +
          "\n\nТехнічні характеристики:\n" +
          `• Приріст потужності: ${item.powerGain}\n• Зниження ваги: ${item.weightReduction}\n• Рівень звуку: ${item.soundLevel}`,
        bodyHtmlEn,
        bodyHtmlUa,
        seoTitleEn: item.titleEn,
        seoTitleUa: item.titleUa,
        seoDescriptionEn: item.shortDescEn,
        seoDescriptionUa: item.shortDescUa,
        priceEur: item.priceEur,
        image: mainImage,
        weight: item.weight,
        isPublished: true,
        status: "ACTIVE",
        tags: item.tags,
        variants: {
          create: {
            title: item.titleEn,
            sku: item.sku,
            position: 1,
            inventoryQty: 5,
            inventoryPolicy: "CONTINUE",
            priceEur: item.priceEur,
            image: mainImage,
            isDefault: true,
            requiresShipping: true,
            taxable: true,
          },
        },
        media: {
          create: item.gallery.map((src, idx) => ({
            mediaType: "IMAGE",
            src,
            position: idx + 1,
          })),
        },
      },
    });

    console.log(`  Successfully seeded product ID: ${product.id}`);
  }

  console.log("=== Seeding Ducati Exhaust Products Complete! ===");
}

main()
  .catch((err) => {
    console.error("Error during seeding:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
