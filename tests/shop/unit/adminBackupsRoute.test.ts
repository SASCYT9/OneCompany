import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminPgDumpInvocation, getAdminBackupRuntimePolicy } from '../../../src/lib/adminBackups';

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
