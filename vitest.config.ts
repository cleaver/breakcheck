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
    alias: [
      {
        find: "@",
        replacement: resolve(__dirname, "./packages/core/src"),
      },
      {
        find: "breakcheck-core",
        replacement: resolve(__dirname, "./packages/core/src"),
      },
      {
        find: "breakcheck-cli",
        replacement: resolve(__dirname, "./packages/cli/src"),
      },
      {
        find: "breakcheck-server",
        replacement: resolve(__dirname, "./packages/server/src"),
      },
    ],
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        paths: {
          "@/*": ["./packages/core/src/*"],
        },
      },
    },
  },
});
