import { expect, test, type Page } from "@playwright/test";

const sq = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);
const move = async (page: Page, from: string, to: string) => {
  await sq(page, from).click();
  await sq(page, to).click();
};

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
});
test.afterEach(() => expect(errors).toEqual([]));

test("plays a game to checkmate (fool's mate)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await expect(page.locator("[data-piece]")).toHaveCount(32);
  await move(page, "f2", "f3");
  await move(page, "e7", "e5");
  await move(page, "g2", "g4");
  await move(page, "d8", "h4");
  const over = page.getByTestId("game-over");
  await expect(over).toBeVisible();
  await expect(over).toContainText("Black wins");
  await expect(sq(page, "e1")).toHaveClass(/check/);
});

test("solves a mate-in-2 puzzle with an automatic reply", async ({ page }) => {
  await page.goto("/?puzzle=7");
  await move(page, "a5", "c7");
  // the defender plays d5d4 by itself
  await expect(sq(page, "d4").locator("[data-piece='bP']")).toBeVisible();
  await move(page, "a3", "a8");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page).toHaveURL(/puzzle=8/);
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
});

test("a wrong puzzle move is flagged and can be retried", async ({ page }) => {
  await page.goto("/?puzzle=1");
  await move(page, "e6", "e7");
  await expect(page.getByText("Not the solution")).toBeVisible();
  await expect(sq(page, "e6").locator("[data-piece='wQ']")).toBeVisible();
  await move(page, "e6", "h3");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("black promotion puzzle uses the picker", async ({ page }) => {
  await page.goto("/?puzzle=5");
  await move(page, "e2", "e1");
  const picker = page.getByTestId("promotion");
  await expect(picker.locator("button")).toHaveCount(4);
  await picker.locator("[data-piece='q']").click();
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("tap shows targets; drag moves; fen param works", async ({ page }) => {
  await page.goto("/");
  await sq(page, "g1").click();
  await expect(sq(page, "g1")).toHaveClass(/selected/);
  await expect(page.locator(".sq.target")).toHaveCount(2);
  await sq(page, "g1").click();
  await expect(page.locator(".sq.target")).toHaveCount(0);

  const a = (await sq(page, "e2").boundingBox())!;
  const b = (await sq(page, "e4").boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(sq(page, "e4").locator("[data-piece='wP']")).toBeVisible();
  await expect(sq(page, "e4")).toHaveClass(/last/);

  await page.goto("/?fen=" + encodeURIComponent("4k3/P7/8/8/8/8/8/4K3 w - - 0 1"));
  await expect(page.locator("[data-piece]")).toHaveCount(3);
  await move(page, "a7", "a8");
  await page.getByTestId("promotion").locator("[data-piece='n']").click();
  await expect(sq(page, "a8").locator("[data-piece='wN']")).toBeVisible();
});

test("stalemate ends the game", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("7k/5Q2/8/6K1/8/8/8/8 w - - 0 1"));
  await move(page, "g5", "g6");
  await expect(page.getByTestId("game-over")).toContainText("Stalemate");
});

test("no horizontal scroll at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ["/", "/?puzzle=3"]) {
    await page.goto(url);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBeLessThanOrEqual(cw);
  }
});
