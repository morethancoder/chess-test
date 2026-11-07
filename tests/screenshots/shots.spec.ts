// Not part of `npm run e2e` (testDir is tests/e2e). Run with:
//   npx playwright test --config tests/screenshots/playwright.config.ts
import { test, type Page } from "@playwright/test";

const sq = (page: Page, n: string) => page.locator(`[data-square="${n}"]`);
async function move(page: Page, uci: string) {
  await sq(page, uci.slice(0, 2)).click();
  await sq(page, uci.slice(2, 4)).click();
}

for (const scheme of ["light", "dark"] as const) {
  for (const width of [390, 1280]) {
    test(`${scheme} ${width}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      const shot = async (name: string) => {
        await page.waitForTimeout(350);
        await page.screenshot({ path: `.playwright/${name}-${width}-${scheme}.png`, fullPage: true });
      };
      await page.goto("/");
      await move(page, "e2e4");
      await move(page, "e7e5");
      await move(page, "f1c4");
      await move(page, "b8c6");
      await sq(page, "d1").click();
      await shot("play");
      await sq(page, "h5").click();
      await move(page, "g8f6");
      await move(page, "h5f7");
      await shot("gameover");
      await page.getByRole("button", { name: "View board" }).click();
      await shot("checkmated");
      await page.goto("/?puzzle=7");
      await move(page, "a5a6");
      await shot("puzzle-wrong");
      await move(page, "a5c7");
      await shot("puzzle-reply");
      await move(page, "a3a8");
      await shot("puzzle-solved");
      await page.goto("/?fen=" + encodeURIComponent("8/P3k3/8/8/8/8/8/4K3 w - - 0 1"));
      await move(page, "a7a8");
      await shot("promotion");
      await page.goto("/?fen=" + encodeURIComponent("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"));
      await page.locator(".board").screenshot({ path: `.playwright/pieces-${width}-${scheme}.png` });
    });
  }
}
