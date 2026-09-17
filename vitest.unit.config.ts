import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/lib/**/*.test.ts"],
    exclude: ["node_modules", "sandbox/**"],
    passWithNoTests: true,
  },
});
