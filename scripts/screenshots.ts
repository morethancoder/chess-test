// Takes screenshots of the running dev server into .playwright/.
// Usage: node scripts/screenshots.ts   (needs `npm run dev` running on $PORT)
import { chromium } from "@playwright/test";

const base = `http://localhost:${process.env.PORT || 5173}`;
const browser = await chromium.launch();
const errors: string[] = [];

for (const width of [390, 1280]) {
  for (const scheme of ["light", "dark"] as const) {
    const ctx = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 800 },
      colorScheme: scheme,
      deviceScaleFactor: width === 390 ? 2 : 1,
    });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    const shot = async (name: string) => {
      await page.waitForTimeout(250);
      await page.screenshot({ path: `.playwright/${name}-${width}-${scheme}.png`, fullPage: true });
    };
    const tap = async (a: string, b: string) => {
      await page.click(`[data-square="${a}"]`);
      await page.click(`[data-square="${b}"]`);
    };

    await page.goto(base);
    await tap("e2", "e4");
    await tap("e7", "e5");
    await page.click('[data-square="g1"]');
    await shot("play");

    await page.click('[data-square="f3"]'); // g1 is selected: this plays Nf3
    await tap("d7", "d6");
    await tap("f1", "b5");
    await shot("check");

    await page.goto(`${base}/?fen=${encodeURIComponent("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4")}`);
    await tap("h5", "f7");
    await shot("gameover");

    await page.goto(`${base}/?fen=${encodeURIComponent("7k/P7/8/8/8/8/8/K7 w - - 0 1")}`);
    await tap("a7", "a8");
    await shot("promotion");

    await page.goto(`${base}/?puzzle=7`);
    await tap("a5", "a6");
    await shot("puzzle-wrong");
    await tap("a5", "c7");
    await page.waitForTimeout(600);
    await tap("a3", "a8");
    await shot("puzzle-solved");

    await page.goto(`${base}/?puzzle=5`);
    await shot("puzzle-black");
    await ctx.close();
  }
}
await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("ok");
