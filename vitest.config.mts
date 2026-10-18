import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server bundle; it's a no-op for tests.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Never let an inherited deployment DSN turn unit fixtures into live writes.
    // Database tests explicitly opt into their validated local TEST_DATABASE_URL.
    env: { DATABASE_URL: "" },
    include: ["src/**/*.test.ts"],
  },
});
