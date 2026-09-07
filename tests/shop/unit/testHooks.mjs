import * as nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const serverOnlyStub = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/server-only-stub.cjs")
).href;
const loaderUrl = pathToFileURL(
  path.resolve("tests/shop/unit/fixtures/test-module-loader.mjs")
).href;

/**
 * Keep the existing Node 24 synchronous-hook API on newer runtimes while
 * providing the same test-only resolver on Node 20 and Node 22.14.
 */
export function registerHooks(options = {}) {
  if (typeof nodeModule.registerHooks === "function") {
    return nodeModule.registerHooks(options);
  }
  installCommonJsFallback();
  nodeModule.register(loaderUrl, {
    parentURL: import.meta.url,
    data: { serverOnlyStub },
  });
}

export function registerTestModuleHooks({ mockedAliases = [], mockUrl } = {}) {
  if (typeof nodeModule.registerHooks === "function") {
    return nodeModule.registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === "server-only") {
          return { url: serverOnlyStub, shortCircuit: true };
        }
        if (
          mockUrl &&
          mockedAliases.some(
            (alias) => specifier === alias || specifier.endsWith(String(alias).slice(1))
          )
        ) {
          return { url: mockUrl, shortCircuit: true };
        }
        return nextResolve(specifier, context);
      },
    });
  }
  installCommonJsFallback({ mockedAliases, mockUrl });
  nodeModule.register(loaderUrl, {
    parentURL: import.meta.url,
    data: { serverOnlyStub, mockedAliases, mockUrl },
  });
}

function installCommonJsFallback({ mockedAliases = [], mockUrl } = {}) {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  };

  const Module = require("node:module");
  const state =
    Module.__oneCompanyTestFallbackState ??
    (Module.__oneCompanyTestFallbackState = {
      rules: [],
      patched: false,
    });
  if (mockUrl && mockedAliases.length > 0) {
    state.rules.push({ aliases: [...mockedAliases], mockPath: fileURLToPath(mockUrl) });
  }
  if (state.patched) return;
  const originalResolveFilename = Module._resolveFilename;
  state.patched = true;
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    const rule = state.rules.find(({ aliases }) =>
      aliases.some((alias) => request === alias || request.endsWith(String(alias).slice(1)))
    );
    if (rule) return rule.mockPath;
    return originalResolveFilename.call(this, request, parent, isMain, options);
  };
}
