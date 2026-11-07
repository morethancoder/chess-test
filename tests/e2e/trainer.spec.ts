import { expect, test, type Page } from "@playwright/test";

const sq = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);
async function move(page: Page, from: string, to: string) {
  await sq(page, from).click();
  await sq(page, to).click();
}

test.beforeEach(async ({ page }) => {
  page.on("console", (m) => expect(m.type(), m.text()).not.toBe("error"));
  page.on("pageerror", (e) => { throw e; });
});

test("solves a mate-in-2 puzzle, retrying after a wrong move", async ({ page }) => {
  await page.goto("/?puzzle=7");
  await expect(sq(page, "a5").locator('[data-piece="wQ"]')).toBeVisible();
  await move(page, "a3", "a4"); // wrong
  await expect(page.getByTestId("status")).toContainText("try again");
  await expect(sq(page, "a3").locator('[data-piece="wR"]')).toBeVisible();
  await move(page, "a5", "c7"); // right
  await expect(sq(page, "d4").locator('[data-piece="bP"]')).toBeVisible(); // auto reply
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
  await move(page, "a3", "a8");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
  await page.getByTestId("puzzle-solved").getByRole("button").click();
  await expect(page.getByText("Puzzle 8 of 12")).toBeVisible();
});

test("solves a mate-in-1 puzzle by dragging", async ({ page }) => {
  await page.goto("/?puzzle=1");
  await sq(page, "e6").dragTo(sq(page, "h3"));
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("solves a puzzle that ends in promotion (black to move)", async ({ page }) => {
  await page.goto("/?puzzle=5");
  await move(page, "e2", "e1");
  await page.getByTestId("promotion").locator('[data-piece="q"]').click();
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("plays a game to checkmate", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await move(page, "f2", "f3");
  await move(page, "e7", "e5");
  await move(page, "g2", "g4");
  await sq(page, "d8").click();
  await expect(sq(page, "h4")).toHaveClass(/target/);
  await sq(page, "h4").click();
  const over = page.getByTestId("game-over");
  await expect(over).toBeVisible();
  await expect(over).toContainText("Checkmate");
  await expect(over).toContainText("Black wins");
  await expect(sq(page, "e1")).toHaveClass(/check/);
});

test("illegal moves are ignored and ?fen starts a game", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("7k/4P3/8/8/8/8/8/K7 w - - 0 1"));
  await move(page, "e7", "e5");
  await expect(sq(page, "e7").locator('[data-piece="wP"]')).toBeVisible();
  await move(page, "e7", "e8");
  await expect(page.getByTestId("promotion").locator("button")).toHaveCount(4);
  await page.getByTestId("promotion").locator('[data-piece="n"]').click();
  await expect(sq(page, "e8").locator('[data-piece="wN"]')).toBeVisible();
});

test("stalemate ends the game", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("7k/8/5K2/6Q1/8/8/8/8 w - - 0 1"));
  await move(page, "g5", "g6");
  await expect(page.getByTestId("game-over")).toContainText("Stalemate");
});
