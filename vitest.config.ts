import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Increase test and hook timeouts for server tests
    testTimeout: 120000,
    hookTimeout: 60000,
    // Setup environment
    setupFiles: ["tests/setup.ts"],
    // Ensure clean environment for each test
    isolate: true,
    // Test file patterns to include
    include: ["tests/**/*.test.ts"],
  },
});
