// Takes screenshots into .playwright/. Usage: PORT=... node scripts/shots.mjs
import { chromium } from "@playwright/test";

import { spawn } from "node:child_process";

const port = process.env.PORT || 5173;
const server = spawn("npx", ["vite"], { stdio: "ignore", env: { ...process.env, PORT: String(port) } });
for (let i = 0; i < 50; i++) {
  try { await fetch(`http://localhost:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
}
const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  for (const [w, h] of [[390, 844], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const base = `http://localhost:${port}`;
    const tag = `${w}-${scheme}`;
    await page.goto(base + "/");
    await page.locator('[data-square="e2"]').click();
    await page.screenshot({ path: `.playwright/game-${tag}.png`, fullPage: true });
    await page.goto(base + "/?puzzle=6");
    await page.screenshot({ path: `.playwright/puzzle-${tag}.png`, fullPage: true });
    await page.goto(base + "/?fen=" + encodeURIComponent("r3k2r/pPp2ppp/8/8/8/8/8/R3K2R w KQkq - 0 1"));
    await page.locator('[data-square="b7"]').click();
    await page.locator('[data-square="b8"]').click();
    await page.screenshot({ path: `.playwright/promo-${tag}.png`, fullPage: true });
    await page.goto(base + "/");
    for (const [a, b] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) {
      await page.locator(`[data-square="${a}"]`).click();
      await page.locator(`[data-square="${b}"]`).click();
    }
    await page.screenshot({ path: `.playwright/over-${tag}.png`, fullPage: true });
    console.log(tag, "errors:", errors.length, "overflow:", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
    await ctx.close();
  }
}
await browser.close();
server.kill();
