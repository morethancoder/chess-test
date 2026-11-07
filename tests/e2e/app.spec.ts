import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const puzzles: { solution: string[]; type: string }[] = JSON.parse(readFileSync("public/puzzles.json", "utf8"));

async function move(page: Page, m: string) {
  await page.locator(`[data-square="${m.slice(0, 2)}"]`).click();
  await page.locator(`[data-square="${m.slice(2, 4)}"]`).click();
  if (m.length === 5) await page.locator(`[data-testid="promotion"] [data-piece="${m[4]}"]`).click();
}

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(String(err)));
});
test.afterEach(() => { expect(errors).toEqual([]); });

test("solves a mate-in-1 puzzle", async ({ page }) => {
  await page.goto("/?puzzle=1");
  await expect(page.locator('[data-square="e6"] [data-piece="wQ"]')).toBeVisible();
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
  await move(page, puzzles[0].solution[0]);
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page).toHaveURL(/puzzle=2/);
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
});

test("wrong move is flagged and can be retried", async ({ page }) => {
  await page.goto("/?puzzle=1");
  await move(page, "e6e7");
  await expect(page.getByTestId("feedback")).toContainText("not the right move");
  await expect(page.locator('[data-square="e6"] [data-piece="wQ"]')).toBeVisible();
  await move(page, puzzles[0].solution[0]);
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("solves every puzzle, including replies and promotions", async ({ page }) => {
  for (let i = 0; i < puzzles.length; i++) {
    await page.goto(`/?puzzle=${i + 1}`);
    const sol = puzzles[i].solution;
    for (let k = 0; k < sol.length; k += 2) {
      await move(page, sol[k]);
      if (k + 2 < sol.length) {
        const to = sol[k + 1].slice(2, 4);
        await expect(page.locator(`[data-square="${to}"] [data-piece]`)).toBeVisible();
      }
    }
    await expect(page.getByTestId("puzzle-solved"), `puzzle ${i + 1}`).toBeVisible();
  }
});

test("plays a game to checkmate (fool's mate)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  for (const m of ["f2f3", "e7e5", "g2g4", "d8h4"]) await move(page, m);
  await expect(page.getByTestId("game-over")).toContainText("Checkmate");
  await expect(page.getByTestId("game-over")).toContainText("Black wins");
});

test("illegal moves are ignored and legal targets are shown", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-square="e2"]').click();
  await expect(page.locator(".sq.target")).toHaveCount(2);
  await page.locator('[data-square="e5"]').click();
  await expect(page.locator('[data-square="e2"] [data-piece="wP"]')).toBeVisible();
  await expect(page.locator(".sq.selected")).toHaveCount(0);
});

test("drag to move with the mouse", async ({ page }) => {
  await page.goto("/");
  const from = (await page.locator('[data-square="e2"]').boundingBox())!;
  const to = (await page.locator('[data-square="e4"]').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('[data-square="e4"] [data-piece="wP"]')).toBeVisible();
  await expect(page.locator(".sq.last")).toHaveCount(2);
});

test("promotion picker, check highlight and ?fen", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("7k/P7/8/8/8/8/8/K7 w - - 0 1"));
  await page.locator('[data-square="a7"]').click();
  await page.locator('[data-square="a8"]').click();
  const picker = page.getByTestId("promotion");
  await expect(picker.locator("button")).toHaveCount(4);
  await picker.locator('[data-piece="r"]').click();
  await expect(page.locator('[data-square="a8"] [data-piece="wR"]')).toBeVisible();
  await expect(page.locator(".sq.check")).toHaveCount(1);
});

test("castling and en passant via the UI", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("4k3/3p4/8/4P3/8/8/8/R3K2R b KQ - 0 1"));
  await move(page, "d7d5");
  await move(page, "e5d6");
  await expect(page.locator('[data-square="d5"] [data-piece]')).toHaveCount(0);
  await move(page, "e8f8");
  await move(page, "e1g1");
  await expect(page.locator('[data-square="f1"] [data-piece="wR"]')).toBeVisible();
});
