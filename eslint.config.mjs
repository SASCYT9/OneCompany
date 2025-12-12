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

    // Ignore one-off repo maintenance scripts stored at the repo root.
    "fix-*.js",
    "restore-auto-blocks*.js",
  ]),
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: ["scripts/**", "src/scripts/**"],
  },
]);

export default eslintConfig;
