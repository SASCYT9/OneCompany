import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldAllowAdminApiRequest,
  shouldAllowAdminPageRequest,
} from '../../../src/lib/adminProxyAuth';

test('allows the admin auth endpoint without an existing session', async () => {
  const result = await shouldAllowAdminApiRequest({
    pathname: '/api/admin/auth',
    method: 'POST',
    cookieToken: null,
  });

  assert.equal(result.allowed, true);
});

test('rejects unauthenticated admin api requests by default', async () => {
  const result = await shouldAllowAdminApiRequest({
    pathname: '/api/admin/turn14-sync',
    method: 'POST',
    cookieToken: null,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'UNAUTHORIZED');
});

test('allows cron admin endpoints to reach their header-secret handlers', async () => {
  const result = await shouldAllowAdminApiRequest({
    pathname: '/api/admin/cron/airtable-stocks',
    method: 'GET',
    cookieToken: null,
  });

  assert.equal(result.allowed, true);
});

test('allows the legacy stock feed endpoint without an existing admin session', async () => {
  const result = await shouldAllowAdminApiRequest({
    pathname: '/api/admin/shop/feed/stock',
    method: 'GET',
    cookieToken: null,
  });

  assert.equal(result.allowed, true);
});

test('requires auth for nested admin pages but keeps the login shell reachable', async () => {
  const lockedPage = await shouldAllowAdminPageRequest({
    pathname: '/admin/shop/orders',
    cookieToken: null,
  });
  const loginShell = await shouldAllowAdminPageRequest({
    pathname: '/admin',
    cookieToken: null,
  });

  assert.equal(lockedPage.allowed, false);
  assert.equal(loginShell.allowed, true);
});
