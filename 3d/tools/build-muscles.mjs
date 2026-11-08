// Build cos-huma-muscles.glb from OrganUI muscles.glb (BodyParts3D 3.0, CC BY-SA 2.1 JP).
// Usage: node build-muscles.mjs <muscles.glb> <out.glb>
// - the 15 muscles labelled on textbook p.27 become one mesh per side (key_L / key_R, or key_C for midline muscles)
// - every other muscle is merged into 'altres' (shown lighter, never labelled)
// - geometry is put into the skeleton's display frame (same transform as build-skeleton.mjs), simplified ≤0.4 mm, quantized
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplifyPrimitive, quantize, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';

const [muPath, outPath] = process.argv.slice(2);
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// textbook p.27 label -> OrganUI structureIds
const MAP = {
  orbic: ['orbicularis-oculi'], masseter: ['masseter'], ecm: ['sternocleidomastoid'], deltoide: ['deltoid'], pectoral: ['pectoralis-major'],
  abdominal: ['rectus-abdominis', 'external-oblique', 'internal-oblique', 'transversus-abdominis'], dorsal: ['latissimus-dorsi'], trapezi: ['trapezius'], gluti: ['gluteus-maximus'],
  biceps: ['biceps-brachii'], triceps: ['triceps-brachii'], quadriceps: ['rectus-femoris', 'vastus-lateralis', 'vastus-medialis', 'vastus-intermedius'],
  bfem: ['biceps-femoris'], tibial: ['tibialis-anterior'], besso: ['gastrocnemius'],
};
const MIDLINE = new Set(['trapezi', 'abdominal']); // one piece across both sides
const keyOf = (id) => Object.keys(MAP).find((k) => MAP[k].includes(id)) || 'altresm';

const SB = { c: [-0.667999267578125, -109.74665069580078, 817.0244853496552], s: 0.0025 };
const SC = { c: [-0.6569976806640625, -97.01134777069092, 816.8721876144409], s: 0.004 };
const toSk = (x, y, z) => [x * (SB.s / SC.s) + (SC.c[0] - SB.c[0]) * SB.s, y * (SB.s / SC.s) + (SC.c[2] - SB.c[2]) * SB.s, z * (SB.s / SC.s) - (SC.c[1] - SB.c[1]) * SB.s];

const src = await io.read(muPath);
const doc = new Document(); const buf = doc.createBuffer(); const scene = doc.createScene('cos-huma-muscles');
doc.getRoot().getAsset().copyright = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan. Adapted by OrganUI and COS-HUMA (see ATTRIBUTION.txt).';
const groups = new Map(); // name -> {pos:[], nor:[], idx:[], ids:Set}
const G = (name) => groups.get(name) || groups.set(name, { pos: [], nor: [], idx: [], ids: new Set() }).get(name);

for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const id = node.getExtras().structureId || node.getName(); const key = keyOf(id);
  const W = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), I = prim.getIndices().getArray();
    const wp = [], wn = [], v = [0, 0, 0], n = [0, 0, 0];
    for (let i = 0; i < P.getCount(); i++) {
      P.getElement(i, v); N.getElement(i, n);
      wp.push(toSk(W[0]*v[0]+W[4]*v[1]+W[8]*v[2]+W[12], W[1]*v[0]+W[5]*v[1]+W[9]*v[2]+W[13], W[2]*v[0]+W[6]*v[1]+W[10]*v[2]+W[14])); const rx = W[0]*n[0]+W[4]*n[1]+W[8]*n[2], ry = W[1]*n[0]+W[5]*n[1]+W[9]*n[2], rz = W[2]*n[0]+W[6]*n[1]+W[10]*n[2]; const L = Math.hypot(rx, ry, rz) || 1; wn.push([rx / L, rz / L, -ry / L]); // same axis swap as positions
    }
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      const cx = (wp[a][0] + wp[b][0] + wp[c][0]) / 3;
      const side = key === 'altresm' || MIDLINE.has(key) ? 'C' : cx > 0 ? 'L' : 'R'; // +x = body's left
      const g = G(`${key}_${side}`); g.ids.add(id);
      for (const k of [a, b, c]) { g.idx.push(g.pos.length / 3); g.pos.push(...wp[k]); g.nor.push(...wn[k]); }
    }
  }
}
const report = { groups: {} };
for (const [name, g] of [...groups].sort()) {
  const [key, side] = name.split('_');
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.pos)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.nor)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(g.idx)).setBuffer(buf));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)).setExtras({ key, side, parts: [...g.ids] }));
  report.groups[name] = { structures: g.ids.size };
}
await doc.transform(dedup(), weld({ tolerance: 0.0001 }));
for (const n of scene.listChildren()) simplifyPrimitive(n.getMesh().listPrimitives()[0], { simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.001 });
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10 }), prune());
await io.write(outPath, doc);
let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
report.meshes = doc.getRoot().listMeshes().length; report.totalTris = tris; report.bytes = fs.statSync(outPath).size;
fs.writeFileSync(outPath.replace(/\.glb$/, '.report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ meshes: report.meshes, tris, bytes: report.bytes, groups: Object.keys(report.groups) }));
