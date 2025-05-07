import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@api": resolve(__dirname, "./src/api"),
      "@cli": resolve(__dirname, "./src/cli"),
      "@core": resolve(__dirname, "./src/core"),
      "@project-types": resolve(__dirname, "./src/types"),
    },
  },
});
