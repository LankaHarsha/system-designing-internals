# 03: The 3D asset pipeline

> Consistency beats polygon count: a scene looks "premium" when every object shares one style, scale and light, not when any single model is detailed.

## 0. Why the people look odd today

The in-game people are a capsule, a sphere and a hair cap. Next to KayKit's chunky, bevelled furniture they read as placeholders: different shape language, no faces or hands, no real walk cycle (just a bob and a sway). The fix is one rigged character family whose style matches the props.

## 1. glTF in one minute

glTF is "the JPEG of 3D": a JSON file describing meshes, materials, skeletons and animations.

| File | Holds |
| --- | --- |
| `.gltf` | JSON: scene tree, materials, pointers into the buffers |
| `.bin` | Raw vertex data, indices, animation keyframes |
| `.png` | Textures. KayKit uses one small **gradient atlas** for a whole pack: each face samples a colour strip, which is why everything matches |
| `.glb` | All of the above packed into one binary file |

## 2. Units and scale

glTF says 1 unit = 1 metre, but packs ignore that. We measured the KayKit models from their accessor bounds: the counter is 1.0 tall and the couch 3.0 wide, so about **1.3 units per real metre**. A 1.7 m person should therefore stand about 2.2 units tall. Measure first, then set one `scale` per pack in the manifest; never eyeball each model.

## 3. One load, many copies

`useGLTF(url)` loads a file once and caches it. Placing it twice needs a copy:

| Model kind | Copy with | Why |
| --- | --- | --- |
| Static prop | `scene.clone(true)` | Meshes can share geometry and materials |
| Rigged character | `SkeletonUtils.clone(scene)` | A plain clone keeps the bones of the *original*, so every copy would animate as one puppet |

## 4. Animation, the short version

A rigged model has a skeleton; clips are keyframes for its bones. `useAnimations(clips, ref)` builds an `AnimationMixer`, and we pick clips by name pattern (`/idle/i`, `/walk/i`) because every pack names them differently. Crossfading (`fadeIn(0.2)`) hides the switch between clips.

## 5. Licences are part of the pipeline

CC0 means no conditions at all. Other "free" licences can forbid redistributing the raw files, which matters for a public repo. So `ASSETS.md` records every pack, its licence and source, and each pack's licence file ships beside its files.

## 6. Gotcha: what the sandbox can download

The cloud sandbox started out reaching only GitHub and npm. KayKit publishes official GitHub repos, so `scripts/import-kaykit.sh` clones only the files we need with a **sparse checkout**: `--filter=blob:none` skips downloading file contents, and `sparse-checkout set` fetches just the listed paths. Kenney and Quaternius host their packs on their own sites (Quaternius on Google Drive), so `scripts/import-characters.sh` only works once the environment allows full network access.

## 7. Read the file before you trust the pack

Three things only showed up by inspecting the downloads:

| Surprise | Found by | Fix |
| --- | --- | --- |
| Kenney's `.glb` files still load `Textures/colormap.png` from beside them | Reading the GLB's JSON chunk (`images[].uri`) | Ship the texture; the unit test now checks every external `uri` |
| Quaternius clip names include `Idle_Gun`, `Idle_Sword`… so `/idle/i` could pick the wrong one | Listing `animations[].name` | Anchor the patterns in the manifest: `^idle$`, `^walk$` |
| The Suit model holds a pistol | Looking at the lab screenshot | `slim-character.mjs` disposes nodes named pistol/gun/sword |

The Quaternius files were 3 MB each because glTF with embedded buffers stores binary as base64 (+33%) and carries 24 clips. Converting to `.glb` and keeping 6 clips brought them to about 1.2 MB; resampling keyframes barely helped, so the mesh, not the animation, is the bulk.

## 8. Making a crowd affordable

The game can show 140 people. A Quaternius outfit arrives as 4–5 meshes and ~10 materials, so a full hotel would be ~1,400 draw calls (double with shadows). `slim-character.mjs` fixes that before the file ever reaches the browser:

| Step | Why |
| --- | --- |
| Bake each material's flat colour into a `COLOR_0` vertex attribute | Lets every part share one material |
| Concatenate all parts into one primitive (offset the indices) | Parts already share one skin, so one skinned mesh = one draw call |
| Keep 5 clips, drop channels that hold a bone at rest | Animation JSON was half the file |
| `meshopt()` (quantize + compress) | drei's `useGLTF` decodes it; ~230 KB per outfit |

In the game, `People.jsx` keeps a pool: one `SkeletonUtils.clone` and one `AnimationMixer` per visible agent, sharing geometry and material. It picks idle / walk / run / work from the agent's state and sets the clip's `timeScale` from the agent's speed so feet don't slide.

**Bugs worth remembering:** (1) disposing an `Animation` in gltf-transform leaves its samplers alive, and they keep every dropped clip's keyframes; dispose the samplers too. (2) `accessor.getElement(i, arr)` fills the first N slots of `arr` but never shortens it, so reusing one scratch array across VEC3 and VEC4 attributes silently pushed a fourth number into every position: the characters rendered as exploded spikes. When a pipeline has several steps, test each step **alone**: three variants that each disabled one step all looked broken, because each still had the faulty one.
