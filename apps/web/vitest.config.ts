import path from "node:path";

import { defineConfig } from "vitest/config";

/** Tests import route handlers, which use the app's `@/` paths, as tsconfig.json maps them. */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
});
