import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      // Mirror the Next.js `@` path alias so test imports match production imports.
      "@": path.resolve(__dirname, "."),
      // `server-only` throws on import outside a React Server Component. Next
      // provides the real guard in production; tests swap in an empty module
      // so server-only files (e.g. lib/template-prompts.ts) can be exercised.
      "server-only": path.resolve(__dirname, "__tests__/stubs/server-only.ts"),
    },
  },
});
