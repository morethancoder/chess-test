import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

const sq = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);

async function move(page: Page, from: string, to: string) {
  await sq(page, from).click();
  await sq(page, to).click();
}

test("plays a game to checkmate", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await expect(sq(page, "e1").locator('[data-piece="wK"]')).toHaveCount(1);
  // illegal: a pawn cannot jump three squares
  await sq(page, "e2").click();
  await expect(sq(page, "e4")).toHaveClass(/target/);
  await expect(sq(page, "e5")).not.toHaveClass(/target/);
  for (const [a, b] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) await move(page, a, b);
  const over = page.getByTestId("game-over");
  await expect(over).toBeVisible();
  await expect(over).toContainText("Checkmate");
  await expect(over).toContainText("Black wins");
  expect(errors).toEqual([]);
});

test("solves a mate-in-1 puzzle and moves on", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/?puzzle=1");
  await expect(page.locator('[data-piece="wQ"]')).toHaveCount(1);
  await move(page, "e6", "e7"); // wrong, legal move
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
  await expect(page.locator("#msg")).toContainText("Try again");
  await expect(sq(page, "e6").locator('[data-piece="wQ"]')).toHaveCount(1);
  await move(page, "e6", "h3");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
  await page.locator("#solved-next").click();
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
  expect(page.url()).toContain("puzzle=2");
  expect(errors).toEqual([]);
});

test("solves a mate-in-2 puzzle with an automatic reply", async ({ page }) => {
  await page.goto("/?puzzle=7");
  await move(page, "a5", "c7");
  await expect(sq(page, "d4").locator('[data-piece="bP"]')).toHaveCount(1); // defender's reply
  await move(page, "a3", "a8");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("promotion picker and drag to move", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("8/P6k/8/8/8/8/8/K7 w - - 0 1"));
  await sq(page, "a7").dragTo(sq(page, "a8"));
  const picker = page.getByTestId("promotion");
  await expect(picker).toBeVisible();
  await expect(picker.locator("button")).toHaveCount(4);
  await picker.locator('[data-piece="n"]').click();
  await expect(sq(page, "a8").locator('[data-piece="wN"]')).toHaveCount(1);
});

test("no horizontal scroll at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
