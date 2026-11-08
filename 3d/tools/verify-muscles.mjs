// M2 label-to-object verification for the muscle page (headless; NOT a real-device test).
// For each of the 15 textbook p.27 labels and each view state: printed name (exact), zone colour, which muscle AND which
// body copy is under the end dot, what the line passes over, what lights up when the label is tapped, and what a tap
// on the muscle itself selects. Usage: node tools/verify-muscles.mjs <url> <outdir>
import { chromium } from 'playwright-core';
import fs from 'fs';
const [URL, OUT] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
// textbook p.27: key -> [printed label, zone by label colour, figure (front/back)]
const BOOK = { orbic: ['orbicular de les parpelles', 'cap', 'F'], masseter: ['masseter', 'cap', 'F'], ecm: ['esternoclidomastoidal', 'tronc', 'F'],
  deltoide: ['deltoide', 'tronc', 'F'], pectoral: ['pectoral', 'tronc', 'F'], abdominal: ['abdominal', 'tronc', 'F'], biceps: ['bíceps', 'ext', 'F'],
  quadriceps: ['quàdriceps', 'ext', 'F'], tibial: ['tibial', 'ext', 'F'],
  trapezi: ['trapezi', 'tronc', 'B'], dorsal: ['dorsal', 'tronc', 'B'], gluti: ['gluti', 'tronc', 'B'], triceps: ['tríceps', 'ext', 'B'], bfem: ['bíceps femoral', 'ext', 'B'], besso: ['bessó', 'ext', 'B'] };
const VPS = {
  android: { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true },
  ipad: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ipadL: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
};
// [state, pair?, view, yaw offset]
// pair mode needs ≥ 600 px width (hidden on phones), so phones only run the single-body states
const STATES = [['pair', true, null, 0], ['pair-turned', true, null, 0.45], ['single-front', false, 'front', 0], ['single-back', false, 'back', 0], ['single-front-turned', false, null, 0.45]];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const report = { url: URL, when: new Date().toISOString(), env: 'headless Chrome, SwiftShader, emulated viewports (simulated, not real devices)', results: {} };
// after a tap: let queued pointer events run and the frame finish before reading the state (slow software GL)
const settle = (pg) => pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))).then(() => pg.waitForFunction(() => window.__coshuma.idle(), null, { timeout: 240000 }));
const idle = (pg) => pg.waitForFunction(() => window.__coshuma && window.__coshuma.idle(), null, { timeout: 240000 }).then(() => pg.waitForTimeout(250));
const ONLY = process.argv[4] ? process.argv[4].split(',') : null;
for (const [vpName, vp] of Object.entries(VPS)) {
  if (ONLY && !ONLY.includes(vpName)) continue;
  const ctx = await b.newContext(vp); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(URL); await pg.waitForFunction(() => window.__coshumaReady, null, { timeout: 120000 }); await idle(pg);
  const autoPair = await pg.evaluate(() => window.__coshuma.state.pair);
  report.results[vpName] = { errors: errs, autoPair, meshInfo: await pg.evaluate(() => window.__coshuma.meshInfo()), states: {} };
  for (const [st, pair, view, yaw] of STATES) {
    if (pair && vp.viewport.width < 600) continue;
    await pg.evaluate(([pair, view, yaw]) => { const C = window.__coshuma; C.select(null); C.setPair(pair); C.setYaw(view === 'back' ? Math.PI : 0); C.setYaw((view === 'back' ? Math.PI : 0) + yaw); }, [pair, view, yaw]); await idle(pg);
    const rows = await pg.evaluate(([BOOKs, pair]) => {
      const BOOK = JSON.parse(BOOKs), C = window.__coshuma, out = [];
      for (const r of C.labels()) {
        const el = document.querySelector(`.pill[data-key="${r.k}"]`);
        const zone = (el.style.background.match(/--(cap|tronc|ext)-f/) || [])[1];
        const wantFig = pair ? (BOOK[r.k][2] === 'F' ? 0 : 1) : 0;
        let end, endOk, fig = null;
        if (r.visible === false) { endOk = null; end = 'hidden in this view'; }
        else { end = C.pickAt(r.ax, r.ay); fig = C.pickFig(r.ax, r.ay); endOk = end === r.k && fig === wantFig; }
        const cross = new Set(); const len = Math.hypot(r.ax - r.ex, r.ay - r.ey);
        for (let t = 0; t < len - 10; t += 4) { const x = r.ex + (r.ax - r.ex) * t / len, y = r.ey + (r.ay - r.ey) * t / len; const h = C.pickAt(x, y); if (h && h !== r.k && h !== 'altresm') cross.add(h); }
        out.push({ k: r.k, text: el.textContent, nameOk: el.textContent === BOOK[r.k][0], zone, zoneOk: zone === BOOK[r.k][1], end, fig, endOk, crosses: [...cross] });
      }
      return out;
    }, [JSON.stringify(BOOK), pair]);
    const expectKeys = Object.keys(BOOK).filter((k) => pair || BOOK[k][2] === (view === 'back' ? 'B' : 'F')).sort();
    const gotKeys = rows.map((r) => r.k).sort();
    // overlaps between labels
    const rects = await pg.evaluate(() => window.__coshuma.labels());
    let ov = 0; for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], c = rects[j]; if (a.x < c.x + c.w && a.x + a.w > c.x && a.y < c.y + c.h && a.y + a.h > c.y) ov++; }
    // tap every label, then tap the muscle itself at up to 3 points (real pointer events)
    for (const row of rows) {
      const el = await pg.$(`.pill[data-key="${row.k}"]`); const bb = await el.boundingBox();
      await pg.evaluate(() => window.__coshuma.select(null));
      if (vp.hasTouch) await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await settle(pg);
      row.lit = await pg.evaluate(() => window.__coshuma.selectedKeys()); row.litOk = row.lit.length === 1 && row.lit[0] === row.k;
      const fig = pair ? (BOOK[row.k][2] === 'F' ? 0 : 1) : 0;
      const pts = await pg.evaluate(([k, fig]) => window.__coshuma.samplePoints(k, 3, fig), [row.k, fig]);
      row.bodyTaps = [];
      for (const [x, y] of pts) {
        await pg.evaluate(() => window.__coshuma.select(null));
        if (vp.hasTouch) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y);
        await settle(pg); row.bodyTaps.push(await pg.evaluate(() => window.__coshuma.state.sel));
      }
      row.bodyTapOk = row.bodyTaps.filter((s) => s === row.k).length; row.bodyTapN = row.bodyTaps.length;
    }
    await pg.evaluate(() => window.__coshuma.select(null)); await idle(pg);
    await pg.screenshot({ path: `${OUT}/${vpName}-${st}.png` });
    const pass = { names: rows.filter((r) => r.nameOk).length, zones: rows.filter((r) => r.zoneOk).length, ends: rows.filter((r) => r.endOk).length,
      endWrong: rows.filter((r) => r.endOk === false).length, hidden: rows.filter((r) => r.endOk === null).length, labelTaps: rows.filter((r) => r.litOk).length,
      bodyTaps: `${rows.reduce((a, r) => a + r.bodyTapOk, 0)}/${rows.reduce((a, r) => a + r.bodyTapN, 0)}`, overlaps: ov, setOk: JSON.stringify(gotKeys) === JSON.stringify(expectKeys) };
    report.results[vpName].states[st] = { count: rows.length, expected: expectKeys.length, rows, pass };
    console.log(vpName, st, JSON.stringify(pass), 'n=', rows.length, 'endFail:', rows.filter((r) => r.endOk === false).map((r) => `${r.k}->${r.end}@${r.fig}`).join(','), 'hidden:', rows.filter((r) => r.endOk === null).map((r) => r.k).join(','));
  }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/verify-muscles${ONLY ? '-' + ONLY.join('-') : ''}.json`, JSON.stringify(report, null, 1));
await b.close();
