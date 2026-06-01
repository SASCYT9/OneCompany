import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
      "Premium titanium slip-on exhaust system by Akrapovič for the Ducati Diavel 1260, offering a deep signature sound and significant weight reduction.",
    shortDescUa:
      "Преміальний титановий глушник Akrapovič Slip-On Line для Ducati Diavel 1260, що забезпечує глибокий фірмовий звук та значне зниження ваги.",
    longDescEn:
      "The Slip-On Line represents the first step in exhaust system tuning. Easy to install, this high-grade titanium muffler delivers an outstanding balance of performance, visual enhancement, and deep, resonant Akrapovič sound.",
    longDescUa:
      "Серія Slip-On Line представляє перший крок у тюнінгу вихлопної системи. Простий у встановленні глушник із високоякісного титану забезпечує відмінне поєднання продуктивності, естетичного вигляду та глибокого звуку Akrapovič.",
    priceEur: 1350.0,
    image: "/images/shop/akrapovic/ducati-diavel-1260.webp",
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
    sku: "96482161A",
    slug: "ducati-performance-racing-exhaust-system-akrapovic-diavel-v4",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Ducati Performance Racing Exhaust System by Akrapovič for Ducati Diavel V4",
    titleUa: "Гоночна вихлопна система Ducati Performance від Akrapovič для Ducati Diavel V4",
    categoryEn: "Full Exhaust Systems",
    categoryUa: "Повні вихлопні системи",
    shortDescEn:
      "Official Ducati Performance full titanium racing exhaust system developed by Akrapovič for the Diavel V4. Maximizes output and provides a raw racing exhaust note.",
    shortDescUa:
      "Офіційна повністю титанова гоночна вихлопна система Ducati Performance, розроблена Akrapovič для Diavel V4. Максимізує віддачу двигуна та дарує яскравий гоночний звук.",
    longDescEn:
      "Designed exclusively for the Diavel V4, this racing system features a high-grade titanium silencer with carbon fiber heat guards. Removes the catalytic converter to drastically reduce weight (-9.0 kg) and unleash the full power potential of the V4 Granturismo engine (+7 HP).",
    longDescUa:
      "Розроблена спеціально для Diavel V4, ця гоночна система оснащена глушником із високоякісного титану та карбоновими захисними екранами. Повністю видаляє каталізатор, зменшуючи вагу на 9 кг та вивільняючи потенціал потужності двигуна V4 Granturismo (+7 к.с.).",
    priceEur: 3950.0,
    image: "/images/shop/akrapovic/ducati-diavel-v4.webp",
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
    sku: "96482321A",
    slug: "ducati-performance-racing-exhaust-system-akrapovic-streetfighter-v4-2025",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Ducati Performance Racing Exhaust System by Akrapovič for Ducati Streetfighter V4",
    titleUa:
      "Гоночна вихлопна система Ducati Performance від Akrapovič для Ducati Streetfighter V4",
    categoryEn: "Full Exhaust Systems",
    categoryUa: "Повні вихлопні системи",
    shortDescEn:
      "The ultimate racing exhaust for the new generation Streetfighter V4. Full titanium system with twin underslung mufflers, optimized for maximum track performance.",
    shortDescUa:
      "Абсолютний гоночний вихлоп для нового покоління Streetfighter V4. Повністю титанова система з двома нижніми глушниками, оптимізована для максимальних результатів на треку.",
    longDescEn:
      "Derived directly from MotoGP experience, this full titanium system is engineered for the 2025+ Streetfighter V4. Delivers outstanding weight savings, optimizes power output across the rev range, and features the legendary Akrapovič sound signature.",
    longDescUa:
      "Створена на основі досвіду MotoGP, ця повністю титанова система розроблена для нового Streetfighter V4 (2025+). Забезпечує колосальне зниження ваги двигуна та надає легендарне звукове супроводження Akrapovič.",
    priceEur: 4250.0,
    image: "/images/shop/akrapovic/ducati-streetfighter-v4.webp",
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
  console.log("=== Seeding New Ducati Akrapovič Products ===");

  for (const item of NEW_DUCATI_PRODUCTS) {
    console.log(`Processing SKU: ${item.sku} - ${item.titleEn}...`);

    // Clean up existing product to prevent unique constraint conflicts
    const existing = await prisma.shopProduct.findUnique({
      where: { slug: item.slug },
    });

    if (existing) {
      console.log(`  Product already exists. Cleaning up...`);
      // Delete child models first
      await prisma.shopProductMedia.deleteMany({ where: { productId: existing.id } });
      await prisma.shopProductVariant.deleteMany({ where: { productId: existing.id } });
      await prisma.shopProduct.delete({ where: { id: existing.id } });
    }

    const bodyHtmlEn = `<h2>${item.titleEn}</h2><p>${item.longDescEn}</p><ul><li>Part Number: ${item.sku}</li><li>Brand: Akrapovič</li></ul>`;
    const bodyHtmlUa = `<h2>${item.titleUa}</h2><p>${item.longDescUa}</p><ul><li>Артикул: ${item.sku}</li><li>Бренд: Akrapovič</li></ul>`;

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
        longDescEn: item.longDescEn,
        longDescUa: item.longDescUa,
        bodyHtmlEn,
        bodyHtmlUa,
        seoTitleEn: item.titleEn,
        seoTitleUa: item.titleUa,
        seoDescriptionEn: item.shortDescEn,
        seoDescriptionUa: item.shortDescUa,
        priceEur: item.priceEur,
        image: item.image,
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

  console.log("=== Seeding New Ducati Akrapovič Products Complete! ===");
}

main()
  .catch((err) => {
    console.error("Error during seeding:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
