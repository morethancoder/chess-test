// Takes screenshots into .playwright/ — run with the dev server up: node scripts/shots.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const port = Number(process.env.PORT) || 5173;
mkdirSync(".playwright", { recursive: true });
const browser = await chromium.launch();
const pages = {
  game: "/",
  check: "/?fen=" + encodeURIComponent("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"),
  puzzle: "/?puzzle=7",
};
for (const [w, h] of [[390, 844], [1280, 800]]) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && console.log("CONSOLE ERROR", m.text()));
    for (const [name, path] of Object.entries(pages)) {
      await page.goto(`http://localhost:${port}${path}`);
      await page.waitForSelector("[data-square]");
      if (name === "game") await page.click('[data-square="e2"]');
      await page.screenshot({ path: `.playwright/${name}-${w}-${scheme}.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close();
