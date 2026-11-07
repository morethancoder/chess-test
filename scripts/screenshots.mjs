// Takes screenshots of a running dev server: node scripts/screenshots.mjs <baseURL>
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? `http://localhost:${process.env.PORT || 5173}`;
const browser = await chromium.launch();
const shots = [
  ["play", "/"],
  ["puzzle", "/?puzzle=8"],
];
for (const scheme of ["light", "dark"]) {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 800 },
      colorScheme: scheme,
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text()));
    for (const [name, path] of shots) {
      await page.goto(base + path);
      await page.waitForSelector("[data-square]");
      if (name === "play") {
        // Select a piece after a couple of moves to show highlights.
        for (const [a, b] of [["e2", "e4"], ["e7", "e5"]]) {
          await page.click(`[data-square="${a}"]`);
          await page.click(`[data-square="${b}"]`);
        }
        await page.click('[data-square="g1"]');
      }
      await page.screenshot({ path: `.playwright/${name}-${width}-${scheme}.png`, fullPage: true });
    }
    // Game over + promotion states at each size.
    await page.goto(base + "/");
    for (const [a, b] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) {
      await page.click(`[data-square="${a}"]`);
      await page.click(`[data-square="${b}"]`);
    }
    await page.screenshot({ path: `.playwright/gameover-${width}-${scheme}.png`, fullPage: true });
    await page.goto(base + "/?fen=" + encodeURIComponent("8/4P3/8/8/8/8/k7/4K3 w - - 0 1"));
    await page.click('[data-square="e7"]');
    await page.click('[data-square="e8"]');
    await page.screenshot({ path: `.playwright/promo-${width}-${scheme}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();
