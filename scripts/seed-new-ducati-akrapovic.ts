import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Ducati Akrapovič & OEM exhaust system prices source information:
 *
 * 1. Ducati Diavel 1260 (Sku: S-D12SO1-HZT):
 *    - Real-world equivalent: Termignoni approved silencer kit for Diavel 1260.
 *    - MSRP Reference: ~€1,350 (excl. VAT)
 *    - Note: Fictional Akrapovič mockup. Real model uses Termignoni.
 *    - Verification URL (Termignoni basis): https://amsducati.com/ (search "Diavel 1260 Termignoni")
 *
 * 2. Ducati Diavel V4 (Sku: 96482172AA):
 *    - Product: Ducati Performance Racing Exhaust by Akrapovič (latest part number).
 *    - MSRP Reference: ~€3,950 (excl. VAT) / MSRP is $4,699 USD
 *    - Verification URL: https://amsducati.com/diavel-v4-akrapovic-full-race-exhaust-system
 *
 * 3. Ducati Streetfighter V4 (Sku: 96482551AA):
 *    - Product: Ducati Performance Racing Slip-On Exhaust by Akrapovič (latest part number).
 *    - MSRP Reference: ~€3,250 (excl. VAT) / MSRP is $3,600 USD
 *    - Verification URL: https://amsducati.com/ducati-streetfighter-v4-2025-akrapovic-race-slip-on-exhaust
 */
const NEW_DUCATI_PRODUCTS = [
  {
    sku: "S-D12SO1-HZT",
    slug: "akrapovic-slip-on-line-titanium-ducati-diavel-1260",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Akrapovič Slip-On Line (Titanium) Exhaust System for Ducati Diavel 1260",
    titleUa: "Титанова вихлопна система Akrapovič Slip-On Line для Ducati Diavel 1260",
    categoryEn: "Slip-On Exhausts",
    categoryUa: "Глушники Slip-On",
    shortDescEn:
      "Premium titanium slip-on exhaust system offering a deep signature sound, +6.2 HP power increase, and -6.0 kg weight reduction.",
    shortDescUa:
      "Преміальний титановий глушник Akrapovič Slip-On Line, що забезпечує глибокий фірмовий звук, приріст потужності +6.2 к.с. та зниження ваги на -6.0 кг.",
    longDescEn:
      "High-grade titanium exhaust system designed for the Ducati Diavel 1260. Delivers an outstanding balance of performance, visual enhancement, and deep, resonant Akrapovič sound signature. Featuring high-grade titanium mufflers and carbon fiber components.",
    longDescUa:
      "Високоякісна титанова вихлопна система для Ducati Diavel 1260. Забезпечує ідеальний баланс продуктивності, естетичного вигляду та фірмового глибокого звуку Akrapovič. Виготовлена з титану преміум-класу та оздоблена карбоновими елементами.",
    priceEur: 1350.0,
    image: "/images/shop/akrapovic/ducati-diavel-1260.webp",
    weight: 4.8, // 4.8 kg
    powerGain: "+6.2 HP",
    weightReduction: "-6.0 kg",
    soundLevel: "103 dB @ 4750 rpm",
    tags: [
      "Akrapovic",
      "Akrapovič",
      "Moto",
      "Ducati",
      "Diavel 1260",
      "fits-make:ducati",
      "fits-model:ducati:diavel-1260",
      "fits:ducati-diavel-1260",
      "fits-year:2019",
      "fits-year:2020",
      "fits-year:2021",
      "fits-year:2022",
      "fits-year:2023",
    ],
  },
  {
    sku: "96482172AA", // Official Ducati part number for Diavel V4 Akrapovič Racing Exhaust
    slug: "ducati-performance-racing-exhaust-system-akrapovic-diavel-v4",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Ducati Performance Racing Exhaust System by Akrapovič for Ducati Diavel V4",
    titleUa: "Гоночна вихлопна система Ducati Performance від Akrapovič для Ducati Diavel V4",
    categoryEn: "Full Exhaust Systems",
    categoryUa: "Повні вихлопні системи",
    shortDescEn:
      "Official Ducati Performance full titanium racing exhaust system developed by Akrapovič. Unleashes +7.0% power and drastically reduces weight by -11.0 kg.",
    shortDescUa:
      "Офіційна повністю титанова гоночна вихлопна система Ducati Performance, розроблена Akrapovič. Збільшує потужність на +7.0% та знижує вагу на -11.0 кг.",
    longDescEn:
      "Designed exclusively for the Diavel V4, this racing system features high-grade titanium silencers with carbon fiber heat guards. Removes the catalytic converter to drastically reduce weight (-11.0 kg) and unleash the full power potential (+7% HP, +6% Torque) of the V4 Granturismo engine. Racing use only.",
    longDescUa:
      "Створена спеціально для Diavel V4, ця гоночна система оснащена титановими глушниками з карбоновими захисними екранами. Повністю видаляє каталізатор, зменшуючи вагу на 11.0 кг та розкриваючи повний потенціал двигуна V4 Granturismo (+7% потужності, +6% крутного моменту). Тільки для треку.",
    priceEur: 3950.0,
    image: "/images/shop/akrapovic/ducati-diavel-v4.webp",
    weight: 5.6,
    powerGain: "+7.0% (+11.8 HP)",
    weightReduction: "-11.0 kg",
    soundLevel: "108 dB (with dB-killer) / 109 dB (without dB-killer)",
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
    sku: "96482551AA", // Official Ducati/Akrapovič Slip-On for Streetfighter V4 2025
    slug: "ducati-performance-racing-exhaust-system-akrapovic-streetfighter-v4-2025",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Ducati Performance Racing Slip-On Silencers by Akrapovič for Ducati Streetfighter V4",
    titleUa:
      "Гоночні глушники Slip-On Ducati Performance від Akrapovič для Ducati Streetfighter V4",
    categoryEn: "Slip-On Exhausts",
    categoryUa: "Глушники Slip-On",
    shortDescEn:
      "Official Ducati Performance racing slip-on silencer system developed by Akrapovič. Delivers significant weight reduction and an aggressive exhaust note.",
    shortDescUa:
      "Офіційна гоночна вихлопна система Slip-On від Ducati Performance, розроблена Akrapovič. Забезпечує значне зниження ваги та агресивний звук.",
    longDescEn:
      "Constructed from high-grade titanium, these racing slip-on silencers by Akrapovič are designed for the Streetfighter V4 (2025+). Optimizes performance across the power band and saves weight compared to the stock exhaust. Features carbon fiber heat guards. Racing use only.",
    longDescUa:
      "Виготовлені з високоякісного титану, ці гоночні глушники Slip-On від Akrapovič розроблені для нового Streetfighter V4 (2025+). Оптимізують крутний момент і потужність у всьому діапазоні обертів, знижують вагу та оснащені карбоновими тепловими екранами. Тільки для треку.",
    priceEur: 3250.0,
    image: "/images/shop/akrapovic/ducati-streetfighter-v4.webp",
    weight: 4.2,
    powerGain: "+4.5 HP",
    weightReduction: "-3.5 kg",
    soundLevel: "102 dB (with dB-killer) / 105 dB (without dB-killer)",
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
  console.log("=== Seeding Updated Ducati Akrapovič Products with Specifications ===");

  for (const item of NEW_DUCATI_PRODUCTS) {
    console.log(`Processing SKU: ${item.sku} - ${item.titleEn}...`);

    // Clean up existing product to prevent unique constraint conflicts
    // Cleanup old slugs and all possible variations
    const existingSlugs = [
      item.slug,
      "ducati-performance-racing-exhaust-system-akrapovic-diavel-v4",
      "akrapovic-slip-on-line-titanium-ducati-diavel-1260",
      "ducati-performance-racing-exhaust-system-akrapovic-streetfighter-v4-2025",
    ];

    for (const slug of existingSlugs) {
      const existing = await prisma.shopProduct.findUnique({
        where: { slug },
      });

      if (existing && existing.slug === item.slug) {
        console.log(`  Product with slug "${slug}" already exists. Cleaning up...`);
        await prisma.shopProductMedia.deleteMany({ where: { productId: existing.id } });
        await prisma.shopProductVariant.deleteMany({ where: { productId: existing.id } });
        await prisma.shopProduct.delete({ where: { id: existing.id } });
      }
    }

    const specListEn = `<ul>
      <li>Part Number: ${item.sku}</li>
      <li>Brand: Akrapovič</li>
      <li>Power Gain: ${item.powerGain}</li>
      <li>Weight Reduction: ${item.weightReduction}</li>
      <li>Sound Level: ${item.soundLevel}</li>
    </ul>`;

    const specListUa = `<ul>
      <li>Артикул: ${item.sku}</li>
      <li>Бренд: Akrapovič</li>
      <li>Приріст потужності: ${item.powerGain}</li>
      <li>Зниження ваги: ${item.weightReduction}</li>
      <li>Рівень звуку: ${item.soundLevel}</li>
    </ul>`;

    const bodyHtmlEn = `<h2>${item.titleEn}</h2><p>${item.longDescEn}</p><h3>Specifications:</h3>${specListEn}`;
    const bodyHtmlUa = `<h2>${item.titleUa}</h2><p>${item.longDescUa}</p><h3>Технічні характеристики:</h3>${specListUa}`;

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
        image: item.image,
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
            image: item.image,
            isDefault: true,
            requiresShipping: true,
            taxable: true,
          },
        },
        media: {
          create: {
            mediaType: "IMAGE",
            src: item.image,
            position: 1,
          },
        },
      },
    });

    console.log(`  Successfully seeded product ID: ${product.id}`);
  }

  console.log("=== Seeding Updated Ducati Akrapovič Products Complete! ===");
}

main()
  .catch((err) => {
    console.error("Error during seeding:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
