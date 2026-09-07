let config = {};

export function initialize(value) {
  config = value ?? {};
}

function isMockedAlias(specifier) {
  const aliases = Array.isArray(config.mockedAliases) ? config.mockedAliases : [];
  return aliases.some((alias) => specifier === alias || specifier.endsWith(String(alias).slice(1)));
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only" && config.serverOnlyStub) {
    return { url: config.serverOnlyStub, shortCircuit: true };
  }
  if (config.mockUrl && isMockedAlias(specifier)) {
    return { url: config.mockUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
