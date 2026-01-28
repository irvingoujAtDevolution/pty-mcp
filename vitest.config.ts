import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 30000, // 30s for PowerShell tests
    hookTimeout: 10000,
    pool: "forks", // Use forks for better isolation with native modules
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid PTY conflicts
      },
    },
  },
});
