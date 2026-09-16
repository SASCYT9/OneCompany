// Isolated local UI harness: real components, synthetic data, no authentication bypass or DB.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ProformaWorkspace} from './src/components/admin/proforma/ProformaWorkspace';
createRoot(document.getElementById('root')).render(<ProformaWorkspace/>);
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
const css = await postcss([tailwind()]).process(
  '@import "tailwindcss"; @source "../src/components/admin";',
  { from: "scripts/preview.css" }
);
const js = bundle.outputFiles.find((file) => file.path.endsWith(".js")).text;
const moduleCss = bundle.outputFiles.find((file) => file.path.endsWith(".css")).text;
const products = [
  [
    "EVE-G8XMV2-CF-INT",
    "BMW G8X M2 / M3 / M4 Black Carbon Intake System - V2",
    2690,
    "/images/shop/products/eventuri-carbon-intake-g8x.webp",
  ],
  [
    "EVE-G9X-CF-CHG",
    "BMW G90 / G99 M5 (S68) Carbon Turbo Inlet Set",
    795,
    "/images/shop/eventuri/eve-g9x-cf-chg-hero.jpg",
  ],
  [
    "EVE-W192-FTR",
    "Eventuri Replacement Air Filter · W192",
    null,
    "/images/shop/eventuri/eve-w192-ftr-hero.jpg",
  ],
].map(([sku, title, price, photo], i) => ({
  id: "demo-" + i,
  slug: "demo-" + i,
  sku,
  titleEn: title,
  titleUa: title,
  brand: "Eventuri",
  stock: "inStock",
  priceEur: price,
  priceUsd: null,
  priceUah: null,
  imageUrl: photo,
  image: photo,
  imageSources: [photo],
  variants:
    i === 0
      ? [
          {
            id: "v-gloss",
            title: "Gloss finish",
            sku: sku + "-GLOSS",
            priceEur: 2690,
            isDefault: true,
          },
          { id: "v-matte", title: "Matte finish", sku: sku + "-MATTE", priceEur: 2790 },
        ]
      : [],
}));
const html = `<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OneCompany · локальний перегляд проформи</title><link rel="stylesheet" href="/preview.css"><style>body{margin:0;background:#0c0c0d;color:#eee;font-family:Arial,sans-serif}.demo-bar{padding:12px 30px;background:#202b3c;color:#c5d9ff;font-size:12px;display:flex;justify-content:space-between;gap:20px}.demo-bar strong{font-size:14px;letter-spacing:1px}</style><div class="demo-bar"><strong>ONE COMPANY</strong><span>Локальний тест · демонстраційні товари · без доступу до бази</span></div><div id="root"></div><script type="module" src="/preview.js"></script></html>`;
let saved = null;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3100");
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
  if (url.pathname === "/api/admin/shop/customers")
    return json([
      {
        id: "demo-client",
        fullName: "Тестовий клієнт",
        email: "demo@example.com",
        group: "B2C",
        companyName: null,
      },
    ]);
  if (url.pathname === "/api/admin/shop/products") {
    const needle = (url.searchParams.get("search") || "").toLowerCase();
    const matches = products.filter((p) =>
      JSON.stringify([p.titleEn, p.sku, p.brand]).toLowerCase().includes(needle)
    );
    return json({
      products: matches,
      metadata: { totalCount: matches.length, currentPage: 1, totalPages: 1 },
    });
  }
  if (url.pathname.startsWith("/api/admin/shop/products/"))
    return json(products.find((p) => p.id === url.pathname.split("/").pop()) || {}, 200);
  if (url.pathname === "/api/admin/shop/drafts" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    saved = JSON.parse(body);
    return json({ id: "preview-only", orderNumber: "DEMO-2026-001" });
  }
  if (url.pathname === "/preview-saved") return json(saved);
  if (
    url.pathname.startsWith("/api/admin/pdf/") ||
    url.pathname === "/admin/shop/drafts/preview-only"
  ) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(
      "<p>Демонстраційне збереження. Справжній PDF потребує тестової бази даних. Продакшн не змінено.</p>"
    );
  }
  if (
    url.pathname.startsWith("/images/shop/") &&
    products.some((product) => product.image === url.pathname)
  ) {
    res.setHeader("content-type", url.pathname.endsWith(".webp") ? "image/webp" : "image/jpeg");
    try {
      res.end(await readFile("public" + url.pathname));
    } catch {
      res.writeHead(404);
      res.end();
    }
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
server.listen(3100, "127.0.0.1", () =>
  console.log("Isolated proforma UI preview: http://127.0.0.1:3100 (synthetic data only)")
);
