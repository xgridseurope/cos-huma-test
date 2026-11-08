// M1.1 label-to-object verification (headless; NOT a real-device test).
// For each of the 21 textbook labels and each view state, checks: printed name, zone colour, where the leader
// line ends (which bone is under the end dot), which bones the line passes over, and what lights up when the
// label is tapped. Usage: node tools/verify-labels.mjs <url> <outdir>
import { chromium } from 'playwright-core';
import fs from 'fs';
const [URL, OUT] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
// textbook p.25: key -> [printed label, zone by label colour]
const BOOK = { crani: ['crani', 'cap'], maxillar: ['maxil·lar', 'cap'], costella: ['costella', 'tronc'], estern: ['estern', 'tronc'], vertebra: ['vèrtebra', 'tronc'],
  columna: ['columna vertebral', 'tronc'], pelvis: ['pelvis', 'tronc'], omoplat: ['omòplat', 'tronc'], humer: ['húmer', 'ext'], cubit: ['cúbit', 'ext'], radi: ['radi', 'ext'],
  carp: ['carp', 'ext'], metacarp: ['metacarp', 'ext'], falma: ['falanges', 'ext'], femur: ['fèmur', 'ext'], rotula: ['ròtula', 'ext'], tibia: ['tíbia', 'ext'],
  perone: ['peroné', 'ext'], tars: ['tars', 'ext'], metatars: ['metatars', 'ext'], fpeu: ['falanges', 'ext'] };
const EXPECT_SEL = (k) => (k === 'falma' || k === 'fpeu') ? ['falma', 'fpeu'] : k === 'columna' ? ['columna', 'vertebra'] : [k];
const TERM = (k) => (k === 'fpeu' ? 'falma' : k);
const VPS = {
  android: { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true },
  ipad: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
};
const STATES = [['front', 'front', 0], ['back', 'back', 0], ['front-50', 'front', 0.5], ['front-100', 'front', 1], ['back-100', 'back', 1], ['reassembled', 'front', 0]];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const report = { url: URL, when: new Date().toISOString(), env: 'headless Chrome, SwiftShader, emulated viewports', results: {} };
const idle = (pg) => pg.waitForFunction(() => window.__coshuma && window.__coshuma.idle(), null, { timeout: 60000 }).then(() => pg.waitForTimeout(250));
for (const [vpName, vp] of Object.entries(VPS)) {
  const ctx = await b.newContext(vp); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(URL); await pg.waitForFunction(() => window.__coshumaReady, null, { timeout: 90000 }); await idle(pg);
  const meshInfo = await pg.evaluate(() => window.__coshuma.meshInfo());
  report.results[vpName] = { errors: errs, meshInfo, states: {} };
  for (const [st, view, e] of STATES) {
    await pg.evaluate(([view, e]) => { window.__coshuma.select(null); window.__coshuma.setView(view); window.__coshuma.setExplode(e); }, [view, e]); await idle(pg);
    const rows = await pg.evaluate(([BOOKs]) => {
      const BOOK = JSON.parse(BOOKs), C = window.__coshuma, out = [];
      const term = (k) => (k === 'fpeu' ? 'falma' : k);
      for (const r of C.labels()) {
        const el = document.querySelector(`.pill[data-key="${r.k}"]`);
        const zone = (el.style.background.match(/--(cap|tronc|ext)-f/) || [])[1];
        let end = null, endOk;
        if (r.visible === false) { endOk = null; end = 'hidden in this view (label faded, dashed line)'; }
        else if (r.bracket) { endOk = r.bracket.y1 - r.bracket.y0 > innerHeight * 0.15; end = `bracket ${Math.round(r.bracket.y0)}–${Math.round(r.bracket.y1)} px`; }
        else {
          const hits = {}; { const h = C.pickAt(r.ax, r.ay); hits[h] = 1; }
          end = Object.entries(hits).sort((a, b) => b[1] - a[1])[0][0]; endOk = term(end) === term(r.k);
        }
        // bones the line passes over (excluding its own and the last 10 px)
        const cross = new Set(); const len = Math.hypot(r.ax - r.ex, r.ay - r.ey);
        for (let t = 0; t < len - 10; t += 4) { const x = r.ex + (r.ax - r.ex) * t / len, y = r.ey + (r.ay - r.ey) * t / len; const h = C.pickAt(x, y); if (h && term(h) !== term(r.k) && !(r.k === 'columna' && h === 'vertebra')) cross.add(h); }
        out.push({ k: r.k, text: el.textContent, nameOk: el.textContent === BOOK[r.k][0], zone, zoneOk: zone === BOOK[r.k][1], end, endOk, crosses: [...cross] });
      }
      return out;
    }, [JSON.stringify(BOOK)]);
    // tap every label: what lights up?
    for (const row of rows) {
      const el = await pg.$(`.pill[data-key="${row.k}"]`); const bb = await el.boundingBox();
      await pg.evaluate(() => window.__coshuma.select(null));
      if (vp.hasTouch) await pg.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await pg.waitForTimeout(60);
      const lit = (await pg.evaluate(() => window.__coshuma.selectedKeys())).sort();
      row.lit = lit; row.litOk = JSON.stringify(lit) === JSON.stringify(EXPECT_SEL(row.k).sort());
    }
    await pg.evaluate(() => window.__coshuma.select(null)); await idle(pg);
    await pg.screenshot({ path: `${OUT}/${vpName}-${st}.png` });
    report.results[vpName].states[st] = { count: rows.length, rows,
      pass: { names: rows.filter((r) => r.nameOk).length, zones: rows.filter((r) => r.zoneOk).length, ends: rows.filter((r) => r.endOk).length, hidden: rows.filter((r) => r.endOk === null).length, taps: rows.filter((r) => r.litOk).length } };
    console.log(vpName, st, JSON.stringify(report.results[vpName].states[st].pass), 'n=', rows.length, 'endFail:', rows.filter((r) => r.endOk === false).map((r) => `${r.k}->${r.end}`).join(','));
  }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/verify-labels.json`, JSON.stringify(report, null, 1));
await b.close();
