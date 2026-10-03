import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";

async function main() {
  const envPath = process.argv.find((arg) => arg.startsWith("--env-path="))?.slice(11);
  if (!envPath) throw new Error("Explicit env-path required");
  const env = parse(readFileSync(envPath));
  const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } });
  const directory = resolve("outputs/site-commerce-2026-10-03");
  const plan = JSON.parse(readFileSync(resolve(directory, "hide-plan.json"), "utf8"));
  const { results } = JSON.parse(readFileSync(resolve(directory, "hide-results.json"), "utf8"));
  try {
    const read = async () => {
      const products = await prisma.shopProduct.findMany({ where: { id: { in: plan.entries.map((entry: { id: string }) => entry.id) } }, select: { id: true, sku: true, isPublished: true, status: true } });
      const events = await prisma.shopCatalogOutbox.findMany({ where: { id: { in: results.map((entry: { outboxId: string }) => entry.outboxId) } }, select: { id: true, status: true } });
      return { retained: products.length, hidden: products.filter((product) => !product.isPublished).length, active: products.filter((product) => product.status === "ACTIVE").length, publication: Object.fromEntries([...new Set(events.map((event) => event.status))].map((status) => [status, events.filter((event) => event.status === status).length])) };
    };
    let result = await read();
    console.log(JSON.stringify({ ...result, cronConfigured: Boolean(env.CRON_SECRET) }));
    if (result.retained !== plan.entries.length || result.hidden !== plan.entries.length) throw new Error("Visibility post-check failed");
    if (process.argv.includes("--drain") || process.argv.includes("--drain-via-vercel")) {
      const viaVercel = process.argv.includes("--drain-via-vercel");
      if (!viaVercel && !env.CRON_SECRET) throw new Error("No locally configured cron secret; keep publication pending for scheduled worker");
      for (let call = 0; call < 50 && (result.publication.COMPLETED ?? 0) < plan.entries.length; call++) {
        if ((result.publication.DEAD_LETTER ?? 0) > 0) throw new Error("Publication has dead-letter events; stop");
        if (viaVercel) {
          await new Promise<void>((finish, reject) => {
            const child = spawn(process.execPath, ["C:/Users/Admin/AppData/Roaming/npm/node_modules/vercel/dist/index.js", "crons", "run", "/api/cron/shop-catalog", "--project", "prj_8aQFqLxL8ML2AQNBMF0iP2M2V1NT"], { cwd: "C:/Users/Admin/OneDrive/Documents/ChatGPT/One Company/OneCompany", env: { ...process.env, NODE_USE_SYSTEM_CA: "1", NODE_USE_ENV_PROXY: "1" }, windowsHide: true, stdio: "ignore" });
            child.on("error", reject);
            child.on("exit", (code) => code === 0 ? finish() : reject(new Error(`Vercel cron trigger failed (${code})`)));
          });
          await new Promise((finish) => setTimeout(finish, 1500));
        } else {
          const response = await fetch("https://onecompany.global/api/cron/shop-catalog", { headers: { Authorization: `Bearer ${env.CRON_SECRET}` }, signal: AbortSignal.timeout(60_000) });
          if (!response.ok) throw new Error(`Publication worker returned ${response.status}`);
          const payload = await response.json();
          if (!payload.ok) throw new Error("Publication worker failed");
        }
        result = await read();
        console.log(JSON.stringify({ call: call + 1, ...result }));
      }
    }
    writeFileSync(resolve(directory, "hide-verification.json"), JSON.stringify({ verifiedAt: new Date().toISOString(), ...result }, null, 2));
  } finally { await prisma.$disconnect(); }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "Publication verification failed"); process.exitCode = 1; });
