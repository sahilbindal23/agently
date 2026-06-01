import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests run in plain Node — these are pure-function regression guards
// for the money path (PROTECTION_FEE_RATE), demo-data visibility, and the
// recommendation ranking. They do NOT need the Next runtime, a DB, or auth.
// End-to-end coverage stays in Playwright (npm run test:e2e).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node"
  }
});
