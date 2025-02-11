import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Increase test timeout to 60 seconds for long-running server tests
    testTimeout: 60000,
    // Setup environment
    setupFiles: ["tests/setup.ts"],
    // Ensure clean environment for each test
    isolate: true,
    // Test file patterns to include
    include: ["tests/**/*.test.ts"],
  },
});
