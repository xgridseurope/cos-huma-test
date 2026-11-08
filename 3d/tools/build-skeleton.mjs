// Build cos-huma-skeleton.glb from OrganUI skeleton.glb + muscles.glb (BodyParts3D 3.0, CC BY-SA 2.1 JP).
// Usage: node build-skeleton.mjs <skeleton.glb> <muscles.glb> <out.glb>
// - groups the 242 bones into textbook items (key + side), one mesh each
// - builds a navy body "shell" from inflated muscle surfaces, aligned to the skeleton frame
// - quantizes geometry (KHR_mesh_quantization, no decoder needed)
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplifyPrimitive, quantize, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';

const [skPath, muPath, outPath] = process.argv.slice(2);
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// structureId -> textbook key (order matters: first match wins)
const MAP = [
  ['crani', /^(frontal-bone|.*parietal-bone|occipital-bone|.*temporal-bone|sphenoid-bone|ethmoid-bone|.*nasal-bone|.*lacrimal-bone|.*zygomatic-bone|.*maxilla|.*palatine-bone|.*inferior-nasal-concha|vomer)$/],
  ['maxillar', /^mandible$/],
  ['vertebra', /^first-lumbar-vertebra-l1$/], // textbook p.25 labels one 'vèrtebra'; L1 is visible below the ribs in front view
  ['columna', /(vertebra|atlas-c1|axis-c2|^sacrum$|intervertebral-disc)/],
  ['costella', /(-rib$|costal-cartilage)/],
  ['estern', /(sternum|xiphoid)/],
  ['pelvis', /hip-bone$/],
  ['omoplat', /scapula$/],
  ['clavicula', /clavicle$/],
  ['humer', /humerus$/], ['cubit', /-ulna$/], ['radi', /-radius$/],
  ['carp', /-(scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)$/],
  ['metacarp', /metacarpal-bone$/], ['falma', /(thumb|finger)-.*phalanx$/],
  ['femur', /femur$/], ['rotula', /patella$/], ['tibia', /-tibia$/], ['perone', /-fibula$/],
  ['tars', /-(talus|calcaneus|navicular|cuboid|medial-cuneiform|intermediate-cuneiform|lateral-cuneiform)$/],
  ['metatars', /metatarsal-bone$/], ['fpeu', /(toe-.*phalanx|sesamoid-bones-of-the-foot)$/],
];
const keyOf = (id) => (MAP.find(([, re]) => re.test(id)) || ['altres'])[0];
const SINGLE = new Set(['crani', 'maxillar', 'columna', 'vertebra', 'estern', 'altres']);
const sideOf0 = (id) => id.startsWith('left-') ? 'L' : id.startsWith('right-') ? 'R' : 'C';

// Transforms recorded in OrganUI manifests (display = (mm - centre) * scale, axes [x, z, -y])
const SB = { c: [-0.667999267578125, -109.74665069580078, 817.0244853496552], s: 0.0025 };
const SC = { c: [-0.6569976806640625, -97.01134777069092, 816.8721876144409], s: 0.004 };
const muToSk = (x, y, z) => [
  x * (SB.s / SC.s) + (SC.c[0] - SB.c[0]) * SB.s,
  y * (SB.s / SC.s) + (SC.c[2] - SB.c[2]) * SB.s,
  z * (SB.s / SC.s) - (SC.c[1] - SB.c[1]) * SB.s,
];

function collect(doc, idOf) {
  const out = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const W = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), I = prim.getIndices();
      const pos = [], nor = [], v = [0, 0, 0], n = [0, 0, 0];
      for (let i = 0; i < P.getCount(); i++) {
        P.getElement(i, v); N.getElement(i, n);
        pos.push(W[0]*v[0]+W[4]*v[1]+W[8]*v[2]+W[12], W[1]*v[0]+W[5]*v[1]+W[9]*v[2]+W[13], W[2]*v[0]+W[6]*v[1]+W[10]*v[2]+W[14]);
        nor.push(n[0], n[1], n[2]); // node transforms are identity/uniform in these files; checked below
      }
      out.push({ id: idOf(node), pos, nor, idx: Array.from(I.getArray()) });
    }
    const s = node.getScale(), r = node.getRotation();
    if (Math.abs(s[0]-s[1]) > 1e-6 || Math.abs(s[1]-s[2]) > 1e-6 || Math.abs(r[3]) < 0.999999) throw new Error('non-trivial node transform: ' + node.getName());
  }
  return out;
}

const sk = await io.read(skPath), mu = await io.read(muPath);
const bones = collect(sk, (n) => n.getExtras().structureId || n.getName());
const muscles = collect(mu, (n) => n.getExtras().structureId || n.getName());

const doc = new Document(); const buf = doc.createBuffer();
const scene = doc.createScene('cos-huma');
doc.getRoot().getAsset().copyright = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan. Adapted by OrganUI and COS-HUMA (see ATTRIBUTION.md).';

function addMesh(name, extras, parts, mapPos = (x, y, z) => [x, y, z], inflate = 0) {
  const pos = [], nor = [], idx = []; let base = 0;
  for (const p of parts) {
    for (let i = 0; i < p.pos.length; i += 3) {
      const [x, y, z] = mapPos(p.pos[i], p.pos[i + 1], p.pos[i + 2]);
      pos.push(x + p.nor[i] * inflate, y + p.nor[i + 1] * inflate, z + p.nor[i + 2] * inflate);
      nor.push(p.nor[i], p.nor[i + 1], p.nor[i + 2]);
    }
    for (const k of p.idx) idx.push(k + base);
    base += p.pos.length / 3;
  }
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(base > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)).setBuffer(buf));
  const mesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(mesh).setExtras(extras);
  scene.addChild(node);
  return { tris: idx.length / 3 };
}

// 1. textbook groups
const groups = new Map();
for (const b of bones) { const k = keyOf(b.id); const g = `${k}_${SINGLE.has(k) ? 'C' : sideOf0(b.id)}`; (groups.get(g) || groups.set(g, []).get(g)).push(b); }
const report = { groups: {}, unmapped: [] };
for (const [g, parts] of [...groups].sort()) {
  const [key, side] = g.split('_');
  const r = addMesh(g, { key, side, parts: parts.map((p) => p.id) }, parts);
  report.groups[g] = { parts: parts.length, tris: r.tris };
  if (key === 'altres') report.unmapped.push(...parts.map((p) => p.id));
}
// 2. body shell from inflated muscles (~11 mm), in skeleton frame
const INFLATE_C = 0.045 / 1; // muscle display units before scaling (0.045 * 0.625 * 400 mm/unit ≈ 11 mm)
const shellDoc = addMesh('shell', { role: 'shell' }, muscles, (x, y, z) => muToSk(x, y, z), 0);
// inflate in skeleton units after mapping: redo with mapped normals scale (uniform scale keeps normals)
const shellNode = scene.listChildren().find((n) => n.getName() === 'shell');
{
  const prim = shellNode.getMesh().listPrimitives()[0];
  const P = prim.getAttribute('POSITION').getArray(), N = prim.getAttribute('NORMAL').getArray();
  const d = INFLATE_C * (SB.s / SC.s);
  for (let i = 0; i < P.length; i++) P[i] += N[i] * d;
}
await doc.transform(dedup(), weld({ tolerance: 0.0001 }));
// bones: light simplification, max deviation ~0.4 mm (0.001 units); shell: strong
for (const n of scene.listChildren()) if (n !== shellNode) simplifyPrimitive(n.getMesh().listPrimitives()[0], { simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.001 });
simplifyPrimitive(shellNode.getMesh().listPrimitives()[0], { simplifier: MeshoptSimplifier, ratio: 0.12, error: 0.004 });
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10 }), prune());
await io.write(outPath, doc);
let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
report.shellTris = doc.getRoot().listMeshes().find((m) => m.getName() === 'shell').listPrimitives()[0].getIndices().getCount() / 3;
report.meshes = doc.getRoot().listMeshes().length; report.totalTris = tris; report.bytes = fs.statSync(outPath).size;
fs.writeFileSync(outPath.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ meshes: report.meshes, totalTris: tris, shellTris: report.shellTris, bytes: report.bytes, unmapped: report.unmapped }));
