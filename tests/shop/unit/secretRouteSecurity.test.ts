import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SECRET_QUERY_ROUTES = [
  'src/app/api/admin/cron/airtable-stocks/route.ts',
  'src/app/api/telegram/admins/route.ts',
  'src/app/api/telegram/analytics/route.ts',
  'src/app/api/telegram/cron/route.ts',
  'src/app/api/telegram/webhook-grammy/route.ts',
];

test('sensitive service routes do not accept auth secrets from query params', () => {
  for (const relativePath of SECRET_QUERY_ROUTES) {
    const fullPath = path.join(process.cwd(), relativePath);
    const source = fs.readFileSync(fullPath, 'utf8');

    assert.doesNotMatch(
      source,
      /searchParams\.get\('(?:secret|token)'\)|searchParams\.get\("(?:secret|token)"\)/,
      `${relativePath} still reads a shared secret from the query string`
    );
  }
});
