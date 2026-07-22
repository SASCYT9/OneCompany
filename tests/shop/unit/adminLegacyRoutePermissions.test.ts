import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

const EXPLICIT_EXCEPTIONS = new Map<string, string>([
  [
    "src/app/api/admin/auth/route.ts",
    "Public login/logout and current-session lifecycle; credential verification is the boundary.",
  ],
  [
    "src/app/api/admin/cron/airtable-stocks/route.ts",
    "Service endpoint authenticated with its bearer secret instead of an admin session.",
  ],
  [
    "src/app/api/admin/cron/atomic-sync/route.ts",
    "Service endpoint authenticated with its bearer secret instead of an admin session.",
  ],
  [
    "src/app/api/admin/search/route.ts",
    "Search resolves current DB access once and applies domain permissions to each result group.",
  ],
]);

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function relativeRoute(file: string) {
  return path.relative(process.cwd(), file).replaceAll(path.sep, "/");
}

function callName(node: ts.CallExpression): string | null {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return null;
}

function collectCalls(node: ts.Node): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child)) calls.push(child);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return calls;
}

function hasPermissionGuard(node: ts.Node): boolean {
  return collectCalls(node).some((call) => {
    const name = callName(call);
    if (name === "assertAdminRequest") return call.arguments.length >= 2;
    if (name === "assertCurrentAdminAccess") return call.arguments.length >= 1;
    if (name === "assertCurrentAdminAnyPermission") return call.arguments.length >= 1;
    if (name === "assertAdminEntityPermission") return call.arguments.length >= 3;
    if (name === "requireAdmin") return true;
    return false;
  });
}

function exportedHandlers(sourceFile: ts.SourceFile): Array<{ method: string; node: ts.Node }> {
  const handlers: Array<{ method: string; node: ts.Node }> = [];
  for (const node of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      HTTP_METHODS.has(node.name.text) &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      handlers.push({ method: node.name.text, node });
      continue;
    }

    if (
      !ts.isVariableStatement(node) ||
      !node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      continue;
    }
    for (const declaration of node.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        HTTP_METHODS.has(declaration.name.text) &&
        declaration.initializer
      ) {
        handlers.push({ method: declaration.name.text, node: declaration.initializer });
      }
    }
  }
  return handlers;
}

test("legacy admin/import routes cannot rely on authentication without an explicit permission", () => {
  const routeFiles = [
    ...walk(path.join(process.cwd(), "src", "app", "api", "admin")),
    path.join(process.cwd(), "src", "app", "api", "import-brabus", "route.ts"),
    path.join(process.cwd(), "src", "app", "api", "import-burger", "route.ts"),
  ].filter(
    (file) =>
      file.endsWith(`${path.sep}route.ts`) &&
      !file.includes(`${path.sep}api${path.sep}admin${path.sep}operations${path.sep}`)
  );

  for (const file of routeFiles) {
    const relative = relativeRoute(file);
    const source = fs.readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const allCalls = collectCalls(sourceFile);

    for (const call of allCalls) {
      if (callName(call) === "assertAdminRequest") {
        assert.ok(
          call.arguments.length >= 2,
          `${relative} contains an auth-only assertAdminRequest; pass an ADMIN_PERMISSIONS requirement`
        );
      }
    }

    const exceptionReason = EXPLICIT_EXCEPTIONS.get(relative);
    if (exceptionReason) {
      assert.ok(exceptionReason.length >= 20, `${relative} needs a meaningful exception reason`);
      continue;
    }

    assert.ok(
      hasPermissionGuard(sourceFile),
      `${relative} has no explicit admin permission guard and is not a documented exception`
    );

    for (const handler of exportedHandlers(sourceFile)) {
      const delegatesToGuardedFactory =
        ts.isCallExpression(handler.node) && hasPermissionGuard(sourceFile);
      assert.ok(
        hasPermissionGuard(handler.node) || delegatesToGuardedFactory,
        `${handler.method} ${relative} does not enforce an explicit permission in the handler`
      );
    }
  }
});

test("stock feed is inventory-scoped and is not in the public admin API allowlist", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/shop/feed/stock/route.ts"),
    "utf8"
  );
  const proxyPolicy = fs.readFileSync(
    path.join(process.cwd(), "src/lib/adminProxyAuth.ts"),
    "utf8"
  );

  assert.match(route, /ADMIN_PERMISSIONS\.SHOP_INVENTORY_READ/);
  const publicSet =
    proxyPolicy.match(/PUBLIC_ADMIN_API_PATHS\s*=\s*new Set\((\[[\s\S]*?\])\)/)?.[1] ?? "";
  assert.doesNotMatch(publicSet, /\/api\/admin\/shop\/feed\/stock/);
});
