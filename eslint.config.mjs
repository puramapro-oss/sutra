import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import puramaConfig from "@purama/eslint-config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...puramaConfig,
  {
    // Test harnesses report assertions on stdout; the production rules stay intact.
    files: ["scripts/test-*.{mjs,mts}", "tooling/**/*.test.mjs"],
    rules: { "no-console": "off", "max-lines": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    "mobile/**",
    ".gitnexus/**",
    "graphify-out/**",
    "test-results/**",
    "playwright-report/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".vercel/**",
  ]),
]);

export default eslintConfig;
