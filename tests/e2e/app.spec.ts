import { expect, test, type Page } from "@playwright/test";

const sq = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);
async function move(page: Page, uci: string) {
  await sq(page, uci.slice(0, 2)).click();
  await sq(page, uci.slice(2, 4)).click();
}
async function drag(page: Page, from: string, to: string) {
  const a = (await sq(page, from).boundingBox())!, b = (await sq(page, to).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 3 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

// Every test fails on any console error or page error.
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test("start position has 64 squares and 32 pieces", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await expect(page.locator("#board [data-piece]")).toHaveCount(32);
  await expect(sq(page, "e1").locator('[data-piece="wK"]')).toHaveCount(1);
  await expect(sq(page, "d8").locator('[data-piece="bQ"]')).toHaveCount(1);
});

test("plays a game to checkmate", async ({ page }) => {
  await page.goto("/");
  await move(page, "e2e4");
  await move(page, "e7e5");
  await move(page, "f1c4");
  await move(page, "b8c6");
  await move(page, "d1h5");
  await move(page, "g8f6");
  await move(page, "h5f7");
  const over = page.getByTestId("game-over");
  await expect(over).toBeVisible();
  await expect(over).toContainText("Checkmate");
  await expect(over).toContainText("White wins");
  await expect(sq(page, "e8")).toHaveClass(/check/);
});

test("solves a mate-in-1 puzzle", async ({ page }) => {
  await page.goto("/?puzzle=1");
  await move(page, "e6h3");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("mate-in-2: wrong move is flagged, retry works, reply is automatic, next puzzle opens", async ({ page }) => {
  await page.goto("/?puzzle=7");
  await move(page, "a5a6"); // legal but wrong
  await expect(page.locator(".feedback.wrong")).toBeVisible();
  await expect(sq(page, "a5").locator('[data-piece="wQ"]')).toHaveCount(1);
  await move(page, "a5c7");
  // Black's reply d5-d4 plays by itself.
  await expect(sq(page, "d4").locator('[data-piece="bP"]')).toHaveCount(1);
  await move(page, "a3a8");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
  await page.getByRole("button", { name: "Next puzzle" }).first().click();
  await expect(page).toHaveURL(/puzzle=8/);
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
});

test("black-to-move puzzle with promotion", async ({ page }) => {
  await page.goto("/?puzzle=5");
  await move(page, "e2e1");
  const picker = page.getByTestId("promotion");
  await expect(picker).toBeVisible();
  await picker.locator('[data-piece="q"]').click();
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
});

test("promotion picker offers four pieces and places the choice", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("8/P3k3/8/8/8/8/8/4K3 w - - 0 1"));
  await move(page, "a7a8");
  const picker = page.getByTestId("promotion");
  await expect(picker.locator("button[data-piece]")).toHaveCount(4);
  await picker.locator('[data-piece="n"]').click();
  await expect(sq(page, "a8").locator('[data-piece="wN"]')).toHaveCount(1);
});

test("drag to move with the mouse", async ({ page }) => {
  await page.goto("/");
  await drag(page, "g1", "f3");
  await expect(sq(page, "f3").locator('[data-piece="wN"]')).toHaveCount(1);
  await expect(sq(page, "f3")).toHaveClass(/last-move/);
  await expect(sq(page, "g1")).toHaveClass(/last-move/);
});

test("drag with locator.dragTo, and an illegal drop snaps back", async ({ page }) => {
  await page.goto("/");
  await sq(page, "e2").locator("[data-piece]").dragTo(sq(page, "e5"));
  await expect(sq(page, "e2").locator('[data-piece="wP"]')).toHaveCount(1);
  await sq(page, "e2").locator("[data-piece]").dragTo(sq(page, "e4"));
  await expect(sq(page, "e4").locator('[data-piece="wP"]')).toHaveCount(1);
});

test("threefold repetition ends the game as a draw", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 2; i++) for (const m of ["g1f3", "g8f6", "f3g1", "f6g8"]) await move(page, m);
  await expect(page.getByTestId("game-over")).toContainText("Threefold repetition");
});

test("illegal moves are refused and legal targets are shown", async ({ page }) => {
  await page.goto("/");
  await sq(page, "e2").click();
  await expect(sq(page, "e2")).toHaveClass(/selected/);
  await expect(page.locator(".square.target")).toHaveCount(2);
  await sq(page, "e5").click();
  await expect(sq(page, "e2").locator('[data-piece="wP"]')).toHaveCount(1);
  await expect(sq(page, "e5").locator("[data-piece]")).toHaveCount(0);
});

test("castling through the UI", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"));
  await move(page, "e1g1");
  await expect(sq(page, "g1").locator('[data-piece="wK"]')).toHaveCount(1);
  await expect(sq(page, "f1").locator('[data-piece="wR"]')).toHaveCount(1);
});

test("stalemate from ?fen shows a draw", async ({ page }) => {
  await page.goto("/?fen=" + encodeURIComponent("7k/8/6K1/8/8/8/8/5Q2 w - - 0 1"));
  await move(page, "f1f7");
  await expect(page.getByTestId("game-over")).toContainText("Stalemate");
});

test("no horizontal scroll at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ["/", "/?puzzle=2"]) {
    await page.goto(url);
    await expect(page.locator("[data-square]")).toHaveCount(64);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw).toBeLessThanOrEqual(390);
  }
});

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("tap to move on a touch screen", async ({ page }) => {
    await page.goto("/");
    await sq(page, "e2").tap();
    await sq(page, "e4").tap();
    await expect(sq(page, "e4").locator('[data-piece="wP"]')).toHaveCount(1);
  });
  test("drag to move with touch", async ({ page }) => {
    await page.goto("/");
    const a = (await sq(page, "b1").boundingBox())!, b = (await sq(page, "c3").boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const point = (x: number, y: number) => [{ x, y, id: 1 }];
    const ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(ax, ay) });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(ax + ((bx - ax) * i) / 8, ay + ((by - ay) * i) / 8) });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(sq(page, "c3").locator('[data-piece="wN"]')).toHaveCount(1);
    await expect(sq(page, "b1").locator("[data-piece]")).toHaveCount(0);
  });
});
