import { test, expect, type Page } from '@playwright/test';

const sq = (page: Page, s: string) => page.locator(`[data-square="${s}"]`);

async function tapMove(page: Page, from: string, to: string) {
  await sq(page, from).click();
  await sq(page, to).click();
}

async function dragMove(page: Page, from: string, to: string) {
  await sq(page, from).dragTo(sq(page, to));
}

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('plays a two-player game to checkmate (tap and drag)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-square]')).toHaveCount(64);
  await expect(page.locator('[data-piece]')).toHaveCount(32);
  await expect(sq(page, 'e1').locator('[data-piece="wK"]')).toBeVisible();

  // Tapping a piece shows its legal targets.
  await sq(page, 'f2').click();
  await expect(sq(page, 'f2')).toHaveClass(/selected/);
  await expect(page.locator('.sq.target')).toHaveCount(2);
  await sq(page, 'f3').click();
  await expect(sq(page, 'f3').locator('[data-piece="wP"]')).toBeVisible();
  await expect(sq(page, 'f3')).toHaveClass(/last/);

  await dragMove(page, 'e7', 'e5');
  await expect(sq(page, 'e5').locator('[data-piece="bP"]')).toBeVisible();
  await tapMove(page, 'g2', 'g4');
  await dragMove(page, 'd8', 'h4');

  const over = page.getByTestId('game-over');
  await expect(over).toBeVisible();
  await expect(over).toContainText('Checkmate');
  await expect(over).toContainText('Black wins');
  await expect(sq(page, 'e1')).toHaveClass(/check/);
});

test('illegal moves are refused', async ({ page }) => {
  await page.goto('/');
  await tapMove(page, 'e2', 'e5');
  await expect(sq(page, 'e2').locator('[data-piece="wP"]')).toBeVisible();
  await expect(sq(page, 'e5').locator('[data-piece]')).toHaveCount(0);
});

test('solves a mate-in-1 puzzle', async ({ page }) => {
  await page.goto('/?puzzle=1');
  await tapMove(page, 'e6', 'h3');
  await expect(page.getByTestId('puzzle-solved')).toBeVisible();
});

test('flags a wrong move, then solves a mate-in-2 with the automatic reply', async ({ page }) => {
  await page.goto('/?puzzle=7');
  await tapMove(page, 'a5', 'a6');
  await expect(page.locator('.msg.wrong')).toBeVisible();
  await expect(sq(page, 'a5').locator('[data-piece="wQ"]')).toBeVisible();
  await expect(page.getByTestId('puzzle-solved')).toHaveCount(0);

  await tapMove(page, 'a5', 'c7');
  await expect(sq(page, 'd4').locator('[data-piece="bP"]')).toBeVisible();
  await dragMove(page, 'a3', 'a8');
  await expect(page.getByTestId('puzzle-solved')).toBeVisible();

  await page.getByTestId('next-puzzle').click();
  await expect(page).toHaveURL(/puzzle=8/);
  await expect(page.getByTestId('puzzle-solved')).toHaveCount(0);
});

test('promotion picker solves puzzle 11', async ({ page }) => {
  await page.goto('/?puzzle=11');
  await tapMove(page, 'g7', 'g8');
  const picker = page.getByTestId('promotion');
  await expect(picker).toBeVisible();
  await expect(picker.locator('button[data-piece]')).toHaveCount(4);
  await picker.locator('[data-piece="q"]').click();
  await expect(sq(page, 'g8').locator('[data-piece="wQ"]')).toBeVisible();
  await expect(sq(page, 'c7').locator('[data-piece="bK"]')).toBeVisible();
  await tapMove(page, 'g8', 'd8');
  await expect(page.getByTestId('puzzle-solved')).toBeVisible();
});

test('?fen starts from a position and underpromotion works', async ({ page }) => {
  await page.goto('/?fen=' + encodeURIComponent('8/P6k/8/8/8/8/8/K7 w - - 0 1'));
  await tapMove(page, 'a7', 'a8');
  await page.getByTestId('promotion').locator('[data-piece="n"]').click();
  await expect(sq(page, 'a8').locator('[data-piece="wN"]')).toBeVisible();
});

test('stalemate shows the game-over screen', async ({ page }) => {
  await page.goto('/?fen=' + encodeURIComponent('k7/8/2Q5/8/8/8/8/7K w - - 0 1'));
  await tapMove(page, 'c6', 'b6');
  await expect(page.getByTestId('game-over')).toContainText('Stalemate');
});
