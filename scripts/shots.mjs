// Takes screenshots into .playwright/ against a dev server on $PORT (default 5173).
import { chromium } from "@playwright/test";

const base = `http://localhost:${process.env.PORT || 5173}`;
const browser = await chromium.launch();
const errors = [];
for (const scheme of ["light", "dark"]) {
  for (const [name, width, height] of [["phone", 390, 844], ["desktop", 1280, 800]]) {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width, height } });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const shot = (n) => page.screenshot({ path: `.playwright/${n}-${name}-${scheme}.png` });
    await page.goto(base + "/");
    await page.locator('[data-square="e2"]').click();
    await shot("game");
    await page.goto(base + "/?puzzle=7");
    await shot("puzzle");
    await page.goto(base + "/?fen=" + encodeURIComponent("r3k2r/1P6/8/8/8/8/8/R3K2R w KQkq - 0 1"));
    await page.locator('[data-square="b7"]').click();
    await page.locator('[data-square="b8"]').click();
    await shot("promotion");
    await page.goto(base + "/?puzzle=1");
    await page.locator('[data-square="e6"]').click();
    await page.locator('[data-square="h3"]').click();
    await shot("solved");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) errors.push(`horizontal overflow at ${width}`);
    await ctx.close();
  }
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "no errors");
