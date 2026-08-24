import { resolve } from "path";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

const repositoryRoot = import.meta.dirname;

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
  sequence: {
    hooks: "list",
  },
  resolve: {
    alias: [
      {
        find: "@",
        replacement: resolve(repositoryRoot, "./packages/core/src"),
      },
      {
        find: "@cleaver/breakcheck-core",
        replacement: resolve(repositoryRoot, "./packages/core/src"),
      },
      {
        find: "breakcheck-cli",
        replacement: resolve(repositoryRoot, "./packages/cli/src"),
      },
      {
        find: "breakcheck-server",
        replacement: resolve(repositoryRoot, "./packages/server/src"),
      },
    ],
  },
});
