import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // server-only бросает ошибку вне RSC-сборки — в юнит-тестах подменяем пустышкой.
      "server-only": `${root}test/server-only-stub.ts`,
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts", "app/**/*.test.ts"],
  },
});
