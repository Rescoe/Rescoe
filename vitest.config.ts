import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig utilise "jsx": "preserve" (Next compile le JSX) : Vitest doit le transformer lui-même.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@styles": path.resolve(__dirname, "src/styles"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 20_000,
  },
});
