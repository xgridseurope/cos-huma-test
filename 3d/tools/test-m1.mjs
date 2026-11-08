// Usage: node tools/test-m1.mjs <url> <outdir>
import { chromium } from 'playwright-core';
import fs from 'fs';
const [url, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const VPS = [
  { name: 'android-390x844', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true },
  { name: 'android-360x780', viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: 'ipad-820x1180', viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desktop-1366x768', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];
const wait = (pg) => pg.waitForFunction(() => window.__coshuma && window.__coshuma.idle(), null, { timeout: 60000 }).then(() => pg.waitForTimeout(300));
const results = [];
for (const v of VPS) {
  const ctx = await browser.newContext(v); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url + '#debug', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__coshuma, null, { timeout: 60000 }); await wait(pg);
  const r = { vp: v.name, errors: errs };
  r.metrics = await pg.evaluate(() => ({ ...window.__coshuma.metrics }));
  r.canvas = await pg.evaluate(() => window.__coshuma.canvas());
  r.body = await pg.evaluate(() => window.__coshuma.bodyRect());
  r.labels = await pg.evaluate(() => window.__coshuma.labels());
  // label overlap check
  const L = r.labels; let ov = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) ov++; }
  r.labelCount = L.length; r.labelOverlaps = ov; r.labelsOffscreen = L.filter((l) => l.x < 0 || l.x + l.w > v.viewport.width || l.y < 0 || l.y + l.h > v.viewport.height).length;
  await pg.screenshot({ path: `${out}/${v.name}-1-front.png` });
  // real tap on the femur (touch or mouse) → selection
  const [fx, fy] = await pg.evaluate(() => window.__coshuma.project('femur'));
  if (v.hasTouch) await pg.touchscreen.tap(fx, fy); else await pg.mouse.click(fx, fy);
  await wait(pg); r.tapFemur = (await pg.evaluate(() => window.__coshuma.state)).sel;
  await pg.screenshot({ path: `${out}/${v.name}-2-tap-femur.png` });
  // drag rotate should NOT select anything new
  const before = (await pg.evaluate(() => window.__coshuma.state)).sel;
  await pg.mouse.move(v.viewport.width / 2, v.viewport.height * 0.45); await pg.mouse.down(); await pg.mouse.move(v.viewport.width / 2 + 120, v.viewport.height * 0.45, { steps: 8 }); await pg.mouse.up(); await wait(pg);
  r.dragKeepsSelection = (await pg.evaluate(() => window.__coshuma.state)).sel === before;
  await pg.screenshot({ path: `${out}/${v.name}-3-rotated.png` });
  // explode stage 1 & 2, restore
  await pg.evaluate(() => { window.__coshuma.select(null); window.__coshuma.setView('front'); window.__coshuma.setExplode(0.5); }); await wait(pg);
  await pg.screenshot({ path: `${out}/${v.name}-4-explode50.png` });
  await pg.evaluate(() => window.__coshuma.setExplode(1)); await wait(pg);
  r.bodyExploded = await pg.evaluate(() => window.__coshuma.bodyRect());
  r.labelsExploded = (await pg.evaluate(() => window.__coshuma.labels())).length;
  await pg.screenshot({ path: `${out}/${v.name}-5-explode100.png` });
  await pg.evaluate(() => { window.__coshuma.setExplode(0); }); await wait(pg);
  r.restoredBody = await pg.evaluate(() => window.__coshuma.bodyRect());
  await pg.evaluate(() => window.__coshuma.setView('back')); await wait(pg);
  await pg.screenshot({ path: `${out}/${v.name}-6-back.png` });
  r.backView = (await pg.evaluate(() => window.__coshuma.state)).view;
  // tap a label pill
  const pill = await pg.$('.pill[data-key="crani"]'); if (pill) { await pill.tap?.().catch(() => pill.click()); if (!v.hasTouch) await pill.click(); }
  await wait(pg); r.pillSelect = (await pg.evaluate(() => window.__coshuma.state)).sel;
  // orientation change (phones only): landscape keeps uniform scale
  if (v.isMobile) { await pg.setViewportSize({ width: v.viewport.height, height: v.viewport.width }); await wait(pg); r.landscape = await pg.evaluate(() => window.__coshuma.canvas()); await pg.screenshot({ path: `${out}/${v.name}-7-landscape.png` }); }
  r.errors = errs; results.push(r); console.log(JSON.stringify({ vp: r.vp, load: r.metrics.loadMs, first: r.metrics.firstFrameMs, draws: r.metrics.draws, tris: r.metrics.tris, canvas: r.canvas, labels: r.labelCount, overlaps: r.labelOverlaps, off: r.labelsOffscreen, tap: r.tapFemur, drag: r.dragKeepsSelection, back: r.backView, pill: r.pillSelect, land: r.landscape, errs }));
  await ctx.close();
}
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
await browser.close();
