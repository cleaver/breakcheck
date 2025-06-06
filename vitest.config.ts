import { coverageConfigDefaults, defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [...coverageConfigDefaults.exclude, "src/__test_server__/**/*"],
    },
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@api": resolve(__dirname, "./src/api"),
      "@cli": resolve(__dirname, "./src/cli"),
      "@core": resolve(__dirname, "./src/core"),
      "@lib": resolve(__dirname, "./src/lib"),
      "@project-types": resolve(__dirname, "./src/types"),
    },
  },
});
