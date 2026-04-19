import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { buildAdminPgDumpInvocation, getAdminBackupRuntimePolicy } from '../../../src/lib/adminBackups';
import { pruneLocalBackupFiles } from '../../../src/lib/adminBackups';

test('getAdminBackupRuntimePolicy refuses production backup execution', () => {
  const policy = getAdminBackupRuntimePolicy({
    nodeEnv: 'production',
    databaseUrl: 'postgres://example',
  });

  assert.equal(policy.allowed, false);
  assert.equal(policy.status, 503);
  assert.match(policy.error, /external backup/i);
});

test('getAdminBackupRuntimePolicy requires a database url outside production', () => {
  const policy = getAdminBackupRuntimePolicy({
    nodeEnv: 'development',
    databaseUrl: '',
  });

  assert.equal(policy.allowed, false);
  assert.equal(policy.status, 500);
  assert.match(policy.error, /DATABASE_URL/i);
});

test('buildAdminPgDumpInvocation maps database url into pg env vars instead of argv', () => {
  const invocation = buildAdminPgDumpInvocation({
    databaseUrl: 'postgresql://db_user:db_password@example.supabase.co:6543/onecompany?sslmode=require',
    outputPath: 'D:/OneCompany/backups/test.sql',
  });

  assert.deepEqual(invocation.args, [
    '--file',
    'D:/OneCompany/backups/test.sql',
    '--format=plain',
    '--no-owner',
    '--no-privileges',
    '--host',
    'example.supabase.co',
    '--port',
    '6543',
    '--username',
    'db_user',
    '--dbname',
    'onecompany',
  ]);
  assert.equal(invocation.env.PGPASSWORD, 'db_password');
  assert.equal(invocation.env.PGSSLMODE, 'require');
});

test('pruneLocalBackupFiles keeps the newest backups within retention', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-backups-'));
  await fs.writeFile(path.join(tempDir, 'onecompany-shop-2026-01-01.sql'), 'a');
  await fs.writeFile(path.join(tempDir, 'onecompany-shop-2026-01-02.sql'), 'b');
  await fs.writeFile(path.join(tempDir, 'onecompany-shop-2026-01-03.sql'), 'c');

  await pruneLocalBackupFiles(tempDir, 2);

  const remaining = (await fs.readdir(tempDir)).sort();
  assert.deepEqual(remaining, ['onecompany-shop-2026-01-02.sql', 'onecompany-shop-2026-01-03.sql']);
});
