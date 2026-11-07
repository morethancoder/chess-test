// Drives a build's running dev server through the brief's fixed interface (items 21-23).
//   node scripts/browser.mjs checks <url> <out.json>   console errors + horizontal scroll at 390 px
//   node scripts/browser.mjs shots  <url> <out dir>    the 20 fixed shots
// Each state is reached with real clicks on [data-square], never by reaching into the app.
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const [, , mode, base, out] = process.argv;
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PROMO = "4k3/1P6/8/8/8/8/8/4K3 w - - 0 1";
const puzzles = JSON.parse(readFileSync(new URL("../public/puzzles.json", import.meta.url)));
const fenUrl = (fen) => `${base}/?fen=${encodeURIComponent(fen)}`;

async function move(page, uci) {
  await page.locator(`[data-square="${uci.slice(0, 2)}"]`).first().click();
  await page.locator(`[data-square="${uci.slice(2, 4)}"]`).first().click();
  await page.waitForTimeout(150);
}

async function board(page, url) {
  await page.goto(url);
  await page.locator('[data-square="e4"]').first().waitFor({ timeout: 10000 });
}

// The 5 states of the plan's fixed shot list. Each returns once the state is on screen.
const STATES = {
  start: async (p) => board(p, fenUrl(START)),
  midgame: async (p) => {
    await board(p, fenUrl(START));
    for (const m of ["e2e4", "e7e5", "g1f3"]) await move(p, m);
    await p.locator('[data-square="b8"]').first().click(); // selected piece + its legal moves
    await p.waitForTimeout(150);
  },
  solved: async (p) => {
    const z = puzzles[0];
    await board(p, `${base}/?puzzle=1`);
    await move(p, z.solution[0]);
    await p.getByTestId("puzzle-solved").waitFor({ timeout: 5000 });
  },
  promotion: async (p) => {
    await board(p, fenUrl(PROMO));
    await move(p, "b7b8");
    await p.getByTestId("promotion").waitFor({ timeout: 5000 });
  },
  mate: async (p) => {
    await board(p, fenUrl(START));
    for (const m of ["f2f3", "e7e5", "g2g4", "d8h4"]) await move(p, m);
    await p.getByTestId("game-over").waitFor({ timeout: 5000 });
  },
};

const browser = await chromium.launch(); // plain launch args, no extra flags
const result = {};
try {
  if (mode === "checks") {
    const errors = [];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const pages = { home: base + "/", fen: fenUrl(START), puzzle: `${base}/?puzzle=1` };
    result.overflow = {};
    for (const [name, url] of Object.entries(pages)) {
      await page.goto(url);
      await page.waitForTimeout(800);
      result.overflow[name] = await page.evaluate(() => document.documentElement.scrollWidth);
    }
    result.errors = errors;
    writeFileSync(out, JSON.stringify(result, null, 2));
  } else if (mode === "shots") {
    mkdirSync(out, { recursive: true });
    result.shots = [];
    result.failed = {};
    for (const [state, reach] of Object.entries(STATES)) {
      for (const width of [390, 1280]) {
        for (const theme of ["light", "dark"]) {
          const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 800 }, colorScheme: theme });
          const page = await ctx.newPage();
          const file = `${out}/${state}-${width}-${theme}.png`;
          try {
            await reach(page);
            await page.screenshot({ path: file, fullPage: true });
            result.shots.push(file);
          } catch (e) {
            result.failed[`${state}-${width}-${theme}`] = String(e).split("\n")[0];
            await page.screenshot({ path: file.replace(".png", ".FAILED.png"), fullPage: true }).catch(() => {});
          }
          await ctx.close();
        }
      }
    }
    writeFileSync(`${out}/shots.json`, JSON.stringify(result, null, 2));
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(mode === "shots" ? { ok: result.shots.length, failed: result.failed } : result));
