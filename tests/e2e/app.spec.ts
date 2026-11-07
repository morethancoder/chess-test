import { expect, test, type Page } from "@playwright/test";
import puzzles from "../../public/puzzles.json" with { type: "json" };

const sq = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);

async function tap(page: Page, from: string, to: string) {
  await sq(page, from).click();
  await sq(page, to).click();
}

async function drag(page: Page, from: string, to: string) {
  await sq(page, from).dragTo(sq(page, to));
}

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test("plays a two-player game to checkmate (tap to move)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-square]")).toHaveCount(64);
  await expect(page.locator("[data-piece]")).toHaveCount(32);
  await sq(page, "e2").click();
  await expect(sq(page, "e2")).toHaveClass(/selected/);
  await expect(sq(page, "e4")).toHaveClass(/target/);
  await sq(page, "e4").click();
  await expect(sq(page, "e4").locator('[data-piece="wP"]')).toBeVisible();
  await expect(sq(page, "e2")).toHaveClass(/last/);
  await tap(page, "e7", "e5");
  await tap(page, "f1", "c4");
  await tap(page, "b8", "c6");
  await tap(page, "d1", "h5");
  await tap(page, "g8", "f6");
  await tap(page, "h5", "f7");
  const over = page.getByTestId("game-over");
  await expect(over).toBeVisible();
  await expect(over).toContainText("Checkmate");
  await expect(over).toContainText("White wins");
  await expect(sq(page, "e8")).toHaveClass(/check/);
});

test("plays fool's mate by dragging", async ({ page }) => {
  await page.goto("/");
  await drag(page, "f2", "f3");
  await drag(page, "e7", "e5");
  await drag(page, "g2", "g4");
  await drag(page, "d8", "h4");
  await expect(page.getByTestId("game-over")).toContainText("Black wins");
});

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("drags a piece with a finger", async ({ page }) => {
    await page.goto("/");
    const cdp = await page.context().newCDPSession(page);
    const centre = async (name: string) => {
      const b = (await sq(page, name).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const a = await centre("g1");
    const b = await centre("f3");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [a] });
    for (let i = 1; i <= 6; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / 6, y: a.y + ((b.y - a.y) * i) / 6 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(sq(page, "f3").locator('[data-piece="wN"]')).toBeVisible();
    await expect(sq(page, "g1").locator("[data-piece]")).toHaveCount(0);
  });
});

test("illegal moves are refused", async ({ page }) => {
  await page.goto("/");
  await tap(page, "e2", "e5");
  await expect(sq(page, "e2").locator('[data-piece="wP"]')).toBeVisible();
  await tap(page, "e7", "e5"); // not black's turn
  await expect(sq(page, "e7").locator('[data-piece="bP"]')).toBeVisible();
});

test("promotion picker from a ?fen position", async ({ page }) => {
  await page.goto(`/?fen=${encodeURIComponent("7k/P7/8/8/8/8/8/K7 w - - 0 1")}`);
  await tap(page, "a7", "a8");
  const picker = page.getByTestId("promotion");
  await expect(picker).toBeVisible();
  await expect(picker.locator("button[data-piece]")).toHaveCount(4);
  await picker.locator('[data-piece="n"]').click();
  await expect(picker).toHaveCount(0);
  await expect(sq(page, "a8").locator('[data-piece="wN"]')).toBeVisible();
});

test("stalemate shows a draw", async ({ page }) => {
  await page.goto(`/?fen=${encodeURIComponent("7k/8/6Q1/8/8/8/8/K7 w - - 0 1")}`);
  await tap(page, "g6", "f7");
  await expect(page.getByTestId("game-over")).toContainText("Stalemate");
});

test("solves a mate-in-2 puzzle, with a wrong try first", async ({ page }) => {
  await page.goto("/?puzzle=7");
  await expect(sq(page, "a5").locator('[data-piece="wQ"]')).toBeVisible();
  await tap(page, "a5", "a6"); // wrong
  await expect(page.locator("#status")).toContainText("try again");
  await expect(sq(page, "a5").locator('[data-piece="wQ"]')).toBeVisible();
  await tap(page, "a5", "c7");
  await expect(sq(page, "d4").locator('[data-piece="bP"]')).toBeVisible(); // automatic reply
  await tap(page, "a3", "a8");
  await expect(page.getByTestId("puzzle-solved")).toBeVisible();
  await page.getByRole("button", { name: "Next puzzle" }).click();
  await expect(page).toHaveURL(/puzzle=8/);
  await expect(page.getByTestId("puzzle-solved")).toHaveCount(0);
});

test("every puzzle can be solved with its listed solution", async ({ page }) => {
  for (const p of puzzles) {
    await page.goto(`/?puzzle=${p.id}`);
    for (let i = 0; i < p.solution.length; i += 2) {
      const m = p.solution[i];
      await tap(page, m.slice(0, 2), m.slice(2, 4));
      if (m[4]) await page.getByTestId("promotion").locator(`[data-piece="${m[4]}"]`).click();
    }
    await expect(page.getByTestId("puzzle-solved"), `puzzle ${p.id}`).toBeVisible();
  }
});

test("no horizontal scroll at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ["/", "/?puzzle=1"]) {
    await page.goto(url);
    await expect(page.locator("[data-piece]").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
