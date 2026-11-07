import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const sqLoc = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);

async function move(page: Page, from: string, to: string) {
  await sqLoc(page, from).click();
  await sqLoc(page, to).click();
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("plays a game to checkmate (fool's mate)", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await expect(page.locator('[data-square="e1"] [data-piece="wK"]')).toBeVisible();
  await move(page, "f2", "f3");
  await move(page, "e7", "e5");
  await move(page, "g2", "g4");
  await expect(page.getByTestId("game-over")).toHaveCount(0);
  await move(page, "d8", "h4");
  const over = page.getByTestId("game-over");
  await expect(over).toContainText("Checkmate");
  await expect(over).toContainText("Black wins");
  expect(errors).toEqual([]);
});

test("solves a mate-in-1 puzzle, retrying after a wrong move", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/?puzzle=1");
  await expect(page.locator('[data-square="e6"] [data-piece="wQ"]')).toBeVisible();
  await move(page, "e6", "e7"); // legal but not mate
  await expect(page.getByText("try again")).toBeVisible();
  await expect(page.locator('[data-square="e6"] [data-piece="wQ"]')).toBeVisible();
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
  await move(page, "e6", "h3");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page).toHaveURL(/puzzle=2/);
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("solves a mate-in-2 puzzle with an automatic reply", async ({ page }) => {
  await page.goto("/?puzzle=7");
  await move(page, "a5", "c7");
  await expect(page.locator('[data-square="d4"] [data-piece="bP"]')).toBeVisible(); // reply d5d4
  await move(page, "a3", "a8");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("black puzzle with promotion picker", async ({ page }) => {
  await page.goto("/?puzzle=5");
  await move(page, "e2", "e1");
  const picker = page.getByTestId("promotion");
  await expect(picker.locator("button")).toHaveCount(4);
  await picker.locator('button[data-piece="q"]').click();
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("?fen starts a game; tapping shows legal targets; drag moves", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"));
  await expect(page.locator("[data-piece]")).toHaveCount(3);
  await sqLoc(page, "e2").click();
  await expect(sqLoc(page, "e2")).toHaveClass(/selected/);
  await expect(page.locator(".sq.target")).toHaveCount(2);
  await sqLoc(page, "e4").click();
  await expect(sqLoc(page, "e4").locator('[data-piece="wP"]')).toBeVisible();
  await expect(sqLoc(page, "e4")).toHaveClass(/last/);
  // black king drags to d7
  const from = (await sqLoc(page, "e8").boundingBox())!;
  const to = (await sqLoc(page, "d7").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(sqLoc(page, "d7").locator('[data-piece="bK"]')).toBeVisible();
});

test("promotion picker in a two-player game and check highlight", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("7k/P7/8/8/8/8/8/K7 w - - 0 1"));
  await move(page, "a7", "a8");
  await page.getByTestId("promotion").locator('button[data-piece="q"]').click();
  await expect(sqLoc(page, "a8").locator('[data-piece="wQ"]')).toBeVisible();
  await expect(sqLoc(page, "h8")).toHaveClass(/check/);
});

test("no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
