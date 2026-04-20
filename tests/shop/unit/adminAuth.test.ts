import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken } from '../../../src/lib/adminAuth';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;

test.after(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  if (ORIGINAL_ADMIN_SESSION_SECRET === undefined) {
    delete process.env.ADMIN_SESSION_SECRET;
  } else {
    process.env.ADMIN_SESSION_SECRET = ORIGINAL_ADMIN_SESSION_SECRET;
  }
});

test('round-trips admin session tokens with the configured secret', () => {
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_SESSION_SECRET = 'unit-admin-secret';

  const token = createSessionToken({
    email: 'admin@example.com',
    name: 'Admin',
    permissions: ['shop.*'],
  });

  const session = verifySessionToken(token);

  assert.ok(session);
  assert.equal(session.email, 'admin@example.com');
  assert.equal(session.name, 'Admin');
  assert.deepEqual(session.permissions, ['shop.*']);
});

test('requires an explicit admin session secret in production', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.ADMIN_SESSION_SECRET;

  assert.throws(
    () =>
      createSessionToken({
        email: 'admin@example.com',
        name: 'Admin',
        permissions: ['*'],
      }),
    /ADMIN_SESSION_SECRET/
  );
});
