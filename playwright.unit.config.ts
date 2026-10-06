import { defineConfig } from "@playwright/test";

// Fast config for tests that need no browser and no running app: SQL tests on PGlite, the MCP route and
// proxy tests, scrub tests and fake-client unit tests. `npm run test:unit` works on a fresh checkout
// without a production build. The accessibility tests (they need a built, running app) stay on the main
// config, which CI runs in full via `npm run test:a11y`.
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/a11y.spec.ts"],
  fullyParallel: true,
  reporter: "list",
});
