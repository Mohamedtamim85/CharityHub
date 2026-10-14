import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globalSetup: ["./tests/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 40000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});
