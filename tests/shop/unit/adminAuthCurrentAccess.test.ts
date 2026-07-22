import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_SESSION_COOKIE,
  assertAdminRequest,
  createSessionToken,
  type CookieReader,
} from "../../../src/lib/adminAuth";
import type { AdminIdentityRepository } from "../../../src/lib/admin/adminIdentity";

function createCookieReader(token: string): CookieReader {
  return {
    get(name) {
      return name === ADMIN_SESSION_COOKIE ? { value: token } : undefined;
    },
  };
}

test("legacy admin assertion ignores stale cookie permissions and returns current DB permissions", async () => {
  const token = createSessionToken({
    email: "manager@example.com",
    name: "Cookie manager",
    permissions: ["*"],
  });
  const repository: AdminIdentityRepository = {
    async findActiveByEmail() {
      return {
        id: "admin_1",
        email: "manager@example.com",
        name: "Current manager",
        isActive: true,
        roles: [
          {
            role: {
              key: "task_member",
              permissions: ["ops.tasks.read"],
            },
          },
        ],
      };
    },
  };

  const session = await assertAdminRequest(createCookieReader(token), "ops.tasks.read", repository);
  assert.equal(session.name, "Current manager");
  assert.deepEqual(session.permissions, ["ops.tasks.read"]);

  await assert.rejects(
    assertAdminRequest(createCookieReader(token), "shop.settings.write", repository),
    /FORBIDDEN/
  );
});

test("deactivation invalidates a still-fresh signed cookie on the next request", async () => {
  const token = createSessionToken({
    email: "manager@example.com",
    name: "Manager",
    permissions: ["*"],
  });
  const repository: AdminIdentityRepository = {
    async findActiveByEmail() {
      return null;
    },
  };

  await assert.rejects(
    assertAdminRequest(createCookieReader(token), undefined, repository),
    /UNAUTHORIZED/
  );
});
