import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const base = "https://nodejs.org/dist/latest-v22.x/";
const response = await fetch(`${base}SHASUMS256.txt`);
if (!response.ok) throw new Error(`Official Node manifest returned ${response.status}`);
const line = (await response.text()).split(/\r?\n/).find((entry) => /node-v22\.[\d.]+-win-x64\.zip$/.test(entry));
if (!line) throw new Error("Windows Node 22 runtime absent from official manifest");
const [expectedHash, filename] = line.trim().split(/\s+/);
const zip = await fetch(`${base}${filename}`);
if (!zip.ok) throw new Error(`Official Node download returned ${zip.status}`);
const bytes = Buffer.from(await zip.arrayBuffer());
if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("Node runtime checksum mismatch");
const directory = resolve("tmp/site-commerce-node22");
await mkdir(directory, { recursive: true });
const path = resolve(directory, filename);
await writeFile(path, bytes);
console.log(JSON.stringify({ path, expectedHash, directory }));
