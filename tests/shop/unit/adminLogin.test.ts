import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateAdminCredentials,
  type AdminLoginRepository,
  type AdminLoginUser,
} from "../../../src/lib/admin/adminLogin";
import { hashPassword } from "../../../src/lib/hashPassword";

function buildUser(overrides?: Partial<AdminLoginUser>): AdminLoginUser {
  return {
    id: "admin_1",
    email: "manager@example.com",
    name: "Manager",
    isActive: true,
    passwordHash: hashPassword("database-password"),
    roles: [
      {
        role: {
          key: "task_member",
          permissions: ["ops.tasks.read"],
        },
      },
    ],
    ...overrides,
  };
}

function createRepository(user: AdminLoginUser | null) {
  const calls = { markLogin: 0, bootstrap: 0 };
  const repository: AdminLoginRepository = {
    async findByEmail() {
      return user;
    },
    async markLogin() {
      calls.markLogin += 1;
    },
    async bootstrapIfEmpty() {
      calls.bootstrap += 1;
      return {
        id: "bootstrap_1",
        email: "owner@example.com",
        name: "Owner",
        permissions: ["*"],
      };
    },
  };
  return { repository, calls };
}

test("database admin login works without ADMIN_PASSWORD fallback", async () => {
  const { repository, calls } = createRepository(buildUser());

  const admin = await authenticateAdminCredentials(
    { email: "manager@example.com", password: "database-password" },
    {
      fallbackEmail: "owner@example.com",
      fallbackPassword: null,
      bootstrapEnabled: false,
    },
    repository
  );

  assert.ok(admin);
  assert.deepEqual(admin.permissions, ["ops.tasks.read"]);
  assert.equal(calls.markLogin, 1);
  assert.equal(calls.bootstrap, 0);
});

test("fallback login never reactivates a deactivated existing admin", async () => {
  const { repository, calls } = createRepository(
    buildUser({
      email: "owner@example.com",
      isActive: false,
      passwordHash: null,
    })
  );

  const admin = await authenticateAdminCredentials(
    { email: "owner@example.com", password: "fallback-password" },
    {
      fallbackEmail: "owner@example.com",
      fallbackPassword: "fallback-password",
      bootstrapEnabled: true,
    },
    repository
  );

  assert.equal(admin, null);
  assert.equal(calls.markLogin, 0);
  assert.equal(calls.bootstrap, 0);
});

test("fallback password never authenticates an existing active admin", async () => {
  const { repository, calls } = createRepository(
    buildUser({
      email: "owner@example.com",
      passwordHash: hashPassword("database-password"),
      roles: [
        {
          role: {
            key: "catalog_editor",
            permissions: ["shop.products.read", "shop.products.write"],
          },
        },
      ],
    })
  );

  const admin = await authenticateAdminCredentials(
    { email: "owner@example.com", password: "fallback-password" },
    {
      fallbackEmail: "owner@example.com",
      fallbackPassword: "fallback-password",
      bootstrapEnabled: true,
    },
    repository
  );

  assert.equal(admin, null);
  assert.equal(calls.markLogin, 0);
  assert.equal(calls.bootstrap, 0);
});

test("existing fallback identity still authenticates through its database password hash", async () => {
  const { repository, calls } = createRepository(
    buildUser({
      email: "owner@example.com",
      passwordHash: hashPassword("database-password"),
    })
  );

  const admin = await authenticateAdminCredentials(
    { email: "owner@example.com", password: "database-password" },
    {
      fallbackEmail: "owner@example.com",
      fallbackPassword: "fallback-password",
      bootstrapEnabled: true,
    },
    repository
  );

  assert.ok(admin);
  assert.equal(calls.markLogin, 1);
  assert.equal(calls.bootstrap, 0);
});

test("bootstrap is explicit and only attempted when the fallback identity is absent", async () => {
  const disabled = createRepository(null);
  assert.equal(
    await authenticateAdminCredentials(
      { email: "owner@example.com", password: "fallback-password" },
      {
        fallbackEmail: "owner@example.com",
        fallbackPassword: "fallback-password",
        bootstrapEnabled: false,
      },
      disabled.repository
    ),
    null
  );
  assert.equal(disabled.calls.bootstrap, 0);

  const enabled = createRepository(null);
  const admin = await authenticateAdminCredentials(
    { email: "owner@example.com", password: "fallback-password" },
    {
      fallbackEmail: "owner@example.com",
      fallbackPassword: "fallback-password",
      bootstrapEnabled: true,
    },
    enabled.repository
  );
  assert.ok(admin);
  assert.equal(enabled.calls.bootstrap, 1);
});

test("bootstrap fallback fails closed when the repository finds another admin", async () => {
  const { repository, calls } = createRepository(null);
  repository.bootstrapIfEmpty = async () => {
    calls.bootstrap += 1;
    return null;
  };

  const admin = await authenticateAdminCredentials(
    { email: "owner@example.com", password: "fallback-password" },
    {
      fallbackEmail: "owner@example.com",
      fallbackPassword: "fallback-password",
      bootstrapEnabled: true,
    },
    repository
  );

  assert.equal(admin, null);
  assert.equal(calls.bootstrap, 1);
  assert.equal(calls.markLogin, 0);
});
