// COS-HUMA 3D · M2 (muscles, textbook p.27). Plain ES module, no build step.
// Same patterns as app.js (skeleton): real GLB + embedded fallback, error screen, diagnostics, visible-vertex label anchors,
// finger-tolerant picking. Differences: no explode; textbook p.27 shows the body from the front AND from the back side by side,
// so on wide screens two copies of the body are drawn (front left, back right) and a horizontal drag turns both together.
// On narrow screens (phones, iPad portrait) one body is drawn and Davant/Darrere switches which labels are shown.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VERSION = 'M2-0.1';
const $ = (id) => document.getElementById(id);
const t0 = performance.now();
const Q = new URLSearchParams(location.search), H = location.hash;
const FORCE_EMBEDDED = Q.get('model') === 'embedded' || /embedded/.test(H);
let DIAG = Q.has('diag') || /diag|debug/.test(H);
const fail = (stage, err) => window.__coshumaFail(stage, err);

const T = {
  ca: { title: 'El cos humà 3D', sub: 'Musculatura · prova M2 (v0.1)', front: 'Davant', back: 'Darrere', labels: 'Noms', zones: 'Zones', pair: 'Davant + darrere', hint: 'Toca un múscul · arrossega per girar · pessiga per ampliar', loading: 'Carregant els músculs…', extra: 'No surt al llibre', x2: '(×2)' },
  es: { title: 'El cuerpo humano 3D', sub: 'Musculatura · prueba M2 (v0.1)', front: 'Delante', back: 'Detrás', labels: 'Nombres', zones: 'Zonas', pair: 'Delante + detrás', hint: 'Toca un músculo · arrastra para girar · pellizca para ampliar', loading: 'Cargando los músculos…', extra: 'No sale en el libro', x2: '(×2)' },
  zh: { title: '人体 3D', sub: '肌肉 · M2 测试版 (v0.1)', front: '正面', back: '背面', labels: '名称', zones: '分区', pair: '正面+背面', hint: '点肌肉看名字 · 拖动旋转 · 双指缩放', loading: '正在加载肌肉…', extra: '课本里没有', x2: '（左右各一）' },
  en: { title: 'The human body 3D', sub: 'Muscles · M2 test (v0.1)', front: 'Front', back: 'Back', labels: 'Names', zones: 'Zones', pair: 'Front + back', hint: 'Tap a muscle · drag to turn · pinch to zoom', loading: 'Loading the muscles…', extra: 'Not in the textbook', x2: '(×2)' },
};
let lang = 'ca';
try { lang = localStorage.getItem('coshuma.lang') || 'ca'; } catch {}

// ---------- layout knowledge (textbook p.27: which figure each label points at) ----------
const FRONT_KEYS = ['orbic', 'masseter', 'ecm', 'deltoide', 'pectoral', 'abdominal', 'biceps', 'quadriceps', 'tibial'];
const BACK_KEYS = ['trapezi', 'dorsal', 'triceps', 'gluti', 'bfem', 'besso'];
const ANCHOR_DY = {};
// one body (phone): label columns, roughly as on the page; pair mode: front labels left, back labels right
const SINGLE_COL = { orbic: 'L', ecm: 'L', pectoral: 'L', abdominal: 'L', quadriceps: 'L', masseter: 'R', deltoide: 'R', biceps: 'R', tibial: 'R',
  trapezi: 'L', dorsal: 'L', gluti: 'L', triceps: 'R', bfem: 'R', besso: 'R' };

// ---------- renderer ----------
const stageEl = $('stage');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
catch (e) { fail('webgl', e); throw e; }
const glInfo = (() => { const gl = renderer.getContext(); const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return { version: renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1', renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), lost: false }; })();
renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glInfo.lost = true; fail('contextlost', new Error('WebGL context lost')); });
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowEnd ? 1.5 : 2));
stageEl.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf4efe6);
const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false; // turning is done by rotating the bodies (both copies together), see pointer handlers
controls.enableDamping = true; controls.dampingFactor = 0.12; controls.zoomSpeed = 0.9; controls.screenSpacePanning = true;
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a4, 2.0));
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 6, 8); camera.add(key); scene.add(camera);

const ramp = new THREE.DataTexture(new Uint8Array([140, 140, 140, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { w: { value: 0.006 }, color: { value: new THREE.Color(0x5a1d1d) } },
  vertexShader: 'uniform float w; void main(){ vec3 p = position + normalize(normal) * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
  fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }',
  side: THREE.BackSide,
});

// ---------- state ----------
const S = { sel: null, labels: true, zones: false, yaw: 0, yawT: 0, pair: null, pairAuto: true, fitDist: 10 };
const parts = []; // {key, side, fig, mesh, item, anchor, vis}
const figs = []; // THREE.Group ×2 (0 = front copy, 1 = back copy, turned 180°)
let CUR;
const metrics = { loadMs: 0, firstFrameMs: 0, frames: 0, draws: 0, tris: 0, source: '', bytes: 0 };

// ---------- load ----------
const GLB_URL = './models/cos-huma-muscles.glb';
async function fetchGlb() {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(GLB_URL, { signal: ctrl.signal, cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} — ${GLB_URL}`);
    const total = +r.headers.get('content-length') || 0; const reader = r.body.getReader(); const chunks = []; let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; if (total) $('loadBar').style.width = (100 * got / total) + '%'; }
    const buf = new Uint8Array(got); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
    if (String.fromCharCode(...buf.slice(0, 4)) !== 'glTF') throw new Error('El fitxer no és un GLB vàlid (capçalera incorrecta)');
    return buf.buffer;
  } catch (e) { if (e.name === 'AbortError') throw new Error('Temps esgotat (45 s) descarregant el model'); throw e; }
  finally { clearTimeout(to); }
}
async function fetchEmbedded() {
  const m = await import('./models/cos-huma-muscles.glb.js'); const bin = atob(m.default);
  const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); return buf.buffer;
}
async function loadModel() {
  let buf;
  if (FORCE_EMBEDDED) { buf = await fetchEmbedded(); metrics.source = 'embedded (diagnòstic)'; }
  else { buf = await fetchGlb(); metrics.source = 'glb'; }
  metrics.bytes = buf.byteLength; $('loadBar').style.width = '100%';
  return new Promise((res, rej) => new GLTFLoader().parse(buf, './', res, (e) => rej(new Error('Error en interpretar el GLB: ' + (e?.message || e)))));
}
let cur, gltf;
try { cur = await fetch('./data/curriculum.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status} — data/curriculum.json`); return r.json(); }); }
catch (e) { fail('data', e); throw e; }
try { gltf = await loadModel(); }
catch (e) { fail('model', e); throw e; }
CUR = Object.fromEntries(cur.items.filter((i) => i.lesson === 'musculatura').map((i) => [i.key, i]));
metrics.loadMs = Math.round(performance.now() - t0);

const box = new THREE.Box3().setFromObject(gltf.scene); const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
const SEP = size.x * 0.5 + 0.22; // half distance between the two bodies
const copies = [gltf.scene, gltf.scene.clone(true)]; // clone before materials/outlines are added (geometry is shared)
for (let f = 0; f < 2; f++) {
  const r = copies[f];
  r.position.set(-center.x, 0, -center.z); // pivot = body axis
  const g = new THREE.Group(); g.add(r); g.position.set(0, 0, 0); scene.add(g); figs.push(g);
  const ms = []; r.traverse((o) => { if (o.isMesh) ms.push(o); });
  for (const o of ms) {
    const k = o.userData.key, item = CUR[k];
    o.material = new THREE.MeshToonMaterial({ color: 0xc94a3f, gradientMap: ramp });
    const ol = new THREE.Mesh(o.geometry, outlineMat); ol.raycast = () => {}; ol.renderOrder = -1; o.add(ol);
    const sc = o.getWorldScale(new THREE.Vector3()).x; ol.onBeforeRender = () => { outlineMat.uniforms.w.value = 0.005 / sc; outlineMat.uniformsNeedUpdate = true; };
    parts.push({ key: k, side: o.userData.side, fig: f, mesh: o, item });
  }
}
const bodyCenterY = center.y;

// ---------- anchors (same method as the skeleton page) ----------
const v3 = new THREE.Vector3(), box3 = new THREE.Box3();
function computeAnchors(p) {
  const g = p.mesh.geometry, pos = g.attributes.position; g.computeBoundingBox();
  const bb = g.boundingBox, c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  const ty = c.y + (ANCHOR_DY[p.key] || 0) * sz.y, r = 0.2 * Math.max(sz.x, sz.y), v = new THREE.Vector3();
  let f = -1, fz = -Infinity, b = -1, bz = Infinity, n = -1, nd = Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); const d = Math.hypot(v.x - c.x, v.y - ty);
    if (d < nd) { nd = d; n = i; }
    if (d < r) { if (v.z > fz) { fz = v.z; f = i; } if (v.z < bz) { bz = v.z; b = i; } }
  }
  p.anchor = { front: f >= 0 ? f : n, back: b >= 0 ? b : n };
}
parts.forEach(computeAnchors);
const figYaw = (f) => S.yaw + (f === 1 && S.pair ? Math.PI : 0);
const facesFront = (f) => Math.cos(figYaw(f)) >= 0;
function vertexScreen(p, i) {
  v3.fromBufferAttribute(p.mesh.geometry.attributes.position, i).applyMatrix4(p.mesh.matrixWorld).project(camera);
  return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight };
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function rayHit(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(parts.filter((p) => p.mesh.visible && figs[p.fig].visible).map((p) => p.mesh), false)[0] || null; }
function rayKey(x, y) { const h = rayHit(x, y); return h ? h.object.userData.key : null; }
function visibleAnchor(p) {
  const pos = p.mesh.geometry.attributes.position, bb = p.mesh.geometry.boundingBox;
  const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), ty = c.y + (ANCHOR_DY[p.key] || 0) * sz.y;
  const step = Math.max(1, Math.floor(pos.count / 600)), cand = [], v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i); cand.push([Math.hypot(v.x - c.x, v.y - ty, (v.z - c.z) * 0.3), i]); }
  cand.sort((a, b) => a[0] - b[0]);
  for (const [, i] of cand.slice(0, 160)) {
    const s = vertexScreen(p, i);
    if (s.x < 2 || s.y < 2 || s.x > innerWidth - 2 || s.y > innerHeight - 2) continue;
    const h = rayHit(s.x, s.y); if (!h || h.object !== p.mesh) continue; // must hit this very mesh (this side, this body copy)
    if ([[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].filter(([dx, dy]) => rayHit(s.x + dx, s.y + dy)?.object === p.mesh).length >= 2) return { i, visible: true };
  }
  return { i: facesFront(p.fig) ? p.anchor.front : p.anchor.back, visible: false };
}
let anchorsFor = '';
function refreshAnchors() {
  const k = `${S.yaw.toFixed(3)}|${S.pair}|${innerWidth}x${innerHeight}|${camera.position.toArray().map((x) => x.toFixed(3))}`;
  if (k === anchorsFor) return false;
  for (const p of parts) if (CUR[p.key]?.exam) p.vis = visibleAnchor(p);
  anchorsFor = k; return true;
}
function anchorScreen(p) { const i = p.vis ? p.vis.i : (facesFront(p.fig) ? p.anchor.front : p.anchor.back); const s = vertexScreen(p, i); s.visible = p.vis ? p.vis.visible : true; return s; }

// ---------- colours / selection ----------
const ZC = { cap: new THREE.Color(0x4f86d0), tronc: new THREE.Color(0xe58a2e), ext: new THREE.Color(0x46a05e) };
const RED = new THREE.Color(0xc94a3f), PINK = new THREE.Color(0xe39a8c), DIM = new THREE.Color(0xf4efe6);
const isSel = (k) => !!S.sel && k === S.sel;
function applyColours() {
  for (const p of parts) {
    const it = p.item; let c = it?.exam ? RED.clone() : PINK.clone();
    if (S.zones && it?.exam) c = RED.clone().lerp(ZC[it.zone], 0.6);
    if (S.sel) { if (isSel(p.key)) c = (S.zones ? ZC[it.zone] : new THREE.Color(0xe0261b)).clone(); else c.lerp(DIM, 0.45); }
    p.mesh.material.color.copy(c); p.mesh.material.emissive?.set(isSel(p.key) ? 0x331111 : 0x000000);
  }
}
function select(k) { S.sel = k && CUR[k] ? k : null; applyColours(); renderCard(); invalidate(); }

// ---------- labels ----------
const pillsEl = $('pills'), leadsEl = $('leads');
const pills = {};
for (const it of cur.items) {
  if (!it.exam || it.lesson !== 'musculatura') continue;
  const d = document.createElement('div'); d.className = 'pill'; d.dataset.key = it.key;
  d.style.background = `var(--${it.zone}-f)`; d.style.borderColor = `var(--${it.zone}-s)`;
  d.addEventListener('click', (ev) => { ev.stopPropagation(); select(S.sel === it.key ? null : it.key); });
  pillsEl.appendChild(d); pills[it.key] = d;
}
function labelText() { for (const k in pills) pills[k].textContent = CUR[k].name[lang]; }
let lastLabelRects = [];
// which labels are shown, and on which body copy / column
function labelPlan() {
  if (S.pair) return [...FRONT_KEYS.map((k) => ({ k, fig: 0, col: 'L' })), ...BACK_KEYS.map((k) => ({ k, fig: 1, col: 'R' }))];
  const keys = facesFront(0) ? FRONT_KEYS : BACK_KEYS;
  return keys.map((k) => ({ k, fig: 0, col: SINGLE_COL[k] }));
}
function figScreenX(f) { v3.set(figs[f].position.x, bodyCenterY, 0).project(camera); return (v3.x + 1) / 2 * innerWidth; }
function layoutLabels() {
  const H = innerHeight;
  const short = H < 500; document.body.classList.toggle('short', short);
  if (!S.labels || short) { pillsEl.style.display = 'none'; leadsEl.innerHTML = ''; lastLabelRects = []; for (const k in pills) pills[k].style.transform = 'translate(-999px,-999px)'; return; }
  pillsEl.style.display = '';
  const top = 58, bottom = H - dockH() - 8;
  const cols = { L: [], R: [] }; const shown = new Set();
  const midX = figScreenX(0);
  for (const { k, fig, col } of labelPlan()) {
    let best = null;
    for (const p of parts) {
      if (p.key !== k || p.fig !== fig) continue;
      const a = anchorScreen(p); const c = col || (a.x < midX ? 'L' : 'R');
      const score = (c === 'L' ? a.x : -a.x) + (a.visible ? 0 : 1e5);
      if (!best || score < best.score) best = { ax: a.x, ay: a.y, score, visible: a.visible, col: c };
    }
    if (!best) continue;
    if (!col) { // single body: the side is decided once per mesh pair, preferring the visible side nearest a column
      best.col = best.ax < midX ? 'L' : 'R';
    }
    cols[best.col].push({ k, ax: best.ax, ay: best.ay, visible: best.visible }); shown.add(k);
  }
  const h = innerWidth >= 700 ? 30 : 26, gap = 3, pad = 6;
  let svg = ''; const rects = [];
  for (const side of ['L', 'R']) {
    const list = cols[side].sort((a, b) => a.ay - b.ay);
    let y = top;
    for (const l of list) { l.y = Math.max(l.ay - h / 2, y); y = l.y + h + gap; }
    const over = y - gap - bottom;
    if (over > 0) { for (let i = list.length - 1, lim = bottom; i >= 0; i--) { list[i].y = Math.min(list[i].y, lim - h); lim = list[i].y - gap; } }
    for (const l of list) {
      const el = pills[l.k]; const w = el.offsetWidth;
      const F = pageFrame(); const x = side === 'L' ? F.x0 + pad : F.x0 + F.w - pad - w;
      el.style.transform = `translate(${x}px,${l.y}px)`;
      el.classList.toggle('sel', isSel(l.k)); el.classList.toggle('hid', !l.visible);
      const ex = side === 'L' ? x + w : x, ey = l.y + h / 2;
      const cls = (isSel(l.k) ? ' sel' : '') + (l.visible ? '' : ' hid');
      svg += `<line class="halo" x1="${ex}" y1="${ey}" x2="${l.ax}" y2="${l.ay}"/><line class="ln${cls}" x1="${ex}" y1="${ey}" x2="${l.ax}" y2="${l.ay}"/>`;
      svg += `<circle class="dotH" cx="${l.ax}" cy="${l.ay}" r="4.2"/><circle class="dot${cls}" cx="${l.ax}" cy="${l.ay}" r="2.6"/>`;
      rects.push({ k: l.k, x, y: l.y, w, h, ax: l.ax, ay: l.ay, ex, ey, side, visible: l.visible });
    }
  }
  for (const k in pills) if (!shown.has(k)) pills[k].style.transform = 'translate(-999px,-999px)';
  leadsEl.innerHTML = svg; lastLabelRects = rects;
}
function pageFrame() { const W = innerWidth, H = innerHeight; const w = Math.min(W, Math.max(360, Math.round(H * (S.pair ? 1.45 : 0.8)))); return { x0: Math.round((W - w) / 2), w }; }
function dockH() { const c = $('card'); return $('dock').offsetHeight + (innerWidth >= 900 ? 12 : 0) - (c.classList.contains('show') ? c.offsetHeight + 8 : 0); }

// ---------- one body or two ----------
function choosePair() { return innerWidth / innerHeight >= 0.95 && innerWidth >= 600; }
function setPair(v) {
  S.pair = v; figs[1].visible = v;
  figs[0].position.x = v ? -SEP : 0; figs[1].position.x = v ? SEP : 0;
  if (v) { S.yaw = S.yawT = 0; }
  $('bPair').classList.toggle('on', v); $('bPair').parentElement.style.display = innerWidth >= 600 ? '' : 'none'; $('bFront').style.display = $('bBack').style.display = v ? 'none' : '';
  applyYaw(); refit(true); anchorsFor = ''; invalidate();
}
function applyYaw() { figs[0].rotation.y = S.yaw; figs[1].rotation.y = S.yaw + Math.PI; $('bFront').classList.toggle('on', !S.pair && facesFront(0)); $('bBack').classList.toggle('on', !S.pair && !facesFront(0)); }

// ---------- camera fit ----------
const colW = () => (S.labels && innerHeight >= 500 ? Math.min(190, Math.max(100, pageFrame().w * (S.pair ? 0.17 : 0.26))) : 0);
function refit(immediate) {
  const b = new THREE.Box3(); for (const g of figs) if (g.visible) b.expandByObject(g);
  const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
  const W = innerWidth, Hh = innerHeight, availH = Hh - 58 - dockH() - 10, availW = pageFrame().w - 2 * colW() * (S.pair ? 1 : 0.55) - 8;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dH = (sz.y / 2) / tan * (Hh / availH), dW = (sz.x / 2) / (tan * camera.aspect) * (W / Math.max(availW, 80));
  S.fitDist = Math.max(dH, dW) * 1.04 + sz.z / 2;
  const mid = (58 + (Hh - dockH())) / 2, shiftY = ((mid - Hh / 2) / Hh) * 2 * tan * S.fitDist;
  S.fitTarget = c.clone().add(new THREE.Vector3(0, shiftY, 0));
  if (immediate) { controls.target.copy(S.fitTarget); camera.position.set(S.fitTarget.x, S.fitTarget.y, S.fitTarget.z + S.fitDist); camera.lookAt(controls.target); controls.update(); }
}
function resize() {
  const W = innerWidth, Hh = innerHeight;
  if (!S.pairAuto && S.pair && innerWidth < 600) S.pairAuto = true; // two bodies only on screens ≥ 600 px wide
  $('bPair').parentElement.style.display = innerWidth >= 600 ? '' : 'none';
  if (S.pairAuto) { const want = choosePair(); if (want !== S.pair) { S.pair = want; setPair(want); } }
  document.documentElement.style.setProperty('--pageW', pageFrame().w + 'px');
  renderer.setSize(W, Hh, false); camera.aspect = W / Hh; camera.updateProjectionMatrix();
  refit(true); invalidate();
}
addEventListener('resize', resize);

// ---------- pointer: one finger turns the bodies, a short tap picks ----------
const taps = new Map(); let multi = false; let drag = null;
const el = renderer.domElement;
el.addEventListener('pointerdown', (e) => { taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() }); if (taps.size > 1) { multi = true; drag = null; } else drag = { x: e.clientX, yaw: S.yaw }; });
el.addEventListener('pointermove', (e) => {
  if (!drag || multi || !taps.has(e.pointerId)) return;
  const dx = e.clientX - drag.x; if (Math.abs(dx) < 4 && !drag.moving) return;
  drag.moving = true; S.yaw = S.yawT = drag.yaw + dx * 0.012; S.turning = false; applyYaw(); invalidate();
});
el.addEventListener('pointerup', (e) => {
  const s = taps.get(e.pointerId); taps.delete(e.pointerId);
  const wasMulti = multi; if (taps.size === 0) { multi = false; } const wasDrag = drag?.moving; drag = null;
  if (!s || wasMulti || wasDrag) return;
  if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8 || performance.now() - s.t > 600) return;
  const k = fingerPick(e.clientX, e.clientY);
  select(k && CUR[k]?.exam && k !== S.sel ? k : k && !CUR[k]?.exam ? k : null);
});
el.addEventListener('pointercancel', (e) => { taps.delete(e.pointerId); drag = null; });
const RING = [...Array(8)].map((_, i) => [Math.cos(i * Math.PI / 4) * 9, Math.sin(i * Math.PI / 4) * 9, 1]).concat([...Array(12)].map((_, i) => [Math.cos(i * Math.PI / 6) * 18, Math.sin(i * Math.PI / 6) * 18, 2]));
function fingerPick(x, y) {
  const c = rayKey(x, y); if (c && CUR[c]?.exam) return c;
  const score = {};
  for (const [dx, dy, ring] of RING) { const k = rayKey(x + dx, y + dy); if (k && CUR[k]?.exam) score[k] = (score[k] || 0) + (ring === 1 ? 2 : 1); }
  let best = null; for (const k in score) if (!best || score[k] > score[best]) best = k;
  return best || c; // a textbook muscle nearby wins over 'altres músculs' under the finger
}

// ---------- info card ----------
function renderCard() {
  const c = $('card'); const it = S.sel && CUR[S.sel];
  if (!it) { c.classList.remove('show'); return; }
  const u = T[lang]; const paired = parts.filter((p) => p.key === S.sel && p.fig === 0).length > 1;
  const zone = it.zone ? `<span class="zone" style="background:var(--${it.zone}-f);border-color:var(--${it.zone}-s)">${cur.zones[it.zone][lang]}</span>` : '';
  $('cName').innerHTML = `${it.name[lang]} <small style="font-size:13px;color:var(--mut)">${paired ? u.x2 : ''}</small> ${zone} ${it.exam ? '' : `<span class="extra">${u.extra}</span>`}`;
  $('cCa').textContent = lang !== 'ca' ? it.name.ca : '';
  const zf = it.zone && cur.zoneFacts[`${it.lesson}.${it.zone}`];
  const RES = { ca: 'resum del llibre', es: 'resumen del libro', zh: '课本要点（非原文）', en: 'textbook summary' };
  $('cDef').innerHTML = it.exam ? `<span class="res">📖 ${RES[lang]} · p.${it.page}</span> ` + ((it.fact && it.fact[lang]) || (zf && zf[lang]) || '') : '';
  c.classList.add('show'); invalidate();
}
$('cardX').onclick = () => select(null);

// ---------- controls ----------
function setView(v) { if (S.pair) return; const d = (v === 'front' ? 0 : Math.PI) - S.yaw; S.yawT = S.yaw + d - 2 * Math.PI * Math.round(d / (2 * Math.PI)); S.turning = true; invalidate(); }
$('bFront').onclick = () => setView('front'); $('bBack').onclick = () => setView('back');
$('bPair').onclick = () => { S.pairAuto = false; setPair(!S.pair); };
$('bLabels').onclick = () => { S.labels = !S.labels; $('bLabels').classList.toggle('on', S.labels); refit(true); invalidate(); };
$('bZones').onclick = () => { S.zones = !S.zones; $('bZones').classList.toggle('on', S.zones); renderLegend(); applyColours(); invalidate(); };
$('bReset').onclick = () => { select(null); S.yaw = ((S.yaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); if (S.yaw > Math.PI) S.yaw -= 2 * Math.PI; S.yawT = 0; S.turning = true; refit(true); invalidate(); };
$('bCredits').onclick = (e) => { e.preventDefault(); $('credits').classList.add('show'); };
$('creditsX').onclick = () => $('credits').classList.remove('show');
$('lang').value = lang;
$('lang').onchange = () => { lang = $('lang').value; try { localStorage.setItem('coshuma.lang', lang); } catch {} applyText(); };
function renderLegend() {
  const l = $('zoneLegend'); l.style.display = S.zones ? 'flex' : 'none';
  l.innerHTML = ['cap', 'tronc', 'ext'].map((z) => `<span style="background:var(--${z}-f);border-color:var(--${z}-s)">${cur.zones[z][lang]}</span>`).join('');
}
function applyText() {
  const u = T[lang]; document.documentElement.lang = lang;
  $('tTitle').textContent = u.title; $('tSub').textContent = u.sub;
  $('bFront').textContent = u.front; $('bBack').textContent = u.back; $('bLabels').textContent = u.labels; $('bZones').textContent = u.zones; $('bPair').textContent = '👥 ' + u.pair;
  $('tHint').textContent = u.hint; $('tLoading').textContent = u.loading;
  labelText(); renderCard(); renderLegend(); anchorsFor = ''; invalidate();
}

// ---------- render loop (on demand) ----------
let frameReq = 0;
function invalidate() { if (!frameReq) frameReq = requestAnimationFrame(frame); }
controls.addEventListener('change', () => invalidate());
let fpsT = performance.now(), fpsN = 0, fps = 0;
const bench = { on: false, n: 0, t0: 0, result: null, yaw0: 0 };
function frame() {
  frameReq = 0; let busy = false;
  if (S.turning) { const d = S.yawT - S.yaw; if (Math.abs(d) > 0.002) { S.yaw += d * 0.16; busy = true; } else { S.yaw = S.yawT; S.turning = false; } applyYaw(); }
  if (bench.on) { S.yaw = bench.yaw0 + (performance.now() - bench.t0) / 5000 * Math.PI * 2; applyYaw(); }
  if (controls.update()) busy = true;
  renderer.render(scene, camera);
  if (!busy && !bench.on && !drag?.moving && S.labels && refreshAnchors()) busy = true;
  layoutLabels();
  metrics.frames++; metrics.draws = renderer.info.render.calls; metrics.tris = renderer.info.render.triangles;
  if (!metrics.firstFrameMs) metrics.firstFrameMs = Math.round(performance.now() - t0);
  fpsN++; const now = performance.now(); if (now - fpsT > 1000) { fps = fpsN * 1000 / (now - fpsT); fpsN = 0; fpsT = now; }
  if (bench.on) { bench.n++; if (now - bench.t0 >= 5000) endBench(now); else busy = true; }
  if (busy) invalidate();
}

// ---------- diagnostics ----------
function startBench() { if (bench.on) return; bench.on = true; bench.n = 0; bench.t0 = performance.now(); bench.yaw0 = S.yaw; renderDiag(); invalidate(); }
function endBench(now) { bench.on = false; bench.result = +(bench.n * 1000 / (now - bench.t0)).toFixed(1); S.yaw = bench.yaw0; applyYaw(); renderDiag(); invalidate(); }
function diagData() {
  return { version: VERSION, page: 'musculatura', bodies: S.pair ? 2 : 1, model: metrics.source, modelMB: +(metrics.bytes / 1048576).toFixed(2), loadMs: metrics.loadMs, firstFrameMs: metrics.firstFrameMs,
    fps5s: bench.result, fpsLastBusy: +fps.toFixed(1), drawCalls: metrics.draws, triangles: metrics.tris,
    devicePixelRatio: devicePixelRatio, renderPixelRatio: renderer.getPixelRatio(), canvas: `${renderer.domElement.width}×${renderer.domElement.height}`,
    css: `${innerWidth}×${innerHeight}`, webgl: glInfo.version, gpu: glInfo.renderer, gpuVendor: glInfo.vendor, maxTexture: glInfo.maxTex, contextLost: glInfo.lost,
    cores: navigator.hardwareConcurrency || null, memoryGB: navigator.deviceMemory || null, ua: navigator.userAgent, time: new Date().toISOString() };
}
function renderDiag() {
  const d$ = $('diag'); d$.style.display = DIAG ? 'block' : 'none'; $('bDiag').classList.toggle('on', DIAG);
  if (!DIAG) return;
  const d = diagData();
  $('diagBody').textContent =
`${d.version} · model: ${d.model} (${d.modelMB} MB) · cossos: ${d.bodies}
càrrega ${d.loadMs} ms · 1r frame ${d.firstFrameMs} ms
FPS (prova 5 s): ${d.fps5s ?? '—'}${bench.on ? ' (mesurant…)' : ''}
draw calls ${d.drawCalls} · triangles ${d.triangles.toLocaleString()}
DPR dispositiu ${d.devicePixelRatio} · render ${d.renderPixelRatio}
canvas ${d.canvas} · CSS ${d.css}
${d.webgl} · ${d.gpu}
max tex ${d.maxTexture} · context perdut: ${d.contextLost ? 'SÍ' : 'no'}`;
}
$('bDiag').onclick = () => { DIAG = !DIAG; renderDiag(); };
$('bBench').onclick = startBench;
$('bCopy').onclick = async () => {
  const txt = JSON.stringify(diagData(), null, 1);
  try { await navigator.clipboard.writeText(txt); $('bCopy').textContent = '✓'; setTimeout(() => ($('bCopy').textContent = '📋'), 1500); }
  catch { const ta = $('diagText'); ta.style.display = 'block'; ta.value = txt; ta.select(); }
};
setInterval(() => { if (DIAG && !bench.on) renderDiag(); }, 700);

// ---------- start ----------
S.pair = choosePair(); applyText(); applyColours(); setPair(S.pair); resize();
$('loading').style.display = 'none'; window.__coshumaReady = true; renderDiag();

window.__coshuma = {
  version: VERSION, metrics, get state() { return { sel: S.sel, yaw: S.yaw, pair: S.pair, labels: S.labels, zones: S.zones, front: facesFront(0) }; },
  select, setView, setPair: (v) => { S.pairAuto = false; setPair(v); }, setYaw: (y) => { S.yaw = S.yawT = y; S.turning = false; applyYaw(); invalidate(); },
  labels: () => lastLabelRects, idle: () => !frameReq && !bench.on, diag: diagData, startBench,
  pickAt: (x, y) => rayKey(x, y), fingerPick, pickFig: (x, y) => { const h = rayHit(x, y); return h ? parts.find((p) => p.mesh === h.object)?.fig : null; },
  selectedKeys: () => [...new Set(parts.filter((p) => isSel(p.key)).map((p) => p.key))], isSel,
  meshInfo: () => parts.filter((p) => p.fig === 0).map((p) => ({ key: p.key, side: p.side, structures: p.mesh.userData.parts || [] })),
  plan: labelPlan, frontKeys: FRONT_KEYS, backKeys: BACK_KEYS,
  canvas: () => ({ buf: [renderer.domElement.width, renderer.domElement.height], css: [renderer.domElement.clientWidth, renderer.domElement.clientHeight], aspect: camera.aspect }),
  samplePoints(k, n = 6, fig = 0) {
    const out = []; for (const p of parts.filter((q) => q.key === k && q.fig === fig)) { const pos = p.mesh.geometry.attributes.position; const step = Math.max(1, Math.floor(pos.count / 60));
      for (let i = 0; i < pos.count; i += step) { v3.fromBufferAttribute(pos, i).applyMatrix4(p.mesh.matrixWorld).project(camera);
        const x = Math.round((v3.x + 1) / 2 * innerWidth), y = Math.round((1 - v3.y) / 2 * innerHeight); if (x < 4 || y < 60 || x > innerWidth - 4 || y > innerHeight - dockH() - 4) continue;
        const h = rayHit(x, y); if (h && h.object === p.mesh && document.elementFromPoint(x, y) === renderer.domElement) out.push([x, y]); } } // skip points covered by a name label
    const sel = []; for (let i = 0; i < n && out.length; i++) sel.push(out[Math.floor((i + 0.5) * out.length / n)]); return sel; },
};
