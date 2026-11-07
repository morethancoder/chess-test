import { test, expect, type Page } from "@playwright/test";

const sq = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);

async function tapMove(page: Page, from: string, to: string) {
  await sq(page, from).click();
  await sq(page, to).click();
}

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("plays a two-player game to checkmate (tap and drag)", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await expect(sq(page, "e1").locator('[data-piece="wK"]')).toBeVisible();

  await tapMove(page, "f2", "f3");
  await expect(sq(page, "f3").locator('[data-piece="wP"]')).toBeVisible();
  await tapMove(page, "e7", "e5");
  // Drag with the mouse.
  await sq(page, "g2").locator("[data-piece]").dragTo(sq(page, "g4"));
  await expect(sq(page, "g4").locator('[data-piece="wP"]')).toBeVisible();
  await tapMove(page, "d8", "h4");

  const over = page.getByTestId("game-over");
  await expect(over).toBeVisible();
  await expect(over).toContainText("Black wins");
  await expect(over).toContainText("checkmate");
  expect(errors).toEqual([]);
});

test("solves a mate-in-2 puzzle with the automatic reply", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/?puzzle=7");
  await expect(sq(page, "a5").locator('[data-piece="wQ"]')).toBeVisible();

  // A wrong move is flagged and taken back.
  await tapMove(page, "a3", "a4");
  await expect(page.getByRole("alert")).toContainText("Try again");
  await expect(sq(page, "a3").locator('[data-piece="wR"]')).toBeVisible();

  await tapMove(page, "a5", "c7");
  // Defender replies d5d4 automatically.
  await expect(sq(page, "d4").locator('[data-piece="bP"]')).toBeVisible();
  await tapMove(page, "a3", "a8");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();

  await page.getByTestId("puzzle-solved").getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/puzzle=8/);
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("promotion picker via ?fen", async ({ page }) => {
  await page.goto(`/?fen=${encodeURIComponent("8/4P3/8/8/8/8/k7/4K3 w - - 0 1")}`);
  await tapMove(page, "e7", "e8");
  const picker = page.getByTestId("promotion");
  await expect(picker.locator("[data-piece]")).toHaveCount(4);
  await picker.locator('[data-piece="n"]').click();
  await expect(sq(page, "e8").locator('[data-piece="wN"]')).toBeVisible();
});

test("no horizontal scroll at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?puzzle=1");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
