// COS-HUMA 3D · M1 (skeleton). Plain ES module, no build step.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const VERSION = 'M1.1-0.4';
const $ = (id) => document.getElementById(id);
const t0 = performance.now();
const Q = new URLSearchParams(location.search), H = location.hash;
const FORCE_EMBEDDED = Q.get('model') === 'embedded' || /embedded/.test(H);
let DIAG = Q.has('diag') || /diag|debug/.test(H);
const fail = (stage, err) => window.__coshumaFail(stage, err); // defined in index.html (classic script, runs even if this module fails)

// ---------- UI text ----------
const T = {
  ca: { title: 'El cos humà 3D', sub: 'Esquelet · prova M1.1 (v0.4)', join: 'Munta', split: 'Desmunta', front: 'Davant', back: 'Darrere', labels: 'Noms', zones: 'Zones', hint: 'Toca un os · arrossega per girar · pessiga per ampliar', loading: "Carregant l'esquelet…", extra: 'No surt al llibre', pair: '(×2)' },
  es: { title: 'El cuerpo humano 3D', sub: 'Esqueleto · prueba M1.1 (v0.4)', join: 'Unir', split: 'Separar', front: 'Delante', back: 'Detrás', labels: 'Nombres', zones: 'Zonas', hint: 'Toca un hueso · arrastra para girar · pellizca para ampliar', loading: 'Cargando el esqueleto…', extra: 'No sale en el libro', pair: '(×2)' },
  zh: { title: '人体 3D', sub: '骨骼 · M1.1 测试版 (v0.4)', join: '拼合', split: '拆开', front: '正面', back: '背面', labels: '名称', zones: '分区', hint: '点骨头看名字 · 拖动旋转 · 双指缩放', loading: '正在加载骨骼…', extra: '课本里没有', pair: '（左右各一）' },
  en: { title: 'The human body 3D', sub: 'Skeleton · M1.1 test (v0.4)', join: 'Join', split: 'Split', front: 'Front', back: 'Back', labels: 'Names', zones: 'Zones', hint: 'Tap a bone · drag to turn · pinch to zoom', loading: 'Loading the skeleton…', extra: 'Not in the textbook', pair: '(×2)' },
};
let lang = 'ca';
try { lang = localStorage.getItem('coshuma.lang') || 'ca'; } catch {}

// ---------- layout knowledge (3D only; knowledge itself comes from curriculum.json) ----------
// preferred label column, as in the 2D textbook layout
const LABEL_COL = { crani: 'L', maxillar: 'L', vertebra: 'L', columna: 'L', costella: 'L', estern: 'L', pelvis: 'L', femur: 'L', rotula: 'L', tibia: 'L', fpeu: 'L',
  omoplat: 'R', humer: 'R', cubit: 'R', radi: 'R', carp: 'R', metacarp: 'R', falma: 'R', perone: 'R', tars: 'R', metatars: 'R' };
// label anchor shift (fraction of the item's height) so the order matches the textbook: costella above estern, vèrtebra above columna vertebral
const ANCHOR_DY = { costella: 0.22, columna: -0.3 };
const ARM = new Set(['humer', 'cubit', 'radi', 'carp', 'metacarp', 'falma']);
const LEG = new Set(['femur', 'rotula', 'tibia', 'perone', 'tars', 'metatars', 'fpeu']);
// stage 2 offsets (model units; body ≈ 4.1 tall; +x = body's left, +z = front); s = +1 left side, -1 right side
const PIECE = {
  crani: [0, .32, 0], maxillar: [0, .06, .22], columna: [0, 0, -.42], vertebra: [0, -.04, .3], costella: [.34, 0, .04], estern: [0, -.02, .44], pelvis: [0, -.22, 0],
  omoplat: [.42, .1, -.26], clavicula: [.34, .3, .16], altres: [0, .18, .3],
  humer: [.04, .02, 0], cubit: [.12, -.2, 0], radi: [.28, -.2, 0], carp: [.24, -.48, 0], metacarp: [.26, -.66, 0], falma: [.28, -.86, 0],
  femur: [.04, 0, 0], rotula: [.12, -.18, .34], tibia: [.04, -.32, 0], perone: [.26, -.32, 0], tars: [.08, -.62, .1], metatars: [.08, -.82, .24], fpeu: [.08, -1.02, .38],
};
const ZONE_OFF = { cap: [0, .40, 0], tronc: [0, 0, 0], arm: [.30, .04, 0], leg: [.12, -.40, 0] };

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
controls.enableDamping = true; controls.dampingFactor = 0.12;
controls.minPolarAngle = Math.PI / 2 - 0.35; controls.maxPolarAngle = Math.PI / 2 + 0.35; // keep upright
controls.rotateSpeed = 0.8; controls.zoomSpeed = 0.9; controls.screenSpacePanning = true;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a4, 2.1));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 8); camera.add(key); scene.add(camera);

// toon ramp
const ramp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { w: { value: 0.006 }, color: { value: new THREE.Color(0x1d2747) } },
  vertexShader: 'uniform float w; void main(){ vec3 p = position + normalize(normal) * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
  fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }',
  side: THREE.BackSide,
});
// opaque pass + depthWrite off: drawn first, bones always on top; fades by blending its colour into the background
const NAVY = new THREE.Color(0x23366b), BG = new THREE.Color(0xf4efe6);
const shellMat = new THREE.MeshBasicMaterial({ color: NAVY.clone(), depthWrite: false });

// ---------- state ----------
const S = { cur: { e: 0 }, tgt: { e: 0 }, sel: null, labels: true, zones: false, view: 'front', az: 0, azT: 0, fitDist: 10, autoFit: true };
const parts = []; // {key, side, mesh, outline, base:Vector3, item}
let shell, CUR, center = new THREE.Vector3(), bodyBox = new THREE.Box3();
const metrics = { loadMs: 0, firstFrameMs: 0, frames: 0, draws: 0, tris: 0, source: '', bytes: 0, fallbackReason: '' };

// ---------- load ----------
// Primary: the real .glb file. Diagnostic fallback: base64 module (?model=embedded), offered on the error screen.
const GLB_URL = './models/cos-huma-skeleton.glb';
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
  const m = await import('./models/cos-huma-skeleton.glb.js'); const bin = atob(m.default);
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
CUR = Object.fromEntries(cur.items.map((i) => [i.key, i]));
metrics.loadMs = Math.round(performance.now() - t0);
const root = gltf.scene; scene.add(root);
const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); });
meshes.forEach((o) => {
  const ex = o.userData;
  if (ex.role === 'shell') { shell = o; o.material = shellMat; o.renderOrder = -2; o.raycast = () => {}; return; }
  const item = CUR[ex.key];
  o.material = new THREE.MeshToonMaterial({ color: 0xfbfaf4, gradientMap: ramp });
  const ol = new THREE.Mesh(o.geometry, outlineMat); ol.raycast = () => {}; ol.renderOrder = -1; o.add(ol);
  const sc = o.getWorldScale(new THREE.Vector3()).x; ol.onBeforeRender = () => { outlineMat.uniforms.w.value = 0.006 / sc; outlineMat.uniformsNeedUpdate = true; };
  parts.push({ key: ex.key, side: ex.side, mesh: o, outline: ol, base: o.position.clone(), item });
});
bodyBox.setFromObject(root); bodyBox.getCenter(center);
controls.target.copy(center);

// ---------- explode ----------
const zoneOf = (k) => CUR[k]?.zone || (k === 'clavicula' ? 'tronc' : 'tronc');
function offsetFor(p, e) {
  const s = p.side === 'L' ? 1 : p.side === 'R' ? -1 : 0;
  const a = smooth(0, 0.5, e), b = smooth(0.5, 1, e);
  const zk = ARM.has(p.key) ? 'arm' : LEG.has(p.key) ? 'leg' : zoneOf(p.key) === 'cap' ? 'cap' : 'tronc';
  const z = ZONE_OFF[zk], q = PIECE[p.key] || [0, 0, 0];
  const sx = (v) => (s === 0 ? 0 : v * s);
  return new THREE.Vector3(sx(z[0]) * a + sx(q[0]) * b, z[1] * a + q[1] * b, z[2] * a + q[2] * b);
}
function smooth(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
function applyExplode() {
  const e = S.cur.e;
  for (const p of parts) p.mesh.position.copy(p.base).add(offsetFor(p, e));
  const f = smooth(0.02, 0.22, e); shellMat.color.copy(NAVY).lerp(BG, f); shell.visible = f < 0.99;
}

// ---------- colours / selection ----------
const ZC = { cap: new THREE.Color(0x4f86d0), tronc: new THREE.Color(0xe58a2e), ext: new THREE.Color(0x46a05e) };
const WHITE = new THREE.Color(0xfbfaf4), GREY = new THREE.Color(0xd9d4cb);
function applyColours() {
  for (const p of parts) {
    const it = p.item, m = p.mesh.material;
    let c = WHITE.clone();
    if (S.zones && it?.exam) c = WHITE.clone().lerp(ZC[it.zone], 0.55);
    if (!it?.exam) c = GREY.clone();
    if (S.sel) {
      if (isSel(p.key)) c = (it?.exam ? ZC[it.zone] : new THREE.Color(0x8a8278)).clone();
      else c.lerp(new THREE.Color(0xf4efe6), 0.35);
    }
    m.color.copy(c);
    m.emissive?.set(isSel(p.key) ? 0x222222 : 0x000000);
  }
}
// Selection works on textbook terms: both 'falanges' (hand and foot) light up together,
// and choosing 'columna vertebral' also lights the separate 'vèrtebra'.
const termOf = (k) => (k && CUR[k] ? CUR[k].term : null);
function isSel(k) { const t = termOf(S.sel); if (!t) return false; return termOf(k) === t || (t === 'columna' && CUR[k]?.partOf === 'columna'); }
function select(k) {
  S.sel = k; applyColours(); renderCard(); invalidate();
}

// ---------- labels ----------
const pillsEl = $('pills'), leadsEl = $('leads');
const pills = {};
for (const it of cur.items) {
  if (!it.exam || it.lesson !== 'esquelet') continue;
  const d = document.createElement('div'); d.className = 'pill'; d.dataset.key = it.key;
  d.style.background = `var(--${it.zone}-f)`; d.style.borderColor = `var(--${it.zone}-s)`;
  d.addEventListener('click', (ev) => { ev.stopPropagation(); select(termOf(S.sel) === it.term ? null : it.key); });
  pillsEl.appendChild(d); pills[it.key] = d;
}
function labelText() { for (const k in pills) pills[k].textContent = CUR[k].name[lang]; }
const v3 = new THREE.Vector3(), box3 = new THREE.Box3();
let lastLabelRects = [];
function layoutLabels() {
  const W = innerWidth, H = innerHeight;
  const short = innerHeight < 500; document.body.classList.toggle('short', short);
  if (!S.labels || short || S.cur.e > 0.02 && S.cur.e < 0.5) { pillsEl.style.display = 'none'; leadsEl.innerHTML = ''; lastLabelRects = []; return; }
  pillsEl.style.display = '';
  const top = 58, bottom = H - dockH() - 8;
  const cols = { L: [], R: [] };
  for (const k in pills) {
    // choose the mesh of this item that sits nearest to its preferred screen column
    const want = LABEL_COL[k] || 'L';
    let best = null;
    for (const p of parts) {
      if (p.key !== k) continue;
      box3.setFromObject(p.mesh); box3.getCenter(v3); if (ANCHOR_DY[k]) v3.y += ANCHOR_DY[k] * (box3.max.y - box3.min.y); v3.project(camera);
      const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H;
      const score = want === 'L' ? x : -x;
      if (!best || score < best.score) best = { x, y, score };
    }
    if (!best) continue;
    const col = S.cur.e >= 0.5 ? (best.x < W / 2 ? 'L' : 'R') : want;
    cols[col].push({ k, ax: best.x, ay: best.y });
  }
  const h = innerWidth >= 700 ? 30 : 26, gap = 3, pad = 6;
  let svg = '';
  const rects = [];
  for (const side of ['L', 'R']) {
    const list = cols[side].sort((a, b) => a.ay - b.ay);
    let y = top;
    for (const l of list) { l.y = Math.max(l.ay - h / 2, y); y = l.y + h + gap; }
    const over = y - gap - bottom; // push back up if we ran past the dock
    if (over > 0) { for (let i = list.length - 1, lim = bottom; i >= 0; i--) { list[i].y = Math.min(list[i].y, lim - h); lim = list[i].y - gap; } }
    for (const l of list) {
      const el = pills[l.k]; const w = el.offsetWidth;
      const F = pageFrame(); const x = side === 'L' ? F.x0 + pad : F.x0 + F.w - pad - w;
      el.style.transform = `translate(${x}px,${l.y}px)`;
      el.classList.toggle('sel', isSel(l.k));
      const ex = side === 'L' ? x + w : x, ey = l.y + h / 2;
      svg += `<line x1="${ex}" y1="${ey}" x2="${l.ax}" y2="${l.ay}"/><circle cx="${l.ax}" cy="${l.ay}" r="2.6"/>`;
      rects.push({ k: l.k, x, y: l.y, w, h });
    }
  }
  for (const k in pills) if (!rects.find((r) => r.k === k)) pills[k].style.transform = 'translate(-999px,-999px)';
  leadsEl.innerHTML = svg; lastLabelRects = rects;
}
// layout height of the dock without the info card, so opening the card never moves the body
// "Page" frame: on wide screens the figure and its labels are laid out inside a textbook-like page
// (width ≈ 0.8 × height) centred on the screen, instead of being stretched to the screen edges.
function pageFrame() { const W = innerWidth, H = innerHeight; const w = Math.min(W, Math.max(360, Math.round(H * 0.8))); return { x0: Math.round((W - w) / 2), w }; }
function dockH() { const c = $('card'); return $('dock').offsetHeight + (innerWidth >= 900 ? 12 : 0) - (c.classList.contains('show') ? c.offsetHeight + 8 : 0); }

// ---------- camera fit (uniform: camera.aspect always equals canvas aspect) ----------
const colW = () => (S.labels && innerHeight >= 500 ? Math.min(170, Math.max(96, pageFrame().w * 0.24)) : 0);
function fitDistance(box) {
  const W = innerWidth, H = innerHeight, availH = H - 58 - dockH() - 10, availW = pageFrame().w - 2 * colW() * 0.55 - 12;
  const size = box.getSize(new THREE.Vector3());
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dH = (size.y / 2) / tan * (H / availH);
  const dW = (Math.max(size.x, size.z) / 2) / (tan * camera.aspect) * (W / Math.max(availW, 80));
  return Math.max(dH, dW) * 1.04 + size.z / 2;
}
function verticalShift() { // keep the body centred in the free area between header and dock
  const H = innerHeight, mid = (58 + (H - dockH())) / 2; return (mid - H / 2) / H;
}
function currentBox() { const b = new THREE.Box3(); for (const p of parts) b.expandByObject(p.mesh); return b; }
function refit(immediate) {
  const b = currentBox(); const c = b.getCenter(new THREE.Vector3());
  S.fitDist = fitDistance(b);
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const shiftY = verticalShift() * 2 * tan * S.fitDist; // world units
  S.fitTarget = c.clone().add(new THREE.Vector3(0, shiftY, 0));
  if (immediate) { controls.target.copy(S.fitTarget); placeCamera(S.az, S.fitDist); }
}
function placeCamera(az, dist) {
  camera.position.set(controls.target.x + Math.sin(az) * dist, controls.target.y, controls.target.z + Math.cos(az) * dist);
  camera.lookAt(controls.target); controls.update();
}
function resize() {
  const W = innerWidth, H = innerHeight;
  document.documentElement.style.setProperty('--pageW', pageFrame().w + 'px');
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  refit(true); invalidate();
}
addEventListener('resize', resize);

// ---------- picking: tap vs drag ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const taps = new Map(); let multi = false;
renderer.domElement.addEventListener('pointerdown', (e) => { taps.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() }); if (taps.size > 1) multi = true; });
renderer.domElement.addEventListener('pointerup', (e) => {
  const s = taps.get(e.pointerId); taps.delete(e.pointerId);
  const wasMulti = multi; if (taps.size === 0) multi = false;
  if (!s || wasMulti) return;
  if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8 || performance.now() - s.t > 600) return;
  const k = fingerPick(e.clientX, e.clientY);
  select(k && termOf(k) !== termOf(S.sel) ? k : null);
});
renderer.domElement.addEventListener('pointercancel', (e) => { taps.delete(e.pointerId); });

// Finger-tolerant picking: the centre ray decides when it hits; otherwise the bone hit most often
// within a 9 px / 18 px ring wins (thin bones such as fingers, fibula and ribs are hard to hit exactly).
const RING = [[0, 0, 0]].concat([...Array(8)].map((_, i) => [Math.cos(i * Math.PI / 4) * 9, Math.sin(i * Math.PI / 4) * 9, 1]), [...Array(12)].map((_, i) => [Math.cos(i * Math.PI / 6) * 18, Math.sin(i * Math.PI / 6) * 18, 2]));
function rayKey(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(parts.map((p) => p.mesh), false)[0]; return h ? h.object.userData.key : null; }
function fingerPick(x, y) {
  const c = rayKey(x, y); if (c) return c;
  const score = {};
  for (const [dx, dy, ring] of RING.slice(1)) { const k = rayKey(x + dx, y + dy); if (k) score[k] = (score[k] || 0) + (ring === 1 ? 2 : 1); }
  let best = null; for (const k in score) if (!best || score[k] > score[best]) best = k; return best;
}

// ---------- info card ----------
function renderCard() {
  const c = $('card'); const it = S.sel && CUR[S.sel];
  if (!it) { c.classList.remove('show'); return; }
  const u = T[lang]; const paired = parts.filter((p) => p.key === S.sel).length > 1 && it.term !== 'falanges';
  const zone = it.zone ? `<span class="zone" style="background:var(--${it.zone}-f);border-color:var(--${it.zone}-s)">${cur.zones[it.zone][lang]}</span>` : '';
  $('cName').innerHTML = `${it.name[lang]} <small style="font-size:13px;color:var(--mut)">${paired ? u.pair : ''}</small> ${zone} ${it.exam ? '' : `<span class="extra">${u.extra}</span>`}`;
  $('cCa').textContent = lang !== 'ca' ? it.name.ca : '';
  const zf = it.zone && cur.zoneFacts[`${it.lesson}.${it.zone}`];
  const typ = it.type && it.status.type === 'textbook' ? ` (${cur.types[it.type][lang]})` : '';
  $('cDef').textContent = it.exam ? '📖 ' + ((it.fact && it.fact[lang]) || (zf && zf[lang]) || '') + typ : '';
  c.classList.add('show'); invalidate(); // no refit: the body must not jump under the child's finger when the card opens
}
$('cardX').onclick = () => select(null);

// ---------- controls ----------
const slider = $('slider');
function setExplode(v) { S.tgt.e = Math.min(1, Math.max(0, v)); slider.value = Math.round(S.tgt.e * 100); invalidate(); }
slider.addEventListener('input', () => setExplode(slider.value / 100));
$('bSplit').onclick = () => setExplode(S.tgt.e < 0.45 ? 0.5 : 1);
$('bJoin').onclick = () => setExplode(S.tgt.e > 0.55 ? 0.5 : 0);
function setView(v) { S.view = v; const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z); S.az = az; S.azT = v === 'front' ? 0 : Math.PI; if (Math.abs(S.azT - az) > Math.PI) S.az += S.azT > az ? 2 * Math.PI : -2 * Math.PI; S.turning = true; $('bFront').classList.toggle('on', v === 'front'); $('bBack').classList.toggle('on', v === 'back'); invalidate(); }
$('bFront').onclick = () => setView('front'); $('bBack').onclick = () => setView('back');
$('bLabels').onclick = () => { S.labels = !S.labels; $('bLabels').classList.toggle('on', S.labels); refit(false); S.refitting = true; invalidate(); };
$('bZones').onclick = () => { S.zones = !S.zones; $('bZones').classList.toggle('on', S.zones); renderLegend(); applyColours(); invalidate(); };
$('bReset').onclick = () => { select(null); setExplode(0); setView('front'); S.refitting = true; };
$('bCredits').onclick = (e) => { e.preventDefault(); $('credits').classList.add('show'); };
$('creditsX').onclick = () => $('credits').classList.remove('show');
$('lang').value = lang;
$('lang').onchange = () => { lang = $('lang').value; try { localStorage.setItem('coshuma.lang', lang); } catch {} applyText(); };
function renderLegend() {
  const el = $('zoneLegend'); el.style.display = S.zones ? 'flex' : 'none';
  el.innerHTML = ['cap', 'tronc', 'ext'].map((z) => `<span style="background:var(--${z}-f);border-color:var(--${z}-s)">${cur.zones[z][lang]}</span>`).join('');
}
function applyText() {
  const u = T[lang]; document.documentElement.lang = lang;
  $('tTitle').textContent = u.title; $('tSub').textContent = u.sub; $('tJoin').textContent = u.join; $('tSplit').textContent = u.split;
  $('bFront').textContent = u.front; $('bBack').textContent = u.back; $('bLabels').textContent = u.labels; $('bZones').textContent = u.zones;
  $('tHint').textContent = u.hint; $('tLoading').textContent = u.loading;
  labelText(); renderCard(); renderLegend(); invalidate();
}

// ---------- render loop (on demand) ----------
let frameReq = 0;
function invalidate() { if (!frameReq) frameReq = requestAnimationFrame(frame); }
controls.addEventListener('change', () => { S.userMoved = true; invalidate(); });
controls.addEventListener('start', () => { S.turning = false; });
let fpsT = performance.now(), fpsN = 0, fps = 0;
const bench = { on: false, n: 0, t0: 0, result: null, az0: 0 };
function frame() {
  frameReq = 0;
  let busy = false;
  // explode tween
  const de = S.tgt.e - S.cur.e;
  if (Math.abs(de) > 0.001) { S.cur.e += de * 0.14; busy = true; } else S.cur.e = S.tgt.e;
  $('slVal').textContent = Math.round(S.cur.e * 100) + '%';
  applyExplode();
  // camera: turn to front/back, and auto-fit while exploding
  if (busy || S.refitting) { refit(false); }
  if (S.fitTarget) {
    const dt = S.fitTarget.clone().sub(controls.target);
    if (dt.length() > 1e-4) { controls.target.add(dt.multiplyScalar(0.18)); busy = true; }
    const off = camera.position.clone().sub(controls.target); const d = off.length();
    const dd = S.fitDist - d;
    if (Math.abs(dd) > 1e-3 && (busy || S.refitting)) { off.setLength(d + dd * 0.18); camera.position.copy(controls.target).add(off); busy = true; }
    else S.refitting = false;
  }
  if (S.turning) {
    const da = S.azT - S.az;
    if (Math.abs(da) > 0.002) { S.az += da * 0.16; busy = true; } else { S.az = S.azT; S.turning = false; }
    const off = camera.position.clone().sub(controls.target); const d = off.length();
    camera.position.set(controls.target.x + Math.sin(S.az) * d, camera.position.y, controls.target.z + Math.cos(S.az) * d);
    camera.lookAt(controls.target);
  }
  if (bench.on) { const k = (performance.now() - bench.t0) / 5000; const az = bench.az0 + k * Math.PI * 2; const off = camera.position.clone().sub(controls.target); const d = Math.hypot(off.x, off.z); camera.position.set(controls.target.x + Math.sin(az) * d, camera.position.y, controls.target.z + Math.cos(az) * d); camera.lookAt(controls.target); }
  if (controls.update()) busy = true;
  renderer.render(scene, camera);
  layoutLabels();
  metrics.frames++; metrics.draws = renderer.info.render.calls; metrics.tris = renderer.info.render.triangles;
  if (!metrics.firstFrameMs) metrics.firstFrameMs = Math.round(performance.now() - t0);
  fpsN++; const now = performance.now(); if (now - fpsT > 1000) { fps = fpsN * 1000 / (now - fpsT); fpsN = 0; fpsT = now; }
  if (bench.on) { bench.n++; if (now - bench.t0 >= 5000) endBench(now); else busy = true; }
  if (busy) invalidate();
}

// ---------- diagnostics panel ----------
function startBench() { if (bench.on) return; bench.on = true; bench.n = 0; bench.t0 = performance.now(); bench.az0 = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z); renderDiag(); invalidate(); }
function endBench(now) { bench.on = false; bench.result = +(bench.n * 1000 / (now - bench.t0)).toFixed(1); setView(S.view); renderDiag(); }
function diagData() {
  return { version: VERSION, model: metrics.source, modelMB: +(metrics.bytes / 1048576).toFixed(2), loadMs: metrics.loadMs, firstFrameMs: metrics.firstFrameMs,
    fps5s: bench.result, fpsLastBusy: +fps.toFixed(1), drawCalls: metrics.draws, triangles: metrics.tris,
    devicePixelRatio: devicePixelRatio, renderPixelRatio: renderer.getPixelRatio(), canvas: `${renderer.domElement.width}×${renderer.domElement.height}`,
    css: `${innerWidth}×${innerHeight}`, webgl: glInfo.version, gpu: glInfo.renderer, gpuVendor: glInfo.vendor, maxTexture: glInfo.maxTex, contextLost: glInfo.lost,
    cores: navigator.hardwareConcurrency || null, memoryGB: navigator.deviceMemory || null, ua: navigator.userAgent, time: new Date().toISOString() };
}
function renderDiag() {
  const el = $('diag'); el.style.display = DIAG ? 'block' : 'none'; $('bDiag').classList.toggle('on', DIAG);
  if (!DIAG) return;
  const d = diagData();
  $('diagBody').textContent =
`${d.version} · model: ${d.model} (${d.modelMB} MB)
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
applyText(); applyColours(); resize();
$('loading').style.display = 'none'; window.__coshumaReady = true; renderDiag();

// test hooks (read-only helpers for automated checks)
window.__coshuma = {
  version: VERSION, metrics, get state() { return { e: S.cur.e, sel: S.sel, view: S.view, labels: S.labels, zones: S.zones }; },
  select, setExplode, setView, labels: () => lastLabelRects,
  canvas: () => ({ buf: [renderer.domElement.width, renderer.domElement.height], css: [renderer.domElement.clientWidth, renderer.domElement.clientHeight], aspect: camera.aspect }),
  project(k) { const p = parts.find((q) => q.key === k && (q.side !== 'R')) || parts.find((q) => q.key === k); box3.setFromObject(p.mesh); box3.getCenter(v3); v3.project(camera); return [(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight]; },
  bodyRect() { const b = currentBox(); const pts = []; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { v3.set(x, y, z).project(camera); pts.push([(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight]); } return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) }; },
  idle: () => !frameReq && !bench.on, diag: diagData, startBench,
  eligible: (it, field) => it.exam === true && it.status?.[field] === 'textbook', termOf, isSel,
  pickAt: (x, y) => rayKey(x, y), fingerPick,
  samplePoints(k, n = 6) { // screen points whose first hit is this item (what a child would aim at)
    const out = []; const ps = parts.filter((p) => p.key === k);
    for (const p of ps) { const pos = p.mesh.geometry.attributes.position; const step = Math.max(1, Math.floor(pos.count / 60));
      for (let i = 0; i < pos.count; i += step) { v3.fromBufferAttribute(pos, i).applyMatrix4(p.mesh.matrixWorld).project(camera);
        const x = (v3.x + 1) / 2 * innerWidth, y = (1 - v3.y) / 2 * innerHeight; if (x < 4 || y < 60 || x > innerWidth - 4 || y > innerHeight - dockH() - 4) continue;
        if (this.pickAt(x, y) === k) out.push([x, y]); } }
    const sel = []; for (let i = 0; i < n && out.length; i++) sel.push(out[Math.floor((i + 0.5) * out.length / n)]); return sel; },
  pieceY(k) { const p = parts.find((q) => q.key === k && q.side !== 'R') || parts.find((q) => q.key === k); return p.mesh.position.clone().sub(p.base).toArray(); },
};
