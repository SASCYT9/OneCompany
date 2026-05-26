import { PrismaClient } from "@prisma/client";

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
  // Test 1: Clean URL
  const cleanUrl =
    "postgres://ee3b75a6877bb03685058e92d3d1ee87dcb245bc2d9e7deb21b64e98ef996805:sk_UYiagQHVUi02RCiZ1LQjW@db.prisma.io:5432/postgres?sslmode=require";
  await testWithUrl(cleanUrl, "Clean URL");

  // Test 2: URL with \r\n
  const carriageReturnUrl =
    "postgres://ee3b75a6877bb03685058e92d3d1ee87dcb245bc2d9e7deb21b64e98ef996805:sk_UYiagQHVUi02RCiZ1LQjW@db.prisma.io:5432/postgres?sslmode=require\r\n";
  await testWithUrl(carriageReturnUrl, "URL with \\r\\n");

  // Test 3: URL with \n only
  const newlineUrl =
    "postgres://ee3b75a6877bb03685058e92d3d1ee87dcb245bc2d9e7deb21b64e98ef996805:sk_UYiagQHVUi02RCiZ1LQjW@db.prisma.io:5432/postgres?sslmode=require\n";
  await testWithUrl(newlineUrl, "URL with \\n");
}

main();
