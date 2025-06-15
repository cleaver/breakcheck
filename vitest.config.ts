import { resolve } from "path";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [...coverageConfigDefaults.exclude, "**/__test_server__/**"],
    },
    include: ["packages/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "breakcheck-core": resolve(__dirname, "./packages/core/src"),
      "breakcheck-cli": resolve(__dirname, "./packages/cli/src"),
      "breakcheck-server": resolve(__dirname, "./packages/server/src"),
    },
  },
});
