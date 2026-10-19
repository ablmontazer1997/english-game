// step 2a: lossless EXT_meshopt_compression (no reorder, no weld, no quantize) for GLBs that are not meshopt yet.
// usage: node glbpack.mjs <in.glb> <out.glb>   -> prints JSON {before, after, same}
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
export function stats(doc) {
  const r = doc.getRoot(); const s = { meshes: [], skins: [], anims: r.listAnimations().length, nodes: r.listNodes().map(n => n.getName()).join('|').length, materials: r.listMaterials().length, textures: r.listTextures().length };
  for (const m of r.listMeshes()) s.meshes.push(m.getName() + ':' + m.listPrimitives().map(p => [p.getAttribute('POSITION')?.getCount(), p.listSemantics().sort().join(','), p.listTargets().length, (p.getIndices()?.getCount() ?? 0)].join('/')).join(';'));
  for (const k of r.listSkins()) s.skins.push(k.listJoints().length);
  return s;
}
const [inp, out] = process.argv.slice(2);
const doc = await io.read(inp);
const before = stats(doc);
const used = doc.getRoot().listExtensionsUsed().map(e => e.extensionName);
if (!used.includes('EXT_meshopt_compression')) {
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
}
await io.write(out, doc);
const doc2 = await io.read(out); const after = stats(doc2);
// lossless check: every primitive attribute, morph target and index array equal, element by element
const orig = await io.read(inp); let diffs = 0;
const eq = (a, b) => { if (!a && !b) return true; if (!a || !b) return false; const x = a.getArray(), y = b.getArray(); if (x.length !== y.length || x.constructor !== y.constructor) return false; for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && !(Number.isNaN(x[i]) && Number.isNaN(y[i]))) return false; return true; };
const M1 = orig.getRoot().listMeshes(), M2 = doc2.getRoot().listMeshes();
M1.forEach((m, i) => m.listPrimitives().forEach((p, j) => { const q = M2[i].listPrimitives()[j];
  for (const sem of p.listSemantics()) if (!eq(p.getAttribute(sem), q.getAttribute(sem))) diffs++;
  // the meshopt index codec may rotate a triangle's corners (a,b,c -> b,c,a): same triangles, same order, same winding
  { const x = p.getIndices()?.getArray(), y = q.getIndices()?.getArray();
    if (!!x !== !!y || (x && x.length !== y.length)) diffs++;
    else if (x) for (let t = 0; t < x.length; t += 3) { const a = x[t], b = x[t+1], c = x[t+2], d = y[t], e = y[t+1], f = y[t+2];
      if (!((a===d&&b===e&&c===f)||(a===e&&b===f&&c===d)||(a===f&&b===d&&c===e))) { diffs++; break; } } }
  p.listTargets().forEach((t, k) => { for (const sem of t.listSemantics()) if (!eq(t.getAttribute(sem), q.listTargets()[k].getAttribute(sem))) diffs++; }); }));
orig.getRoot().listSkins().forEach((k, i) => { if (!eq(k.getInverseBindMatrices(), doc2.getRoot().listSkins()[i].getInverseBindMatrices())) diffs++; });
const same = JSON.stringify(before) === JSON.stringify(after) && diffs === 0;
console.log(JSON.stringify({ diffs, morphs: before.meshes.join(';').split('/').length, skins: before.skins, file: inp, in: fs.statSync(inp).size, out: fs.statSync(out).size, already: used.includes('EXT_meshopt_compression'), same, before: same ? undefined : before, after: same ? undefined : after }));
