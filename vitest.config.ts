import { resolve } from "path";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

const repositoryRoot = import.meta.dirname;

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      reportOnFailure: true,
      include: ["packages/*/src/**/*.ts"],
      thresholds: {
        statements: 62,
        branches: 68,
        functions: 75,
        lines: 62,
        "packages/core/src/core/check/**/*.ts": {
          lines: 90,
          branches: 80,
        },
        "packages/core/src/core/snapshot/route-coverage.ts": {
          lines: 90,
          branches: 80,
        },
        "packages/core/src/core/snapshot/update-routes.ts": {
          lines: 90,
          branches: 80,
        },
        "packages/cli/src/cli/site-environment.ts": {
          lines: 90,
          branches: 80,
        },
      },
      exclude: [
        ...coverageConfigDefaults.exclude,
        "packages/*/src/**/*.test.ts",
        "packages/*/src/**/*.d.ts",
        "packages/*/src/__tests__/**",
        "packages/*/src/__test_server__/**",
        "packages/*/src/**/dist/**",
      ],
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
