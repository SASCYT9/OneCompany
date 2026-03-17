/**
 * Local helper: run CSV import through the actual Next.js API route,
 * so behavior matches Vercel (auth, RBAC, audit log, import jobs).
 *
 * Usage:
 *   node scripts/shop-import-local-via-http.js products_export_urban.csv commit UPDATE
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const ADMIN_SESSION_COOKIE = 'onecompany-admin-session';
const DEFAULT_SECRET = 'dev-admin-session-secret';

function base64url(input) {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function createAdminSessionToken() {
  const secret = (process.env.ADMIN_SESSION_SECRET || DEFAULT_SECRET).trim();
  const payload = {
    sub: 'local-dev@onecompany.local',
    name: 'Local Dev',
    permissions: ['*'],
    iat: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  const encoded = base64url(JSON.stringify(payload));
  const signature = signPayload(encoded, secret);
  return `${encoded}.${signature}`;
}

async function main() {
  const csvPathArg = process.argv[2] || 'products_export_urban.csv';
  const actionArg = String(process.argv[3] || 'commit').trim().toLowerCase();
  const conflictMode = String(process.argv[4] || 'UPDATE').trim().toUpperCase();

  const csvPath = path.isAbsolute(csvPathArg) ? csvPathArg : path.join(process.cwd(), csvPathArg);
  const csvText = fs.readFileSync(csvPath, 'utf8');
  if (!csvText.trim()) throw new Error(`CSV is empty: ${csvPath}`);

  // NEXTAUTH_URL may differ (e.g. 3001). For local dev server use 3000 unless overridden.
  const baseUrl = process.env.SHOP_LOCAL_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/admin/shop/import/csv`;
  const token = createAdminSessionToken();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `${ADMIN_SESSION_COOKIE}=${token}`,
    },
    body: JSON.stringify({
      action: actionArg === 'dry-run' ? 'dry-run' : 'commit',
      csvText,
      supplierName: 'local',
      sourceFilename: path.basename(csvPath),
      conflictMode,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Import failed (${res.status}): ${text}`);
  }
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

