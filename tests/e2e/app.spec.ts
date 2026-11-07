import { expect, test, type Page } from "@playwright/test";

const sqr = (page: Page, s: string) => page.locator('[data-square="' + s + '"]');
async function move(page: Page, from: string, to: string) {
  await sqr(page, from).click();
  await sqr(page, to).click();
}

test.beforeEach(async ({ page }) => {
  page.on("console", (m) => {
    if (m.type() === "error") throw new Error("console error: " + m.text());
  });
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("solves a mate-in-1 puzzle, wrong move is flagged and retried", async ({ page }) => {
  await page.goto("/?puzzle=1");
  await expect(sqr(page, "e6").locator('[data-piece="wQ"]')).toBeVisible();
  await move(page, "e6", "e1"); // legal but wrong
  await expect(page.getByTestId("status")).toContainText("try again");
  await expect(sqr(page, "e6").locator('[data-piece="wQ"]')).toBeVisible();
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
  await move(page, "e6", "h3");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
  await page.getByTestId("puzzle-solved").getByRole("button").click();
  await expect(page).toHaveURL(/puzzle=2/);
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
});

test("solves a mate-in-2 puzzle with the automatic reply", async ({ page }) => {
  await page.goto("/?puzzle=7");
  await move(page, "a5", "c7");
  await expect(sqr(page, "d4").locator('[data-piece="bP"]')).toBeVisible(); // defender replied d5d4
  await move(page, "a3", "a8");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("puzzle with promotion uses the picker", async ({ page }) => {
  await page.goto("/?puzzle=11");
  await move(page, "g7", "g8");
  const picker = page.getByTestId("promotion");
  await expect(picker.locator("button")).toHaveCount(4);
  await picker.locator('[data-piece="q"]').click();
  await expect(sqr(page, "c7").locator('[data-piece="bK"]')).toBeVisible(); // defender replied
  await move(page, "g8", "d8");
  await expect(sqr(page, "d8").locator('[data-piece="wQ"]')).toBeVisible();
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("plays a two-player game to checkmate", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-piece]")).toHaveCount(32);
  await move(page, "f2", "f3");
  await move(page, "e7", "e5");
  await move(page, "g2", "g4");
  await move(page, "d8", "h4");
  const over = page.getByTestId("game-over");
  await expect(over).toBeVisible();
  await expect(over).toContainText("Checkmate");
  await expect(over).toContainText("Black wins");
});

test("tap shows targets, illegal tap does nothing, drag moves", async ({ page }) => {
  await page.goto("/");
  await sqr(page, "e2").click();
  await expect(page.locator(".sq.target")).toHaveCount(2);
  await expect(sqr(page, "e2")).toHaveClass(/selected/);
  await sqr(page, "e5").click();
  await expect(sqr(page, "e2").locator('[data-piece="wP"]')).toBeVisible();
  await sqr(page, "e2").dragTo(sqr(page, "e4"));
  await expect(sqr(page, "e4").locator('[data-piece="wP"]')).toBeVisible();
  await expect(sqr(page, "e4")).toHaveClass(/last/);
});

test("promotion picker in a free game, and fen parameter", async ({ page }) => {
  await page.goto("/?fen=8/P6k/8/8/8/8/8/4K3 w - - 0 1");
  await move(page, "a7", "a8");
  await page.getByTestId("promotion").locator('[data-piece="n"]').click();
  await expect(sqr(page, "a8").locator('[data-piece="wN"]')).toBeVisible();
});

test("stalemate ends the game", async ({ page }) => {
  await page.goto("/?fen=7k/8/5KQ1/8/8/8/8/8 w - - 0 1");
  await move(page, "g6", "f7");
  await expect(page.getByTestId("game-over")).toContainText("stalemate");
});

test("no horizontal scroll at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
