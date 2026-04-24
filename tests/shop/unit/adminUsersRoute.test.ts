import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { RequestCookies } from 'next/dist/server/web/spec-extension/cookies';
import { RequestCookiesAdapter } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
import { createPatchAdminUserRoute } from '../../../src/app/api/admin/users/[id]/route';

type PatchDependencies = NonNullable<Parameters<typeof createPatchAdminUserRoute>[0]>;
type PatchTx = Parameters<Parameters<PatchDependencies['prisma']['$transaction']>[0]>[0];
type AdminUserFixture = NonNullable<
  Awaited<ReturnType<PatchDependencies['prisma']['adminUser']['findUnique']>>
>;
type AdminRoleFixture = AdminUserFixture['roles'][number]['role'];
type AuditLogFixture = Awaited<ReturnType<PatchDependencies['writeAdminAuditLog']>>;

const FIXTURE_DATE = new Date('2026-04-20T08:00:00.000Z');

function createRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/users/user_1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createCookieStore() {
  return RequestCookiesAdapter.seal(new RequestCookies(new Headers()));
}

function createContext() {
  return {
    params: Promise.resolve({ id: 'user_1' }),
  };
}

function buildRole(role: { id: string; key: string; name: string }): AdminRoleFixture {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    permissions: [],
    createdAt: FIXTURE_DATE,
    updatedAt: FIXTURE_DATE,
  };
}

function buildRoleAssignment(role: { id: string; key: string; name: string }): AdminUserFixture['roles'][number] {
  const fullRole = buildRole(role);

  return {
    userId: 'user_1',
    roleId: fullRole.id,
    assignedAt: FIXTURE_DATE,
    role: fullRole,
  };
}

function buildCurrentUser(isActive: boolean): AdminUserFixture {
  return {
    id: 'user_1',
    email: 'manager@onecompany.com',
    name: 'Current manager',
    isActive,
    createdAt: new Date('2026-04-20T07:00:00.000Z'),
    updatedAt: new Date('2026-04-20T08:00:00.000Z'),
    lastLoginAt: null,
    passwordHash: null,
    roles: [],
  };
}

function buildUpdatedUser(options: {
  name: string;
  isActive: boolean;
  roles: Array<{ id: string; key: string; name: string }>;
}): AdminUserFixture {
  return {
    id: 'user_1',
    email: 'manager@onecompany.com',
    name: options.name,
    isActive: options.isActive,
    lastLoginAt: null,
    passwordHash: null,
    createdAt: new Date('2026-04-20T08:00:00.000Z'),
    updatedAt: new Date('2026-04-20T09:00:00.000Z'),
    roles: options.roles.map((role) => buildRoleAssignment(role)),
  };
}

test('PATCH /api/admin/users/[id] handles update, activation, and auth error flows', async (t) => {
  const session = {
    email: 'admin@onecompany.com',
    name: 'Admin',
    permissions: ['*'],
    issuedAt: Date.now(),
    nonce: 'nonce',
  };

  const state = {
    auth: 'allow' as 'allow' | 'unauthorized' | 'forbidden',
    currentUser: buildCurrentUser(true),
    validRoles: [{ id: 'role_a' }, { id: 'role_b' }],
    updatedUser: buildUpdatedUser({
      name: 'Updated manager',
      isActive: false,
      roles: [
        { id: 'role_b', key: 'ops', name: 'Ops' },
        { id: 'role_a', key: 'catalog', name: 'Catalog' },
      ],
    }),
  };

  const calls = {
    deleteMany: [] as unknown[],
    createMany: [] as unknown[],
    update: [] as unknown[],
    audit: [] as Parameters<PatchDependencies['writeAdminAuditLog']>[],
  };

  function resetCalls() {
    calls.deleteMany.length = 0;
    calls.createMany.length = 0;
    calls.update.length = 0;
    calls.audit.length = 0;
  }

  const tx: PatchTx = {
    adminUser: {
      update: async (input: unknown) => {
        calls.update.push(input);
        return state.updatedUser;
      },
      findUniqueOrThrow: async () => state.updatedUser,
    },
    adminUserRole: {
      deleteMany: async (input: unknown) => {
        calls.deleteMany.push(input);
        return { count: 2 };
      },
      createMany: async (input: unknown) => {
        calls.createMany.push(input);
        return { count: 2 };
      },
    },
  };

  const patchRoute = createPatchAdminUserRoute({
    cookies: async () => createCookieStore(),
    assertAdminRequest: () => {
      if (state.auth === 'unauthorized') {
        throw new Error('UNAUTHORIZED');
      }
      if (state.auth === 'forbidden') {
        throw new Error('FORBIDDEN');
      }
      return session;
    },
    prisma: {
      adminUser: {
        findUnique: async () => state.currentUser,
      },
      adminRole: {
        findMany: async () => state.validRoles,
      },
      $transaction: async <T>(callback: (client: PatchTx) => Promise<T>) => callback(tx),
    },
    writeAdminAuditLog: async (...args) => {
      calls.audit.push(args);
      const [, sessionArg, entry] = args;

      return {
        id: 'audit_1',
        actorId: null,
        actorEmail: sessionArg.email,
        actorName: sessionArg.name,
        scope: entry.scope,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: null,
        createdAt: FIXTURE_DATE,
      } satisfies AuditLogFixture;
    },
    requiredPermission: 'shop.settings.write',
  });

  await t.test('updates name and replaces role assignments atomically', async () => {
    resetCalls();
    state.auth = 'allow';
    state.currentUser = buildCurrentUser(true);
    state.validRoles = [{ id: 'role_a' }, { id: 'role_b' }];
    state.updatedUser = buildUpdatedUser({
      name: 'Updated manager',
      isActive: false,
      roles: [
        { id: 'role_b', key: 'ops', name: 'Ops' },
        { id: 'role_a', key: 'catalog', name: 'Catalog' },
      ],
    });

    const response = await patchRoute(createRequest({
      name: '  Updated manager  ',
      isActive: false,
      roleIds: ['role_b', 'role_b', 'role_a'],
    }), createContext());

    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.user.name, 'Updated manager');
    assert.equal(payload.user.isActive, false);
    assert.deepEqual(
      payload.user.roles.map((role: { id: string }) => role.id),
      ['role_b', 'role_a']
    );

    assert.deepEqual(calls.deleteMany, [{ where: { userId: 'user_1' } }]);
    assert.deepEqual(calls.createMany, [
      {
        data: [
          { userId: 'user_1', roleId: 'role_b' },
          { userId: 'user_1', roleId: 'role_a' },
        ],
      },
    ]);

    const auditEntry = calls.audit[0]?.[2] as unknown as {
      action: string;
      metadata: { updatedFields: string[] };
    };
    assert.equal(auditEntry.action, 'admin.user.deactivate');
    assert.deepEqual(auditEntry.metadata.updatedFields, ['name', 'isActive', 'roleIds']);
  });

  await t.test('reactivates a user without accumulating duplicate roles', async () => {
    resetCalls();
    state.auth = 'allow';
    state.currentUser = buildCurrentUser(false);
    state.validRoles = [{ id: 'role_a' }];
    state.updatedUser = buildUpdatedUser({
      name: 'Current manager',
      isActive: true,
      roles: [{ id: 'role_a', key: 'catalog', name: 'Catalog' }],
    });

    const response = await patchRoute(createRequest({
      isActive: true,
      roleIds: ['role_a'],
    }), createContext());

    assert.equal(response.status, 200);
    assert.deepEqual(calls.createMany, [
      {
        data: [{ userId: 'user_1', roleId: 'role_a' }],
      },
    ]);

    const auditEntry = calls.audit[0]?.[2] as { action: string };
    assert.equal(auditEntry.action, 'admin.user.activate');
  });

  await t.test('returns 401 when the admin session is missing', async () => {
    resetCalls();
    state.auth = 'unauthorized';

    const response = await patchRoute(createRequest({
      name: 'Blocked',
      roleIds: [],
    }), createContext());

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.error, 'Unauthorized');
  });

  await t.test('returns 403 when the admin lacks permission', async () => {
    resetCalls();
    state.auth = 'forbidden';

    const response = await patchRoute(createRequest({
      name: 'Blocked',
      roleIds: [],
    }), createContext());

    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.error, 'Forbidden');
  });
});
