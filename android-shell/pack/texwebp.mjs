// option B: JPEG textures inside a GLB -> WebP q90 (EXT_texture_webp). Geometry untouched; the existing
// meshopt compression is kept (same encoder method as the input). usage: node texwebp.mjs in.glb out.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { execFileSync } from 'child_process';
import fs from 'fs';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [inp, out] = process.argv.slice(2);
const doc = await io.read(inp);
let n = 0, before = 0, after = 0;
for (const t of doc.getRoot().listTextures()) {
  if (t.getMimeType() !== 'image/jpeg') continue;
  const img = t.getImage(); const tj = `/tmp/tw_${process.pid}.jpg`, tw = `/tmp/tw_${process.pid}.webp`;
  fs.writeFileSync(tj, img); execFileSync('cwebp', ['-quiet', '-q', '90', '-m', '6', '-sharp_yuv', '-mt', tj, '-o', tw]);
  const w = fs.readFileSync(tw);
  if (w.length < img.length) { t.setImage(new Uint8Array(w)).setMimeType('image/webp'); if (t.getURI()) t.setURI(t.getURI().replace(/\.jpe?g$/i, '.webp')); n++; before += img.length; after += w.length; }
}
if (n) doc.createExtension(EXTTextureWebP).setRequired(true);
const mo = doc.getRoot().listExtensionsUsed().find(e => e.extensionName === 'EXT_meshopt_compression');
if (mo) mo.setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(out, doc);
console.log(JSON.stringify({ file: inp, textures: n, tex_in: before, tex_out: after, in: fs.statSync(inp).size, out: fs.statSync(out).size }));
