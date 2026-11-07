import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  testDir: ".",
  outputDir: "../../.playwright/screenshot-results",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npm run dev", port, reuseExistingServer: false, cwd: "../.." },
});
