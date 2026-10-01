import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-config-next already registers the jsx-a11y plugin but only enables a handful of its
    // rules. Turn on the full recommended set (labels, roles, keyboard handlers, alt text, ...) so
    // new markup that breaks the accessibility rules in DESIGN.md section 11.5 fails lint. Only the
    // rules are added here: registering the plugin a second time would be an ESLint error.
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
