// Usage: PORT=5199 node scripts/screenshots.mjs  (dev server must be running)
import { chromium } from "@playwright/test";

const port = process.env.PORT || 5173;
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [1280, 800]]) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const shots = {
      game: "/?fen=" + encodeURIComponent("r3k2r/pp3ppp/2n1b3/3pP3/8/2N2N2/PPP2PPP/R1BQK2R b KQkq - 0 1"),
      puzzle: "/?puzzle=9",
      over: "/?fen=" + encodeURIComponent("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"),
    };
    for (const [name, url] of Object.entries(shots)) {
      await page.goto(`http://localhost:${port}${url}`);
      await page.waitForSelector("[data-square]");
      if (name === "game") {
        await page.locator('[data-square="e6"]').click();
      }
      await page.screenshot({ path: `.playwright/${name}-${w}-${scheme}.png`, fullPage: true });
    }
    console.log(w, scheme, "errors:", errors.length, "scrollW-innerW:", await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
    await ctx.close();
  }
}
await browser.close();
