import pg from "pg";
import dotenv from "dotenv";
import { parse } from "pg-connection-string";
dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
const config = parse(connectionString);

// Add timeout so it doesn't hang
config.connectionTimeoutMillis = 5000;

async function test(name, sslConfig) {
  console.log(`--- Testing: ${name} ---`);
  const client = new pg.Client({
    ...config,
    ssl: sslConfig,
  });
  try {
    await client.connect();
    console.log(`[${name}] SUCCESS!`);
    const res = await client.query("SELECT NOW()");
    console.log(`[${name}] Query:`, res.rows[0]);
  } catch (err) {
    console.error(`[${name}] FAILED:`, err.message || err);
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  await test("ssl: false", false);
  await test("ssl: rejectUnauthorized: false", { rejectUnauthorized: false });
  await test("ssl: rejectUnauthorized: true", { rejectUnauthorized: true });
}

main();
