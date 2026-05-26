import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "../node_modules/.prisma/client/index.js";

const p = new PrismaClient();

async function run() {
  console.log("BLOB_READ_WRITE_TOKEN exists:", !!process.env.BLOB_READ_WRITE_TOKEN);
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    console.log("Token length:", process.env.BLOB_READ_WRITE_TOKEN.length);
  }
}

run()
  .catch(console.error)
  .finally(() => p.$disconnect());
