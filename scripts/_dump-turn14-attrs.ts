/**
 * Dump full attributes JSON for one stored Turn14Item + live /items/{id}.
 * Looking for: HD image fields, description, media endpoints we may have missed.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function call(endpoint: string) {
  const { getTurn14AccessToken } = await import("../src/lib/turn14");
  const token = await getTurn14AccessToken();
  const r = await fetch(`https://api.turn14.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) return { ok: false, status: r.status, text: (await r.text()).slice(0, 200) };
  return { ok: true, status: r.status, body: await r.json() };
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  // CSF item — user's screenshot shows "CSF Oil Coolers" with bad image quality.
  const sample =
    (await prisma.turn14Item.findFirst({
      where: { partNumber: "csf8343" },
      select: {
        id: true,
        partNumber: true,
        brand: true,
        name: true,
        thumbnail: true,
        attributes: true,
      },
    })) ||
    (await prisma.turn14Item.findFirst({
      where: { brand: { contains: "CSF", mode: "insensitive" } },
      select: {
        id: true,
        partNumber: true,
        brand: true,
        name: true,
        thumbnail: true,
        attributes: true,
      },
    }));
  if (!sample) throw new Error("no sample");

  console.log("=== Stored row (DB) ===");
  console.log({ id: sample.id, partNumber: sample.partNumber, brand: sample.brand });
  console.log("Stored thumbnail URL:", sample.thumbnail);
  console.log("\nStored attributes JSON (top-level keys, with image-related deep dump):");
  const attrs: any = sample.attributes ?? {};
  for (const k of Object.keys(attrs).sort()) {
    const v = attrs[k];
    if (/image|photo|media|asset|thumb|picture/i.test(k)) {
      console.log(`  ${k} =`, JSON.stringify(v).slice(0, 400));
    } else if (typeof v === "string" && v.length > 60) {
      console.log(`  ${k} = "${v.slice(0, 80)}..."`);
    } else if (typeof v === "object") {
      console.log(
        `  ${k} = ${JSON.stringify(v).slice(0, 120)}${JSON.stringify(v).length > 120 ? "..." : ""}`
      );
    } else {
      console.log(`  ${k} =`, v);
    }
  }

  // Live: same item from /items/{id} — sometimes detail endpoint has more
  // fields than the list endpoint.
  console.log("\n=== Live /items/" + sample.id + " ===");
  const r = await call(`/items/${sample.id}`);
  if (r.ok) {
    const data: any = (r as any).body?.data;
    const liveAttrs = data?.attributes ?? {};
    console.log("Top-level data keys:", Object.keys((r as any).body || {}));
    console.log("data.relationships?", !!data?.relationships);
    if (data?.relationships) console.log("  relationships keys:", Object.keys(data.relationships));
    console.log("attributes keys:", Object.keys(liveAttrs).sort());
    for (const k of Object.keys(liveAttrs).sort()) {
      if (/image|photo|media|asset|thumb|picture|url/i.test(k)) {
        console.log(`  ${k} =`, JSON.stringify(liveAttrs[k]).slice(0, 500));
      }
    }
  } else {
    console.log("FAIL", r);
  }

  // Live: /items/{id}/data ? Some JSON:API APIs expose related resources.
  console.log("\n=== Try /items/" + sample.id + "/media ===");
  console.log(await call(`/items/${sample.id}/media`));

  console.log("\n=== Try /pricing/" + sample.id + " (full dump) ===");
  const pr = await call(`/pricing/${sample.id}`);
  if (pr.ok) console.log(JSON.stringify((pr as any).body, null, 2).slice(0, 1500));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
