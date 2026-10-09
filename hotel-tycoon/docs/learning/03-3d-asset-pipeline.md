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

The cloud sandbox only reaches GitHub and npm. KayKit publishes official GitHub repos, so `scripts/import-kaykit.sh` clones only the files we need with a **sparse checkout**: `--filter=blob:none` skips downloading file contents, and `sparse-checkout set` fetches just the listed paths. Kenney and Quaternius host their packs on their own sites, which the sandbox blocks, so those need an allowed domain or a manual download.
