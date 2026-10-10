import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors tsconfig's "@/*" path so component tests can import app modules.
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
  },
});
