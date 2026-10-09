// node slim-character.mjs in.gltf out.glb: keep only hotel-relevant clips, prune, write binary GLB
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, dedup, weld, resample } from '@gltf-transform/functions'
const KEEP = new Set(['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Interact', 'Wave'])
const [, , inp, out] = process.argv
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(inp)
// props that don't belong in a hotel (the Suit model holds a pistol)
for (const n of doc.getRoot().listNodes()) if (/pistol|gun|sword/i.test(n.getName())) n.dispose()
for (const a of doc.getRoot().listAnimations()) if (!KEEP.has(a.getName())) a.dispose()
await doc.transform(dedup(), weld(), resample(), prune())
await io.write(out, doc)
console.log(out, doc.getRoot().listAnimations().map((a) => a.getName()).join(','))
