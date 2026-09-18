import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const prisma = new PrismaClient();
try {
  const rows = await prisma.shopProduct.findMany({ where: { brand: "Revozport", isPublished: true }, select: { sku: true, image: true, media: { select: { src: true, mediaType: true } } } });
  const urls = [...new Set(rows.flatMap((row) => [row.image, ...row.media.filter((item) => item.mediaType === "IMAGE").map((item) => item.src)].filter(Boolean)))];
  const bad = [];
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      try {
        const { stdout } = await run("curl.exe", ["--silent", "--show-error", "--head", "--max-time", "15", url]);
        if (!/^HTTP\/\S+ 200/m.test(stdout) || !/content-type:\s*image\//i.test(stdout)) bad.push({ url, head: stdout.split(/\r?\n/).slice(0, 4) });
      } catch (error) { bad.push({ url, error: error.message }); }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(JSON.stringify({ published: rows.length, uniqueImages: urls.length, bad: bad.length, examples: bad.slice(0, 12) }, null, 2));
} finally { await prisma.$disconnect(); }
