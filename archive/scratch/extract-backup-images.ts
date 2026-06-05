import fs from "fs";
import path from "path";

function main() {
  const backupPath = path.resolve(
    process.cwd(),
    "backups",
    "urban-gp-portal",
    "urban-gp-portal-backup-2026-04-19T09-19-10-289Z.json"
  );
  if (!fs.existsSync(backupPath)) {
    console.error("Backup file not found!");
    return;
  }

  const data = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  // The backup could be an array of products, or settings. Let's find out by printing the structure.
  console.log("Is array:", Array.isArray(data));
  if (Array.isArray(data)) {
    const targets = ["URB-LOG-25353014-V1", "URB-FLO-26006230-V1"];
    for (const t of targets) {
      const found = data.find((p: any) => p.sku === t || p.slug === t.toLowerCase());
      if (found) {
        console.log(`Found direct: ${t}`);
        console.log(JSON.stringify({ sku: found.sku, image: found.image, gallery: found.gallery }, null, 2));
      }
    }
  } else {
    console.log("Keys:", Object.keys(data));
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        console.log(`Key "${key}" is array of length: ${data[key].length}`);
        if (data[key].length > 0) {
          const targets = ["URB-LOG-25353014-V1", "URB-FLO-26006230-V1"];
          for (const t of targets) {
            const found = data[key].find((p: any) => p.sku === t || p.slug === t.toLowerCase());
            if (found) {
              console.log(`  Found under "${key}": ${t}`);
              console.log(JSON.stringify({ sku: found.sku, image: found.image, gallery: found.gallery }, null, 2));
            }
          }
        }
      }
    }
  }
}

main();
