/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// The dev server serves on $PORT (the lead's checks set it), 5173 otherwise.
export default defineConfig({
  server: { port: Number(process.env.PORT) || 5173, strictPort: true },
  preview: { port: Number(process.env.PORT) || 4173, strictPort: true },
  test: { include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"] },
});
