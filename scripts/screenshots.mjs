// Usage: node scripts/screenshots.mjs  (starts its own dev server on $PORT or 5199, stops it at the end)
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const port = process.env.PORT || 5199;
const server = spawn("npx", ["vite"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
for (let i = 0; i < 50; i++) {
  try { await fetch("http://localhost:" + port); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
}
const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [1280, 800]]) {
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    const shot = (n) => page.screenshot({ path: ".playwright/" + n + "-" + w + "-" + scheme + ".png", fullPage: true });
    await page.goto("http://localhost:" + port + "/?fen=r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R+w+KQkq+-+0+1");
    await page.click('[data-square="e5"]');
    await shot("game");
    await page.goto("http://localhost:" + port + "/?puzzle=11");
    await page.click('[data-square="g7"]');
    await page.click('[data-square="g8"]');
    await shot("promotion");
    await page.click('[data-testid="promotion"] [data-piece="q"]');
    await page.waitForSelector('[data-square="c7"] [data-piece="bK"]');
    await page.click('[data-square="g8"]');
    await page.click('[data-square="d8"]');
    await shot("solved");
    await page.goto("http://localhost:" + port + "/");
    for (const [a, b] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) {
      await page.click('[data-square="' + a + '"]');
      await page.click('[data-square="' + b + '"]');
    }
    await shot("checkmate");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log(w, scheme, "overflow:", overflow, "errors:", errors);
    await ctx.close();
  }
}
await browser.close();
server.kill();
