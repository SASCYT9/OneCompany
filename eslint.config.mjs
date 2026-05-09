import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore bundled WordPress sources that ship with the repo.
    "wordpress/**",
    "wp-content/**",
    "scripts/**",
    ".agents/**",
    "public/sw.js",

    // Archived one-off scripts and historical artifacts.
    "archive/**",
    // Ignore one-off repo maintenance scripts stored at the repo root.
    "*.js",
    "fix-*.js",
    "restore-auto-blocks*.js",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "prefer-const": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "off",
      // React Compiler rules are advisory hints about missed memoization
      // opportunities, not correctness bugs. Demote to warnings so CI
      // surfaces them without blocking PRs. Address as cleanup tasks.
      "react-hooks/react-compiler": "warn",
      "react-compiler/react-compiler": "warn",
    },
  },
  {
    ignores: ["scripts/**", "src/scripts/**"],
  },
]);

export default eslintConfig;
