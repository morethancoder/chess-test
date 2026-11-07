// Usage: PORT=<dev server port> node scripts/screenshots.ts
import { chromium } from "@playwright/test";

const port = process.env.PORT || "5173";
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [1280, 800]]) {
  for (const scheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    for (const [name, url] of [
      ["play", "/"],
      ["puzzle", "/?puzzle=7"],
      ["check", "/?fen=" + encodeURIComponent("rnbqkbnr/ppppp2p/5p2/6pQ/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 3")],
    ]) {
      await page.goto(`http://localhost:${port}${url}`);
      await page.waitForSelector("[data-square]");
      await page.screenshot({ path: `.playwright/${name}-${w}-${scheme}.png`, fullPage: true });
    }
    // select a piece, then promotion picker, then solved
    await page.goto(`http://localhost:${port}/?fen=` + encodeURIComponent("7k/P7/8/8/8/8/8/K7 w - - 0 1"));
    await page.click('[data-square="a7"]');
    await page.click('[data-square="a8"]');
    await page.screenshot({ path: `.playwright/promo-${w}-${scheme}.png` });
    await page.goto(`http://localhost:${port}/?puzzle=1`);
    await page.click('[data-square="e6"]');
    await page.click('[data-square="h3"]');
    await page.screenshot({ path: `.playwright/solved-${w}-${scheme}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(w, scheme, "horizontal overflow:", overflow, "errors:", errors);
    await ctx.close();
  }
}
await browser.close();
