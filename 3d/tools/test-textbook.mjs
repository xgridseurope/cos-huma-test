// Checks the 3D labels against the words printed on textbook p.25 (exact spelling, accents, lower case).
// Usage: node tools/test-textbook.mjs <url>
import { chromium } from 'playwright-core';
const P25 = ['crani', 'maxil·lar', 'costella', 'estern', 'vèrtebra', 'columna vertebral', 'pelvis', 'fèmur', 'ròtula', 'tíbia', 'falanges',
  'omòplat', 'húmer', 'cúbit', 'radi', 'carp', 'metacarp', 'falanges', 'peroné', 'tars', 'metatars'];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await b.newPage({ viewport: { width: 393, height: 851 } }); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto(process.argv[2]); await pg.waitForFunction(() => window.__coshuma && window.__coshuma.idle(), null, { timeout: 90000 });
const shown = await pg.evaluate(() => [...document.querySelectorAll('.pill')].map((e) => e.textContent));
const sort = (a) => [...a].sort((x, y) => x.localeCompare(y, 'ca'));
const missing = [...P25]; const extra = [];
for (const w of shown) { const i = missing.indexOf(w); if (i >= 0) missing.splice(i, 1); else extra.push(w); }
const labels = await pg.evaluate(() => window.__coshuma.labels());
let ov = 0; for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) { const a = labels[i], c = labels[j]; if (a.x < c.x + c.w && a.x + a.w > c.x && a.y < c.y + c.h && a.y + a.h > c.y) ov++; }
await pg.evaluate(() => window.__coshuma.select('fpeu'));
const fal = await pg.evaluate(() => ['falma', 'fpeu', 'metatars'].map((k) => window.__coshuma.isSel(k)));
await pg.evaluate(() => window.__coshuma.select('columna'));
const col = await pg.evaluate(() => ['columna', 'vertebra', 'costella'].map((k) => window.__coshuma.isSel(k)));
await pg.evaluate(() => window.__coshuma.select('vertebra'));
const ver = await pg.evaluate(() => ['vertebra', 'columna'].map((k) => window.__coshuma.isSel(k)));
await pg.waitForTimeout(500); const card = await pg.evaluate(() => [document.getElementById('cName').textContent.trim(), document.getElementById('cDef').textContent]);
await pg.evaluate(() => window.__coshuma.select(null)); await pg.waitForFunction(() => window.__coshuma.idle());
await pg.screenshot({ path: process.argv[3] || '/tmp/textbook.png' });
console.log(JSON.stringify({ shownCount: shown.length, expected: P25.length, missing, extra, sameMultiset: !missing.length && !extra.length,
  labelOverlaps: ov, falangesBoth: fal, columnaIncludesVertebra: col, vertebraAlone: ver, vertebraCard: card, errs }, null, 1));
await b.close();
