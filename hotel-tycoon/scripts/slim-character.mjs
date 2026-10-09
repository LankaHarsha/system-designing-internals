// node slim-character.mjs in.gltf out.glb
// Turns a Quaternius character into something a crowd of 100+ can afford:
// - optionally recolours materials by name (linear RGB), e.g. to turn a builder into hotel staff
// - drops props (the Suit model holds a pistol) and every clip a hotel doesn't need
// - bakes each flat-colour material into vertex colours and merges all body parts
//   into one primitive with one material: 1 draw call per person instead of ~10
// - simplifies the mesh and meshopt-compresses the file (three's GLTFLoader via drei decodes it)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld, simplify, resample, meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'

const KEEP = new Set(['Idle', 'Walk', 'Run', 'Interact', 'Wave'])
const RATIO = 0.5 // keep about half the triangles; at game camera distance the loss is invisible
const [, , inp, out, recolor = '{}'] = process.argv
const RECOLOR = JSON.parse(recolor)
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(inp)
const root = doc.getRoot()

for (const n of root.listNodes()) if (/pistol|gun|sword/i.test(n.getName())) n.dispose()
// dispose samplers explicitly: a disposed Animation leaves them alive, still holding their
// keyframe accessors, so prune() keeps every dropped clip's data
const dropAnimation = (a) => { for (const s of a.listSamplers()) s.dispose(); for (const c of a.listChannels()) c.dispose(); a.dispose() }
for (const a of root.listAnimations()) if (!KEEP.has(a.getName())) dropAnimation(a)
// drop channels that hold a bone at its rest pose the whole clip (most scale tracks): they
// cost a pair of accessors each in the JSON and do nothing
const REST = { translation: 'getTranslation', rotation: 'getRotation', scale: 'getScale' }
for (const anim of root.listAnimations()) {
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode()
    const out = ch.getSampler().getOutput()
    const rest = node[REST[ch.getTargetPath()]]?.()
    if (!rest) continue
    let still = true
    const v = []
    for (let i = 0; i < out.getCount() && still; i++) still = out.getElement(i, v).every((x, k) => Math.abs(x - rest[k]) < 1e-4)
    if (still) { ch.getSampler().dispose(); ch.dispose() }
  }
}

// bake material colour into COLOR_0 (times any existing vertex colour), then merge every
// body part into one primitive: all parts share one skin and have identity transforms
const SEMANTICS = { POSITION: 'VEC3', NORMAL: 'VEC3', COLOR_0: 'VEC3', JOINTS_0: 'VEC4', WEIGHTS_0: 'VEC4' }
const bodyNodes = root.listNodes().filter((n) => n.getMesh() && n.getSkin())
const target = bodyNodes[0]
const data = Object.fromEntries(Object.keys(SEMANTICS).map((k) => [k, []]))
const index = []
let base = 0
for (const node of bodyNodes) {
  for (const prim of node.getMesh().listPrimitives()) {
    const f = RECOLOR[prim.getMaterial()?.getName()] ?? prim.getMaterial()?.getBaseColorFactor() ?? [1, 1, 1, 1]
    const n = prim.getAttribute('POSITION').getCount()
    for (let i = 0; i < n; i++) {
      // fresh arrays: getElement() fills the first N slots but never shortens a reused one
      for (const s of ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']) data[s].push(...prim.getAttribute(s).getElement(i, []))
      const old = prim.getAttribute('COLOR_0')?.getElement(i, []) ?? [1, 1, 1]
      data.COLOR_0.push(f[0] * old[0], f[1] * old[1], f[2] * old[2])
    }
    const idx = prim.getIndices()
    for (let i = 0; i < idx.getCount(); i++) index.push(base + idx.getScalar(i))
    base += n
  }
}
const buffer = root.listBuffers()[0]
const merged = doc.createPrimitive()
  .setMaterial(doc.createMaterial('Character').setRoughnessFactor(0.75).setMetallicFactor(0))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(index)).setBuffer(buffer))
for (const [s, type] of Object.entries(SEMANTICS)) {
  const Arr = s === 'JOINTS_0' ? Uint16Array : Float32Array
  merged.setAttribute(s, doc.createAccessor().setType(type).setArray(new Arr(data[s])).setBuffer(buffer))
}
target.setMesh(doc.createMesh('Body').addPrimitive(merged))
for (const node of bodyNodes) if (node !== target) node.dispose()
target.setName('Body')

await doc.transform(
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.01 }),
  resample(),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
)
await io.write(out, doc)
const prims = target.getMesh().listPrimitives()
console.log(out, `${prims.length} prim, ${prims[0].getAttribute('POSITION').getCount()} verts,`, root.listAnimations().map((a) => a.getName()).join(','))
