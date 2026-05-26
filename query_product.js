const fs = require("fs");
const path = require("path");

const envLocalPath = path.join(__dirname, ".env.local");
const envPath = path.join(__dirname, ".env");
let envFileToRead = null;
if (fs.existsSync(envLocalPath)) envFileToRead = envLocalPath;
else if (fs.existsSync(envPath)) envFileToRead = envPath;

if (envFileToRead) {
  const content = fs.readFileSync(envFileToRead, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const parts = trimmed.split("=");
      const key = parts[0].trim();
      const val = parts
        .slice(1)
        .join("=")
        .trim()
        .replace(/^['"]|['"]$/g, "");
      process.env[key] = val;
    }
  });
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.shopSettings.findUnique({
    where: { key: "shop" },
  });
  console.log("=== Shop Settings ===");
  console.log(JSON.stringify(settings, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
