import dotenv from "dotenv";
import fs from "fs";

// Read the raw file
const raw = fs.readFileSync(".env.production", "utf8");
console.log("Raw file contains \\r\\n literally in text?", raw.includes("\\r\\n"));

dotenv.config({ path: ".env.production" });
const dbUrl = process.env.DATABASE_URL;
console.log(`DATABASE_URL length: ${dbUrl?.length}`);
if (dbUrl) {
  for (let i = 0; i < dbUrl.length; i++) {
    console.log(`Char ${i}: ${dbUrl[i]} (code: ${dbUrl.charCodeAt(i)})`);
  }
}
