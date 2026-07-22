import assert from "node:assert/strict";
import test from "node:test";

import {
  currentAdminHasAnyPermission,
  currentAdminHasPermission,
  resolveAdminAccessFromSession,
  type AdminAccessRepository,
} from "../../../src/lib/admin/adminAccess";
import type { AdminSession } from "../../../src/lib/adminAuth";

const SESSION: AdminSession = {
  email: "manager@example.com",
  name: "Cookie name",
  permissions: ["*"],
  issuedAt: Date.now(),
  nonce: "test",
};

test("current admin access ignores stale cookie permissions and uses current DB roles", async () => {
  const repository: AdminAccessRepository = {
    async findActiveByEmail(email) {
      assert.equal(email, "manager@example.com");
      return {
        id: "admin-1",
        email,
        name: "Manager",
        isActive: true,
        roles: [
          {
            role: {
              key: "task_member",
              permissions: ["ops.tasks.read", "ops.tasks.write"],
            },
          },
        ],
      };
    },
  };

  const access = await resolveAdminAccessFromSession(SESSION, repository);

  assert.ok(access);
  assert.deepEqual(access.permissions, ["ops.tasks.read", "ops.tasks.write"]);
  assert.equal(access.isOwner, false);
  assert.equal(currentAdminHasPermission(access, "ops.tasks.read"), true);
  assert.equal(currentAdminHasPermission(access, "shop.orders.read"), false);
  assert.equal(currentAdminHasAnyPermission(access, ["shop.orders.read", "ops.tasks.write"]), true);
});

test("deactivated or removed admins are rejected on the next resolution", async () => {
  const inactiveRepository: AdminAccessRepository = {
    async findActiveByEmail() {
      return null;
    },
  };

  assert.equal(await resolveAdminAccessFromSession(SESSION, inactiveRepository), null);
  assert.equal(await resolveAdminAccessFromSession(null, inactiveRepository), null);
});

test("owner and legacy superadmin roles retain wildcard access", async () => {
  for (const roleKey of ["owner", "superadmin"]) {
    const repository: AdminAccessRepository = {
      async findActiveByEmail(email) {
        return {
          id: roleKey,
          email,
          name: roleKey,
          isActive: true,
          roles: [{ role: { key: roleKey, permissions: [] } }],
        };
      },
    };

    const access = await resolveAdminAccessFromSession(SESSION, repository);
    assert.ok(access);
    assert.equal(access.isOwner, true);
    assert.deepEqual(access.permissions, ["*"]);
  }
});
