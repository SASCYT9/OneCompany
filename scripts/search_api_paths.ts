import * as fs from "fs";
import * as path from "path";

async function main() {
  const dir =
    "C:\\Users\\sascy\\.gemini\\antigravity\\brain\\24b7c8d2-556a-4e42-8d8d-852724ffa9da\\scratch";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));

  const patterns = [/api2/gi, /products/gi, /models/gi, /brands/gi];

  for (const f of files) {
    const filePath = path.join(dir, f);
    const content = fs.readFileSync(filePath, "utf8");

    for (const regex of patterns) {
      let match;
      let count = 0;
      while ((match = regex.exec(content)) !== null && count < 3) {
        const idx = match.index;
        console.log(`\nMatch for ${regex} in ${f} at index ${idx}:`);
        console.log(content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 100)));
        count++;
      }
    }
  }
}

main().catch(console.error);
