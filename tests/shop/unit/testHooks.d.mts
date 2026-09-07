export type TestResolveContext = {
  conditions: string[];
  importAttributes: Record<string, string>;
  parentURL?: string;
};

export type TestResolveResult = {
  url: string;
  format?: string;
  shortCircuit?: boolean;
};

export type TestNextResolve = (
  specifier: string,
  context: TestResolveContext
) => TestResolveResult | Promise<TestResolveResult>;

export type TestResolveHook = (
  specifier: string,
  context: TestResolveContext,
  nextResolve: TestNextResolve
) => TestResolveResult | Promise<TestResolveResult>;

export function registerHooks(options?: { resolve?: TestResolveHook }): void;

export function registerTestModuleHooks(options?: {
  mockedAliases?: readonly string[];
  mockUrl?: string;
}): void;
