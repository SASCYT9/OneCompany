import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("admin users and roles APIs use the dedicated user-management permission", () => {
  const root = process.cwd();
  const sources = [
    "src/app/api/admin/users/route.ts",
    "src/app/api/admin/users/[id]/route.ts",
    "src/app/api/admin/roles/route.ts",
  ].map((file) => fs.readFileSync(path.join(root, file), "utf8"));

  for (const source of sources) {
    assert.match(source, /ADMIN_USERS_MANAGE/);
    assert.doesNotMatch(source, /SHOP_SETTINGS_(?:READ|WRITE)/);
  }
});
