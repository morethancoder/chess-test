// Contact sheets for the blind grader: three per build, no build names on them.
//   node scripts/sheets.mjs <shots dir>   → <shots dir>/sheets/<build>-{phone,desktop-light,desktop-dark}.png
// phone: 5 screens × light/dark at 390 px; desktop-<theme>: the 5 screens at 1280 px.
import { chromium } from "playwright";
import { readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";

const dir = process.argv[2];
const STATES = ["start", "midgame", "solved", "promotion", "mate"];
const out = `${dir}/sheets`; mkdirSync(out, { recursive: true });
const builds = readdirSync(dir).filter((d) => /^r[12]-[A-E]$/.test(d)).sort();
const css = "body{margin:0;padding:12px;background:#777;font:600 22px sans-serif;color:#fff}table{border-spacing:10px}td{vertical-align:top}img{display:block}p{margin:0 0 6px}";
const cell = (b, s, w, t) => `<td><p>${s}${w === "390" ? ", " + t : ""}</p><img src="file://${dir}/${b}/${s}-${w}-${t}.png" width="${w === "390" ? 390 : 1280}"></td>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2000, height: 1000 } });
let n = 0;
for (const bd of builds) {
  if (!existsSync(`${dir}/${bd}/start-390-light.png`)) continue;
  const sheets = {
    phone: ["light", "dark"].map((t) => `<tr>${STATES.map((s) => cell(bd, s, "390", t)).join("")}</tr>`).join(""),
    "desktop-light": [[0, 1], [2, 3], [4]].map((r) => `<tr>${r.map((i) => cell(bd, STATES[i], "1280", "light")).join("")}</tr>`).join(""),
    "desktop-dark": [[0, 1], [2, 3], [4]].map((r) => `<tr>${r.map((i) => cell(bd, STATES[i], "1280", "dark")).join("")}</tr>`).join(""),
  };
  for (const [k, rows] of Object.entries(sheets)) {
    const hf = `${out}/${bd}-${k}.html`;
    writeFileSync(hf, `<style>${css}</style><table>${rows}</table>`);
    await p.goto("file://" + hf); await p.waitForLoadState("load");
    await p.locator("table").screenshot({ path: `${out}/${bd}-${k}.png` }); n++;
  }
}
await b.close();
console.log(`${n} sheets in ${out}`);
