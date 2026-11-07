// Takes screenshots of a running dev server: node scripts/screenshots.mjs <baseURL>
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:5173';
const browser = await chromium.launch();
const shots = [
  ['play', '/', async () => {}],
  ['play-moves', '/', async (p) => {
    for (const [a, b] of [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4']]) {
      await p.click(`[data-square="${a}"]`); await p.click(`[data-square="${b}"]`);
    }
    await p.click('[data-square="d7"]');
  }],
  ['mate', '/', async (p) => {
    for (const [a, b] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) {
      await p.click(`[data-square="${a}"]`); await p.click(`[data-square="${b}"]`);
    }
  }],
  ['puzzle', '/?puzzle=7', async (p) => {
    await p.click('[data-square="a5"]'); await p.click('[data-square="a6"]');
  }],
  ['promo', '/?puzzle=11', async (p) => {
    await p.click('[data-square="g7"]'); await p.click('[data-square="g8"]');
  }],
];
const errors = [];
for (const scheme of ['light', 'dark']) {
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 800 }, colorScheme: scheme });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    for (const [name, url, act] of shots) {
      await page.goto(base + url);
      await page.waitForSelector('[data-square]');
      await act(page);
      await page.waitForTimeout(150);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > width) errors.push(`horizontal overflow ${name} ${width}: ${sw}`);
      await page.screenshot({ path: `.playwright/${name}-${width}-${scheme}.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors, no overflow');
