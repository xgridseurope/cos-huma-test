// M1.1 headless acceptance checks (NOT a substitute for real-device testing).
// Usage: node tools/test-m11.mjs <base url ending with /> <outdir>
import { chromium } from 'playwright-core';
import fs from 'fs';
const [BASE, OUT, ONLY = 'all'] = process.argv.slice(2);
const want = (x) => ONLY === 'all' || ONLY.split(',').includes(x); fs.mkdirSync(OUT, { recursive: true });
const CHROME = { executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] };
const browser = await chromium.launch(CHROME);
const report = { base: BASE, when: new Date().toISOString(), env: 'headless Chrome (SwiftShader software WebGL), emulated viewports — not real devices', cases: {} };
const ready = (pg) => pg.waitForFunction(() => window.__coshumaReady || window.__coshumaError, null, { timeout: 90000 });
const idle = (pg) => pg.waitForFunction(() => window.__coshuma && window.__coshuma.idle(), null, { timeout: 60000 }).then(() => pg.waitForTimeout(250));
const VP = {
  android: { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36' },
  androidSmall: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  ipad: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
};
async function open(vp, url = BASE, routes) {
  const ctx = await browser.newContext(VP[vp]); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  if (routes) await routes(pg);
  await pg.goto(url); await ready(pg); return { ctx, pg, errs };
}
const tap = async (pg, x, y, touch) => (touch ? pg.touchscreen.tap(x, y) : pg.mouse.click(x, y));
const errState = (pg) => pg.evaluate(() => ({ err: window.__coshumaError || null, visible: document.getElementById('err').classList.contains('show'), msg: document.getElementById('errMsg').textContent, embBtn: getComputedStyle(document.getElementById('errEmb')).display !== 'none', blank: !document.getElementById('err').classList.contains('show') && !window.__coshumaReady }));

// ---- 1. loading: real GLB, then failure modes ----
if (want('load')) {
  const { ctx, pg, errs } = await open('android'); await idle(pg);
  report.cases.load_glb = { ...(await pg.evaluate(() => { const d = window.__coshuma.diag(); return { model: d.model, MB: d.modelMB, loadMs: d.loadMs, firstFrameMs: d.firstFrameMs, draws: d.drawCalls, tris: d.triangles, webgl: d.webgl }; })), errors: errs };
  await pg.tap('#bDiag'); await pg.evaluate(() => window.__coshuma.startBench()); await idle(pg);
  report.cases.load_glb.diagPanel = await pg.evaluate(() => ({ visible: getComputedStyle(document.getElementById('diag')).display !== 'none', text: document.getElementById('diagBody').textContent }));
  await pg.screenshot({ path: `${OUT}/01-diag-panel.png` }); await ctx.close();
}
if (want('fail')) for (const [name, routes, url] of [
  ['glb_404', (pg) => pg.route('**/cos-huma-skeleton.glb', (r) => r.fulfill({ status: 404, body: 'nope' }))],
  ['glb_corrupt', (pg) => pg.route('**/cos-huma-skeleton.glb', (r) => r.fulfill({ status: 200, body: Buffer.from('this is not a glb file at all') }))],
  ['glb_truncated', (pg) => pg.route('**/cos-huma-skeleton.glb', async (r) => { const res = await r.fetch(); const b = await res.body(); r.fulfill({ status: 200, body: b.subarray(0, 200000) }); })],
  ['data_404', (pg) => pg.route('**/curriculum.json', (r) => r.fulfill({ status: 404, body: '' }))],
  ['three_js_404', (pg) => pg.route('**/vendor/three.module.js', (r) => r.fulfill({ status: 404, body: '' }))],
]) {
  const { ctx, pg } = await open('android', url, routes); await pg.waitForTimeout(500);
  const st = await errState(pg); await pg.screenshot({ path: `${OUT}/02-error-${name}.png` });
  let after = null;
  if (st.embBtn) { await pg.unroute('**/cos-huma-skeleton.glb').catch(() => {}); await pg.tap('#errEmb'); await ready(pg); await idle(pg); after = await pg.evaluate(() => window.__coshuma.diag().model); await pg.screenshot({ path: `${OUT}/02-error-${name}-then-embedded.png` }); }
  report.cases['fail_' + name] = { errorShown: st.visible, stage: st.err?.stage, detail: st.err?.message?.slice(0, 120), embeddedOffered: st.embBtn, blankScreen: st.blank, embeddedLoadAfterClick: after };
  await ctx.close();
}
if (want('fail')) {
  const b2 = await chromium.launch({ ...CHROME, args: [...CHROME.args, '--disable-webgl', '--disable-3d-apis'] });
  const ctx = await b2.newContext(VP.android); const pg = await ctx.newPage(); await pg.goto(BASE); await ready(pg);
  const st = await errState(pg); await pg.screenshot({ path: `${OUT}/02-error-no-webgl.png` });
  report.cases.fail_no_webgl = { errorShown: st.visible, stage: st.err?.stage, blankScreen: st.blank, embeddedOffered: st.embBtn }; await b2.close();
}

// ---- 2. per-viewport functional checks ----
const L = (pg) => pg.evaluate(() => window.__coshuma.labels());
function labelStats(labels, W, H) {
  let ov = 0; for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) { const a = labels[i], b = labels[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) ov++; }
  return { count: labels.length, overlaps: ov, offscreen: labels.filter((l) => l.x < 0 || l.y < 0 || l.x + l.w > W || l.y + l.h > H).length };
}
for (const vp of ['android', 'androidSmall', 'ipad', 'desktop'].filter(want)) {
  const touch = !!VP[vp].hasTouch; const { ctx, pg, errs } = await open(vp); await idle(pg); const W = VP[vp].viewport.width, H = VP[vp].viewport.height;
  const R = { errors: errs };
  // labels: count, overlap, size, contrast, exam-only
  R.labels = labelStats(await L(pg), W, H);
  R.labels.style = await pg.evaluate(() => { const els = [...document.querySelectorAll('.pill')]; const fs = els.map((e) => parseFloat(getComputedStyle(e).fontSize)); return { minFontPx: Math.min(...fs), keys: els.map((e) => e.dataset.key) }; });
  R.labels.nonExamLabelled = await pg.evaluate(() => [...document.querySelectorAll('.pill')].map((e) => e.dataset.key).filter((k) => ['clavicula', 'altres'].includes(k)));
  await pg.screenshot({ path: `${OUT}/10-${vp}-front.png` });
  // tap accuracy: real taps on sample points of each of the 20 items, exact and with ±6 px finger jitter
  const keys = R.labels.style.keys; let ok = 0, n = 0, okJ = 0, nJ = 0; const misses = [];
  for (const k of keys) {
    const pts = await pg.evaluate((k) => window.__coshuma.samplePoints(k, 2), k);
    if (!pts.length) { misses.push({ k, why: 'no visible point' }); continue; }
    for (const [x, y] of pts) {
      await pg.evaluate(() => window.__coshuma.select(null)); await tap(pg, x, y, touch); await idle(pg);
      const sel = (await pg.evaluate(() => window.__coshuma.state)).sel; n++; if (sel === k) ok++; else misses.push({ k, got: sel, x: Math.round(x), y: Math.round(y) });
      for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
        await pg.evaluate(() => window.__coshuma.select(null)); await tap(pg, x + dx, y + dy, touch); await idle(pg);
        const s2 = (await pg.evaluate(() => window.__coshuma.state)).sel; nJ++; if (s2 === k) okJ++;
      }
    }
  }
  R.tapAccuracy = { exact: `${ok}/${n}`, jitter6px: `${okJ}/${nJ}`, misses: misses.slice(0, 8) };
  // label tap selects
  await pg.evaluate(() => window.__coshuma.select(null)); const pill = await pg.$('.pill[data-key="humer"]'); const bb = await pill.boundingBox();
  await tap(pg, bb.x + bb.width / 2, bb.y + bb.height / 2, touch); await idle(pg); R.labelTapSelects = (await pg.evaluate(() => window.__coshuma.state)).sel === 'humer';
  // rotation mis-touch: drags of various lengths must not change selection
  await pg.evaluate(() => window.__coshuma.select('femur')); await idle(pg);
  const drags = []; for (const d of [12, 25, 60, 150]) {
    await pg.mouse.move(W / 2, H * 0.45); await pg.mouse.down(); await pg.mouse.move(W / 2 + d, H * 0.45, { steps: 6 }); await pg.mouse.up(); await idle(pg);
    drags.push((await pg.evaluate(() => window.__coshuma.state)).sel === 'femur');
  }
  R.dragNoMisSelect = drags;
  if (touch) { // two-finger pinch via CDP must not select
    const cdp = await ctx.newCDPSession(pg); await pg.evaluate(() => window.__coshuma.select(null));
    const tp = (a, b) => [{ x: W / 2 - a, y: H * 0.45 }, { x: W / 2 + b, y: H * 0.45 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(20, 20) });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(20 + i * 12, 20 + i * 12) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await idle(pg);
    R.pinchNoSelect = (await pg.evaluate(() => window.__coshuma.state)).sel === null;
  }
  // front/back
  await pg.evaluate(() => { window.__coshuma.select(null); window.__coshuma.setView('back'); }); await idle(pg);
  R.back = { view: (await pg.evaluate(() => window.__coshuma.state)).view, labels: labelStats(await L(pg), W, H) };
  await pg.screenshot({ path: `${OUT}/11-${vp}-back.png` });
  await pg.evaluate(() => window.__coshuma.setView('front')); await idle(pg);
  // explode order: stage 1 moves zones only, stage 2 separates pieces; restore returns to base
  const off = async (e) => { await pg.evaluate((e) => window.__coshuma.setExplode(e), e); await idle(pg); return pg.evaluate(() => Object.fromEntries(['crani', 'columna', 'humer', 'falma', 'femur', 'fpeu'].map((k) => [k, window.__coshuma.pieceY(k).map((v) => +v.toFixed(3))]))); };
  const e25 = await off(0.25), e50 = await off(0.5); await pg.screenshot({ path: `${OUT}/12-${vp}-explode50.png` });
  const e100 = await off(1); R.explodeLabels = labelStats(await L(pg), W, H); await pg.screenshot({ path: `${OUT}/13-${vp}-explode100.png` });
  const e0 = await off(0);
  R.explode = {
    stage1_capUp: e50.crani[1] > 0.3, stage1_columnaStill: Math.abs(e50.columna[2]) < 1e-3, stage1_handWithArm: Math.abs(e50.falma[1] - e50.humer[1]) < 1e-3,
    stage2_handBelowArm: e100.falma[1] < e100.humer[1] - 0.5, stage2_columnaBack: e100.columna[2] < -0.3, stage2_footBelowFemur: e100.fpeu[1] < e100.femur[1] - 0.5,
    monotonic: e25.crani[1] < e50.crani[1] && e50.crani[1] < e100.crani[1], restored: Object.values(e0).every((v) => v.every((c) => Math.abs(c) < 1e-3)),
  };
  // orientation (touch devices): portrait -> landscape -> portrait
  if (touch) {
    const asp = () => pg.evaluate(() => { const c = window.__coshuma.canvas(); return { buf: c.buf[0] / c.buf[1], css: c.css[0] / c.css[1], cam: c.aspect }; });
    const fit = () => pg.evaluate(() => { const r = window.__coshuma.bodyRect(); return { inside: r.x0 >= -2 && r.y0 >= -2 && r.x1 <= innerWidth + 2 && r.y1 <= innerHeight + 2, hPct: Math.round((r.y1 - r.y0) / innerHeight * 100) }; });
    await pg.setViewportSize({ width: H, height: W }); await idle(pg); const land = { aspect: await asp(), fit: await fit(), labels: labelStats(await L(pg), H, W) };
    await pg.screenshot({ path: `${OUT}/14-${vp}-landscape.png` });
    await pg.setViewportSize({ width: W, height: H }); await idle(pg); const port = { aspect: await asp(), fit: await fit(), labels: labelStats(await L(pg), W, H) };
    const uni = (a) => Math.abs(a.buf - a.css) < 0.01 && Math.abs(a.cam - a.css) < 0.01;
    R.orientation = { landscapeUniform: uni(land.aspect), portraitUniform: uni(port.aspect), landscape: land, portraitAgain: port };
  }
  R.errors = errs; report.cases['vp_' + vp] = R; fs.writeFileSync(`${OUT}/headless-${ONLY}.json`, JSON.stringify(report, null, 1)); console.log(vp, JSON.stringify(R).slice(0, 400));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/headless-${ONLY}.json`, JSON.stringify(report, null, 1));
await browser.close();
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.cases).filter(([k]) => k.startsWith('fail') || k.startsWith('load'))), null, 1));
