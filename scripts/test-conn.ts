import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testWithUrl(url: string, label: string) {
  console.log(`Testing connection with: "${label}"...`);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url,
      },
    },
  });

  try {
    const count = await prisma.shopProduct.count();
    console.log(`Success! Product count: ${count}`);
  } catch (err: any) {
    console.error(`Failed! Error: ${err.message || err}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const envUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!envUrl) {
    console.error("Error: DIRECT_URL or DATABASE_URL environment variable is not defined.");
    process.exit(1);
  }

  // Test 1: Clean URL
  await testWithUrl(envUrl, "Clean URL");

  // Test 2: URL with \r\n
  await testWithUrl(`${envUrl}\r\n`, "URL with \\r\\n");

  // Test 3: URL with \n only
  await testWithUrl(`${envUrl}\n`, "URL with \\n");
}

main();
