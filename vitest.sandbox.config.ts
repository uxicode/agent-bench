import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["sandbox/tasks/**/*.test.ts"],
    exclude: ["node_modules", "src/**"],
    passWithNoTests: true,
  },
});
