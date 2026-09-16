// Isolated local UI harness: real catalog generator UI, synthetic data only.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as tls from "node:tls";
import { pathToFileURL } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Corporate Windows certificates are not always part of Node's bundled CA set.
// Add the OS trust store so the local preview resolves the same Catalog V2 media
// that production uses, without disabling TLS verification.
if (
  process.platform === "win32" &&
  typeof tls.getCACertificates === "function" &&
  typeof tls.setDefaultCACertificates === "function"
) {
  tls.setDefaultCACertificates([
    ...tls.getCACertificates("default"),
    ...tls.getCACertificates("system"),
  ]);
}

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import AdminCatalogsPage from './src/app/admin/shop/catalogs/page';
createRoot(document.getElementById('root')).render(<AdminCatalogsPage/>);
`;
const bundle = await build({
  stdin: { contents: entry, loader: "tsx", resolveDir: process.cwd() },
  bundle: true,
  write: false,
  outdir: "/virtual",
  format: "esm",
  jsx: "automatic",
  plugins: [
    {
      name: "preview-link",
      setup(build) {
        build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "preview" }));
        build.onLoad({ filter: /.*/, namespace: "preview" }, () => ({
          contents: `import React from 'react'; export default function Link({children,...props}) { return React.createElement('a',props,children); }`,
          resolveDir: process.cwd(),
          loader: "jsx",
        }));
      },
    },
  ],
});
const pdfBundlePath = ".next/preview-catalog/catalog-brochure-pdf.mjs";
await build({
  entryPoints: ["src/lib/admin/catalogBrochurePdf.tsx"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  jsx: "automatic",
  packages: "external",
  outfile: pdfBundlePath,
});
const { renderCatalogBrochurePdf } = await import(
  `${pathToFileURL(path.resolve(pdfBundlePath)).href}?v=${Date.now()}`
);
const css = await postcss([tailwind()]).process(
  '@import "tailwindcss"; @source "../src/app/admin/shop/catalogs"; @source "../src/components/admin";',
  { from: "scripts/preview.css" }
);
const js = bundle.outputFiles.find((file) => file.path.endsWith(".js")).text;
const moduleCss = bundle.outputFiles
  .filter((file) => file.path.endsWith(".css"))
  .map((file) => file.text)
  .join("\n");
const publicDir = path.resolve(process.cwd(), "public");
const productFixtures = [
  {
    sku: "EVE-G8XMV2-CF-INT",
    titleUa: "Карбонова впускна система Eventuri для BMW M2 G87 / M3 G8X / M4 G8X — V2",
    titleEn: "Eventuri carbon intake system for BMW M2 G87 / M3 G8X / M4 G8X — V2",
    price: 2690,
    photo:
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/f4d5cdf23d8a2d4f527767e6.jpg",
    galleryPhotos: [
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/f50a2783f44de5955cd89729.jpg",
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/5e7d9dc77e5edd907156cb3a.jpg",
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/676a89cb0e0f5e5700c55e16.jpg",
    ],
    fallbackPhoto: "/images/shop/products/eventuri-carbon-intake-g8x.webp",
    descriptionUa:
      "Повна впускна система Eventuri для BMW M2 G87 / M3 G8X / M4 G8X — V2. Карбонові корпуси та повітроводи формують плавний, менш обмежений потік повітря й зберігають точну сумісність із зазначеною моделлю.",
    descriptionRu:
      "Карбоновая система впуска Eventuri V2 для BMW M2, M3 и M4 поколения G8X. Фирменная геометрия корпусов и высокопроизводительные фильтры улучшают поток воздуха, отклик двигателя и добавляют выразительный звук впуска.",
    descriptionEn:
      "A complete Eventuri intake system for BMW M2 G87 / M3 G8X / M4 G8X — V2. Carbon housings and ducts create a smooth, less restrictive airflow path while preserving precise model-specific fitment.",
  },
  {
    sku: "EVE-G9X-CF-CHG",
    titleUa: "Карбонові турбоінлети Eventuri для BMW M5 G90 / G99 (S68)",
    titleEn: "Eventuri carbon turbo inlets for BMW M5 G90 / G99 (S68)",
    price: 795,
    photo:
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/788c2a6641bc0838879c73e9.jpg",
    galleryPhotos: [
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/198141da0bf2b4108e859800.jpg",
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/d2badce26c41f7791b8e53ce.webp",
    ],
    fallbackPhoto: "/images/shop/eventuri/eve-g9x-cf-chg-hero.jpg",
    descriptionUa:
      "Модельний комплект турбоінлетів Eventuri для BMW M5 G90 / G99 (S68). Геометрія каналів зменшує опір перед турбінами, а препрег-карбон забезпечує точну посадку та акуратну інтеграцію під капотом.",
    descriptionRu:
      "Комплект карбоновых турбо-инлетов для BMW M5 G90/G99 с двигателем S68. Увеличенное внутреннее сечение снижает сопротивление перед турбинами и дополняет моторный отсек премиальной карбоновой отделкой.",
    descriptionEn:
      "A model-specific Eventuri turbo inlet set for BMW M5 G90 / G99 (S68). The duct geometry reduces restriction before the turbos, while pre-preg carbon provides precise fitment and clean engine-bay integration.",
  },
  {
    sku: "EVE-F9XM5M8-CF-INT",
    titleUa: "Карбонова впускна система Eventuri для BMW M5 F90 / M8 F9X — V2",
    titleEn: "Eventuri carbon intake system for BMW M5 F90 / M8 F9X — V2",
    price: 2490,
    photo:
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/4af613fde5429494fa68d604.jpg",
    galleryPhotos: [
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/8fe939907bf2adb93d913c25.jpg",
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/de09adb6f051d6392a2b1be2.jpg",
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/bd7bb28c828626a667e283fa.jpg",
    ],
    fallbackPhoto: "/images/shop/eventuri/eventuri-m5-g90-hero-v2.png",
    descriptionUa:
      "Повна впускна система Eventuri для BMW M5 F90 / M8 F9X — V2. Карбонові корпуси та повітроводи формують плавний, менш обмежений потік повітря й зберігають точну сумісність із зазначеною моделлю.",
    descriptionRu:
      "Второе поколение карбонового впуска Eventuri для BMW F90 M5 и F9X M8. Система обеспечивает стабильную подачу холодного воздуха, снижает потери потока и сохраняет заводское качество установки.",
    descriptionEn:
      "A complete Eventuri intake system for BMW M5 F90 / M8 F9X — V2. Carbon housings and ducts create a smooth, less restrictive airflow path while preserving precise model-specific fitment.",
  },
  {
    sku: "EVE-G8XM-CF-SC",
    titleUa: "Карбонові повітрозабірники Eventuri для BMW M3 G8X / M4 G8X",
    titleEn: "Eventuri carbon air scoops for BMW M3 G8X / M4 G8X",
    price: 395,
    photo:
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/5bc80ba1cb5cf2030c43c06b.jpg",
    galleryPhotos: [
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/1decf1bab9084600f78f1661.jpg",
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/f3bc885eab2bbcd357a4e1c7.jpg",
      "https://rfip333zgtfizdii.public.blob.vercel-storage.com/catalog/eventuri/a820f7a30d781af620b79966.jpg",
    ],
    fallbackPhoto: "/images/shop/eventuri/eventuri-machine-atelier-hero-v1.png",
    descriptionUa:
      "Модельний комплект карбонових повітрозабірників для BMW M3 G8X / M4 G8X. Елементи встановлюються за решіткою та спрямовують зовнішнє повітря до впускної системи.",
    descriptionRu:
      "Карбоновые направляющие воздухозаборника для BMW G8X M3/M4. Они подают больше внешнего воздуха к системе впуска и визуально завершают комплект Eventuri.",
    descriptionEn:
      "A model-specific carbon air scoop set for BMW M3 G8X / M4 G8X. The parts install behind the grille and guide outside air toward the intake system.",
  },
];
const products = productFixtures.map(
  ({ sku, titleUa, titleEn, price, photo, galleryPhotos, fallbackPhoto }, i) => ({
    id: `demo-${i}`,
    slug: `demo-${i}`,
    sku,
    titleEn,
    titleUa,
    brand: "Eventuri",
    stock: "inStock",
    priceEur: price,
    priceUsd: null,
    priceUah: null,
    imageUrl: photo,
    imageSources: [photo, ...galleryPhotos, fallbackPhoto],
  })
);

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
const html = `<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OneCompany · локальний перегляд каталогу</title><link rel="stylesheet" href="/preview.css"><style>body{margin:0;background:#0c0c0d;color:#eee;font-family:Arial,sans-serif}.demo-bar{padding:12px 30px;background:#202b3c;color:#c5d9ff;font-size:12px;display:flex;justify-content:space-between;gap:20px}.demo-bar strong{font-size:14px;letter-spacing:1px}</style><div class="demo-bar"><strong>ONE COMPANY</strong><span>Локальний тест · демонстраційні товари · без доступу до бази</span></div><div id="root"></div><script type="module" src="/preview.js"></script></html>`;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3101");
  const json = (value, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(value));
  };
  if (url.pathname === "/preview.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    return res.end(js);
  }
  if (url.pathname === "/preview.css") {
    res.writeHead(200, { "content-type": "text/css" });
    return res.end(css.css + "\n" + moduleCss);
  }
  if (
    url.pathname === "/api/admin/shop/products" ||
    url.pathname === "/api/admin/shop/catalogs/products"
  ) {
    const needle = (url.searchParams.get("search") || "").toLowerCase();
    const matches = products.filter((p) =>
      JSON.stringify([p.titleEn, p.sku, p.brand]).toLowerCase().includes(needle)
    );
    return json({
      products: matches,
      source: "catalog_v2_projection",
      metadata: { totalCount: matches.length, currentPage: 1, totalPages: 1 },
    });
  }
  if (url.pathname === "/api/admin/pdf/catalog" && req.method === "POST") {
    try {
      const input = await readJsonBody(req);
      const language = ["ua", "ru", "en"].includes(input.language) ? input.language : "ua";
      const items = input.items.map((entry) => {
        const index = products.findIndex((product) => product.id === entry.productId);
        if (index < 0) throw new Error("Demo product not found");
        const product = products[index];
        const fixture = productFixtures[index];
        const selectedImage =
          typeof entry.imageSource === "string" && product.imageSources.includes(entry.imageSource)
            ? entry.imageSource
            : product.imageUrl;
        return {
          title: language === "en" ? product.titleEn : product.titleUa,
          description:
            fixture[`description${language === "ua" ? "Ua" : language === "ru" ? "Ru" : "En"}`],
          sku: product.sku,
          brand: product.brand,
          image: selectedImage,
          imageSources: [
            selectedImage,
            ...product.imageSources.filter((source) => source !== selectedImage),
          ],
          price: entry.priceOverride == null ? product.priceEur : Number(entry.priceOverride),
        };
      });
      const pdf = await renderCatalogBrochurePdf({
        title: String(input.title || "OneCompany Selection"),
        subtitle: String(input.subtitle || "Presentation catalog"),
        language,
        currency: ["EUR", "USD", "UAH"].includes(input.currency) ? input.currency : "EUR",
        layout: input.layout === "double" ? "double" : "single",
        branding: ["onecompany", "brand", "none"].includes(input.branding)
          ? input.branding
          : "onecompany",
        brandLogoSrc: input.branding === "brand" ? "/logos/eventuri-v2.png" : null,
        showPrice: input.showPrice !== false,
        generatedAt: new Date(),
        items,
      });
      res.writeHead(200, {
        "content-type": "application/pdf",
        "content-length": pdf.length,
        "content-disposition": "attachment; filename=preview-catalog.pdf",
        "cache-control": "no-store",
      });
      return res.end(pdf);
    } catch (error) {
      console.error("Preview catalog PDF render failed", error);
      return json({ error: "Не вдалося сформувати тестовий PDF." }, 500);
    }
  }
  if (/^\/(?:images|branding|brands|logos)\//.test(url.pathname)) {
    try {
      const decodedPath = decodeURIComponent(url.pathname);
      if (decodedPath.includes("\\") || decodedPath.split("/").includes(".."))
        throw new Error("Invalid public path");
      const filePath = path.resolve(publicDir, decodedPath.replace(/^\/+/, ""));
      if (!filePath.startsWith(`${publicDir}${path.sep}`)) throw new Error("Invalid public path");
      const file = await readFile(filePath);
      const extension = url.pathname.split(".").pop()?.toLowerCase();
      const contentType =
        extension === "svg"
          ? "image/svg+xml"
          : extension === "webp"
            ? "image/webp"
            : extension === "png"
              ? "image/png"
              : "image/jpeg";
      res.setHeader("content-type", contentType);
      return res.end(file);
    } catch {
      res.writeHead(404);
      return res.end();
    }
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
server.listen(3101, "127.0.0.1", () =>
  console.log("Isolated catalog UI preview: http://127.0.0.1:3101 (synthetic data only)")
);
