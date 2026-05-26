import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import { putPublicBlob, isBlobStorageConfigured } from "../src/lib/runtimeBlobStorage.js";

const prisma = new PrismaClient();

const PRODUCTS_TO_SEED = [
  {
    sku: "S-B10E9-APLT",
    slug: "akrapovic-evolution-line-titanium-bmw-s1000rr-sb10e9-aplt",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Akrapovič Evolution Line (Titanium) Exhaust System for BMW S1000RR / M1000RR",
    titleUa: "Титанова вихлопна система Akrapovič Evolution Line для BMW S1000RR / M1000RR",
    categoryEn: "Full Exhaust Systems",
    categoryUa: "Повні вихлопні системи",
    shortDescEn:
      "The flagship Evolution Line full titanium exhaust system for the BMW S1000RR and M1000RR, delivering ultimate power gains and signature race sound.",
    shortDescUa:
      "Флагманська повністю титанова вихлопна система Evolution Line для BMW S1000RR та M1000RR, що забезпечує максимальний приріст потужності та гоночний звук.",
    longDescEn:
      "Constructed entirely from high-grade lightweight titanium with a hand-crafted carbon fiber end cap, the Evolution Line represents the peak of exhaust tuning. Shaves off 6.7 kg of weight while increasing power by 10.3 hp.",
    longDescUa:
      "Виготовлена повністю з високоякісного надлегкого титану з карбоновим наконечником ручної роботи, серія Evolution Line представляє вершину тюнінгу вихлопу. Зменшує вагу на 6.7 кг і збільшує потужність на 10.3 к.с.",
    priceEur: 2850.0,
    priceUsd: 3100.0,
    priceUah: 125000.0,
    tags: ["Akrapovic", "Akrapovič", "Moto", "BMW", "S1000RR", "M1000RR", "Evolution Line"],
    imageUrl: "https://www.carpimoto.com/Images/Products/Zoom/S_B10E9_APLT.jpg",
    blobPathname: "akrapovic-moto/S_B10E9_APLT.jpg",
  },
  {
    sku: "S-D9E7-CKOT",
    slug: "akrapovic-evolution-line-titanium-ducati-panigale-v2-sd9e7-ckot",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn:
      "Akrapovič Evolution Line (Titanium) Exhaust System for Ducati Panigale V2 / Streetfighter V2",
    titleUa:
      "Титанова вихлопна система Akrapovič Evolution Line для Ducati Panigale V2 / Streetfighter V2",
    categoryEn: "Full Exhaust Systems",
    categoryUa: "Повні вихлопні системи",
    shortDescEn:
      "The pinnacle of racing exhaust technology for the Panigale V2. Full titanium system designed to optimize engine performance and minimize weight.",
    shortDescUa:
      "Вершина технологій гоночного вихлопу для Panigale V2. Повністю титанова система, розроблена для оптимізації роботи двигуна та зниження ваги.",
    longDescEn:
      "Constructed from high-grade lightweight titanium, the Evolution Line represents the peak of exhaust tuning. Offers massive weight reduction and a power gain of +9.8 HP.",
    longDescUa:
      "Виготовлена з високоякісного титану, серія Evolution Line представляє вершину тюнінгу вихлопу. Забезпечує величезне зниження ваги та приріст потужності на +9.8 к.с.",
    priceEur: 4150.0,
    priceUsd: 4500.0,
    priceUah: 185000.0,
    tags: [
      "Akrapovic",
      "Akrapovič",
      "Moto",
      "Ducati",
      "Panigale V2",
      "Streetfighter V2",
      "Evolution Line",
    ],
    imageUrl:
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/akrapovic-moto/S_D9E7_CKOT.webp",
    blobPathname: "akrapovic-moto/S_D9E7_CKOT.webp",
  },
  {
    sku: "S-Y10E3-APT",
    slug: "akrapovic-evolution-line-titanium-yamaha-yzf-r1-sy10e3-apt",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Akrapovič Evolution Line (Titanium) Exhaust System for Yamaha YZF-R1 / R1M",
    titleUa: "Титанова вихлопна система Akrapovič Evolution Line для Yamaha YZF-R1 / R1M",
    categoryEn: "Full Exhaust Systems",
    categoryUa: "Повні вихлопні системи",
    shortDescEn:
      "High-performance full titanium exhaust system with carbon fiber heat shield, designed for maximum racetrack output.",
    shortDescUa:
      "Високопродуктивна повністю титанова вихлопна система з карбоновим термозахисним екраном, створена для трекового використання.",
    longDescEn:
      "Constructed from lightweight titanium, offering approximately 5.8 kg in weight savings. Designed for racing teams and riders looking to extract the absolute maximum from their Yamaha R1.",
    longDescUa:
      "Виготовлена з легкого титану, що забезпечує зниження ваги приблизно на 5.8 кг. Створена для гоночних команд і пілотів, які бажають отримати абсолютний максимум від Yamaha R1.",
    priceEur: 2750.0,
    priceUsd: 2980.0,
    priceUah: 120000.0,
    tags: ["Akrapovic", "Akrapovič", "Moto", "Yamaha", "R1", "R1M", "Evolution Line"],
    imageUrl: "https://www.carpimoto.com/Images/Products/Zoom/S_Y10E3_APT.jpg",
    blobPathname: "akrapovic-moto/S_Y10E3_APT.jpg",
  },
  {
    sku: "S-B13SO4-HLGT",
    slug: "akrapovic-slip-on-line-titanium-bmw-r1300gs-sb13so4-hlgt",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Akrapovič Slip-On Line (Titanium) Exhaust for BMW R 1300 GS",
    titleUa: "Глушник Akrapovič Slip-On Line (Титан) для BMW R 1300 GS",
    categoryEn: "Slip-On Exhausts",
    categoryUa: "Глушники Slip-On",
    shortDescEn:
      "Fully street-legal premium titanium slip-on muffler with double outlet and carbon fiber end caps for the new BMW R1300GS.",
    shortDescUa:
      "Преміальний титановий глушник Slip-On подвійної конструкції з карбоновими накладками, повністю сертифікований для доріг загального користування.",
    longDescEn:
      "A plug-and-play slip-on exhaust featuring a double-flow muffler design constructed from high-grade titanium. Features EC/ECE type-approval and instantly enhances sound and aesthetic appeal.",
    longDescUa:
      "Швидкомонтований вихлоп plug-and-play з глушником подвійного потоку з високоякісного титану. Має європейське схвалення типу EC/ECE, миттєво покращує звук і зовнішній вигляд.",
    priceEur: 1250.0,
    priceUsd: 1380.0,
    priceUah: 55000.0,
    tags: ["Akrapovic", "Akrapovič", "Moto", "BMW", "R1300GS", "R 1300 GS", "Slip-On"],
    imageUrl: "https://www.carpimoto.com/Images/Products/Zoom/S_B13SO4_HLGT.jpg",
    blobPathname: "akrapovic-moto/S_B13SO4_HLGT.jpg",
  },
  {
    sku: "S-K10SO27-HRC",
    slug: "akrapovic-slip-on-line-carbon-kawasaki-ninja-zx10r-sk10so27-hrc",
    scope: "moto",
    brand: "AKRAPOVIC",
    vendor: "AKRAPOVIC",
    titleEn: "Akrapovič Slip-On Line (Carbon) Exhaust for Kawasaki Ninja ZX-10R / ZX-10RR",
    titleUa: "Глушник Akrapovič Slip-On Line (Карбон) для Kawasaki Ninja ZX-10R / ZX-10RR",
    categoryEn: "Slip-On Exhausts",
    categoryUa: "Глушники Slip-On",
    shortDescEn:
      "Race-inspired hexagonal carbon fiber muffler with a titanium end cap, certified with EC/ECE approval.",
    shortDescUa:
      "Глушник шестигранної форми з карбоновим корпусом та титановим наконечником, схвалений за стандартами EC/ECE.",
    longDescEn:
      "The first step in exhaust system tuning. Replaces the stock muffler to provide a distinct deep sound, weight reduction, and minor power gains without requiring ECU remaps.",
    longDescUa:
      "Перший крок у налаштуванні вихлопної системи. Замінює заводський глушник, надаючи глибокий фірмовий звук, знижуючи вагу та покращуючи потужність двигуна.",
    priceEur: 980.0,
    priceUsd: 1080.0,
    priceUah: 43000.0,
    tags: ["Akrapovic", "Akrapovič", "Moto", "Kawasaki", "ZX-10R", "ZX-10RR", "Slip-On"],
    imageUrl: "https://www.carpimoto.com/Images/Products/Zoom/S_K10SO27_HRC.jpg",
    blobPathname: "akrapovic-moto/S_K10SO27_HRC.jpg",
  },
];

async function main() {
  console.log("=== Akrapovič Moto Products Seeding ===");

  // Clean up old Ducati Panigale V4 product if it exists
  const oldSku = "S-D11E3-FJTD";
  const oldProduct = await prisma.shopProduct.findFirst({
    where: { sku: oldSku },
  });
  if (oldProduct) {
    console.log(`Found old product ${oldProduct.sku} (${oldProduct.titleEn}). Cleaning up...`);
    await prisma.shopProduct.delete({
      where: { id: oldProduct.id },
    });
    console.log("Old product cleaned up successfully.");
  }

  if (!isBlobStorageConfigured()) {
    console.warn(
      "WARNING: Vercel Blob Storage is not configured. Images will fallback to direct URLs."
    );
  }

  for (const item of PRODUCTS_TO_SEED) {
    console.log(`Processing: ${item.sku} (${item.titleEn})...`);

    let finalImageUrl = item.imageUrl;

    if (isBlobStorageConfigured()) {
      try {
        console.log(`Downloading image from ${item.imageUrl}...`);
        const response = await fetch(item.imageUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const buffer = await response.buffer();
        console.log(`Uploading to Vercel Blob: ${item.blobPathname}...`);
        const contentType = item.blobPathname.endsWith(".webp") ? "image/webp" : "image/jpeg";
        const blobResult = await putPublicBlob(item.blobPathname, buffer, contentType);
        finalImageUrl = blobResult.url;
        console.log(`Uploaded successfully! URL: ${finalImageUrl}`);
      } catch (err) {
        console.error(`Error downloading/uploading image for ${item.sku}:`, err);
        console.log(`Falling back to direct URL: ${finalImageUrl}`);
      }
    }

    // Clean up existing product with same slug to prevent collisions
    const existing = await prisma.shopProduct.findUnique({
      where: { slug: item.slug },
    });

    if (existing) {
      console.log(`Product with slug ${item.slug} already exists. Removing to re-seed...`);
      await prisma.shopProduct.delete({
        where: { slug: item.slug },
      });
    }

    // Prepare body HTML
    const bodyHtmlEn = `<h2>${item.titleEn}</h2><p>${item.longDescEn}</p><ul><li>SKU: ${item.sku}</li><li>Brand: Akrapovič</li><li>Line: ${item.tags.includes("Evolution Line") ? "Evolution Line" : "Slip-On Line"}</li></ul>`;
    const bodyHtmlUa = `<h2>${item.titleUa}</h2><p>${item.longDescUa}</p><ul><li>Артикул: ${item.sku}</li><li>Бренд: Akrapovič</li><li>Лінійка: ${item.tags.includes("Evolution Line") ? "Evolution Line" : "Slip-On Line"}</li></ul>`;

    // Create the product
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
        priceUsd: item.priceUsd,
        priceUah: item.priceUah,
        image: finalImageUrl,
        isPublished: true,
        tags: item.tags,
        status: "ACTIVE",
        variants: {
          create: {
            title: item.titleEn,
            sku: item.sku,
            position: 1,
            inventoryQty: 5,
            inventoryPolicy: "CONTINUE",
            priceEur: item.priceEur,
            priceUsd: item.priceUsd,
            priceUah: item.priceUah,
            image: finalImageUrl,
            isDefault: true,
            requiresShipping: true,
            taxable: true,
          },
        },
        media: {
          create: {
            mediaType: "IMAGE",
            src: finalImageUrl,
            position: 1,
          },
        },
      },
    });

    console.log(`Successfully seeded product ID: ${product.id}`);
  }

  console.log("=== Seeding Complete! ===");
}

main()
  .catch((err) => {
    console.error("Fatal error during seeding:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
