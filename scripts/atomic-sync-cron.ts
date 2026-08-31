#!/usr/bin/env node
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const endpoint =
  process.env.ATOMIC_SYNC_ENDPOINT?.trim() ||
  "https://onecompany.global/api/admin/cron/atomic-sync";
const secret = process.env.CRON_SECRET?.trim();

if (!secret) throw new Error("CRON_SECRET is required to invoke the Atomic sync endpoint");

const response = await fetch(endpoint, {
  method: "GET",
  headers: { Authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(10 * 60_000),
});
const body = await response.text();
if (!response.ok) {
  throw new Error(`Atomic sync endpoint failed (${response.status}): ${body.slice(0, 2_000)}`);
}

try {
  console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch {
  console.log(body);
}
